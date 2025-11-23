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

Stage 5 Goal: Implement **Query Processing & Classification** for GNANI backend. This module takes real-time transcripts from Stage 4b (Whisper), cleans the text, classifies the intent, applies caching, and prepares the prompt for the Context Engine (Stage 6).

Requirements:

1. **Text Cleaning & Normalization**

- Remove noise, filler words, and non-speech artifacts
- Normalize text: lowercase, punctuation, spacing
- Handle common speech-to-text errors from Whisper
- Optional: basic spell correction

2. **Intent Classification**

- Classify text into types:
  - `conversation` → normal chat
  - `system_command` → GNANI action
  - `search_query` → web or local search
  - `utility_request` → timers, calculator, notes
  - `multi_step_instruction` → multi-action workflow
- Implement modular function `classifyIntent(text)` returning intent type
- Allow future replacement with ML/NLP model if needed

3. **Session Context & Memory**

- Maintain short-term memory per session (last 5 interactions)
- Store into in-memory cache (Redis optional later)
- Placeholder for long-term memory (vector DB) integration

4. **Prompt Preparation**

- Build structured prompt for Context Engine:
  - Include session memory
  - Include user profile settings (from Stage 2)
  - Include current transcript
  - Include classification result
- Ensure prompt is modular for LLM ingestion

5. **Caching**

- If same query is repeated, use cached result to reduce LLM calls
- Cache key: hash of cleaned transcript + userId
- Expiry: configurable (e.g., 1 hour)

6. **Logging**

- Log:
  - Original transcript
  - Cleaned text
  - Classified intent
  - Cache hit/miss
- Include timestamps

7. **Error Handling**

- Handle empty or invalid transcripts
- Handle classification errors gracefully
- Ensure pipeline doesn’t break for one bad session

8. **Modularity**

- Structure:
  - `query_processor.js` → main pipeline
  - `text_cleaner.js` → cleaning & normalization
  - `intent_classifier.js` → intent classification
  - `cache_manager.js` → in-memory caching
- Include comments for future extensions (ML/NLP, vector DB, embedding)

9. **Future Integration Notes**

- Output → Stage 6 (Context Engine)
- Classification helps Context Engine decide:
  - Chat response
  - Execute system action
  - Search or utility command
- Pipeline supports multi-session concurrent transcripts

Instructions for Gemini:

- Implement a **fully working Node.js query processing module**
- Accept partial/final transcripts from Whisper
- Clean text, classify intent, manage session memory, prepare structured prompt
- Include caching with in-memory store
- Modular code structure (`query_processor.js`, `text_cleaner.js`, `intent_classifier.js`, `cache_manager.js`)
- Include error handling and logging
- Include comments explaining each step
- Do not integrate LLM execution yet — Stage 6 will handle that
