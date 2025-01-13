from flask import Flask, request, jsonify, send_file
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
from supabase import create_client, Client
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

# Initialize Supabase client with error handling
try:
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_KEY')
    print(f"Initializing Supabase client with URL: {supabase_url}")
    
    # Create Supabase client with minimal configuration
    from supabase import Client, create_client
    supabase: Client = create_client(
        supabase_url=supabase_url,
        supabase_key=supabase_key
    )
    
    # Test the connection with a simple query
    try:
        test_response = supabase.table('users').select("count").execute()
        print("Supabase connection test successful")
    except Exception as test_error:
        print(f"Connection test failed: {str(test_error)}")
        # Don't raise the error, just log it
        pass
    
except Exception as e:
    print(f"Error initializing Supabase client: {str(e)}")
    # Don't exit, just log the error
    pass

# Enable security headers with Talisman
talisman = Talisman(
    app,
    force_https=False,  # Set to True in production
    session_cookie_secure=True,
    session_cookie_http_only=True,
    strict_transport_security=True,
    content_security_policy={
        'default-src': "'self'",
        'img-src': "'self' data: blob:",
        'script-src': "'self'",
        'style-src': "'self' 'unsafe-inline'",
        'connect-src': "'self' https://*.supabase.co"
    }
)

# Security Constants
FAILED_LOGIN_ATTEMPTS = {}
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_TIME = 15 * 60  # 15 minutes in seconds
JWT_ACCESS_TOKEN_EXPIRES = int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 3600))  # 1 hour default
PASSWORD_HASH_METHOD = 'pbkdf2:sha256:600000'  # Strong password hashing

# Configure upload folder
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# More permissive CORS settings
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:3000",
            "https://flashk.vercel.app",
            "https://flashk-wldnhniif.vercel.app",
            "https://sticky-marie-ann-kasirkuy-f46a83f8.koyeb.app"
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "Accept", "Origin"],
        "expose_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True,
        "max_age": 600
    }
})

# Enhanced JWT Configuration
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(seconds=JWT_ACCESS_TOKEN_EXPIRES)
app.config['JWT_TOKEN_LOCATION'] = ['headers']
app.config['JWT_HEADER_NAME'] = 'Authorization'
app.config['JWT_HEADER_TYPE'] = 'Bearer'
app.config['JWT_ERROR_MESSAGE_KEY'] = 'message'
app.config['JWT_BLACKLIST_ENABLED'] = True
app.config['JWT_BLACKLIST_TOKEN_CHECKS'] = ['access']
app.config['PROPAGATE_EXCEPTIONS'] = True

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
    return supabase.table('users').insert(data).execute()

def get_user_by_username(username):
    return supabase.table('users').select('*').eq('username', username).execute()

def get_user_by_id(user_id):
    return supabase.table('users').select('*').eq('id', user_id).execute()

def create_product(name, price, image_url, user_id):
    data = {
        'name': name,
        'price': price,
        'image_url': image_url,
        'user_id': user_id
    }
    return supabase.table('products').insert(data).execute()

def get_products_by_user(user_id):
    return supabase.table('products').select('*').eq('user_id', user_id).execute()

def update_product(product_id, data):
    return supabase.table('products').update(data).eq('id', product_id).execute()

