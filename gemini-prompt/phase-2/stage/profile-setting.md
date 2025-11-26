You are an expert senior backend engineer specializing in:
• Node.js + TypeScript + Express/NestJS backend
• MongoDB / Mongoose schema design and optimization
• Modular and scalable API design
• User profile, settings, and preferences management
• Security, OAuth, device management, and session-based memory
• Maintaining existing functionality while adding new features

Your task:
Analyze the **current Gnani backend project**.  
Do NOT remove or break any existing functionality.  
Focus ONLY on **backend support required for frontend User Profile & Settings features**.

----------------------------------------------------------------------  
CURRENT SCHEMA REFERENCE
----------------------------------------------------------------------

Refer to `/src/models/User.ts`:
• IUser, IProfile, ISettings, IDevice, ISecurity, IHistoryItem, IOAuthProvider
• Embedded schemas and main userSchema

----------------------------------------------------------------------  
GOALS
----------------------------------------------------------------------

1. Implement **feature-based modular backend support**, including:

   **a. Profile Management**
      - Fetch and update user profile (name, dob, locale, language, photo)
      - Validate fields and maintain timestamps

   **b. Assistant Settings**
      - Fetch and update assistant settings (wake word, preferred voice, volume, theme, shortcuts)
      - Validate supported voice and wake word formats
      - Maintain default values if missing

   **c. Devices**
      - List, add, remove devices
      - Track last active
      - Ensure unique device IDs

   **d. Security**
      - Fetch and update security info (MFA, recovery email, failed login attempts)
      - Validation on email, MFA toggling
      - Maintain audit info

   **e. OAuth Providers**
      - List, link, unlink OAuth accounts
      - Track linked timestamps

   **f. Preferences & Notes**
      - Fetch and update user preferences and notes
      - Flexible JSON for future extensions

   **g. History**
      - Fetch and delete conversation history items
      - Ensure timestamped records

2. Analyze existing backend code:
   - Detect missing endpoints, controllers, or services for these features
   - Identify schema gaps, required indexes, or validation improvements

3. Add only **missing backend pieces** to fully support frontend flow
   - If endpoints exist, do not recreate; enhance only if necessary
   - Maintain backward compatibility

4. Feature modularity:
   - Each feature should be self-contained (controller, service, model usage)
   - Scalable for future features (e.g., session memory, analytics, system-level commands)

5. Validation & Security:
   - Apply proper input validation, role-based access, and error handling
   - Ensure MongoDB schema consistency and indexes for efficient queries

----------------------------------------------------------------------  
OUTPUT FORMAT
----------------------------------------------------------------------

1. **Backend Analysis**
   - Existing features and gaps per module
   - Schema adjustments or index improvements

2. **Feature-based APIs**
   - List endpoints per module (minimal required)
   - Request/response structure
   - Validation and error handling notes

3. **Code Patches**
   - Modular controllers/services/routes for missing features
   - Sample TypeScript code

4. **Testing / Verification Plan**
   - Ensure all existing functionality remains intact
   - Unit / integration tests for new APIs

----------------------------------------------------------------------  
STRICT RULES
----------------------------------------------------------------------

• DO NOT remove or break any existing backend functionality  
• Only implement missing pieces to support frontend features  
• All code in TypeScript + Node.js + Express/NestJS + Mongoose  
• Modular, scalable, and secure  
• Maintain consistent coding style and patterns
