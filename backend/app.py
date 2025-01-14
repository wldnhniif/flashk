from flask import Flask, request, jsonify, send_file, send_from_directory, after_this_request
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity, verify_jwt_in_request
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import timedelta, datetime, timezone
from functools import wraps
from dotenv import load_dotenv
import os
from werkzeug.utils import secure_filename
import uuid
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import json
import re
from flask_talisman import Talisman
from supabase import create_client
import time
import sys

# Load environment variables
load_dotenv()

# Validate required environment variables
required_env_vars = [
    'SUPABASE_URL',
    'SUPABASE_KEY',
    'JWT_SECRET_KEY'
]

missing_vars = [var for var in required_env_vars if not os.getenv(var)]
if missing_vars:
    print(f"Error: Missing required environment variables: {', '.join(missing_vars)}")
    sys.exit(1)

# Initialize Flask app
app = Flask(__name__)

# Configure CORS with cookie support
CORS(app, resources={
    r"/*": {  # Allow CORS for all routes
        "origins": [
            "http://localhost:3000",
            "https://kasirkuy-one.vercel.app",
            "https://kasirkuy-git-main-wildan-hanifs-projects.vercel.app",
            "https://kasirkuy-3xu6aq1qr-wildan-hanifs-projects.vercel.app",
            "https://kasirkuy-fkhdlawsv-wildan-hanifs-projects.vercel.app",
            "https://kasirkuy.vercel.app",
            "https://sticky-marie-ann-kasirkuy-f46a83f8.koyeb.app"
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
        "expose_headers": ["Content-Range", "X-Content-Range"],
        "supports_credentials": True,
        "allow_credentials": True,
        "max_age": 3600
    }
})

# Add CORS headers to all responses
@app.after_request
def add_cors_headers(response):
    origin = request.headers.get('Origin')
    if origin in [
        "http://localhost:3000",
        "https://kasirkuy-one.vercel.app",
        "https://kasirkuy-git-main-wildan-hanifs-projects.vercel.app",
        "https://kasirkuy-3xu6aq1qr-wildan-hanifs-projects.vercel.app",
        "https://kasirkuy-fkhdlawsv-wildan-hanifs-projects.vercel.app",
        "https://kasirkuy.vercel.app",
        "https://sticky-marie-ann-kasirkuy-f46a83f8.koyeb.app"
    ]:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Accept, Origin, X-Requested-With'
        response.headers['Access-Control-Expose-Headers'] = 'Content-Range, X-Content-Range'
        
        # Handle OPTIONS request
        if request.method == 'OPTIONS':
            response.headers['Access-Control-Max-Age'] = '3600'
            response.status_code = 204
            return response
            
    return response

# Initialize Supabase client
try:
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_KEY')
    
    if not supabase_url or not supabase_key:
        print("Error: Supabase credentials are missing")
        print(f"URL: {supabase_url}")
        print(f"Key exists: {'Yes' if supabase_key else 'No'}")
        sys.exit(1)
        
    print(f"Initializing Supabase client with URL: {supabase_url}")
    supabase = create_client(supabase_url=supabase_url, supabase_key=supabase_key)
    
    # Test the connection
    print("Testing Supabase connection...")
    test_response = supabase.from_('users').select("count").execute()
    print(f"Connection test successful: {test_response}")
    
except Exception as e:
    print(f"Error initializing Supabase client: {str(e)}")
    print(f"Error type: {type(e)}")
    print(f"Error details: {e.__dict__ if hasattr(e, '__dict__') else {}}")
    sys.exit(1)

# Enable security headers with Talisman
talisman = Talisman(
    app,
    force_https=True,  # Set to True for production
    session_cookie_secure=True,
    session_cookie_http_only=True,
    strict_transport_security=True,
    content_security_policy={
        'default-src': "'self' https://*.vercel.app https://*.koyeb.app",
        'img-src': "'self' data: blob: https://*.vercel.app https://*.koyeb.app",
        'script-src': "'self' https://*.vercel.app",
        'style-src': "'self' 'unsafe-inline' https://*.vercel.app",
        'connect-src': "'self' https://*.supabase.co https://*.vercel.app https://*.koyeb.app"
    }
)

# Security Constants
FAILED_LOGIN_ATTEMPTS = {}
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_TIME = 15 * 60  # 15 minutes in seconds
JWT_ACCESS_TOKEN_EXPIRES = int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 3600))  # 1 hour default
PASSWORD_HASH_METHOD = 'pbkdf2:sha256:600000'  # Strong password hashing
AUTH_COOKIE_NAME = 'kasirkuy_auth_token'  # Specific cookie name for our application

