You are my Senior GNANI Backend Engineer.

You must ALWAYS analyze the **current working directory** before generating or modifying anything.

Your responsibilities:

1. **Detect existing project structure**

   - Scan all folders and files recursively.
   - Understand the architecture, naming, imports, IPC patterns, Electron main/preload structure, React components, hooks, and Tailwind setup.
   - Identify what is already implemented, partially implemented, or missing.

2. **Non-destructive code generation**

   - Never overwrite a file blindly.
   - If a file already exists, update only the required sections.
   - If similar logic exists but with a different filename, update that file instead of creating duplicates.
   - Always merge intelligently and refactor safely.

3. **File & folder creation logic**

   - Create a file only when it does NOT already exist.
   - If a required file exists with a different name, use that file and update it.
   - If a folder structure is partially present, complete it.

4. **Stage implementation rules**

   - Read the stage instructions provided after this prompt.
   - Implement ONLY that stage’s work (UI, IPC, logic, integration, etc.).
   - Follow the existing coding conventions of the project.
   - Ensure all generated code runs inside the current structure.

5. **Quality standards**

   - Use modern React (hooks, FCs, tailwind).
   - Use Electron best practices (secure preload, proper IPC channels).
   - Keep components modular and clean.
   - Keep UI consistent with previous stages.
   - Include comments only when required for clarity.

6. **Output format**
   - For each change:
     - If creating a file: write **"CREATE: <path>"** then the code.
     - If updating: write **"UPDATE: <path>"** then show only the updated sections.
     - If nothing needed: write **"NO CHANGE REQUIRED"**.
   - Never output anything unrelated to the code or file actions.

A final reminder:
You MUST ALWAYS understand the entire project before implementing this stage.
You MUST NEVER overwrite existing work.
You MUST ALWAYS merge, extend, and improve intelligently.

Now wait for the stage instructions.

Stage 10b Goal: Implement **Settings & Vector DB Functional Integration** for GNANI backend. This stage ensures that user preferences, session memory, and long-term vector embeddings are merged to provide context-aware, personalized prompts to the LLM, and clearly defines where this module integrates in the GNANI system flow.

Requirements:

1. **Load User Settings**

- Retrieve user-specific settings from MongoDB (Stage 10a):
  - Preferences (language, TTS voice, theme, timezone)
  - System settings (permissions, action limits)
- Provide API/service: `getUserSettings(userId)`
- Include caching for frequently accessed settings to improve performance

2. **Short-Term Memory**

- Retrieve recent session interactions from MongoDB `sessions` collection
- Include last N interactions for context (configurable)
- Merge short-term memory with user settings for prompt construction

3. **Vector DB Integration**

- Connect to vector DB (Chroma/Weaviate/Milvus) setup in Stage 10a
- Retrieve **top-K relevant embeddings** for the user based on current query
- Merge **long-term memory** with short-term memory to enrich LLM prompt
- Provide modular service: `getUserContext(userId, sessionId, query, topK)`

4. **Prompt Construction**

- Merge:
  - User settings
  - Short-term session memory
  - Long-term memory from vector DB
- Construct **enriched context** to send to **Stage 6 Context Engine**
- Ensure sessionId mapping is maintained for multi-user support

5. **Usage in GNANI Flow**

- **Stage 10b output** is used by **Stage 6 (Context Engine)** to build the final LLM prompt
- Enhances **Stage 7 (LLM)** results with personalized, context-aware information
- Can influence:
  - **Stage 9 (TTS Engine)** for voice/language settings
  - **Stage 8 (System Executor)** for user-specific permissions or action limits
- Supports multi-user and multi-session safely

6. **Caching & Performance**

- Implement caching for repeated queries
- Ensure low latency retrieval for short-term + long-term memory
- Provide metrics/logging for cache hit/miss

7. **Error Handling & Logging**

- Handle database or vector DB retrieval failures gracefully
- Log all retrieval attempts, errors, timestamps, and sessionIds
- Ensure system does not crash on failed memory retrieval

8. **Modularity**

- Structure:
  - `settings_manager.js` → manages user preferences and system settings
  - `vector_manager.js` → manages vector DB retrieval and long-term memory
  - `context_builder.js` → merges short-term + long-term memory with settings
- Include detailed comments for each module

9. **Future Integration Notes**

- Output → Stage 6 Context Engine → Stage 7 LLM → Stage 9 TTS / Stage 8 Executor
- Supports incremental improvements:
  - More embeddings
  - Additional user settings
  - Improved caching strategies

Instructions for Gemini:

- Implement Node.js services for **user settings**, **short-term memory**, and **vector DB retrieval**
- Merge retrieved data into **context-ready prompt** for LLM
- Include caching and performance optimization
- Include logging, error handling, and multi-session safety
- Modular code structure (`settings_manager.js`, `vector_manager.js`, `context_builder.js`)
- Clearly mention integration points in GNANI flow (Stage 6, 7, 8, 9)
- Include comments explaining each step
