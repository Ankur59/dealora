# Dealora Backend API

Production-grade Node.js REST API for the Dealora mobile coupon/deals application.

## 🚀 Technology Stack

- **Runtime**: Node.js (v18+ LTS)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Firebase Admin SDK (UID based)
- **Validation**: express-validator
- **Logging**: Winston & Morgan
- **Security**: Helmet, CORS, Rate Limiting

## 📂 Project Structure

```
src/
├── config/         # Database, Firebase, and app configuration
├── controllers/    # Business logic for requests
├── middlewares/    # Authentication, validation, and error handling
├── models/         # Mongoose schema definitions
├── routes/         # API route definitions
├── utils/          # Helper functions (logger, response handler, validators)
└── app.js          # Express app setup
server.js           # Application entry point
```

## 🛠️ Setup Instructions

### 1. Prerequisites

- Node.js (v18 or higher)
- MongoDB (Local or Atlas connection string)
- Firebase Project (Service Account credentials)

### 2. Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### 3. Environment Configuration

Create a `.env` file in the root directory based on `.env.example`:

```env
# Server
NODE_ENV=development
PORT=5000

# Database
MONGO_URI=mongodb://localhost:27017/dealora

# Security
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Firebase (Required for Authentication)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
```

### 4. Running the Server

- **Development Mode** (with nodemon):
  ```bash
  npm run dev
  ```
- **Production Mode**:
  ```bash
  npm start
  ```

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/signup` | Register a new user | No |
| `POST` | `/api/auth/login` | Login user (update last login) | No |
| `GET` | `/api/auth/profile` | Get current user profile | Yes (Bearer Token) |
| `PUT` | `/api/auth/profile` | Update user profile | Yes (Bearer Token) |

### Health Check

- `GET /health` - Check server status

## 🔒 Security Features

- **Helmet**: Sets secure HTTP headers.
- **CORS**: Configurable cross-origin resource sharing.
- **Rate Limiting**: Protects against brute-force and DDoS attacks (default: 100 req/15min).
- **Input Sanitization**: Prevents XSS and injection attacks.
- **Validation**: Strict strict validation on all inputs using `express-validator`.

## 📝 Error Handling

Centralized error handling with standardized JSON responses:

- `400 Bad Request` - Validation errors
- `401 Unauthorized` - Invalid or missing tokens
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource or route not found
- `409 Conflict` - Duplicate data (e.g., email already exists)
- `500 Internal Server Error` - Server-side issues

## 🧪 Testing

To test the API endpoints, you can use `curl` or Postman.

**Example Signup:**
```bash
curl -X POST http://localhost:5000/api/auth/signup \
   -H "Content-Type: application/json" \
   -d '{
     "uid": "test_uid_123",
     "name": "Jane Doe",
     "email": "jane@example.com",
     "phone": "9876543210"
   }'
```
