// src/services/authService.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import User, { IUser } from '../../modules/user/user.entity.js';
import RefreshToken, { IRefreshToken } from './refresh-token.entity.js'; // Import from new entity
import { createContextualLogger } from '../../core/logger/logger.js';
import auditService from '../../core/logger/audit.service.js';
import config from '../../config/app.config.js'; // STAGE 1
import { encryptToken, decryptToken } from '../../core/security/oauth-security.util.js';
import { Logger } from 'winston';
import { AuthenticationError } from '../../shared/errors/error-types.js';

export class AuthService {
    private logger: Logger;

    constructor() {
        this.logger = createContextualLogger({ module: 'AuthService' });
    }

    public verifyToken(token: string): any {
        return jwt.verify(token, config.JWT_SECRET);
    }

    public generateAccessToken(userId: string, expiresIn: string = '1h'): string {
        const payload = {
            user: {
                id: userId,
            },
        };

        const now = Math.floor(Date.now() / 1000);
        let exp = now + (60 * 60); // Default 1 hour

        const unit = expiresIn.slice(-1);
        const value = parseInt(expiresIn.slice(0, -1));

        if (unit === 'h') {
            exp = now + (value * 60 * 60);
        } else if (unit === 'd') {
            exp = now + (value * 24 * 60 * 60);
        }

        return jwt.sign({ ...payload, exp }, config.JWT_SECRET);
    }

    public generateRefreshToken(userId: string, expiresIn: string = '7d', deviceId?: string, userAgent?: string): IRefreshToken {
        const token = uuidv4(); // Unique ID for the refresh token
        const expiresAt = new Date(Date.now() + parseInt(expiresIn.slice(0, -1)) * 24 * 60 * 60 * 1000); // e.g., 7 days
        const encryptedToken = encryptToken(token);

        return new RefreshToken({
            userId,
            token: encryptedToken,
            expiresAt,
            issuedAt: new Date(),
            revoked: false,
            deviceId,
            userAgent,
        });
    }

    public async saveRefreshToken(userId: string, refreshToken: IRefreshToken): Promise<void> {
        // Create a new document in the separate collection
        const newRefreshToken = new RefreshToken({
            userId,
            token: refreshToken.token,
            expiresAt: refreshToken.expiresAt,
            revoked: refreshToken.revoked,
            deviceId: refreshToken.deviceId,
            userAgent: refreshToken.userAgent
        });
        await newRefreshToken.save();
        this.logger.info(`Refresh token saved for user ${userId}.`);
    }

    public async revokeRefreshToken(userId: string, refreshTokenId: string, replacedByToken?: string): Promise<void> {
        // Find token in separate collection by scanning (due to encryption)
        const userTokens = await RefreshToken.find({ userId, revoked: false });

        // Find the matching token
        const match = userTokens.find(rt => {
            try {
                return decryptToken(rt.token) === refreshTokenId;
            } catch {
                return false;
            }
        });

        if (!match) {
            this.logger.warn(`Refresh token not found for user ${userId}.`);
            return;
        }

        match.revoked = true;
        match.replacedByToken = replacedByToken;
        await match.save();

        this.logger.info(`Refresh token revoked for user ${userId}.`);
    }

    public async rotateRefreshToken(oldRefreshToken: string, userId: string, deviceId?: string, userAgent?: string): Promise<{ accessToken: string; refreshToken: IRefreshToken }> {
        // 1. Decrypt incoming token
        const decryptedOldRefreshToken = decryptToken(oldRefreshToken);

        // 2. Find ALL tokens (including revoked) to check for valid or compromised scenarios
        const userTokens = await RefreshToken.find({ userId });

        const storedRefreshToken = userTokens.find(rt => {
            try {
                return decryptToken(rt.token) === decryptedOldRefreshToken;
            } catch (e) {
                return false;
            }
        });

        if (!storedRefreshToken) {
            // Compromised check: Look for revoked token that matches
            const compromised = userTokens.find(rt => {
                try { return decryptToken(rt.token) === decryptedOldRefreshToken && rt.revoked; } catch { return false; }
            });

            if (compromised) {
                await this.revokeAllRefreshTokens(userId);
                this.logger.warn(`Compromised refresh token used for user ${userId}. All tokens revoked.`);
                throw new Error('Invalid or revoked refresh token. Please log in again.');
            }

            throw new Error('Invalid refresh token.');
        }

        if (storedRefreshToken.revoked || storedRefreshToken.expiresAt < new Date()) {
            throw new Error('Invalid or expired refresh token.');
        }

        // 3. Valid Sequence: Revoke old, Issue new
        storedRefreshToken.revoked = true;

        // Generate new
        const newAccessToken = this.generateAccessToken(userId, '1h');
        const newRefreshTokenObj = this.generateRefreshToken(userId, '7d', deviceId, userAgent);

        storedRefreshToken.replacedByToken = newRefreshTokenObj.token;
        await storedRefreshToken.save();

        // Save new
        await this.saveRefreshToken(userId, newRefreshTokenObj);

        return { accessToken: newAccessToken, refreshToken: newRefreshTokenObj };
    }

