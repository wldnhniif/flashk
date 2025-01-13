from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
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

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)

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
        'connect-src': "'self'"
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
CORS(app, 
     resources={
         r"/*": {
             "origins": ["http://localhost:3000"],
             "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
             "allow_headers": ["Content-Type", "Authorization", "Access-Control-Allow-Credentials"],
             "supports_credentials": True,
             "expose_headers": ["Content-Range", "X-Content-Range"]
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

# Database configuration
if os.getenv('FLASK_ENV') == 'production':
    app.config['SQLALCHEMY_DATABASE_URI'] = f"mysql+pymysql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SQLALCHEMY_POOL_SIZE'] = 10
    app.config['SQLALCHEMY_MAX_OVERFLOW'] = 20
    app.config['SQLALCHEMY_POOL_TIMEOUT'] = 30
else:
    # Use SQLite for development
    sqlite_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dev.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{sqlite_path}'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize extensions
db = SQLAlchemy()
jwt = JWTManager()

# Initialize the app with extensions
db.init_app(app)
jwt.init_app(app)

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

# Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    products = db.relationship('Product', backref='user', lazy=True, cascade='all, delete-orphan')
    devices = db.relationship('DeviceRegistration', backref='user', lazy=True, cascade='all, delete-orphan')

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    price = db.Column(db.Float, nullable=False)
    image_url = db.Column(db.String(255))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    variants = db.relationship('ProductVariant', backref='product', lazy=True, cascade='all, delete-orphan')

class ProductVariant(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)  # e.g. "Size", "Color"
    value = db.Column(db.String(50), nullable=False)  # e.g. "S", "M", "L" or "Red", "Blue"
    price_adjustment = db.Column(db.Float, default=0.0)  # Additional price for this variant
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

class DeviceRegistration(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(255), unique=True, nullable=False)
    ip_address = db.Column(db.String(45), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

# Admin middleware
def admin_required():
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            user = User.query.get(user_id)
            if not user or not user.is_admin:
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
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    # Validate password
    is_valid, message = is_password_valid(password)
    if not is_valid:
        return jsonify({'error': message}), 400

    # Get device fingerprint
    device_id, ip_address = get_device_fingerprint()

    # Check if device already registered
    existing_device = DeviceRegistration.query.filter_by(device_id=device_id).first()
    if existing_device:
        return jsonify({'error': 'An account has already been registered from this device'}), 400

    # Check if IP has too many registrations
    ip_registrations = DeviceRegistration.query.filter_by(ip_address=ip_address).count()
    if ip_registrations >= 3:  # Limit to 3 accounts per IP
        return jsonify({'error': 'Too many accounts registered from this IP address'}), 400

    try:
        # Check if username already exists
        if User.query.filter_by(username=username).first():
            return jsonify({'error': 'Username already exists'}), 400

        # Create new user with Werkzeug password hashing
        hashed_password = generate_password_hash(password, method='pbkdf2:sha256:600000')
        new_user = User(username=username, password=hashed_password)
        db.session.add(new_user)
        db.session.flush()

        # Register device
        new_device = DeviceRegistration(
            device_id=device_id,
            ip_address=ip_address,
            user_id=new_user.id
        )
        db.session.add(new_device)
        db.session.commit()

        return jsonify({
            'message': 'Registration successful',
            'user': {
                'id': new_user.id,
                'username': new_user.username,
                'is_admin': new_user.is_admin
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@app.route('/api/login', methods=['POST'])
@strict_rate_limit()
def login():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({'error': 'Username and password are required'}), 400

        # Check if user is locked out
        ip_address = request.remote_addr
        if ip_address in FAILED_LOGIN_ATTEMPTS:
            attempts = FAILED_LOGIN_ATTEMPTS[ip_address]
            if attempts['count'] >= MAX_FAILED_ATTEMPTS:
                time_passed = datetime.now(timezone.utc).timestamp() - attempts['timestamp']
                if time_passed < LOCKOUT_TIME:
                    return jsonify({
                        'error': f'Account locked. Try again in {int((LOCKOUT_TIME - time_passed) / 60)} minutes'
                    }), 429

        user = User.query.filter_by(username=username).first()
        if not user:
            # Record failed attempt
            record_failed_login(ip_address)
            return jsonify({'error': 'Invalid credentials'}), 401

        if check_password_hash(user.password, password):
            # Reset failed attempts on successful login
            if ip_address in FAILED_LOGIN_ATTEMPTS:
                del FAILED_LOGIN_ATTEMPTS[ip_address]

            access_token = create_access_token(identity=str(user.id))
            return jsonify({
                'token': access_token,
                'user_id': user.id,
                'username': user.username,
                'is_admin': user.is_admin
            }), 200
        
        # Record failed attempt
        record_failed_login(ip_address)
        return jsonify({'error': 'Invalid credentials'}), 401

    except Exception as e:
        print(f"Login error: {str(e)}")
        return jsonify({'error': 'An error occurred during login'}), 500

def record_failed_login(ip_address):
    """Record failed login attempt and update lockout status"""
    now = datetime.now(timezone.utc).timestamp()
    if ip_address in FAILED_LOGIN_ATTEMPTS:
        # Reset if lockout period has passed
        time_passed = now - FAILED_LOGIN_ATTEMPTS[ip_address]['timestamp']
        if time_passed >= LOCKOUT_TIME:
            FAILED_LOGIN_ATTEMPTS[ip_address] = {'count': 1, 'timestamp': now}
        else:
            FAILED_LOGIN_ATTEMPTS[ip_address]['count'] += 1
            FAILED_LOGIN_ATTEMPTS[ip_address]['timestamp'] = now
    else:
        FAILED_LOGIN_ATTEMPTS[ip_address] = {'count': 1, 'timestamp': now}

@app.route('/api/products', methods=['GET'])
@jwt_required()
@moderate_rate_limit()
def get_products():
    user_id = get_jwt_identity()
    products = Product.query.filter_by(user_id=user_id).all()
    return jsonify([{
        'id': p.id,
        'name': p.name,
        'price': p.price,
        'image_url': p.image_url,
        'variants': [{
            'id': v.id,
            'name': v.name,
            'value': v.value,
            'price_adjustment': v.price_adjustment
        } for v in p.variants]
    } for p in products])

@app.route('/api/products', methods=['POST'])
@jwt_required()
@moderate_rate_limit()
def add_product():
    try:
        user_id = get_jwt_identity()
        
        # Handle image upload
        image_url = None
        if 'image' in request.files:
            file = request.files['image']
            if file and allowed_file(file.filename):
                filename = secure_filename(f"{uuid.uuid4()}_{file.filename}")
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(file_path)
                image_url = f"/api/uploads/{filename}"

        # Handle product data
        if 'name' not in request.form or 'price' not in request.form:
            return jsonify({'error': 'Name and price are required'}), 400

        name = request.form.get('name')
        try:
            price = float(request.form.get('price'))
        except ValueError:
            return jsonify({'error': 'Price must be a valid number'}), 400

        if not name:
            return jsonify({'error': 'Name cannot be empty'}), 400
        if price < 0:
            return jsonify({'error': 'Price cannot be negative'}), 400

        new_product = Product(
            name=name,
            price=price,
            image_url=image_url,
            user_id=int(user_id)
        )
        
        # Handle variants if provided
        variants_data = request.form.get('variants')
        if variants_data:
            try:
                variants = json.loads(variants_data)
                for variant in variants:
                    new_variant = ProductVariant(
                        name=variant['name'],
                        value=variant['value'],
                        price_adjustment=float(variant.get('price_adjustment', 0.0))
                    )
                    new_product.variants.append(new_variant)
            except (json.JSONDecodeError, KeyError) as e:
                return jsonify({'error': 'Invalid variants data format'}), 400
            except ValueError:
                return jsonify({'error': 'Invalid price adjustment value'}), 400

        db.session.add(new_product)
        db.session.commit()

        return jsonify({
            'id': new_product.id,
            'name': new_product.name,
            'price': new_product.price,
            'image_url': new_product.image_url,
            'variants': [{
                'id': v.id,
                'name': v.name,
                'value': v.value,
                'price_adjustment': v.price_adjustment
            } for v in new_product.variants]
        }), 201

    except Exception as e:
        print(f"Error adding product: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to add product'}), 500

@app.route('/api/products/<int:product_id>', methods=['PUT'])
@jwt_required()
@moderate_rate_limit()
def update_product(product_id):
    try:
        user_id = get_jwt_identity()
        product = Product.query.filter_by(id=product_id, user_id=user_id).first()
        if not product:
            return jsonify({'error': 'Product not found'}), 404

        # Handle image upload
        if 'image' in request.files:
            file = request.files['image']
            if file and allowed_file(file.filename):
                # Remove old image if exists
                if product.image_url:
                    old_filename = product.image_url.split('/')[-1]
                    old_path = os.path.join(app.config['UPLOAD_FOLDER'], old_filename)
                    if os.path.exists(old_path):
                        os.remove(old_path)
                
                # Save new image
                filename = secure_filename(f"{uuid.uuid4()}_{file.filename}")
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(file_path)
                product.image_url = f"/api/uploads/{filename}"

        # Update other fields
        if 'name' in request.form:
            name = request.form.get('name')
            if not name:
                return jsonify({'error': 'Name cannot be empty'}), 400
            product.name = name

        if 'price' in request.form:
            try:
                price = float(request.form.get('price'))
                if price < 0:
                    return jsonify({'error': 'Price cannot be negative'}), 400
                product.price = price
            except ValueError:
                return jsonify({'error': 'Price must be a valid number'}), 400

        # Update variants if provided
        variants_data = request.form.get('variants')
        if variants_data:
            try:
                variants = json.loads(variants_data)
                # Remove existing variants
                for variant in product.variants:
                    db.session.delete(variant)
                # Add new variants
                for variant in variants:
                    new_variant = ProductVariant(
                        name=variant['name'],
                        value=variant['value'],
                        price_adjustment=float(variant.get('price_adjustment', 0.0))
                    )
                    product.variants.append(new_variant)
            except (json.JSONDecodeError, KeyError) as e:
                return jsonify({'error': 'Invalid variants data format'}), 400
            except ValueError:
                return jsonify({'error': 'Invalid price adjustment value'}), 400

        db.session.commit()

        return jsonify({
            'id': product.id,
            'name': product.name,
            'price': product.price,
            'image_url': product.image_url,
            'variants': [{
                'id': v.id,
                'name': v.name,
                'value': v.value,
                'price_adjustment': v.price_adjustment
            } for v in product.variants]
        })

    except Exception as e:
        print(f"Error updating product: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to update product'}), 500

@app.route('/api/products/<int:product_id>', methods=['DELETE'])
@jwt_required()
@moderate_rate_limit()
def delete_product(product_id):
    try:
        user_id = get_jwt_identity()
        product = Product.query.filter_by(id=product_id, user_id=user_id).first()
        if not product:
            return jsonify({'error': 'Product not found'}), 404

        # Remove image file if exists
        if product.image_url:
            filename = product.image_url.split('/')[-1]
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            if os.path.exists(file_path):
                os.remove(file_path)

        db.session.delete(product)
        db.session.commit()
        return jsonify({'message': 'Product deleted successfully'})

    except Exception as e:
        print(f"Error deleting product: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to delete product'}), 500

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
    users = User.query.all()
    return jsonify([{
        'id': u.id,
        'username': u.username,
        'is_admin': u.is_admin,
        'created_at': u.created_at.isoformat(),
        'products_count': len(u.products)
    } for u in users])

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

        if User.query.filter_by(username=username).first():
            return jsonify({'error': 'Username already exists'}), 400

        hashed_password = generate_password_hash(password)
        new_user = User(username=username, password=hashed_password, is_admin=is_admin)
        db.session.add(new_user)
        db.session.commit()

        return jsonify({
            'id': new_user.id,
            'username': new_user.username,
            'is_admin': new_user.is_admin,
            'products_count': 0,
            'created_at': new_user.created_at.isoformat()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users/<int:user_id>', methods=['PUT'])
@admin_required()
@moderate_rate_limit()
def update_user(user_id):
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        data = request.get_json()
        if 'username' in data and data['username'] != user.username:
            if User.query.filter_by(username=data['username']).first():
                return jsonify({'error': 'Username already exists'}), 400
            user.username = data['username']

        if 'password' in data and data['password']:
            user.password = generate_password_hash(data['password'])

        if 'is_admin' in data:
            user.is_admin = data['is_admin']

        db.session.commit()

        return jsonify({
            'id': user.id,
            'username': user.username,
            'is_admin': user.is_admin,
            'products_count': len(user.products),
            'created_at': user.created_at.isoformat()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@admin_required()
@moderate_rate_limit()
def delete_user(user_id):
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Don't allow deleting the last admin
        if user.is_admin and User.query.filter_by(is_admin=True).count() <= 1:
            return jsonify({'error': 'Cannot delete the last admin user'}), 400

        # The cascade will automatically handle deleting related products and device registrations
        db.session.delete(user)
        db.session.commit()

        return jsonify({'message': 'User deleted successfully'})
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting user: {str(e)}")  # Add debug logging
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/products', methods=['GET'])
@admin_required()
@moderate_rate_limit()
def get_all_products():
    products = Product.query.all()
    return jsonify([{
        'id': p.id,
        'name': p.name,
        'price': p.price,
        'image_url': p.image_url,
        'user_id': p.user_id,
        'user_name': p.user.username
    } for p in products])

@app.route('/api/admin/products', methods=['POST'])
@admin_required()
@moderate_rate_limit()
def add_product_admin():
    try:
        data = request.get_json()
        name = data.get('name')
        price = data.get('price')
        user_id = data.get('user_id')

        if not all([name, price, user_id]):
            return jsonify({'error': 'Name, price, and user_id are required'}), 400

        if not User.query.get(user_id):
            return jsonify({'error': 'User not found'}), 404

        try:
            price = float(price)
            if price < 0:
                return jsonify({'error': 'Price must be non-negative'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid price format'}), 400

        new_product = Product(name=name, price=price, user_id=user_id)
        db.session.add(new_product)
        db.session.commit()

        return jsonify({
            'id': new_product.id,
            'name': new_product.name,
            'price': new_product.price,
            'user_id': new_product.user_id,
            'user_name': User.query.get(new_product.user_id).username,
            'image_url': new_product.image_url
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/products/<int:product_id>', methods=['PUT'])
@admin_required()
@moderate_rate_limit()
def update_product_admin(product_id):
    try:
        product = Product.query.get(product_id)
        if not product:
            return jsonify({'error': 'Product not found'}), 404

        data = request.get_json()
        if 'name' in data:
            product.name = data['name']
        if 'price' in data:
            try:
                price = float(data['price'])
                if price < 0:
                    return jsonify({'error': 'Price must be non-negative'}), 400
                product.price = price
            except ValueError:
                return jsonify({'error': 'Invalid price format'}), 400
        if 'user_id' in data:
            if not User.query.get(data['user_id']):
                return jsonify({'error': 'User not found'}), 404
            product.user_id = data['user_id']

        db.session.commit()

        return jsonify({
            'id': product.id,
            'name': product.name,
            'price': product.price,
            'user_id': product.user_id,
            'user_name': User.query.get(product.user_id).username,
            'image_url': product.image_url
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/products/<int:product_id>', methods=['DELETE'])
@admin_required()
@moderate_rate_limit()
def delete_product_admin(product_id):
    try:
        product = Product.query.get(product_id)
        if not product:
            return jsonify({'error': 'Product not found'}), 404

        # Delete associated image if exists
        if product.image_url:
            filename = product.image_url.split('/')[-1]
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            if os.path.exists(file_path):
                os.remove(file_path)

        db.session.delete(product)
        db.session.commit()

        return jsonify({'message': 'Product deleted successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/transactions', methods=['GET'])
@admin_required()
def get_all_transactions():
    # For now, return an empty list since we haven't implemented transactions yet
    return jsonify([])

# Add cleanup function for expired device registrations (optional)
@app.cli.command('cleanup-devices')
def cleanup_devices():
    """Clean up device registrations older than 30 days"""
    expiry_date = datetime.now(timezone.utc) - timedelta(days=30)
    DeviceRegistration.query.filter(DeviceRegistration.created_at < expiry_date).delete()
    db.session.commit()

# Add request logging
@app.after_request
def after_request(response):
    if request.path.startswith('/api/'):
        app.logger.info(
            f"[{datetime.now()}] {request.remote_addr} {request.method} "
            f"{request.path} {response.status_code}"
        )
    return response

# Add error logging
@app.errorhandler(Exception)
def handle_error(error):
    app.logger.error(f"Error: {str(error)}", exc_info=True)
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()  # Create database tables
        
        # Create default admin user if none exists
        admin_user = User.query.filter_by(username='wildanhniif').first()
        if not admin_user:
            hashed_password = generate_password_hash('pemenang321')
            admin_user = User(username='wildanhniif', password=hashed_password, is_admin=True)
            db.session.add(admin_user)
            db.session.commit()
            print("Default admin user created - Username: wildanhniif, Password: pemenang321")
            
    app.run(debug=True) 