# Unified OAuth 2.0 Authentication

This document outlines the implementation of the unified OAuth 2.0 authentication flow for the Gnani voice assistant.

## API Endpoint

### `POST /auth/oauth`

This endpoint handles authentication with all supported OAuth providers.

**Request Body:**

| Field | Type | Description |
|---|---|---|
| `provider` | `string` | The OAuth provider to use. Supported values are `google`, `apple`, `github`, `microsoft`. |
| `code` | `string` | The authorization code received from the OAuth provider. |
| `redirectUri` | `string` | The redirect URI used in the initial OAuth request. This must match the one configured for the provider. |

**Example Request:**

```json
{
    "provider": "google",
    "code": "4/0AY0e-g7...-...",
    "redirectUri": "http://localhost:3000/auth/google/callback"
}
```

**Success Response (200 OK):**

| Field | Type | Description |
|---|---|---|
| `user` | `object` | The user object. |
| `accessToken` | `string` | A short-lived JWT access token. |
| `refreshToken` | `string` | A long-lived JWT refresh token. |
| `isNewUser` | `boolean` | `true` if a new user was created, `false` otherwise. |
| `isOnboarded` | `boolean` | `true` if the user has completed the onboarding process, `false` otherwise. |

**Example Response:**

```json
{
    "user": {
        "userId": "...",
        "username": "...",
        "email": "...",
        ...
    },
    "accessToken": "...",
    "refreshToken": "...",
    "isNewUser": true,
    "isOnboarded": false
}
```

**Error Responses:**

*   **400 Bad Request:** If the request body is invalid or the provider is not supported.
*   **500 Internal Server Error:** If there is an error during the OAuth flow (e.g., failed to exchange code for token).

## Frontend Integration

1.  **Initiate OAuth Flow:**
    The frontend should redirect the user to the authorization URL of the desired OAuth provider. The `redirect_uri` should be a page on the frontend that can receive the authorization code.

2.  **Receive Authorization Code:**
    After the user authorizes the application, the OAuth provider will redirect them to the `redirect_uri` with the authorization code in the query parameters.

3.  **Send Code to Backend:**
    The frontend should extract the authorization code from the URL and send it to the `POST /auth/oauth` endpoint along with the provider name and the original `redirectUri`.

4.  **Store Tokens:**
    The backend will return an `accessToken` and a `refreshToken`. These should be stored securely on the client-side. The `accessToken` should be sent in the `Authorization` header for all subsequent requests to the API.

5.  **Handle Onboarding:**
    If the `isOnboarded` flag in the response is `false`, the frontend should redirect the user to the onboarding flow.

## Provider Configuration

The following environment variables must be set on the server for the OAuth flow to work:

*   `GOOGLE_CLIENT_ID`
*   `GOOGLE_CLIENT_SECRET`
*   `GOOGLE_REDIRECT_URI`
*   `APPLE_TEAM_ID`
*   `APPLE_KEY_ID`
*   `APPLE_PRIVATE_KEY`
*   `APPLE_REDIRECT_URI`
*   `GITHUB_CLIENT_ID`
*   `GITHUB_CLIENT_SECRET`
*   `GITHUB_REDIRECT_URI`
*   `MICROSOFT_CLIENT_ID`
*   `MICROSOFT_CLIENT_SECRET`
*   `MICROSOFT_REDIRECT_URI`