# Configure upload folder
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

# Create upload folder if it doesn't exist
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
    print(f"Created upload folder at: {UPLOAD_FOLDER}")

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
print(f"Upload folder configured at: {UPLOAD_FOLDER}")

# Configure JWT
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=7)  # Increase token expiry to 7 days
app.config['JWT_TOKEN_LOCATION'] = ['headers', 'cookies']
app.config['JWT_COOKIE_SECURE'] = True
app.config['JWT_COOKIE_SAMESITE'] = 'None'
app.config['JWT_COOKIE_DOMAIN'] = None  # Let the browser set the domain
app.config['JWT_COOKIE_CSRF_PROTECT'] = False  # Disable CSRF for simplicity

# Initialize JWT
jwt = JWTManager(app)

# JWT token blocklist
jwt_blocklist = set()

@jwt.token_in_blocklist_loader
def check_if_token_in_blocklist(jwt_header, jwt_payload):
    jti = jwt_payload["jti"]
    return jti in jwt_blocklist

@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    return jsonify({
        'message': 'The token has expired',
        'error': 'token_expired'
    }), 401

@jwt.invalid_token_loader
def invalid_token_callback(error):
    return jsonify({
        'message': 'Signature verification failed',
        'error': 'invalid_token'
    }), 401

@jwt.unauthorized_loader
def missing_token_callback(error):
    return jsonify({
        'message': 'Request does not contain an access token',
        'error': 'authorization_required'
    }), 401

@jwt.needs_fresh_token_loader
def token_not_fresh_callback(jwt_header, jwt_payload):
    return jsonify({
        'message': 'The token is not fresh',
        'error': 'fresh_token_required'
    }), 401

@jwt.revoked_token_loader
def revoked_token_callback(jwt_header, jwt_payload):
    return jsonify({
        'message': 'The token has been revoked',
        'error': 'token_revoked'
    }), 401

# Initialize rate limiter with Redis storage
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["100 per day", "20 per hour"],
    storage_uri="memory://"  # For development. In production, use: "redis://localhost:6379"
)

# Add decorator for strict rate limiting on auth endpoints
def strict_rate_limit():
    return limiter.limit(
        "3 per minute, 10 per hour, 20 per day",
        error_message="Too many attempts. Please try again later."
    )

