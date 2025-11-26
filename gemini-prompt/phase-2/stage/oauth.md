You are an expert senior backend engineer working on the Gnani voice assistant.
Your task is to implement a unified, enterprise-grade OAuth authentication system using a SINGLE API endpoint that supports ALL OAuth providers (Google, Apple, Microsoft, GitHub, and future providers).

Before writing any code, you MUST:

1. Fully analyze the existing authentication implementation:

   - Current folder structure
   - Current User schema
   - Existing email/password login + register flows
   - Current token generation logic
   - Session & refresh token handling
   - Existing middleware (auth middleware, validators)
   - Any Redis logic if present

2. Based on the existing structure, design and implement a unified OAuth flow, similar to Google Assistant / Siri standards:

   - ONE endpoint: POST /auth/oauth
   - Accepts: provider, authorizationCode, redirectUri, and optional extraData
   - Handles ALL providers internally using provider-specific configs
   - Secure server-side OAuth code exchange
   - Token introspection / verification
   - Extract profile: email, name, profile photo
   - Strict validation: state, nonce (Apple), and redirect URIs

3. The unified OAuth controller must:

   - Load provider configuration dynamically from config/env
   - Based on "provider", execute the correct OAuth strategy:
     - google
     - apple
     - github
     - microsoft
     - custom/future providers
   - Use modular provider adapters (googleAdapter, appleAdapter, etc.)

4. Account management rules:

   - If email already exists → link OAuth provider to the existing user
   - If user does not exist → create new user with onboarding status
   - Always issue:
     - accessToken (short-lived)
     - refreshToken (long-lived)
   - Store refresh token in Redis if available
   - Store provider linkage:
     user.oauthProviders = [
     {
     provider: string,
     providerUserId: string,
     linkedAt: Date
     }
     ]

5. Update User Model only if needed:

   - Add/ensure fields:
     profilePhoto
     isOnboarded
     oauthProviders: [...]
   - DO NOT BREAK existing email/password authentication

6. The unified OAuth API must return:
   {
   user: {...},
   accessToken: "...",
   refreshToken: "...",
   session: {...},
   isNewUser: boolean,
   isOnboarded: boolean
   }

7. Security requirements:

   - Validate OAuth codes server-to-server ONLY
   - Validate state (CSRF protection)
   - Validate nonce for Apple Sign In
   - Hash refresh tokens before storing in DB/Redis
   - Prevent duplicate users via email merging
   - Use HTTPS-only redirects
   - Strict input validation

8. After implementation, generate:

   - Complete backend code for:
     controllers/authController.js
     services/oauthService.js
     services/providers/\*.js (google, apple, etc.)
     routes/auth.js
   - Updated User model (if required)
   - Example request/response samples
   - Error handling patterns
   - Full API documentation for POST /auth/oauth
   - Provider config documentation:
     GOOGLE_CLIENT_ID
     GOOGLE_CLIENT_SECRET
     APPLE_TEAM_ID
     APPLE_KEY_ID
     APPLE_PRIVATE_KEY
     etc.

9. Also generate integration notes for Electron + React frontend:
   - How to initiate OAuth
   - How to pass code → backend
   - How to store returned tokens securely
   - How to handle onboarding after OAuth login

IMPORTANT RULES:

- DO NOT delete or rewrite existing authentication logic.
- DO NOT break email/password login and register flows.
- Only extend the current system with a unified OAuth module.
- All new code must match existing coding style and structure.
- Always check the current codebase first before generating new code.

Begin by scanning the entire authentication folder and summarizing the current implementation, then proceed to implement the unified OAuth system.
