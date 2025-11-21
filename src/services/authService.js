// src/services/authService.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const { createContextualLogger } = require('../utils/logger'); // Import logger factory
const auditService = require('../services/auditService'); // Import audit service
const { JWT_SECRET } = require('../configs/config'); // Updated path

class AuthService {
    constructor() {
        this.logger = createContextualLogger({ module: 'AuthService' }); // Create a logger instance
    }

    /**
     * Registers a new user.
     * @param {Object} userData - User data for registration.
     * @returns {Object} - Newly created user object.
     */
    async registerUser(userData) {
        const { username, email, password } = userData;

        // Check if user already exists
        let user = await User.findOne({ $or: [{ username }, { email }] });
        if (user) {
            this.logger.warn(`Registration attempt for existing user: ${username || email}`);
            auditService.logAuthEvent(null, 'REGISTER', 'failure', { username, email, reason: 'User already exists' });
            throw new Error('User with that username or email already exists.');
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Create new user
        user = new User({
            userId: uuidv4(),
            username,
            email,
            passwordHash,
            // Default roles and settings are handled by schema defaults
        });

        await user.save();
        this.logger.info(`User registered successfully: ${user.username}`);
        auditService.logAuthEvent(user.userId, 'REGISTER', 'success', { username, email });
        return user;
    }

    /**
     * Authenticates a user and generates a JWT token.
     * @param {string} loginIdentifier - Username or email.
     * @param {string} password - User's password.
     * @returns {Object} - JWT token and user info.
     */
    async loginUser(loginIdentifier, password) {
        // Find user by username or email
        let user = await User.findOne({
            $or: [{ username: loginIdentifier.toLowerCase() }, { email: loginIdentifier.toLowerCase() }]
        });

        if (!user) {
            this.logger.warn(`Login attempt with unknown identifier: ${loginIdentifier}`);
            auditService.logAuthEvent(null, 'LOGIN', 'failure', { loginIdentifier, reason: 'Invalid credentials - user not found' });
            throw new Error('Invalid credentials');
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            // Track failed login attempt
            user.security.failedLoginAttempts = (user.security.failedLoginAttempts || 0) + 1;
            user.security.lastFailedLogin = Date.now();
            await user.save();
            this.logger.warn(`Failed login attempt for user ${user.username}`);
            auditService.logAuthEvent(user.userId, 'LOGIN', 'failure', { loginIdentifier, reason: 'Invalid credentials - wrong password' });
            throw new Error('Invalid credentials');
        }

        // Reset failed login attempts on successful login
        user.security.failedLoginAttempts = 0;
        user.lastLoginAt = Date.now();
        await user.save();

        // Generate JWT
        const payload = {
            user: {
                id: user.id,
                userId: user.userId,
                roles: user.roles,
            },
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' }); // Token expires in 1 hour
        this.logger.info(`User logged in successfully: ${user.username}`);
        auditService.logAuthEvent(user.userId, 'LOGIN', 'success', { loginIdentifier });

        return { token, user: { id: user.id, userId: user.userId, username: user.username, email: user.email, roles: user.roles } };
    }
}

module.exports = new AuthService();
