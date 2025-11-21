// src/controllers/authController.js
const authService = require('../services/authService');
const { createContextualLogger } = require('../utils/logger'); // Import logger factory
const auditService = require('../services/auditService'); // Import audit service
const errorHandler = require('../utils/error_handler');

class AuthController {
    constructor() {
        this.logger = createContextualLogger({ module: 'AuthController' }); // Create a logger instance
    }

    async register(req, res, next) {
        const { username, email, password } = req.body;
        try {
            const user = await authService.registerUser({ username, email, password });
            auditService.logAuthEvent(user.userId, 'REGISTER', 'success', { username, email });
            res.status(201).json({ message: 'User registered successfully', userId: user.userId });
        } catch (error) {
            this.logger.error(`Registration error for ${username || email}: ${error.message}`);
            auditService.logAuthEvent(null, 'REGISTER', 'failure', { username, email, error: error.message });
            next(error); // Pass error to centralized error handler
        }
    }

    async login(req, res, next) {
        const { loginIdentifier, password } = req.body;
        try {
            const { token, user } = await authService.loginUser(loginIdentifier, password);
            auditService.logAuthEvent(user.userId, 'LOGIN', 'success', { loginIdentifier });
            res.status(200).json({ message: 'Login successful', token, user });
        } catch (error) {
            this.logger.error(`Login error for ${loginIdentifier}: ${error.message}`);
            auditService.logAuthEvent(null, 'LOGIN', 'failure', { loginIdentifier, error: error.message });
            next(error); // Pass error to centralized error handler
        }
    }
}

module.exports = new AuthController();
