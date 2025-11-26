import axios from 'axios';
import { oauthConfig } from '../../../config/index.js';
import { IOAuthProvider, IUser } from '../../user/user.entity.js';

interface MicrosoftTokenResponse {
    token_type: string;
    scope: string;
    expires_in: number;
    access_token: string;
    refresh_token: string;
    id_token: string;
}

interface MicrosoftProfileResponse {
    id: string;
    userPrincipalName: string;
    displayName: string;
    givenName: string;
    surname: string;
    mail: string;
}

export class MicrosoftAdapter {
    private readonly config = oauthConfig.microsoft;

    /**
     * Generate Microsoft OAuth authorization URL
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
            response_mode: 'query',
        });

        // Add PKCE if provided
        if (codeChallenge) {
            params.append('code_challenge', codeChallenge);
            params.append('code_challenge_method', 'S256');
        }

        return `${this.config.authUrl}?${params.toString()}`;
    }

    public async exchangeCodeForToken(code: string, codeVerifier?: string): Promise<MicrosoftTokenResponse> {
        const { clientId, clientSecret, redirectUri } = this.config;

        const params = new URLSearchParams();
        params.append('client_id', clientId);
        params.append('scope', this.config.scopes.join(' '));
        params.append('code', code);
        params.append('redirect_uri', redirectUri);
        params.append('grant_type', 'authorization_code');
        params.append('client_secret', clientSecret);

        // Add PKCE verifier if provided
        if (codeVerifier) {
            params.append('code_verifier', codeVerifier);
        }

        const { data } = await axios.post<MicrosoftTokenResponse>(
            this.config.tokenUrl,
            params.toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );
        return data;
    }

    public async getProfile(accessToken: string): Promise<Partial<IUser>> {
        const { data } = await axios.get<MicrosoftProfileResponse>('https://graph.microsoft.com/v1.0/me', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const oauthProvider: IOAuthProvider = {
            provider: 'microsoft',
            providerUserId: data.id,
            linkedAt: new Date(),
        } as IOAuthProvider;

        return {
            email: data.mail || data.userPrincipalName,
            profile: {
                firstName: data.givenName,
                lastName: data.surname,
            },
            oauthProviders: [oauthProvider],
        } as Partial<IUser>;
    }
}
