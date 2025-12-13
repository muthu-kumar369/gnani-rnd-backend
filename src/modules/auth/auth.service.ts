// src/services/authService.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import User, { IUser, IRefreshToken } from '../../modules/user/user.entity.js';
import { createContextualLogger } from '../../core/logger/logger.js';
import auditService from '../../core/logger/audit.service.js';
import config from '../../config/app.config.js'; // STAGE 1
import { encryptToken, decryptToken } from '../../core/security/oauth-security.util.js';
import { Logger } from 'winston';
import { AuthenticationError } from '../../shared/errors/error-types.js'; // Added import

export class AuthService {
    private logger: Logger;

    constructor() {
        this.logger = createContextualLogger({ module: 'AuthService' });
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

        return jwt.sign({ ...payload, exp }, config.JWT_SECRET); // STAGE 1
    }

    public generateRefreshToken(userId: string, expiresIn: string = '7d', deviceId?: string, userAgent?: string): IRefreshToken {
        const token = uuidv4(); // Unique ID for the refresh token
        const expiresAt = new Date(Date.now() + parseInt(expiresIn.slice(0, -1)) * 24 * 60 * 60 * 1000); // e.g., 7 days
        const encryptedToken = encryptToken(token);

        return {
            token: encryptedToken,
            expiresAt,
            issuedAt: new Date(),
            revoked: false,
            deviceId,
            userAgent,
        } as IRefreshToken;
    }

    public async saveRefreshToken(userId: string, refreshToken: IRefreshToken): Promise<void> {
        const user = await User.findOne({ userId });
        if (!user) {
            this.logger.warn(`User ${userId} not found when saving refresh token.`);
            throw new Error('User not found');
        }

        // Add the new refresh token
        user.refreshTokens.push(refreshToken);

        // Optional: Limit the number of active refresh tokens per user/device for security
        // For example, keep only the last 5 tokens per device, or simply replace old ones.
        // For now, we'll just add it. More complex logic can be added here if needed.

        await user.save();
        this.logger.info(`Refresh token saved for user ${userId}.`);
    }

    public async revokeRefreshToken(userId: string, refreshTokenId: string, replacedByToken?: string): Promise<void> {
        const user = await User.findOne({ userId });
        if (!user) {
            this.logger.warn(`User ${userId} not found when revoking refresh token.`);
            throw new Error('User not found');
        }

        const tokenIndex = user.refreshTokens.findIndex(rt => decryptToken(rt.token) === refreshTokenId);

        if (tokenIndex === -1) {
            this.logger.warn(`Refresh token ${refreshTokenId.substring(0, 8)}... not found for user ${userId}.`);
            return; // Token not found, maybe already revoked or invalid
        }

        user.refreshTokens[tokenIndex].revoked = true;
        user.refreshTokens[tokenIndex].replacedByToken = replacedByToken;
        await user.save();
        this.logger.info(`Refresh token ${refreshTokenId.substring(0, 8)}... revoked for user ${userId}.`);
    }

    public async rotateRefreshToken(oldRefreshToken: string, userId: string, deviceId?: string, userAgent?: string): Promise<{ accessToken: string; refreshToken: IRefreshToken }> {
        const user = await User.findOne({ userId });
        if (!user) {
            throw new Error('User not found');
        }

        const decryptedOldRefreshToken = decryptToken(oldRefreshToken);
        const storedRefreshToken = user.refreshTokens.find(rt => decryptToken(rt.token) === decryptedOldRefreshToken && !rt.revoked && rt.expiresAt > new Date());

        if (!storedRefreshToken) {
            // If the refresh token is not found or is invalid, consider all tokens for this user compromised
            // and revoke all of them. This is a security measure to prevent token replay.
            await this.revokeAllRefreshTokens(userId);
            this.logger.warn(`Compromised refresh token detected for user ${userId}.All tokens revoked.`);
            throw new Error('Invalid or revoked refresh token. Please log in again.');
        }

        // Revoke the old refresh token (and link it to the new one)
        await this.revokeRefreshToken(userId, decryptedOldRefreshToken, storedRefreshToken.token); // Link with encrypted stored token

        // Generate new access and refresh tokens
        const newAccessToken = this.generateAccessToken(userId, '1h');
        const newRefreshToken = this.generateRefreshToken(userId, '7d', deviceId, userAgent);

        // Save the new refresh token
        await this.saveRefreshToken(userId, newRefreshToken);

        return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    }

    public async revokeAllRefreshTokens(userId: string): Promise<void> {
        await User.updateOne(
            { userId },
            { $set: { 'refreshTokens.$[].revoked': true } }
        );
        this.logger.warn(`All refresh tokens revoked for user ${userId}.`);
    }

    async registerUser(userData: any): Promise<IUser> {
        const { firstName, lastName, email, password } = userData;

        // Check if user already exists
        const userExists = await User.findOne({ email: email.toLowerCase() });
        if (userExists) {
            this.logger.warn(`Registration attempt for existing email: ${email}`);
            auditService.logAuthEvent(null, 'REGISTER', 'failure', { email, reason: 'User with this email already exists' });
            throw new Error('User with that email already exists.');
        }

        // Auto-generate username (handle)
        // Strategy: Use first part of email + random suffix to ensure uniqueness
        const baseName = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, ''); // Sanitize
        let username = `${baseName}${Math.floor(1000 + Math.random() * 9000)}`; // Initial try

        // Simple collision check loop (max 3 retries)
        let retries = 0;
        while (await User.findOne({ username }) && retries < 3) {
            username = `${baseName}${Math.floor(10000 + Math.random() * 90000)}`; // Try longer suffix
            retries++;
        }

        // Final fallback if extremely unlucky (using uuid segment)
        if (await User.findOne({ username })) {
            username = `${baseName}${uuidv4().split('-')[0]}`;
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const newUser = new User({
            userId: uuidv4(),
            username, // Auto-generated
            email,
            passwordHash,
            profile: {
                firstName,
                lastName,
                // Initials can be derived dynamically, no need to store unless cached
                locale: 'en-US', // Default
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
        const refreshToken = this.generateRefreshToken(user.userId); // Device info might come from request

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
            // We don't throw here to allow the logout process to complete even if token is invalid
        }
    }
}

