import crypto from 'crypto';
import { JWT_ENCRYPTION_SECRET } from '../../config/env.config.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
// Derive a 32-byte (256-bit) key from the secret using SHA256
const ENCRYPTION_KEY = crypto.createHash('sha256').update(JWT_ENCRYPTION_SECRET).digest();

/**
 * Encrypts a given token using AES-256-GCM.
 * @param token - The token string to encrypt.
 * @returns An encrypted token string.
 */
export function encryptToken(token: string): string {
    if (ENCRYPTION_KEY.length !== 32) {
        throw new Error('Encryption key must be 32 bytes long (256 bits).');
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${encrypted}:${tag.toString('hex')}`;
}

/**
 * Decrypts an encrypted token using AES-256-GCM.
 * @param encryptedToken - The encrypted token string.
 * @returns The decrypted token string.
 */
export function decryptToken(encryptedToken: string): string {
    if (ENCRYPTION_KEY.length !== 32) {
        throw new Error('Encryption key must be 32 bytes long (256 bits).');
    }

    const parts = encryptedToken.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const tag = Buffer.from(parts[2], 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

/**
 * OAuth Security Utilities
 * Provides cryptographically secure random value generation for OAuth flows
 */

/**
 * Generate a cryptographically secure random state parameter
 * @returns 32-byte hex string (64 characters)
 */
export function generateState(): string {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a cryptographically secure random nonce parameter
 * @returns 32-byte hex string (64 characters)
 */
export function generateNonce(): string {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a PKCE code_verifier
 * @returns Base64URL-encoded random string (43-128 characters)
 */
export function generateCodeVerifier(): string {
    // Generate 32 random bytes and encode as base64url (43 characters)
    return base64URLEncode(crypto.randomBytes(32));
}

/**
 * Generate a PKCE code_challenge from a code_verifier
 * @param verifier - The code_verifier to hash
 * @returns Base64URL-encoded SHA256 hash of the verifier
 */
export function generateCodeChallenge(verifier: string): string {
    const hash = crypto.createHash('sha256').update(verifier).digest();
    return base64URLEncode(hash);
}

/**
 * Validate a redirect URI against a whitelist
 * @param uri - The redirect URI to validate
 * @param allowedUris - Array of allowed redirect URIs
 * @returns true if valid, false otherwise
 */
export function validateRedirectUri(uri: string, allowedUris: string[]): boolean {
    if (!uri || !allowedUris || allowedUris.length === 0) {
        return false;
    }

    // Exact match or wildcard pattern match
    return allowedUris.some(allowed => {
        if (allowed === uri) {
            return true;
        }

        // Support wildcard patterns like http://localhost:* or http://*.example.com
        if (allowed.includes('*')) {
            const pattern = allowed
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
                .replace(/\*/g, '.*'); // Replace * with .*
            const regex = new RegExp(`^${pattern}$`);
            return regex.test(uri);
        }

        return false;
    });
}

/**
 * Base64URL encode a buffer
 * @param buffer - Buffer to encode
 * @returns Base64URL-encoded string
 */
function base64URLEncode(buffer: Buffer): string {
    return buffer
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

/**
 * Verify a PKCE code_verifier against a code_challenge
 * @param verifier - The code_verifier to verify
 * @param challenge - The code_challenge to verify against
 * @returns true if valid, false otherwise
 */
export function verifyCodeChallenge(verifier: string, challenge: string): boolean {
    const computedChallenge = generateCodeChallenge(verifier);
    return computedChallenge === challenge;
}
