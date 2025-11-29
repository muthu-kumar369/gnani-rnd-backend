You are assisting as a senior backend infrastructure engineer.

Your task:
1. Analyze the entire folder named **gnani-rnd-backend**.  
   - Automatically detect the tech stack, project structure, package managers, scripts, runtime environment, and configuration patterns.
   - Identify how the project initializes services, loads environment variables, and organizes modules.

2. Completely set up **Redis** for the backend:
   - Detect if Docker is being used; if yes, update or create the needed docker-compose service for Redis.
   - If Docker is not used, install Redis locally in the correct way based on OS and stack.
   - Install and configure the Redis Node.js library (e.g., redis or ioredis) based on what suits the project structure.

3. Update the setup script:
   - Locate the existing setup shell script(s) without me giving the exact file names.
   - Modify the setup script so that it:
     - Installs Redis if needed.
     - Installs required Redis dependencies in Node.js.
     - Sets up environment variables automatically.
     - Verifies Redis connection after install.
   - If no setup script exists, intelligently create one following the coding patterns used in this project.

4. Update environment configuration:
   - Find the `.env` or environment config system the project uses.
   - Add Redis variables following the same conventions:
     - REDIS_HOST
     - REDIS_PORT
     - REDIS_PASSWORD (if required)
     - REDIS_DB
   - Ensure no sensitive data is hardcoded.

5. After completing all changes:
   - Output a clear explanation of what changes you made and where.
   - Make sure nothing breaks existing functionality.

Important:
- Do not ask me for the file names; find them yourself by scanning the project.
- Follow the coding style and architecture already used in the project.
- Ensure the setup script can be used in the future when setting up on a new laptop.
