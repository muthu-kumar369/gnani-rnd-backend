import { v4 as uuidv4 } from 'uuid';
import { IOAuthProvider, IUser } from '../user/user.entity.js';
import { AppleAdapter, GitHubAdapter, GoogleAdapter, MicrosoftAdapter } from './providers/index.js';
import { AuthService } from './auth.service.js';
import User from '../user/user.entity.js';

export class OAuthService {
    private readonly googleAdapter = new GoogleAdapter();
    private readonly appleAdapter = new AppleAdapter();
    private readonly githubAdapter = new GitHubAdapter();
    private readonly microsoftAdapter = new MicrosoftAdapter();
    private readonly authService = new AuthService();

    public async authenticate(provider: string, code: string, redirectUri: string) {
        let profile: Partial<IUser>;

        switch (provider) {
            case 'google':
                const googleToken = await this.googleAdapter.exchangeCodeForToken(code);
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
                const microsoftToken = await this.microsoftAdapter.exchangeCodeForToken(code);
                profile = await this.microsoftAdapter.getProfile(microsoftToken.access_token);
                break;
            default:
                throw new Error('Invalid provider');
        }

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
                username: `${profile.email.split('@')[0]}_${uuidv4()}`, // a default username
                email: profile.email,
                isOnboarded: false,
            });
            await user.save();
            isNewUser = true;
        }

        const accessToken = this.authService.generateToken(user.userId, '1h');
        const refreshToken = this.authService.generateToken(user.userId, '7d');

        return {
            user,
            accessToken,
            refreshToken,
            isNewUser,
            isOnboarded: user.isOnboarded,
        };
    }
}