    public async revokeAllRefreshTokens(userId: string): Promise<void> {
        await RefreshToken.updateMany({ userId, revoked: false }, { revoked: true });
        this.logger.warn(`All refresh tokens revoked for user ${userId}.`);
    }

    async registerUser(userData: any): Promise<IUser> {
        const { firstName, lastName, email, password } = userData;

        const userExists = await User.findOne({ email: email.toLowerCase() });
        if (userExists) {
            this.logger.warn(`Registration attempt for existing email: ${email}`);
            auditService.logAuthEvent(null, 'REGISTER', 'failure', { email, reason: 'User with this email already exists' });
            throw new Error('User with that email already exists.');
        }

        const baseName = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
        let username = `${baseName}${Math.floor(1000 + Math.random() * 9000)}`;

        let retries = 0;
        while (await User.findOne({ username }) && retries < 3) {
            username = `${baseName}${Math.floor(10000 + Math.random() * 90000)}`;
            retries++;
        }

        if (await User.findOne({ username })) {
            username = `${baseName}${uuidv4().split('-')[0]}`;
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const newUser = new User({
            userId: uuidv4(),
            username,
            email,
            passwordHash,
            profile: {
                firstName,
                lastName,
                locale: 'en-US',
                language: 'en'
            }
        });

        await newUser.save();
        this.logger.info(`User registered successfully: ${newUser.username} (${email})`);
        auditService.logAuthEvent(newUser.userId, 'REGISTER', 'success', { username: newUser.username, email });
        return newUser;
    }

    async loginUser(loginIdentifier: string, password: string): Promise<{ accessToken: string, refreshToken: IRefreshToken, user: Partial<IUser> }> {
        let user = await User.findOne({
            $or: [{ username: loginIdentifier.toLowerCase() }, { email: loginIdentifier.toLowerCase() }]
        });

        if (!user) {
            this.logger.warn(`Login attempt with unknown identifier: ${loginIdentifier} `);
            auditService.logAuthEvent(null, 'LOGIN', 'failure', { loginIdentifier, reason: 'Invalid credentials - user not found' });
            throw new AuthenticationError('Invalid credentials');
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            user.security.failedLoginAttempts = (user.security.failedLoginAttempts || 0) + 1;
            user.security.lastFailedLogin = new Date();
            await user.save();
            this.logger.warn(`Failed login attempt for user ${user.username}`);
            auditService.logAuthEvent(user.userId, 'LOGIN', 'failure', { loginIdentifier, reason: 'Invalid credentials - wrong password' });
            throw new AuthenticationError('Invalid credentials');
        }

        user.security.failedLoginAttempts = 0;
        user.lastLoginAt = new Date();
        await user.save();

        const accessToken = this.generateAccessToken(user.userId);
        const refreshToken = this.generateRefreshToken(user.userId);

        await this.saveRefreshToken(user.userId, refreshToken);

        this.logger.info(`User logged in successfully: ${user.username} `);
        auditService.logAuthEvent(user.userId, 'LOGIN', 'success', { loginIdentifier });

        return {
            accessToken,
            refreshToken,
            user: { userId: user.userId, username: user.username, email: user.email, roles: user.roles, isOnboarded: user.isOnboarded },
        };
    }

    public async logoutUser(userId: string, refreshToken: string): Promise<void> {
        try {
            const decryptedToken = decryptToken(refreshToken);
            await this.revokeRefreshToken(userId, decryptedToken);
            this.logger.info(`User ${userId} logged out successfully(token revoked).`);
        } catch (error: any) {
            this.logger.warn(`Logout failed for user ${userId}: ${error.message} `);
        }
    }
}
