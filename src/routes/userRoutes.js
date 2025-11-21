// src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware } = require('../middlewares/authMiddleware');

// User Profile & Settings Routes (Protected)
// Note: paths changed as they will be mounted under '/user'
router.get('/profile', authMiddleware, userController.getProfile);
router.put('/settings', authMiddleware, userController.updateSettings);
router.get('/devices', authMiddleware, userController.getDevices);
router.post('/devices', authMiddleware, userController.addDevice);
router.put('/devices/:deviceId', authMiddleware, userController.updateDevice);

module.exports = router;
