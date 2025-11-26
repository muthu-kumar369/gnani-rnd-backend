import {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    APPLE_CLIENT_ID,
    APPLE_TEAM_ID,
    APPLE_KEY_ID,
    APPLE_PRIVATE_KEY,
    APPLE_REDIRECT_URI,
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
    GITHUB_REDIRECT_URI,
    MICROSOFT_CLIENT_ID,
    MICROSOFT_CLIENT_SECRET,
    MICROSOFT_REDIRECT_URI,
} from './env.config.js';

export const oauthConfig = {
    google: {
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        redirectUri: GOOGLE_REDIRECT_URI,
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scopes: ['openid', 'profile', 'email'],
        allowedRedirectUris: [
            GOOGLE_REDIRECT_URI,
            'http://localhost:*',
            'http://127.0.0.1:*',
        ],
    },
    apple: {
        clientId: APPLE_CLIENT_ID,
        teamId: APPLE_TEAM_ID,
        keyId: APPLE_KEY_ID,
        privateKey: APPLE_PRIVATE_KEY,
        redirectUri: APPLE_REDIRECT_URI,
        authUrl: 'https://appleid.apple.com/auth/authorize',
        tokenUrl: 'https://appleid.apple.com/auth/token',
        scopes: ['name', 'email'],
        allowedRedirectUris: [
            APPLE_REDIRECT_URI,
            'http://localhost:*',
            'http://127.0.0.1:*',
        ],
    },
    github: {
        clientId: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
        redirectUri: GITHUB_REDIRECT_URI,
        authUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        scopes: ['user:email', 'read:user'],
        allowedRedirectUris: [
            GITHUB_REDIRECT_URI,
            'http://localhost:*',
            'http://127.0.0.1:*',
        ],
    },
    microsoft: {
        clientId: MICROSOFT_CLIENT_ID,
        clientSecret: MICROSOFT_CLIENT_SECRET,
        redirectUri: MICROSOFT_REDIRECT_URI,
        authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        scopes: ['openid', 'profile', 'email', 'User.Read'],
        allowedRedirectUris: [
            MICROSOFT_REDIRECT_URI,
            'http://localhost:*',
            'http://127.0.0.1:*',
        ],
    },
};