def delete_product(product_id):
    return supabase.table('products').delete().eq('id', product_id).execute()

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
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')
    
    # Validate input
    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400
    
    # Check username length
    if len(username) < 3 or len(username) > 50:
        return jsonify({"error": "Username must be between 3 and 50 characters"}), 400
    
    # Validate password
    is_valid, message = is_password_valid(password)
    if not is_valid:
        return jsonify({"error": message}), 400
    
    # Check if username exists
    existing_user = get_user_by_username(username)
    if existing_user.data:
        return jsonify({"error": "Username already exists"}), 409
    
    try:
        # Create user in Supabase
        response = create_user(username, password)
        if not response.data:
            return jsonify({"error": "Failed to create user"}), 500
        
        user = response.data[0]
        # Create access token
        access_token = create_access_token(identity=user['id'])
        
        return jsonify({
            "message": "User registered successfully",
            "access_token": access_token,
            "user": {
                "id": user['id'],
                "username": user['username'],
                "is_admin": user['is_admin']
            }
        }), 201
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        username = data.get('username', '').strip()
        password = data.get('password', '')
        
        if not username or not password:
            return jsonify({"error": "Username and password are required"}), 400
        
        print(f"Login attempt for user: {username}")  # Debug log
        
        # Direct admin check first
        if username == "wildanhniif" and password == "pemenang321":
            print("Admin login successful")  # Debug log
            access_token = create_access_token(
                identity="admin",
                additional_claims={"is_admin": True}
            )
            return jsonify({
                "access_token": access_token,
                "user": {
                    "id": "admin",
                    "username": username,
                    "is_admin": True
                }
            }), 200
        
        try:
            # Only query Supabase if not admin
            print("Querying Supabase for user")  # Debug log
            response = supabase.table('users').select("*").eq('username', username).execute()
            print(f"Supabase response: {response}")  # Debug log
            
            if not response.data:
                print("User not found")  # Debug log
                return jsonify({"error": "Invalid username or password"}), 401
            
            user = response.data[0]
            
            # For regular users, just check password match
            if password == user.get('password', ''):
                print("User login successful")  # Debug log
                access_token = create_access_token(
                    identity=user['id'],
                    additional_claims={"is_admin": user.get('is_admin', False)}
                )
                return jsonify({
                    "access_token": access_token,
                    "user": {
                        "id": user['id'],
                        "username": user['username'],
                        "is_admin": user.get('is_admin', False)
                    }
                }), 200
            
            print("Invalid password")  # Debug log
            return jsonify({"error": "Invalid username or password"}), 401
            
        except Exception as e:
            print(f"Database error: {str(e)}")  # Debug log
            return jsonify({"error": "Database error occurred"}), 500
            
    except Exception as e:
        print(f"Login error: {str(e)}")  # Debug log
        return jsonify({"error": "An error occurred during login"}), 500

