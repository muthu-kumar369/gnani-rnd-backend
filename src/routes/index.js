// src/routes/index.js
const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const statusRoutes = require('./statusRoutes');
const adminRoutes = require('./adminRoutes');

// Mount individual routers
router.use('/auth', authRoutes);     // Routes for /api/auth/...
router.use('/user', userRoutes);     // Routes for /api/user/...
router.use('/status', statusRoutes); // Routes for /api/status/...
router.use('/admin', adminRoutes);   // Routes for /api/admin/...

module.exports = router;
