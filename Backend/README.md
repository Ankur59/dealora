# Dealora Backend API

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Express.js](https://img.shields.io/badge/Express.js-000000?logo=express&logoColor=white)](https://expressjs.com/)

Production-ready RESTful API backend for Dealora - a modern mobile coupon and deals application. Built with Node.js, Express, and MongoDB, featuring Firebase authentication and comprehensive security measures.

---

## 📋 Table of Contents

- [Features](#-features)
- [Technology Stack](#-technology-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Running the Application](#-running-the-application)
- [Project Structure](#-project-structure)
- [API Documentation](#-api-documentation)
- [Security](#-security)
- [Testing](#-testing)
- [Deployment](#-deployment)

---

## ✨ Features

- 🔐 **Firebase Authentication** - Secure user authentication using Firebase Admin SDK
- 📊 **MongoDB Integration** - Scalable NoSQL database with Mongoose ODM
- 🛡️ **Production-Ready Security** - Helmet, CORS, rate limiting, and input sanitization
- ✅ **Request Validation** - Comprehensive input validation using express-validator
- 📝 **Structured Logging** - Winston and Morgan for application and HTTP logging
- 🚦 **Centralized Error Handling** - Standardized error responses

---

## 🚀 Technology Stack

- **Runtime**: Node.js (v18+ LTS)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Firebase Admin SDK (UID based)
- **Validation**: express-validator
- **Logging**: Winston & Morgan
- **Security**: Helmet, CORS, Rate Limiting

---

## 📋 Prerequisites

- **Node.js** (v18.0.0 or higher)
- **MongoDB** (Local or Atlas)
- **Firebase Project** (Service Account credentials)

---

## 🔧 Installation

```bash
# Clone repository
git clone https://github.com/yourusername/dealora-backend.git
cd dealora-backend

# Install dependencies
npm install
```

---

## ⚙️ Configuration

Create a `.env` file in the root directory:

```env
# Server Configuration
NODE_ENV=development
PORT=5000

# Database
MONGO_URI=mongodb://localhost:27017/dealora

# Security
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000      # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100      # Max requests per window

# Firebase Configuration
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourPrivateKeyHere\n-----END PRIVATE KEY-----\n"
```

### Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Navigate to **Project Settings** → **Service Accounts**
3. Click **Generate New Private Key**
4. Extract `project_id`, `client_email`, and `private_key` to `.env`

---

## 🏃 Running the Application

```bash
# Development mode (with nodemon)
npm run dev

# Production mode
npm start
```

**Verify server:**
```bash
curl http://localhost:5000/health
```

---

## 📂 Project Structure

```
src/
├── config/         # Database, Firebase, and app configuration
├── controllers/    # Business logic for requests
├── middlewares/    # Authentication, validation, and error handling
├── models/         # Mongoose schema definitions
├── routes/         # API route definitions
├── utils/          # Helper functions (logger, response handler)
└── app.js          # Express app setup
server.js           # Application entry point
```

---

## 📡 API Documentation

### Base URL
```
Development: http://localhost:5000
Production: https://api.yourdomain.com
```

### Authentication
Protected endpoints require Firebase ID token:
```
Authorization: Bearer <firebase_id_token>
```

---

### Endpoints

#### Health Check
```http
GET /health
```

#### User Signup
```http
POST /api/auth/signup
Content-Type: application/json

{
  "uid": "firebase_user_uid",
  "name": "John Doe",
  "email": "john.doe@example.com",
  "phone": "1234567890"
}
```

#### User Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "uid": "firebase_user_uid"
}
```

#### Get Profile (Protected)
```http
GET /api/auth/profile
Authorization: Bearer <firebase_id_token>
```

#### Update Profile (Protected)
```http
PUT /api/auth/profile
Authorization: Bearer <firebase_id_token>
Content-Type: application/json

{
  "name": "John Updated Doe",
  "phone": "9876543210"
}
```

### Response Format

**Success:**
```json
{
  "status": "success",
  "message": "Operation successful",
  "data": { }
}
```

**Error:**
```json
{
  "status": "error",
  "message": "Error description",
  "errors": [ ]
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | OK - Request succeeded |
| `201` | Created - Resource created |
| `400` | Bad Request - Validation errors |
| `401` | Unauthorized - Invalid/missing token |
| `404` | Not Found - Resource not found |
| `409` | Conflict - Duplicate data |
| `429` | Too Many Requests - Rate limit exceeded |
| `500` | Internal Server Error |

---

## 🛡️ Security

- **Helmet**: Secure HTTP headers
- **CORS**: Configurable cross-origin resource sharing
- **Rate Limiting**: 100 requests per 15 minutes (configurable)
- **Input Sanitization**: XSS and injection prevention
- **Firebase Auth**: Token-based authentication
- **Environment Variables**: Sensitive data protection

---

## 🧪 Testing

### cURL Examples

**Signup:**
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

**Login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"uid": "test_uid_123"}'
```

**Get Profile:**
```bash
curl http://localhost:5000/api/auth/profile \
  -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN"
```

---

## 🚀 Deployment

### DigitalOcean Droplet

```bash
# SSH into droplet
ssh root@your_droplet_ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
git clone https://github.com/yourusername/dealora-backend.git
cd dealora-backend
npm install --production

# Create .env file with production values
nano .env

# Install PM2 for process management
sudo npm install -g pm2

# Start application
pm2 start server.js --name dealora-api

# Setup PM2 to start on reboot
pm2 startup
pm2 save

# Configure Nginx as reverse proxy
sudo apt install nginx
sudo nano /etc/nginx/sites-available/dealora

# Add Nginx configuration:
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable site and restart Nginx
sudo ln -s /etc/nginx/sites-available/dealora /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Setup SSL with Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use MongoDB Atlas for database
- [ ] Update `CORS_ORIGIN` with production domain
- [ ] Configure SSL/TLS certificates
- [ ] Set up PM2 for process management
- [ ] Configure Nginx reverse proxy
- [ ] Set up automated backups
- [ ] Configure monitoring and logging

---
