import axios from 'axios';
import { oauthConfig } from '../../../config/index.js';
import { IOAuthProvider, IUser } from '../../user/user.entity.js';

interface GitHubTokenResponse {
    access_token: string;
    scope: string;
    token_type: string;
}

interface GitHubProfileResponse {
    id: number;
    email: string | null;
    name: string | null;
    avatar_url: string;
    login: string;
}

export class GitHubAdapter {
    private readonly config = oauthConfig.github;

    public async exchangeCodeForToken(code: string): Promise<GitHubTokenResponse> {
        const { clientId, clientSecret } = this.config;
        const { data } = await axios.post<GitHubTokenResponse>(
            'https://github.com/login/oauth/access_token',
            {
                code,
                client_id: clientId,
                client_secret: clientSecret,
            },
            {
                headers: {
                    Accept: 'application/json',
                },
            }
        );
        return data;
    }

    public async getProfile(accessToken: string): Promise<Partial<IUser>> {
        const { data } = await axios.get<GitHubProfileResponse>('https://api.github.com/user', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const oauthProvider: IOAuthProvider = {
            provider: 'github',
            providerUserId: data.id.toString(),
            linkedAt: new Date(),
        } as IOAuthProvider;

        const [firstName, lastName] = data.name ? data.name.split(' ') : [data.login, ''];

        return {
            email: data.email,
            profile: {
                firstName: firstName,
                lastName: lastName,
                profilePhoto: data.avatar_url,
            },
            oauthProviders: [oauthProvider],
        } as Partial<IUser>;
    }
}
