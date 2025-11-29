You are assisting as a senior realtime AI systems engineer and conversation memory architect.

Your task is to analyze and improve the complete conversational flow inside the folder **gnani-rnd-backend**.  
You must automatically identify the structure without asking me for file names.

---------------------------------------
🔍 PART 1 — Analyze the Existing Realtime Flow
---------------------------------------
1. Scan the entire project and identify:
   - How the gRPC audio stream is received.
   - How the ASR text chunks are constructed.
   - How final transcripts are produced.
   - How prompts are currently constructed.
   - How the LLM response is generated.
   - How responses are streamed back to the user.
   - How TTS is triggered.
   - How frontend status is updated.

2. Produce a complete internal flow diagram *in text* after analyzing:
   Audio Stream → ASR → PromptBuilder → LLM → Response → TTS → Stream Back.

3. Detect any missing or incomplete logic in the flow.

---------------------------------------
🔍 PART 2 — Analyze Current Memory Implementation
---------------------------------------
1. Identify existing memory or context-related modules.
2. Detect incomplete or placeholder logic.
3. Understand how memory is currently being passed to the prompt builder.
4. Identify gaps or missing architecture for long-term or short-term memory.

---------------------------------------
🧠 PART 3 — Implement a Complete Conversation Memory System
---------------------------------------

### A) Short-Term Memory (MongoDB)
Implement short-term memory with the following rules:
- Store user and Gnani messages for the current session.
- Only store messages for the last **X days** (auto-detected from constants or create a new config value).
- Maintain chronological conversation history.
- Auto-delete older short-term memory samples.
- Make short-term memory available when constructing prompts.

### B) Long-Term Memory (ChromaDB)
Implement long-term memory with the following rules:
- When conversations exceed short-term retention, summarize and embed them.
- Store embeddings in ChromaDB.
- Implement a retrieval function to fetch relevant past memories based on semantic similarity.
- Integrate retrieved memories into the prompt builder.
- Ensure no blocking operations during gRPC streaming.

### C) Redis Layer
Use Redis as a high-speed caching layer for:
- Recent conversation messages (optional)
- Current session state (user speaking state, last intent, etc.)
- Frequently accessed short-term memory segments

Gemini must detect where Redis fits best and use it intelligently without blocking the existing flow.

---------------------------------------
🧩 PART 4 — Build a Unified Memory Manager
---------------------------------------
Create or update a **MemoryManager** module that:
- Combines short-term memory retrieval (MongoDB)
- Long-term memory retrieval (ChromaDB)
- Fast-access session memory (Redis)
- Selects the most relevant memories using:
  - Time-based priority
  - Semantic ranking
  - Token budget awareness
- Exposes a single function:
    getContextForPrompt(userId, currentQuery)

This should return:
- Short-term conversation history
- Retrieved long-term memory snippets
- Important session data from Redis

All formatted for structured prompt building.

---------------------------------------
🧱 PART 5 — Update the Prompt Builder
---------------------------------------
1. Analyze the existing prompt builder.
2. Refactor it to include:
   - Short-term memory context
   - Long-term memory retrieval
   - Redis session state
3. Ensure the final prompt follows a clean internal structure:
   - System Instructions
   - User Profile (optional)
   - Short-term memory window
   - Long-term relevant memory
   - Latest user query

4. Ensure token limits and truncation rules are handled automatically.

---------------------------------------
⚙️ PART 6 — Modify gRPC Response Flow to Use Memory
---------------------------------------
Update the streaming response logic so that:
- Every user message is stored in short-term memory.
- Every Gnani reply is stored after streaming.
- Summaries of long interactions are sent to ChromaDB.
- Redis maintains the live session state.

---------------------------------------
🛡 PART 7 — Do Not Break Existing Functionality
---------------------------------------
- Maintain all existing APIs.
- Keep all current LLM streaming behavior intact.
- Follow the existing code style and architecture.
- Use intelligent file placement based on project conventions.
- Make no breaking changes unless absolutely needed.

---------------------------------------
📦 PART 8 — Final Output
---------------------------------------
After completing all changes, output:
1. A summary of what was implemented.
2. The new architecture.
3. Naming conventions for files/modules created.
4. How the new memory system works end-to-end.
5. Instructions for testing the flow.

Important:
- Do NOT ask for file names; detect everything automatically.
- Adapt to the existing architecture.
- Maintain high performance for realtime streaming.