# Add decorator for moderate rate limiting on protected endpoints
def moderate_rate_limit():
    return limiter.limit(
        "30 per minute, 300 per hour",
        error_message="Request limit exceeded. Please try again later."
    )

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Helper functions for database operations
def create_user(username, password, is_admin=False):
    hashed_password = generate_password_hash(password, method=PASSWORD_HASH_METHOD)
    data = {
        'username': username,
        'password': hashed_password,
        'is_admin': is_admin,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    return supabase.from_('users').insert(data).execute()

def get_user_by_username(username):
    return supabase.from_('users').select('*').eq('username', username).execute()

def get_user_by_id(user_id):
    return supabase.from_('users').select('*').eq('id', user_id).execute()

def create_product(name, price, image_url, user_id):
    data = {
        'name': name,
        'price': price,
        'image_url': image_url,
        'user_id': user_id
    }
    return supabase.from_('products').insert(data).execute()

def get_products_by_user(user_id):
    return supabase.from_('products').select('*').eq('user_id', user_id).execute()

def update_product(product_id, data):
    return supabase.from_('products').update(data).eq('id', product_id).execute()

def delete_product(product_id):
    """Delete a product and its associated image"""
    try:
        print(f"Attempting to delete product with ID: {product_id}")
        # First get the product to check if it exists and has an image
        product = supabase.from_('products').select('*').eq('id', product_id).execute()
        print(f"Found product: {product.data if product.data else 'None'}")
        
        if not product.data:
            print("Product not found")
            return None
            
        # Delete the product
        response = supabase.from_('products').delete().eq('id', product_id).execute()
        print(f"Delete response: {response.data if response.data else 'None'}")
        
        # If deletion was successful and product had an image, check if we should clean it up
        if response.data and product.data[0].get('image_url'):
            try:
                image_url = product.data[0]['image_url']
                filename = image_url.split('/')[-1]
                
                # Check if any other products use this image
                other_products = supabase.from_('products').select('id').neq('id', product_id).ilike('image_url', f'%{filename}%').execute()
                
                # Only delete the image if no other products are using it
                if not other_products.data:
                    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    if os.path.exists(file_path):
                        os.remove(file_path)
                        print(f"Deleted image file: {filename}")
                else:
                    print(f"Image {filename} is still in use by other products, keeping file")
            except Exception as e:
                print(f"Error handling image file: {str(e)}")
        
        return response
    except Exception as e:
        print(f"Error in delete_product: {str(e)}")
        return None

# Admin middleware
def admin_required():
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            response = get_user_by_id(user_id)
            user = response.data[0] if response.data else None
            if not user or not user['is_admin']:
                return jsonify({"error": "Admin access required"}), 403
            return fn(*args, **kwargs)
        return decorator
    return wrapper

def get_device_fingerprint():
    """Generate a device fingerprint based on headers and IP"""
    user_agent = request.headers.get('User-Agent', '')
    ip_address = request.remote_addr
    # Combine user agent and IP to create a unique device ID
    device_id = f"{ip_address}_{user_agent}"
    return device_id, ip_address

# Password validation function
def is_password_valid(password):
    """
    Password must:
    - Be at least 8 characters long
    - Contain at least one uppercase letter
    - Contain at least one lowercase letter
    - Contain at least one number
    - Contain at least one special character
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"
    
    if not re.search(r"\d", password):
        return False, "Password must contain at least one number"
    
    if not re.search(r"[ !@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]", password):
        return False, "Password must contain at least one special character"
    
    return True, "Password is valid"

# Routes
@app.route('/api/register', methods=['POST'])
@strict_rate_limit()
def register():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'message': 'No data provided'}), 400
            
        username = data.get('username')
        password = data.get('password')
        
        # Validate input
        if not username or not password:
            return jsonify({'message': 'Username and password are required'}), 400
            
        # Validate username format
        if not re.match(r'^[a-zA-Z0-9_]{3,20}$', username):
            return jsonify({'message': 'Username must be 3-20 characters long and contain only letters, numbers, and underscores'}), 400
            
        # Validate password strength
        is_valid, message = is_password_valid(password)
        if not is_valid:
            return jsonify({'message': message}), 400
            
        # Check if username already exists
        existing_user = get_user_by_username(username)
        if existing_user.data:
            return jsonify({'message': 'Username already exists'}), 409
            
        # Create user
        result = create_user(username, password)
        if not result.data:
            return jsonify({'message': 'Failed to create user'}), 500
            
        return jsonify({'message': 'User registered successfully'}), 201
            
    except Exception as e:
        print(f"Registration error: {str(e)}")
        return jsonify({'message': 'An error occurred during registration'}), 500

@app.route('/api/login', methods=['POST'])
@strict_rate_limit()
def login():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'message': 'No data provided'}), 400
            
        username = data.get('username')
        password = data.get('password')
        
        # Validate input
        if not username or not password:
            return jsonify({'message': 'Username and password are required'}), 400
            
        # Get user
        result = get_user_by_username(username)
        if not result.data:
            return jsonify({'message': 'Invalid username or password'}), 401
            
        user = result.data[0]
        
        # Verify password
        if not verify_password(password, user['password']):
            return jsonify({'message': 'Invalid username or password'}), 401
            
        # Create access token with additional claims
        access_token = create_access_token(
            identity=user['id'],
            additional_claims={
                'username': user['username'],
                'is_admin': user['is_admin']
            }
        )
        
        # Set cookie and prepare response
        response = jsonify({
            'message': 'Login successful',
            'token': access_token,
            'user': {
                'id': user['id'],
                'username': user['username'],
                'is_admin': user['is_admin']
            }
        })
        
        # Set cookie with proper settings
        response.set_cookie(
            AUTH_COOKIE_NAME,
            value=access_token,
            max_age=60 * 60 * 24 * 7,  # 7 days
            secure=True,
            httponly=True,
            samesite='None',
            path='/'
        )
        
        return response
            
    except Exception as e:
        print(f"Login error: {str(e)}")
        return jsonify({'message': 'An error occurred during login'}), 500

def verify_password(password, stored_password_hash):
    """Verify a password against a stored hash"""
    try:
        return check_password_hash(stored_password_hash, password)
    except Exception as e:
        print(f"Password verification error: {str(e)}")
        return False

def record_failed_login(ip_address):
    """Record failed login attempt and update lockout status"""
    current_time = time.time()
    if ip_address in FAILED_LOGIN_ATTEMPTS:
        attempts, _ = FAILED_LOGIN_ATTEMPTS[ip_address]
        FAILED_LOGIN_ATTEMPTS[ip_address] = (attempts + 1, current_time)
    else:
        FAILED_LOGIN_ATTEMPTS[ip_address] = (1, current_time)

@app.route('/api/products', methods=['GET'])
@jwt_required()
@moderate_rate_limit()
def get_products():
    try:
        user_id = get_jwt_identity()
        # Get products with user information
        response = supabase.from_('products').select('*, users(username)').eq('user_id', user_id).execute()
        
        # Format the response
        products = []
        for product in response.data:
            user = product.pop('users', {})
            products.append({
                **product,
                'user_name': user.get('username') if user else None
            })
            
        return jsonify({"products": products}), 200
    except Exception as e:
        print(f"Error getting products: {str(e)}")  # Debug log
        return jsonify({"error": str(e)}), 500

@app.route('/api/products', methods=['POST'])
@jwt_required()
@moderate_rate_limit()
def add_product():
    try:
        user_id = get_jwt_identity()
        print(f"Adding product for user_id: {user_id}")
        
        # Validate request data
        if not request.form:
            print("No form data received")
            return jsonify({"error": "No form data provided"}), 400
            
        data = request.form.to_dict()
        print(f"Received product data: {data}")
        
        if 'name' not in data or not data['name'].strip():
            return jsonify({"error": "Product name is required"}), 400
            
        if 'price' not in data:
            return jsonify({"error": "Product price is required"}), 400
        
        try:
            price = float(data['price'])
            if price < 0:
                return jsonify({"error": "Price cannot be negative"}), 400
        except ValueError:
            return jsonify({"error": "Invalid price format"}), 400
        
        # Handle image upload
        image_url = None
        if 'image' in request.files:
            file = request.files['image']
            print(f"Received image file: {file.filename if file else 'None'}")
            
            if file and file.filename:
                if not allowed_file(file.filename):
                    return jsonify({"error": "Invalid file type"}), 400
                    
                try:
                    filename = secure_filename(str(uuid.uuid4()) + '_' + file.filename)
                    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    file.save(file_path)
                    image_url = f"/api/uploads/{filename}"
                    print(f"Image saved successfully: {image_url}")
                except Exception as e:
                    print(f"Error saving image: {str(e)}")
                    return jsonify({"error": "Failed to save image"}), 500
        
        # Create product in database
        try:
            response = create_product(
                name=data['name'].strip(),
                price=price,
                image_url=image_url,
                user_id=user_id
            )
            print(f"Database response: {response.data if response.data else 'None'}")
            
            if not response.data:
                if image_url:  # Clean up the uploaded image if product creation fails
                    try:
                        filename = image_url.split('/')[-1]
                        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                        if os.path.exists(file_path):
                            os.remove(file_path)
                            print(f"Cleaned up image after failed product creation: {filename}")
                    except Exception as e:
                        print(f"Error cleaning up image: {str(e)}")
                return jsonify({"error": "Failed to create product in database"}), 500
            
            # Clean up unused images
            cleanup_old_images()
            
            return jsonify({
                "message": "Product added successfully",
                "product": response.data[0]
            }), 201
            
        except Exception as e:
            print(f"Database error: {str(e)}")
            if image_url:  # Clean up image if database operation fails
                try:
                    filename = image_url.split('/')[-1]
                    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    if os.path.exists(file_path):
                        os.remove(file_path)
                        print(f"Cleaned up image after database error: {filename}")
                except Exception as cleanup_error:
                    print(f"Error cleaning up image: {str(cleanup_error)}")
            return jsonify({"error": "Database error occurred"}), 500
            
    except Exception as e:
        print(f"Unexpected error in add_product: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/products/<int:product_id>', methods=['PUT'])
@jwt_required()
@moderate_rate_limit()
def update_product(product_id):
    try:
        user_id = get_jwt_identity()
        
        # Check if product exists and belongs to user
        product_response = supabase.from_('products').select('*').eq('id', product_id).eq('user_id', user_id).execute()
        if not product_response.data:
            return jsonify({"error": "Product not found or unauthorized"}), 404
        
        data = request.form.to_dict()
        update_data = {}
        
        if 'name' in data:
            update_data['name'] = data['name']
        
        if 'price' in data:
            try:
                price = float(data['price'])
                if price < 0:
                    return jsonify({"error": "Price cannot be negative"}), 400
                update_data['price'] = price
            except ValueError:
                return jsonify({"error": "Invalid price format"}), 400
        
        old_image_url = None
        if 'image' in request.files:
            file = request.files['image']
            if file and allowed_file(file.filename):
                # Store old image URL for cleanup
                old_image_url = product_response.data[0].get('image_url')
                
                # Save new image
                filename = secure_filename(str(uuid.uuid4()) + '_' + file.filename)
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(file_path)
                update_data['image_url'] = f"/api/uploads/{filename}"
        
        if update_data:
            response = supabase.from_('products').update(update_data).eq('id', product_id).execute()
            if not response.data:
                # If update fails, clean up the newly uploaded image
                if 'image_url' in update_data:
                    filename = update_data['image_url'].split('/')[-1]
                    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    if os.path.exists(file_path):
                        os.remove(file_path)
                return jsonify({"error": "Failed to update product"}), 500
            
            # If update succeeds and we uploaded a new image, clean up the old one
            if old_image_url:
                old_filename = old_image_url.split('/')[-1]
                old_path = os.path.join(app.config['UPLOAD_FOLDER'], old_filename)
                if os.path.exists(old_path):
                    os.remove(old_path)
            
            # Clean up any other unused images
            cleanup_old_images()
            
            return jsonify({
                "message": "Product updated successfully",
                "product": response.data[0]
            }), 200
        else:
            return jsonify({"message": "No changes to update"}), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/products/<string:product_id>', methods=['DELETE'])
@jwt_required()
@moderate_rate_limit()
def delete_user_product(product_id):
    try:
        print(f"Delete request for product ID: {product_id}")
        user_id = get_jwt_identity()
        print(f"User ID: {user_id}")
        
        # Check if product exists and belongs to user
        product_response = supabase.from_('products').select('*').eq('id', product_id).eq('user_id', user_id).execute()
        print(f"Product check response: {product_response.data if product_response.data else 'None'}")
        
        if not product_response.data:
            return jsonify({"error": "Product not found or unauthorized"}), 404
        
        # Delete product and handle image cleanup
        response = delete_product(product_id)
        print(f"Delete response: {response.data if response and response.data else 'None'}")
        
        if not response or not response.data:
            return jsonify({"error": "Failed to delete product"}), 500
        
        # Run general cleanup
        cleanup_old_images()
        
        return jsonify({"message": "Product deleted successfully"}), 200
        
    except Exception as e:
        print(f"Error deleting product: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/uploads/<filename>')
def uploaded_file(filename):
    try:
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        if not os.path.exists(file_path):
            return jsonify({"error": "File not found"}), 404

        response = send_file(file_path)
        # Add CORS headers
        response.headers.add('Access-Control-Allow-Origin', '*')
        
        # If this is a receipt file, delete it after sending
        if filename.startswith('receipt_'):
            # We need to use after_this_request to delete the file after it's sent
            @after_this_request
            def remove_file(response):
                try:
                    if os.path.exists(file_path):
                        os.remove(file_path)
                        print(f"Deleted receipt file after serving: {filename}")
                except Exception as e:
                    print(f"Error deleting receipt file {filename}: {str(e)}")
                return response

        return response
    except Exception as e:
        print(f"Error serving file {filename}: {str(e)}")
        return jsonify({"error": "File not found"}), 404

@app.route('/api/generate-receipt', methods=['POST'])
@jwt_required()
@moderate_rate_limit()
def generate_receipt():
    try:
        data = request.get_json()
        items = data.get('items', [])
        total = data.get('total', 0)
        
        if not items:
            return jsonify({'error': 'No items provided'}), 400

        # Create a unique filename for the PDF
        filename = f"receipt_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}.pdf"
        pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)

        # Create PDF with professional dimensions
        page_width = 2.8 * inch  # Standard receipt width
        page_height = 6.0 * inch  # Adjustable based on content
        doc = SimpleDocTemplate(
            pdf_path,
            pagesize=(page_width, page_height),
            rightMargin=0.1*inch,
            leftMargin=0.1*inch,
            topMargin=0.2*inch,
            bottomMargin=0.2*inch
        )

        # Prepare the story (content)
        story = []
        styles = getSampleStyleSheet()

        # Professional color scheme
        primary_color = colors.HexColor('#000000')  # Black for main text
        secondary_color = colors.HexColor('#666666')  # Gray for secondary text
        border_color = colors.HexColor('#CCCCCC')  # Light gray for borders

        # Header style - Clean and professional
        header_style = ParagraphStyle(
            'Header',
            parent=styles['Normal'],
            fontSize=10,
            alignment=1,
            spaceAfter=2,
            textColor=primary_color,
            fontName='Helvetica-Bold'
        )

        # Subheader style
        subheader_style = ParagraphStyle(
            'Subheader',
            parent=styles['Normal'],
            fontSize=7,
            alignment=1,
            spaceAfter=2,
            textColor=secondary_color,
            fontName='Helvetica'
        )

        # Add header content
        story.append(Paragraph("KasirKuy", header_style))
        
        # Add date and time
        current_time = datetime.now()
        date_str = current_time.strftime('%d/%m/%Y')
        time_str = current_time.strftime('%H:%M')
        story.append(Paragraph(f"{date_str} {time_str}", subheader_style))

        # Add separator
        story.append(HRFlowable(
            width="100%",
            thickness=0.5,
            color=border_color,
            spaceBefore=4,
            spaceAfter=4
        ))

        # Function to format currency
        def format_currency(amount):
            return f"Rp {amount:,.0f}".replace(',', '.')

        # Table style - Clean and minimal
        table_style = TableStyle([
            # Headers
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 7),
            ('TEXTCOLOR', (0, 0), (-1, 0), primary_color),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 4),
            ('TOPPADDING', (0, 0), (-1, 0), 4),
            
            # Content
            ('FONTNAME', (0, 1), (-1, -2), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -2), 7),
            ('TEXTCOLOR', (0, 1), (-1, -2), primary_color),
            ('BOTTOMPADDING', (0, 1), (-1, -2), 2),
            ('TOPPADDING', (0, 1), (-1, -2), 2),
            
            # Total row
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, -1), (-1, -1), 8),
            ('TEXTCOLOR', (0, -1), (-1, -1), primary_color),
            ('LINEABOVE', (0, -1), (-1, -1), 0.5, border_color),
            ('TOPPADDING', (0, -1), (-1, -1), 4),
        ])

        # Prepare table data
        table_data = []
        
        # Add items
        for item in items:
            name = item['name']
            if len(name) > 20:  # Limit name length
                name = name[:18] + '..'
            
            # Format: Item name, Qty x Price, Total
            qty_price = f"{item['quantity']} x {format_currency(item['price'])}"
            total_price = format_currency(item['price'] * item['quantity'])
            
            table_data.append([name, qty_price, total_price])

        # Add total
        table_data.append(['Total', '', format_currency(total)])

        # Create and style the table
        col_widths = [1.4*inch, 0.7*inch, 0.5*inch]  # Adjusted column widths
        table = Table(table_data, colWidths=col_widths)
        table.setStyle(table_style)
        story.append(table)

        # Add separator before footer
        story.append(HRFlowable(
            width="100%",
            thickness=0.5,
            color=border_color,
            spaceBefore=6,
            spaceAfter=6
        ))

        # Footer style
        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=6,
            alignment=1,
            textColor=secondary_color,
            fontName='Helvetica',
            spaceBefore=0,
            spaceAfter=2
        )

        # Add footer
        story.append(Paragraph("Terima kasih atas kunjungan Anda", footer_style))
        story.append(Paragraph("Sampai jumpa kembali", footer_style))

        # Build PDF
        doc.build(story)

        # Get the base URL from environment or default
        base_url = os.getenv('BASE_URL', request.url_root.rstrip('/'))
        pdf_url = f"{base_url}/api/uploads/{filename}"

        return jsonify({
            'message': 'Receipt generated successfully',
            'pdf_url': pdf_url
        }), 200

    except Exception as e:
        print(f"Error generating receipt: {str(e)}")
        return jsonify({'error': 'Failed to generate receipt'}), 500

# Admin routes
@app.route('/api/admin/users', methods=['GET'])
@admin_required()
@moderate_rate_limit()
def get_all_users():
    try:
        # Get users with their product counts
        response = supabase.from_('users').select('*, products(count)').execute()
        return jsonify([{
            'id': u['id'],
            'username': u['username'],
            'is_admin': u['is_admin'],
            'created_at': u['created_at'],
            'products_count': len(u.get('products', [])) if u.get('products') else 0
        } for u in response.data]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users', methods=['POST'])
@admin_required()
@moderate_rate_limit()
def add_user():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        is_admin = data.get('is_admin', False)

        if not username or not password:
            return jsonify({'error': 'Username and password are required'}), 400

        # Check if username exists
        existing_user = get_user_by_username(username)
        if existing_user.data:
            return jsonify({'error': 'Username already exists'}), 409

        # Create user in Supabase
        response = create_user(username, password, is_admin)
        if not response.data:
            return jsonify({'error': 'Failed to create user'}), 500

        user = response.data[0]
        return jsonify({
            'id': user['id'],
            'username': user['username'],
            'is_admin': user['is_admin'],
            'created_at': user['created_at']
        }), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users/<int:user_id>', methods=['PUT'])
@admin_required()
@moderate_rate_limit()
def update_user(user_id):
    try:
        data = request.get_json()
        update_data = {}

        # Check if user exists
        user_response = get_user_by_id(user_id)
        if not user_response.data:
            return jsonify({'error': 'User not found'}), 404

        if 'username' in data:
            existing = get_user_by_username(data['username'])
            if existing.data and existing.data[0]['id'] != user_id:
                return jsonify({'error': 'Username already exists'}), 409
            update_data['username'] = data['username']

        if 'password' in data and data['password']:
            update_data['password'] = generate_password_hash(data['password'], method=PASSWORD_HASH_METHOD)

        if 'is_admin' in data:
            update_data['is_admin'] = data['is_admin']

        if update_data:
            response = supabase.from_('users').update(update_data).eq('id', user_id).execute()
            if not response.data:
                return jsonify({'error': 'Failed to update user'}), 500
            
            return jsonify(response.data[0]), 200
        
        return jsonify({'message': 'No changes to update'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users/<string:user_id>', methods=['DELETE'])
@admin_required()
@moderate_rate_limit()
def delete_user(user_id):
    try:
        print(f"Delete request for user ID: {user_id}")
        # Check if user exists
        user_response = get_user_by_id(user_id)
        print(f"User check response: {user_response.data if user_response.data else 'None'}")
        
        if not user_response.data:
            return jsonify({'error': 'User not found'}), 404

        user = user_response.data[0]
        
        # Don't allow deleting the last admin
        admins_response = supabase.from_('users').select('id').eq('is_admin', True).execute()
        if user['is_admin'] and len(admins_response.data) <= 1:
            return jsonify({'error': 'Cannot delete the last admin user'}), 400

        # Get all products for this user
        products_response = supabase.from_('products').select('*').eq('user_id', user_id).execute()
        
        # Delete all products for this user first
        if products_response.data:
            for product in products_response.data:
                delete_product(product['id'])

        # Delete user from Supabase
        response = supabase.from_('users').delete().eq('id', user_id).execute()
        print(f"User delete response: {response.data if response.data else 'None'}")
        
        if not response.data:
            return jsonify({'error': 'Failed to delete user'}), 500

        # Clean up any unused images
        cleanup_old_images()

        return jsonify({'message': 'User deleted successfully'}), 200

    except Exception as e:
        print(f"Error deleting user: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/products', methods=['GET'])
@admin_required()
@moderate_rate_limit()
def get_all_products():
    try:
        # Get products with user information
        response = supabase.from_('products').select('*, users(username)').execute()
        
        # Format the response
        products = []
        for product in response.data:
            user = product.pop('users', {})
            products.append({
                **product,
                'user_name': user.get('username') if user else None
            })
            
        return jsonify(products), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/products/<string:product_id>', methods=['DELETE'])
@admin_required()
@moderate_rate_limit()
def admin_delete_product(product_id):
    try:
        print(f"Admin delete request for product ID: {product_id}")
        # Check if product exists
        product_response = supabase.from_('products').select('*').eq('id', product_id).execute()
        print(f"Product check response: {product_response.data if product_response.data else 'None'}")
        
        if not product_response.data:
            return jsonify({"error": "Product not found"}), 404
        
        # Delete product and handle image cleanup
        response = delete_product(product_id)
        print(f"Delete response: {response.data if response and response.data else 'None'}")
        
        if not response or not response.data:
            return jsonify({"error": "Failed to delete product"}), 500
        
        # Run general cleanup
        cleanup_old_images()
        
        return jsonify({"message": "Product deleted successfully"}), 200
        
    except Exception as e:
        print(f"Error deleting product: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Add OPTIONS method handlers for CORS preflight requests
@app.route('/api/products/<string:product_id>', methods=['OPTIONS'])
def products_options(product_id):
    return '', 204

@app.route('/api/admin/products/<string:product_id>', methods=['OPTIONS'])
def admin_products_options(product_id):
    return '', 204

@app.route('/api/admin/users/<string:user_id>', methods=['OPTIONS'])
def admin_users_options(user_id):
    return '', 204

# Add request logging
@app.after_request
def after_request(response):
    if request.path.startswith('/api/'):
        print(
            f"[{datetime.now()}] {request.remote_addr} {request.method} "
            f"{request.path} {response.status_code}"
        )
    return response

# Add error logging
@app.errorhandler(Exception)
def handle_error(error):
    print(f"Error: {str(error)}")
    return jsonify({'error': 'Internal server error'}), 500

# Add this function near the other helper functions
def cleanup_old_images():
    """Clean up unused images from the upload folder"""
    try:
        # Get all products with images
        response = supabase.from_('products').select('image_url').execute()
        active_images = set()
        
        # Collect all active image filenames
        if response.data:
            for product in response.data:
                if product.get('image_url'):
                    filename = product['image_url'].split('/')[-1]
                    active_images.add(filename)
        
        # Check upload folder and remove receipt files and truly orphaned images
        current_time = time.time()
        for filename in os.listdir(UPLOAD_FOLDER):
            # Skip non-files
            if not os.path.isfile(os.path.join(UPLOAD_FOLDER, filename)):
                continue
                
            file_path = os.path.join(UPLOAD_FOLDER, filename)
                
            # Clean up receipt files that are older than 5 minutes
            if filename.startswith('receipt_'):
                try:
                    file_age = current_time - os.path.getmtime(file_path)
                    if file_age > 300:  # 5 minutes in seconds
                        os.remove(file_path)
                        print(f"Cleaned up old receipt file: {filename}")
                except Exception as e:
                    print(f"Error deleting receipt file {filename}: {str(e)}")
                continue
            
            # Only delete image files that are not referenced by any product
            if allowed_file(filename) and filename not in active_images:
                file_path = os.path.join(UPLOAD_FOLDER, filename)
                try:
                    # Double check if image is truly not referenced
                    double_check = supabase.from_('products').select('id').ilike('image_url', f'%{filename}%').execute()
                    if not double_check.data:
                        os.remove(file_path)
                        print(f"Cleaned up unused image: {filename}")
                except Exception as e:
                    print(f"Error deleting file {filename}: {str(e)}")
    except Exception as e:
        print(f"Error during image cleanup: {str(e)}")

@app.route('/api/logout', methods=['POST'])
@jwt_required()
def logout():
    response = jsonify({"message": "Successfully logged out"})
    response.delete_cookie(AUTH_COOKIE_NAME, path='/')
    return response

# Add OPTIONS route handlers for auth endpoints
@app.route('/api/login', methods=['OPTIONS'])
def login_options():
    return '', 204

@app.route('/api/register', methods=['OPTIONS'])
def register_options():
    return '', 204

@app.after_request
def after_request(response):
    if request.method == 'OPTIONS':
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Accept, Origin, X-Requested-With'
        response.headers['Access-Control-Max-Age'] = '600'
    return response

# Add a general OPTIONS handler for all routes
@app.route('/api/<path:path>', methods=['OPTIONS'])
def handle_options(path):
    return '', 204

# Add root route handler
@app.route('/')
def root():
    return jsonify({
        'status': 'healthy',
        'message': 'KasirKuy API is running'
    }), 200

# Update error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({'error': 'Method not allowed'}), 405

# Add verify endpoint
@app.route('/api/verify', methods=['GET'])
@jwt_required()
def verify_token():
    try:
        current_user_id = get_jwt_identity()
        user_response = get_user_by_id(current_user_id)
        
        if not user_response.data:
            return jsonify({'message': 'User not found'}), 404
            
        user = user_response.data[0]
        return jsonify({
            'id': user['id'],
            'username': user['username'],
            'is_admin': user['is_admin']
        })
    except Exception as e:
        print(f"Verify error: {str(e)}")
        return jsonify({'message': 'An error occurred during verification'}), 500

if __name__ == '__main__':
    # Create default admin user if none exists
    try:
        admin_user = get_user_by_username('wildanhniif')
        if not admin_user.data:
            response = create_user('wildanhniif', 'pemenang321', is_admin=True)
            if response.data:
                print("Default admin user created - Username: wildanhniif, Password: pemenang321")
            else:
                print("Failed to create default admin user")
    except Exception as e:
        print(f"Error creating default admin: {str(e)}")
            
    app.run(debug=True) 