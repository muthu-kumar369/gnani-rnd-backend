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

    public async exchangeCodeForToken(code: string): Promise<MicrosoftTokenResponse> {
        const { clientId, clientSecret, redirectUri } = this.config;

        const params = new URLSearchParams();
        params.append('client_id', clientId);
        params.append('scope', 'user.read');
        params.append('code', code);
        params.append('redirect_uri', redirectUri);
        params.append('grant_type', 'authorization_code');
        params.append('client_secret', clientSecret);


        const { data } = await axios.post<MicrosoftTokenResponse>(
            'https://login.microsoftonline.com/common/oauth2/v2.0/token',
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
