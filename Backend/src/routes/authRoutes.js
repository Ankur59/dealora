const express = require('express');
const router = express.Router();

const { signup, login, getProfile, updateProfile, updateFCMToken, deleteFCMToken } = require('../controllers/authController');
const { validateSignup, validateLogin, validateProfileUpdate, validateFCMToken } = require('../middlewares/validation');
const authenticate = require('../middlewares/authenticate');

router.post('/signup', validateSignup, signup);
router.post('/login', validateLogin, login);
router.get('/profile', getProfile);
router.put('/profile', authenticate, validateProfileUpdate, updateProfile);
router.post('/fcm-token', validateFCMToken, updateFCMToken);
router.delete('/fcm-token', deleteFCMToken);

module.exports = router;
