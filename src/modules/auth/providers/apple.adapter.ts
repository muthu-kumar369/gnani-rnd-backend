import axios from 'axios';
import jwt from 'jsonwebtoken';
import { oauthConfig } from '../../../config/index.js';
import { IOAuthProvider, IUser } from '../../user/user.entity.js';

interface AppleTokenResponse {
    access_token: string;
    expires_in: number;
    id_token: string;
    refresh_token: string;
    token_type: string;
}

interface AppleProfile {
    sub: string;
    email: string;
    email_verified: string;
    is_private_email: string;
    name?: {
        firstName?: string;
        lastName?: string;
    };
}

export class AppleAdapter {
    private readonly config = oauthConfig.apple;

    private getClientSecret(): string {
        const { clientId, teamId, keyId, privateKey } = this.config;
        const now = Math.floor(Date.now() / 1000);
        const claims = {
            iss: teamId,
            iat: now,
            exp: now + 86400 * 180, // 180 days
            aud: 'https://appleid.apple.com',
            sub: clientId,
        };

        return jwt.sign(claims, privateKey, {
            algorithm: 'ES256',
            keyid: keyId,
        });
    }

    /**
     * Generate Apple OAuth authorization URL
     * Note: Apple supports nonce but not PKCE
     * @param state - CSRF protection state
     * @param nonce - Replay attack protection nonce
     * @param redirectUri - Optional custom redirect URI
     * @returns Authorization URL
     */
    public generateAuthUrl(state: string, nonce: string, redirectUri?: string): string {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: redirectUri || this.config.redirectUri,
            response_type: 'code',
            scope: this.config.scopes.join(' '),
            state,
            nonce,
            response_mode: 'form_post', // Apple recommends form_post for security
        });

        return `${this.config.authUrl}?${params.toString()}`;
    }

    public async exchangeCodeForToken(code: string): Promise<AppleTokenResponse> {
        const { clientId, redirectUri } = this.config;
        const clientSecret = this.getClientSecret();

        const { data } = await axios.post<AppleTokenResponse>(
            this.config.tokenUrl,
            new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }).toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );
        return data;
    }

    public async getProfile(idToken: string): Promise<Partial<IUser>> {
        const decoded = jwt.decode(idToken) as AppleProfile;

        const oauthProvider: IOAuthProvider = {
            provider: 'apple',
            providerUserId: decoded.sub,
            linkedAt: new Date(),
        } as IOAuthProvider;

        return {
            email: decoded.email,
            profile: {
                firstName: decoded.name?.firstName,
                lastName: decoded.name?.lastName,
            },
            oauthProviders: [oauthProvider],
        } as Partial<IUser>;
    }
}
