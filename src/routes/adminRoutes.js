// src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware, authorizeRoles } = require('../middlewares/authMiddleware');

// Example of a role-protected route
router.get('/dashboard', authMiddleware, authorizeRoles('admin', 'owner'), (req, res) => { // Note: path changed to '/dashboard'
    res.status(200).json({ message: 'Welcome to the Admin Dashboard!' });
});

module.exports = router;
