// src/middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/config');
const logger = require('../utils/logger');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
    // Get token from header
    const token = req.header('x-auth-token');

    // Check if no token
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // Verify token
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded.user;

        // Optionally, fetch full user object from DB and attach
        req.fullUser = await User.findById(req.user.id).select('-passwordHash');
        if (!req.fullUser) {
            return res.status(401).json({ message: 'User not found, authorization denied' });
        }
        next();
    } catch (err) {
        logger.error(`Auth middleware error: ${err.message}`);
        res.status(401).json({ message: 'Token is not valid' });
    }
};

const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.fullUser || !req.fullUser.roles) {
            return res.status(403).json({ message: 'Authorization denied: No roles found' });
        }
        const hasPermission = req.fullUser.roles.some(role => roles.includes(role));
        if (!hasPermission) {
            return res.status(403).json({ message: 'Authorization denied: Insufficient role' });
        }
        next();
    };
};

module.exports = { authMiddleware, authorizeRoles };
