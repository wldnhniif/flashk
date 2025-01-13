# KasirKuy - Point of Sale System

A modern Point of Sale (POS) system built with Flask and React. This application provides a secure and efficient way to manage products, generate receipts, and handle user authentication.

## Features

- User authentication with JWT
- Role-based access control (Admin/User)
- Product management (CRUD operations)
- Receipt generation (PDF)
- Secure file uploads
- Rate limiting
- Security headers
- Cross-Origin Resource Sharing (CORS) configuration

## Tech Stack

### Backend
- Flask
- Flask-JWT-Extended
- Flask-CORS
- Flask-Limiter
- Flask-Talisman
- Supabase
- ReportLab
- Gunicorn

### Frontend
- React
- Next.js
- Tailwind CSS
- React Icons
- Supabase Client

## Getting Started

### Prerequisites
- Python 3.11
- Node.js
- npm/yarn
- Supabase account

### Installation

1. Clone the repository
```bash
git clone <your-repo-url>
cd kasierkuy
```

2. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # Configure your environment variables
```

3. Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env.local  # Configure your environment variables
```

### Running the Application

1. Start the backend server
```bash
cd backend
python app.py
```

2. Start the frontend development server
```bash
cd frontend
npm run dev
```

## Environment Variables

### Backend (.env)
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_KEY`: Your Supabase project API key
- `JWT_SECRET_KEY`: Secret key for JWT token generation
- `JWT_ACCESS_TOKEN_EXPIRES`: Token expiration time in seconds

### Frontend (.env.local)
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase project public API key
- `NEXT_PUBLIC_API_URL`: Backend API URL

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
