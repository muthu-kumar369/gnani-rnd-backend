You are assisting as a senior backend API and caching architect.

Your task:
1. Analyze the entire backend project inside the folder **gnani-rnd-backend**.
   - Understand the folder structure, controllers, services, models, middlewares, and utility patterns.
   - Identify shared modules where caching logic should be placed.
   - Automatically detect how responses and business logic flow.

2. Implement Redis caching for all suitable APIs:
   - Follow project conventions and coding style.
   - DO NOT break any existing functionality.
   - Cache only safe and static/repeatable data (Gemini should auto-detect).
   - Skip caching sensitive APIs (authentication, OTP, etc.).
   - Add cache invalidation logic where required.
   - Ensure cached data is serialized/deserialized correctly.

3. Implement Redis connection in a standard, reusable way:
   - Create or update a central Redis connection utility.
   - Use environment variables added previously.
   - Ensure it exports a clean, maintainable client instance.

4. Modify API handlers and services intelligently:
   - Add “check cache before DB” and “update cache after DB write” flows.
   - Use appropriate TTL.
   - Ensure no duplication or inconsistent cache keys.

5. Code must match the architectural structure already present:
   - Whether the project uses services, repositories, or controllers, Gemini must adapt accordingly.
   - If modular pattern exists, integrate caching respecting that pattern.

6. At the end:
   - Produce a clear summary of the files updated.
   - Explain the caching strategy applied.
   - Explain how cache invalidation works.
   - Ensure the project remains fully functional without requiring code changes from me.

Important:
- Do not ask for file names; discover everything automatically.
- Follow the exact structure the backend already uses.
- Apply changes in a clean, standardized, and scalable way.
