import NodeCache from 'node-cache';
import { generateState, generateNonce, generateCodeVerifier, generateCodeChallenge } from '../../core/security/oauth-security.util.js';
import { createContextualLogger } from '../../core/logger/logger.js';

const logger = createContextualLogger({ module: 'OAuthStateService' });

/**
 * OAuth session data stored temporarily during the OAuth flow
 */
export interface OAuthSession {
    state: string;
    nonce: string;
    codeVerifier?: string;
    codeChallenge?: string;
    provider: string;
    redirectUri: string;
    userId?: string; // For linking flow (when user is already authenticated)
    createdAt: Date;
}

/**
 * Service to manage OAuth state, nonce, and PKCE values
 * Uses in-memory cache with TTL for temporary storage
 */
export class OAuthStateService {
    private cache: NodeCache;
    private readonly TTL = 600; // 10 minutes in seconds

    constructor() {
        // Initialize cache with 10-minute TTL and check period of 60 seconds
        this.cache = new NodeCache({
            stdTTL: this.TTL,
            checkperiod: 60,
            useClones: false,
        });

        // Log cache statistics periodically
        this.cache.on('expired', (key, value) => {
            logger.debug(`OAuth session expired: ${key}`);
        });
    }

    /**
     * Create a new OAuth session with state, nonce, and optional PKCE
     * @param provider - OAuth provider name
     * @param redirectUri - Redirect URI for this OAuth flow
     * @param usePKCE - Whether to generate PKCE values
     * @param userId - Optional user ID for linking flow
     * @returns OAuth session data
     */
    public createSession(
        provider: string,
        redirectUri: string,
        usePKCE: boolean = false,
        userId?: string
    ): OAuthSession {
        const state = generateState();
        const nonce = generateNonce();

        const session: OAuthSession = {
            state,
            nonce,
            provider,
            redirectUri,
            createdAt: new Date(),
        };

        // Add PKCE if requested
        if (usePKCE) {
            session.codeVerifier = generateCodeVerifier();
            session.codeChallenge = generateCodeChallenge(session.codeVerifier);
        }

        // Add userId for linking flow
        if (userId) {
            session.userId = userId;
        }

        // Store session with state as key
        this.cache.set(state, session);

        logger.info(`Created OAuth session for provider: ${provider}, state: ${state.substring(0, 8)}...`);

        return session;
    }

    /**
     * Retrieve and validate an OAuth session by state
     * @param state - State parameter from OAuth callback
     * @returns OAuth session data if valid, null otherwise
     */
    public getSession(state: string): OAuthSession | null {
        if (!state) {
            logger.warn('Attempted to get session with empty state');
            return null;
        }

        const session = this.cache.get<OAuthSession>(state);

        if (!session) {
            logger.warn(`OAuth session not found for state: ${state.substring(0, 8)}...`);
            return null;
        }

        logger.debug(`Retrieved OAuth session for state: ${state.substring(0, 8)}...`);
        return session;
    }

    /**
     * Validate and consume an OAuth session
     * Once consumed, the session is deleted to prevent replay attacks
     * @param state - State parameter from OAuth callback
     * @param provider - Expected provider name
     * @returns OAuth session data if valid, null otherwise
     */
    public consumeSession(state: string, provider: string): OAuthSession | null {
        const session = this.getSession(state);

        if (!session) {
            return null;
        }

        // Validate provider matches
        if (session.provider !== provider) {
            logger.warn(`Provider mismatch: expected ${session.provider}, got ${provider}`);
            return null;
        }

        // Delete session to prevent reuse (replay attack prevention)
        this.cache.del(state);

        logger.info(`Consumed OAuth session for provider: ${provider}, state: ${state.substring(0, 8)}...`);

        return session;
    }

    /**
     * Validate nonce from OAuth callback
     * @param session - OAuth session
     * @param nonce - Nonce from OAuth callback
     * @returns true if valid, false otherwise
     */
    public validateNonce(session: OAuthSession, nonce?: string): boolean {
        // Some providers (like GitHub) don't support nonce
        if (!session.nonce) {
            return true;
        }

        if (!nonce) {
            logger.warn('Nonce validation failed: nonce not provided');
            return false;
        }

        const isValid = session.nonce === nonce;

        if (!isValid) {
            logger.warn('Nonce validation failed: nonce mismatch');
        }

        return isValid;
    }

    /**
     * Get cache statistics
     * @returns Cache statistics
     */
    public getStats() {
        return this.cache.getStats();
    }

    /**
     * Clear all sessions (for testing or maintenance)
     */
    public clearAll(): void {
        this.cache.flushAll();
        logger.info('Cleared all OAuth sessions');
    }
}
