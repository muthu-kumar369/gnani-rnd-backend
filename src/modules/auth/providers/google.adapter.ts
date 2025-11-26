import axios from 'axios';
import { oauthConfig } from '../../../config/index.js';
import { IOAuthProvider, IUser } from '../../user/user.entity.js';

interface GoogleTokenResponse {
    access_token: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
    token_type: string;
    id_token: string;
}

interface GoogleProfileResponse {
    id: string;
    email: string;
    verified_email: boolean;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
    locale: string;
}

export class GoogleAdapter {
    private readonly config = oauthConfig.google;

    /**
     * Generate Google OAuth authorization URL
     * @param state - CSRF protection state
     * @param nonce - Replay attack protection nonce
     * @param codeChallenge - Optional PKCE code challenge
     * @param redirectUri - Optional custom redirect URI
     * @returns Authorization URL
     */
    public generateAuthUrl(
        state: string,
        nonce: string,
        codeChallenge?: string,
        redirectUri?: string
    ): string {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: redirectUri || this.config.redirectUri,
            response_type: 'code',
            scope: this.config.scopes.join(' '),
            state,
            nonce,
            access_type: 'offline', // Request refresh token
            prompt: 'consent', // Force consent screen to get refresh token
        });

        // Add PKCE if provided
        if (codeChallenge) {
            params.append('code_challenge', codeChallenge);
            params.append('code_challenge_method', 'S256');
        }

        return `${this.config.authUrl}?${params.toString()}`;
    }

    public async exchangeCodeForToken(code: string, codeVerifier?: string): Promise<GoogleTokenResponse> {
        const { clientId, clientSecret, redirectUri } = this.config;

        const body: any = {
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
        };

        // Add PKCE verifier if provided
        if (codeVerifier) {
            body.code_verifier = codeVerifier;
        }

        const { data } = await axios.post<GoogleTokenResponse>(this.config.tokenUrl, body);
        return data;
    }

    public async getProfile(accessToken: string): Promise<Partial<IUser>> {
        const { data } = await axios.get<GoogleProfileResponse>('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const oauthProvider: IOAuthProvider = {
            provider: 'google',
            providerUserId: data.id,
            linkedAt: new Date(),
        } as IOAuthProvider;

        return {
            email: data.email,
            profile: {
                firstName: data.given_name,
                lastName: data.family_name,
                profilePhoto: data.picture,
            },
            oauthProviders: [oauthProvider],
        } as Partial<IUser>;
    }
}
