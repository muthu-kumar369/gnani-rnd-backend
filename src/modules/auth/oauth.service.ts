import { v4 as uuidv4 } from 'uuid';
import { IOAuthProvider, IUser, IRefreshToken } from '../user/user.entity.js';
import { AppleAdapter, GitHubAdapter, GoogleAdapter, MicrosoftAdapter } from './providers/index.js';
import { AuthService } from './auth.service.js';
import { OAuthStateService } from './oauth-state.service.js';
import { validateRedirectUri } from '../../core/security/oauth-security.util.js';
import { oauthConfig } from '../../config/index.js';
import { createContextualLogger } from '../../core/logger/logger.js';
import User from '../user/user.entity.js';

const logger = createContextualLogger({ module: 'OAuthService' });

export class OAuthService {
    private readonly googleAdapter = new GoogleAdapter();
    private readonly appleAdapter = new AppleAdapter();
    private readonly githubAdapter = new GitHubAdapter();
    private readonly microsoftAdapter = new MicrosoftAdapter();
    private readonly authService = new AuthService();
    private readonly stateService = new OAuthStateService();

    /**
     * Generate OAuth authorization URL
     * @param provider - OAuth provider name
     * @param redirectUri - Optional custom redirect URI
     * @param usePKCE - Whether to use PKCE (recommended for desktop/Electron apps)
     * @param userId - Optional user ID for linking flow
     * @returns Authorization URL and state
     */
    public generateAuthUrl(
        provider: string,
        redirectUri?: string,
        usePKCE: boolean = false,
        userId?: string
    ): { authUrl: string; state: string } {
        // Validate redirect URI if provided
        const config = (oauthConfig as any)[provider];
        if (!config) {
            throw new Error(`Invalid provider: ${provider}`);
        }

        const finalRedirectUri = redirectUri || config.redirectUri;
        if (!validateRedirectUri(finalRedirectUri, config.allowedRedirectUris)) {
            logger.warn(`Invalid redirect URI: ${finalRedirectUri}`);
            throw new Error('Invalid redirect URI');
        }

        // Create OAuth session
        const session = this.stateService.createSession(provider, finalRedirectUri, usePKCE, userId);

        // Generate auth URL based on provider
        let authUrl: string;
        switch (provider) {
            case 'google':
                authUrl = this.googleAdapter.generateAuthUrl(
                    session.state,
                    session.nonce,
                    session.codeChallenge,
                    finalRedirectUri
                );
                break;
            case 'apple':
                authUrl = this.appleAdapter.generateAuthUrl(
                    session.state,
                    session.nonce,
                    finalRedirectUri
                );
                break;
            case 'github':
                authUrl = this.githubAdapter.generateAuthUrl(session.state, finalRedirectUri);
                break;
            case 'microsoft':
                authUrl = this.microsoftAdapter.generateAuthUrl(
                    session.state,
                    session.nonce,
                    session.codeChallenge,
                    finalRedirectUri
                );
                break;
            default:
                throw new Error(`Unsupported provider: ${provider}`);
        }

        logger.info(`Generated OAuth URL for provider: ${provider}`);
        return { authUrl, state: session.state };
    }

    /**
     * Handle OAuth callback and authenticate user
     * @param provider - OAuth provider name
     * @param code - Authorization code from provider
     * @param state - State parameter for CSRF protection
     * @param nonce - Optional nonce for replay protection
     * @returns User, tokens, and onboarding status
     */
    public async handleCallback(
        provider: string,
        code: string,
        state: string,
        nonce?: string
    ): Promise<{ accessToken: string, refreshToken: IRefreshToken, user: Partial<IUser>, isNewUser: boolean, isOnboarded: boolean }> {
        // Validate and consume session
        const session = this.stateService.consumeSession(state, provider);
        if (!session) {
            logger.warn(`Invalid or expired OAuth session for state: ${state.substring(0, 8)}...`);
            throw new Error('Invalid or expired OAuth session');
        }

        // Validate nonce if applicable
        if (!this.stateService.validateNonce(session, nonce)) {
            throw new Error('Invalid nonce');
        }

        // Exchange code for token and get profile
        const profile = await this.exchangeCodeAndGetProfile(provider, code, session.codeVerifier);

        // If this is a linking flow (userId exists in session), link provider to existing user
        if (session.userId) {
            const { user, message } = await this.linkProviderToUser(session.userId, provider, profile);
            // Return existing tokens or generate new ones if needed by frontend
            // For now, re-authenticating to get tokens
            return await this.authenticateUser(provider, profile);
        }

        // Otherwise, authenticate user (login or register)
        return await this.authenticateUser(provider, profile);
    }

    /**
     * Link OAuth provider to existing authenticated user
     * @param userId - User ID to link provider to
     * @param provider - OAuth provider name
     * @param code - Authorization code from provider
     * @param redirectUri - Redirect URI used in OAuth flow
     * @returns Updated user
     */
    public async linkProvider(
        userId: string,
        provider: string,
        code: string,
        redirectUri: string
    ): Promise<{ user: Partial<IUser>; message: string }> {
        // Get user
        const user = await User.findOne({ userId });
        if (!user) {
            throw new Error('User not found');
        }

        // Exchange code for token and get profile
        const profile = await this.exchangeCodeAndGetProfile(provider, code);

        // Check if provider is already linked
        const existingProvider = user.oauthProviders.find((p: IOAuthProvider) => p.provider === provider);
        if (existingProvider) {
            // Update existing provider
            existingProvider.providerUserId = profile.oauthProviders![0].providerUserId;
            existingProvider.linkedAt = new Date();
        } else {
            // Add new provider
            user.oauthProviders.push(profile.oauthProviders![0]);
        }

        await user.save();
        logger.info(`Linked ${provider} to user: ${userId}`);

        return { user: { userId: user.userId, username: user.username, email: user.email, roles: user.roles, isOnboarded: user.isOnboarded }, message: `${provider} linked successfully` };
    }

