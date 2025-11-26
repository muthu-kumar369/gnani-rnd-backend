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

    public async exchangeCodeForToken(code: string): Promise<GoogleTokenResponse> {
        const { clientId, clientSecret, redirectUri } = this.config;
        const { data } = await axios.post<GoogleTokenResponse>('https://oauth2.googleapis.com/token', {
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
        });
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