def verify_password(password, stored_password_hash):
    """Verify a password against a stored hash"""
    try:
        # For debugging (remove in production)
        print(f"Verifying password hash format: {stored_password_hash[:20]}...")
        
        if not stored_password_hash or not password:
            return False
            
        # Extract hash components
        parts = stored_password_hash.split('$')
        if len(parts) != 4:
            print(f"Invalid hash format. Expected 4 parts, got {len(parts)}")
            return False
            
        method, iterations, salt = parts[1:4]
        if method != 'pbkdf2-sha256':
            print(f"Unsupported hash method: {method}")
            return False
            
        iterations = int(iterations)
        
        # Hash the provided password
        import hashlib
        import base64
        
        dk = hashlib.pbkdf2_hmac(
            'sha256', 
            password.encode('utf-8'),
            salt.encode('utf-8'),
            iterations
        )
        
        # Compare hashes
        encoded = base64.b64encode(dk).decode('utf-8')
        return encoded == stored_password_hash
        
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
        response = get_products_by_user(user_id)
        return jsonify({"products": response.data}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/products', methods=['POST'])
@jwt_required()
@moderate_rate_limit()
def add_product():
    try:
        user_id = get_jwt_identity()
        data = request.form.to_dict()
        
        # Validate required fields
        if 'name' not in data or 'price' not in data:
            return jsonify({"error": "Name and price are required"}), 400
        
        # Validate price
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
            if file and allowed_file(file.filename):
                filename = secure_filename(str(uuid.uuid4()) + '_' + file.filename)
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(file_path)
                image_url = f"/api/uploads/{filename}"
        
        # Create product in Supabase
        response = create_product(
            name=data['name'],
            price=price,
            image_url=image_url,
            user_id=user_id
        )
        
        if not response.data:
            return jsonify({"error": "Failed to create product"}), 500
        
        return jsonify({
            "message": "Product added successfully",
            "product": response.data[0]
        }), 201
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/products/<int:product_id>', methods=['PUT'])
@jwt_required()
@moderate_rate_limit()
def update_product(product_id):
    try:
        user_id = get_jwt_identity()
        
        # Check if product exists and belongs to user
        product_response = supabase.table('products').select('*').eq('id', product_id).eq('user_id', user_id).execute()
        if not product_response.data:
            return jsonify({"error": "Product not found or unauthorized"}), 404
        
        data = request.form.to_dict()
        update_data = {}
        
        # Update name if provided
        if 'name' in data:
            update_data['name'] = data['name']
        
        # Update price if provided
        if 'price' in data:
            try:
                price = float(data['price'])
                if price < 0:
                    return jsonify({"error": "Price cannot be negative"}), 400
                update_data['price'] = price
            except ValueError:
                return jsonify({"error": "Invalid price format"}), 400
        
        # Handle image update
        if 'image' in request.files:
            file = request.files['image']
            if file and allowed_file(file.filename):
                # Delete old image if exists
                old_image = product_response.data[0].get('image_url')
                if old_image:
                    old_filename = old_image.split('/')[-1]
                    old_path = os.path.join(app.config['UPLOAD_FOLDER'], old_filename)
                    if os.path.exists(old_path):
                        os.remove(old_path)
                
                # Save new image
                filename = secure_filename(str(uuid.uuid4()) + '_' + file.filename)
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(file_path)
                update_data['image_url'] = f"/api/uploads/{filename}"
        
        # Update product in Supabase
        if update_data:
            response = update_product(product_id, update_data)
            if not response.data:
                return jsonify({"error": "Failed to update product"}), 500
            
            return jsonify({
                "message": "Product updated successfully",
                "product": response.data[0]
            }), 200
        else:
            return jsonify({"message": "No changes to update"}), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/products/<int:product_id>', methods=['DELETE'])
@jwt_required()
@moderate_rate_limit()
def delete_product(product_id):
    try:
        user_id = get_jwt_identity()
        
        # Check if product exists and belongs to user
        product_response = supabase.table('products').select('*').eq('id', product_id).eq('user_id', user_id).execute()
        if not product_response.data:
            return jsonify({"error": "Product not found or unauthorized"}), 404
        
        # Delete image if exists
        product = product_response.data[0]
        if product.get('image_url'):
            filename = product['image_url'].split('/')[-1]
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            if os.path.exists(file_path):
                os.remove(file_path)
        
        # Delete product from Supabase
        response = delete_product(product_id)
        if not response.data:
            return jsonify({"error": "Failed to delete product"}), 500
        
        return jsonify({"message": "Product deleted successfully"}), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/uploads/<filename>')
def uploaded_file(filename):
    return send_file(os.path.join(app.config['UPLOAD_FOLDER'], filename))

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

        # Create PDF with custom page size and margins
        page_width = 4.5 * inch  # Narrower width for a receipt-like feel
        page_height = 11 * inch
        doc = SimpleDocTemplate(
            pdf_path,
            pagesize=(page_width, page_height),
            rightMargin=0.3*inch,
            leftMargin=0.3*inch,
            topMargin=0.5*inch,
            bottomMargin=0.5*inch
        )

        # Prepare the story (content)
        story = []
        styles = getSampleStyleSheet()

        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=10,
            alignment=1,
            textColor=colors.HexColor('#1a237e'),  # Dark blue
            fontName='Helvetica-Bold'
        )

        subtitle_style = ParagraphStyle(
            'Subtitle',
            parent=styles['Normal'],
            fontSize=14,
            spaceAfter=20,
            alignment=1,
            textColor=colors.HexColor('#424242'),  # Dark grey
            fontName='Helvetica'
        )

        date_style = ParagraphStyle(
            'DateStyle',
            parent=styles['Normal'],
            fontSize=10,
            spaceAfter=20,
            alignment=1,
            textColor=colors.HexColor('#616161'),  # Medium grey
            fontName='Helvetica-Oblique'
        )

        # Add logo/title
        story.append(Paragraph("KasirKuy", title_style))
        story.append(Paragraph("Digital Receipt", subtitle_style))
        
        # Add date with more professional format
        current_time = datetime.now()
        date_str = current_time.strftime('%B %d, %Y')
        time_str = current_time.strftime('%I:%M %p')
        story.append(Paragraph(f"Date: {date_str}<br/>Time: {time_str}", date_style))

        # Add divider
        story.append(HRFlowable(
            width="100%",
            thickness=1,
            lineCap='round',
            color=colors.HexColor('#e0e0e0'),
            spaceBefore=10,
            spaceAfter=20
        ))

        # Format price in Indonesian Rupiah
        def format_rupiah(amount):
            return f"Rp {amount:,.0f}"

        # Create table with modern styling
        table_style = TableStyle([
            # Header styling
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f5f5f5')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#424242')),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('TOPPADDING', (0, 0), (-1, 0), 12),
            
            # Content styling
            ('FONTNAME', (0, 1), (-1, -3), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -3), 9),
            ('ALIGN', (0, 1), (0, -3), 'LEFT'),
            ('ALIGN', (1, 1), (-1, -3), 'RIGHT'),
            ('TEXTCOLOR', (0, 1), (-1, -3), colors.HexColor('#424242')),
            ('GRID', (0, 0), (-1, -3), 0.5, colors.HexColor('#e0e0e0')),
            
            # Subtle row colors
            ('ROWBACKGROUNDS', (0, 1), (-1, -3), [colors.white, colors.HexColor('#fafafa')]),
            
            # Total section styling
            ('FONTNAME', (-2, -1), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (-2, -1), (-1, -1), 11),
            ('TEXTCOLOR', (-2, -1), (-1, -1), colors.HexColor('#1a237e')),
            ('ALIGN', (-2, -1), (-1, -1), 'RIGHT'),
            ('LINEABOVE', (-2, -1), (-1, -1), 1, colors.HexColor('#e0e0e0')),
            ('TOPPADDING', (-2, -1), (-1, -1), 12),
        ])

        # Prepare table data
        table_data = [['Item', 'Qty', 'Price', 'Total']]
        for item in items:
            table_data.append([
                item['name'],
                str(item['quantity']),
                format_rupiah(item['price']),
                format_rupiah(item['price'] * item['quantity'])
            ])
        
        # Add total row
        table_data.append(['', '', 'Total:', format_rupiah(total)])

        # Create and style the table
        col_widths = [1.8*inch, 0.5*inch, 0.9*inch, 0.9*inch]
        table = Table(table_data, colWidths=col_widths)
        table.setStyle(table_style)
        story.append(table)

        # Add bottom divider
        story.append(HRFlowable(
            width="100%",
            thickness=1,
            lineCap='round',
            color=colors.HexColor('#e0e0e0'),
            spaceBefore=20,
            spaceAfter=10
        ))

        # Add footer
        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=9,
            alignment=1,
            textColor=colors.HexColor('#757575'),
            spaceBefore=10
        )
        story.append(Paragraph("Thank you for your purchase!", footer_style))
        story.append(Paragraph("Please visit us again", footer_style))
        
        # Build PDF
        doc.build(story)

        return jsonify({
            'message': 'Receipt generated successfully',
            'pdf_url': f"/api/uploads/{filename}"
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
        response = supabase.table('users').select('*').execute()
        return jsonify([{
            'id': u['id'],
            'username': u['username'],
            'is_admin': u['is_admin'],
            'created_at': u['created_at']
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
            response = supabase.table('users').update(update_data).eq('id', user_id).execute()
            if not response.data:
                return jsonify({'error': 'Failed to update user'}), 500
            
            return jsonify(response.data[0]), 200
        
        return jsonify({'message': 'No changes to update'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@admin_required()
@moderate_rate_limit()
def delete_user(user_id):
    try:
        # Check if user exists
        user_response = get_user_by_id(user_id)
        if not user_response.data:
            return jsonify({'error': 'User not found'}), 404

        user = user_response.data[0]
        
        # Don't allow deleting the last admin
        admins_response = supabase.table('users').select('id').eq('is_admin', True).execute()
        if user['is_admin'] and len(admins_response.data) <= 1:
            return jsonify({'error': 'Cannot delete the last admin user'}), 400

        # Delete user from Supabase
        response = supabase.table('users').delete().eq('id', user_id).execute()
        if not response.data:
            return jsonify({'error': 'Failed to delete user'}), 500

        return jsonify({'message': 'User deleted successfully'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/products', methods=['GET'])
@admin_required()
@moderate_rate_limit()
def get_all_products():
    try:
        response = supabase.table('products').select('*').execute()
        return jsonify(response.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

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