    /**
     * Unlink OAuth provider from user
     * @param userId - User ID
     * @param provider - OAuth provider name
     * @returns Updated user
     */
    public async unlinkProvider(userId: string, provider: string): Promise<{ user: Partial<IUser>; message: string }> {
        const user = await User.findOne({ userId });
        if (!user) {
            throw new Error('User not found');
        }

        // Check if user has other auth methods
        const hasPassword = !!user.passwordHash;
        const otherProviders = user.oauthProviders.filter((p: IOAuthProvider) => p.provider !== provider);

        if (!hasPassword && otherProviders.length === 0) {
            throw new Error('Cannot unlink last authentication method');
        }

        // Remove provider
        user.oauthProviders = otherProviders;
        await user.save();

        logger.info(`Unlinked ${provider} from user: ${userId}`);
        return { user: { userId: user.userId, username: user.username, email: user.email, roles: user.roles, isOnboarded: user.isOnboarded }, message: `${provider} unlinked successfully` };
    }

    /**
     * Original authenticate method (kept for backward compatibility)
     */
    public async authenticate(provider: string, code: string, redirectUri: string): Promise<{ accessToken: string, refreshToken: IRefreshToken, user: Partial<IUser>, isNewUser: boolean, isOnboarded: boolean }> {
        const profile = await this.exchangeCodeAndGetProfile(provider, code);
        return await this.authenticateUser(provider, profile);
    }

    /**
     * Exchange authorization code for token and get user profile
     * @private
     */
    private async exchangeCodeAndGetProfile(
        provider: string,
        code: string,
        codeVerifier?: string
    ): Promise<Partial<IUser>> {
        let profile: Partial<IUser>;

        switch (provider) {
            case 'google':
                const googleToken = await this.googleAdapter.exchangeCodeForToken(code, codeVerifier);
                profile = await this.googleAdapter.getProfile(googleToken.access_token);
                break;
            case 'apple':
                const appleToken = await this.appleAdapter.exchangeCodeForToken(code);
                profile = await this.appleAdapter.getProfile(appleToken.id_token);
                break;
            case 'github':
                const githubToken = await this.githubAdapter.exchangeCodeForToken(code);
                profile = await this.githubAdapter.getProfile(githubToken.access_token);
                break;
            case 'microsoft':
                const microsoftToken = await this.microsoftAdapter.exchangeCodeForToken(code, codeVerifier);
                profile = await this.microsoftAdapter.getProfile(microsoftToken.access_token);
                break;
            default:
                throw new Error('Invalid provider');
        }

        return profile;
    }

    /**
     * Authenticate user (login or register)
     * @private
     */
    private async authenticateUser(provider: string, profile: Partial<IUser>): Promise<{ accessToken: string, refreshToken: IRefreshToken, user: Partial<IUser>, isNewUser: boolean, isOnboarded: boolean }> {
        let user = await User.findOne({ email: profile.email });
        let isNewUser = false;

        if (user) {
            // Link provider to existing user
            const providerExists = user.oauthProviders.some((p: IOAuthProvider) => p.provider === provider);
            if (!providerExists && profile.oauthProviders) {
                user.oauthProviders.push(profile.oauthProviders[0]);
                await user.save();
            }
        } else {
            // Create new user
            if (!profile.email) {
                throw new Error('Email not provided by OAuth provider');
            }
            user = new User({
                ...profile,
                username: `${profile.email.split('@')[0]}_${uuidv4()}`,
                email: profile.email,
                isOnboarded: false,
            });
            await user.save();
            isNewUser = true;
        }

        const accessToken = this.authService.generateAccessToken(user.userId, '1h');
        const refreshToken = this.authService.generateRefreshToken(user.userId, '7d'); // Consider passing deviceId/userAgent here

        await this.authService.saveRefreshToken(user.userId, refreshToken);

        return {
            user: { userId: user.userId, username: user.username, email: user.email, roles: user.roles, isOnboarded: user.isOnboarded },
            accessToken,
            refreshToken,
            isNewUser,
            isOnboarded: user.isOnboarded,
        };
    }

    /**
     * Link provider to existing user
     * @private
     */
    private async linkProviderToUser(userId: string, provider: string, profile: Partial<IUser>) {
        const user = await User.findOne({ userId });
        if (!user) {
            throw new Error('User not found');
        }

        // Check if provider is already linked
        const existingProvider = user.oauthProviders.find((p: IOAuthProvider) => p.provider === provider);
        if (existingProvider) {
            // Update existing provider
            existingProvider.providerUserId = profile.oauthProviders![0].providerUserId;
            existingProvider.linkedAt = new Date();
        } else {
            // Add new provider
            user.oauthProviders.push(profile.oauthProviders![0]);
        }

        await user.save();
        logger.info(`Linked ${provider} to user: ${userId} via callback`);

        return {
            user,
            message: `${provider} linked successfully`,
        };
    }
}
