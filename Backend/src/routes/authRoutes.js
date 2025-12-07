/**
 * Authentication Routes
 * 
 * Defines all authentication-related API endpoints:
 * - POST /signup - Create new user account
 * - POST /login - User login
 * - GET /profile - Get authenticated user profile
 * - PUT /profile - Update user profile
 * 
 * @module routes/authRoutes
 */

const express = require('express');
const router = express.Router();

// Import controllers
const { signup, login, getProfile, updateProfile } = require('../controllers/authController');

// Import validation middleware
const { validateSignup, validateLogin, validateProfileUpdate } = require('../middlewares/validation');

// Import authentication middleware
const authenticate = require('../middlewares/authenticate');

/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user
 * @access  Public
 * @body    { uid, name, email, phone }
 */
router.post('/signup', validateSignup, signup);

/**
 * @route   POST /api/auth/login
 * @desc    Login user and update last login
 * @access  Public
 * @body    { uid }
 */
router.post('/login', validateLogin, login);

/**
 * @route   GET /api/auth/profile
 * @desc    Get authenticated user's profile
 * @access  Protected
 * @header  Authorization: Bearer <firebase_token>
 */
router.get('/profile', authenticate, getProfile);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Protected
 * @body    { name?, profilePicture? }
 * @header  Authorization: Bearer <firebase_token>
 */
router.put('/profile', authenticate, validateProfileUpdate, updateProfile);

module.exports = router;
