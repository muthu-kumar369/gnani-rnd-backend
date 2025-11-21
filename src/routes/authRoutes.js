// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Auth Routes
router.post('/register', authController.register); // Note: path changed to '/register' as it will be mounted under '/auth'
router.post('/login', authController.login);     // Note: path changed to '/login' as it will be mounted under '/auth'

module.exports = router;
