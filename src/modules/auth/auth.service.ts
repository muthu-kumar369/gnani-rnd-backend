// src/services/authService.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import User, { IUser } from '../../modules/user/user.entity.js';
import { createContextualLogger } from '../../core/logger/logger.js';
import auditService from '../../core/logger/audit.service.js';
import { JWT_SECRET } from '../../config/env.config.js';
import { Logger } from 'winston';

class AuthService {
    private logger: Logger;

    constructor() {
        this.logger = createContextualLogger({ module: 'AuthService' });
    }

    async registerUser(userData: any): Promise<IUser> {
        const { username, email, password } = userData;

        let user = await User.findOne({ $or: [{ username }, { email }] });
        if (user) {
            this.logger.warn(`Registration attempt for existing user: ${username || email}`);
            auditService.logAuthEvent(null, 'REGISTER', 'failure', { username, email, reason: 'User already exists' });
            throw new Error('User with that username or email already exists.');
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        user = new User({
            userId: uuidv4(),
            username,
            email,
            passwordHash,
        });

        await user.save();
        this.logger.info(`User registered successfully: ${user.username}`);
        auditService.logAuthEvent(user.userId, 'REGISTER', 'success', { username, email });
        return user;
    }

    async loginUser(loginIdentifier: string, password: string): Promise<{ token: string, user: any }> {
        let user = await User.findOne({
            $or: [{ username: loginIdentifier.toLowerCase() }, { email: loginIdentifier.toLowerCase() }]
        });

        if (!user) {
            this.logger.warn(`Login attempt with unknown identifier: ${loginIdentifier}`);
            auditService.logAuthEvent(null, 'LOGIN', 'failure', { loginIdentifier, reason: 'Invalid credentials - user not found' });
            throw new Error('Invalid credentials');
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            user.security.failedLoginAttempts = (user.security.failedLoginAttempts || 0) + 1;
            user.security.lastFailedLogin = new Date();
            await user.save();
            this.logger.warn(`Failed login attempt for user ${user.username}`);
            auditService.logAuthEvent(user.userId, 'LOGIN', 'failure', { loginIdentifier, reason: 'Invalid credentials - wrong password' });
            throw new Error('Invalid credentials');
        }

        user.security.failedLoginAttempts = 0;
        user.lastLoginAt = new Date();
        await user.save();

        const payload = {
            user: {
                id: user.id,
                userId: user.userId,
                roles: user.roles,
            },
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
        this.logger.info(`User logged in successfully: ${user.username}`);
        auditService.logAuthEvent(user.userId, 'LOGIN', 'success', { loginIdentifier });

        return { token, user: { id: user.id, userId: user.userId, username: user.username, email: user.email, roles: user.roles } };
    }
}

export default new AuthService();
