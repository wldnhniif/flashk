# KasirKuy - Point of Sale System

A modern point of sale system built with Flask and React.

## Features

- User authentication with JWT
- Product management with variants
- Image upload support
- PDF receipt generation
- Admin dashboard
- Rate limiting and security features
- Modern UI/UX

## Tech Stack

### Backend
- Flask
- SQLAlchemy
- JWT Authentication
- Flask-Limiter
- Flask-Talisman
- ReportLab (PDF generation)
- MySQL/SQLite

### Frontend
- React
- Material-UI
- Axios
- React Router

## Setup

1. Clone the repository
```bash
git clone https://github.com/yourusername/kasirkuy.git
cd kasirkuy
```

2. Set up virtual environment
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies
```bash
pip install -r requirements.txt
```

4. Configure environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

5. Initialize database
```bash
cd backend
flask db upgrade
```

## Development

1. Start backend server
```bash
cd backend
flask run
```

2. Start frontend development server
```bash
cd frontend
npm install
npm start
```

## Deployment

### Koyeb Deployment

1. Create a new Koyeb account if you haven't already
2. Install Koyeb CLI
3. Configure your environment variables in Koyeb dashboard
4. Deploy using Git:
   - Connect your GitHub repository
   - Select the main branch
   - Configure build settings using the Procfile
   - Set environment variables
   - Deploy!

## Security Features

- Rate limiting on all endpoints
- Password complexity requirements
- Brute force protection
- JWT token management
- Security headers (HSTS, CSP, etc.)
- SQL injection protection
- XSS protection
- CSRF protection

## API Documentation

Detailed API documentation is available in the `/docs` folder.

## License

MIT License

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request 