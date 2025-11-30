You are assisting as a senior AI backend engineer and realtime agent systems architect.

Your task is to analyze the entire backend inside the folder **gnani-rnd-backend** and implement a complete Tool Layer using a TWO-STAGE LLM → TOOL → LLM reasoning pipeline without breaking the existing realtime flow.

Gemini must detect all project structures automatically.

────────────────────────────────────────
🔍 PART 1 — Analyze Existing Gnani Pipeline
────────────────────────────────────────
Scan the whole backend and identify:
1. gRPC audio streaming → how text is generated.
2. How the current prompt builder works.
3. How context memory is combined (short-term, long-term, Redis).
4. How the LLM is invoked and streamed back.
5. Where in the backend the tool layer should be inserted.

Output an internal diagram:
ASR → Memory → PromptBuilder → LLM → Stream → TTS

────────────────────────────────────────
🧩 PART 2 — Implement a TWO-STAGE LLM Tool Reasoning Pipeline
────────────────────────────────────────

Gemini must implement the following exact structure:

------------------------
STAGE 1 — TOOL DECISION
------------------------
After ASR text + memory retrieval:
1. Call the LLM with a special “Tool Decision Prompt”.
2. The LLM must ONLY return structured JSON:
   {
     "needs_tool": true/false,
     "tool_name": "...",
     "parameters": { ... }
   }
3. No conversational text here.
4. Gemini must create the decision prompt file and detect best location.

------------------------------
STAGE 2 — TOOL EXECUTION
------------------------------
If needs_tool = true:
1. ToolRegistry checks if tool exists.
2. Tool is executed using external APIs.
3. Tool result is returned in normalized structure:
   {
     "tool_name": "...",
     "data": { ... }
   }

If needs_tool = false:
→ Skip tool logic entirely.

-------------------------------------------
STAGE 3 — FINAL LLM RESPONSE (HUMANIZED)
-------------------------------------------
If a tool was used:
1. A second LLM call is made.
2. Input contains:
   - User original query
   - Tool output
   - Context memory
3. LLM generates the final natural-language answer for user.

If no tool was needed:
→ LLM answer from Stage 1 is replaced by this final response.

-----------------------------------------------
REQUIREMENT: DO NOT break existing streaming.
-----------------------------------------------

────────────────────────────────────────
🧰 PART 3 — Intelligent Tool Detection Layer
────────────────────────────────────────
Gemini must create a **ToolDetector** AND the LLM-based decision step:
- Only call tools when necessary.
- Detect user intent:
  “What’s the weather?”, “Tell me time”, “Define”, “Search Wikipedia”, etc.
- If ambiguous, default to non-tool LLM response.

Tools must include (at minimum):
1. Weather
2. Time
3. Date
4. Location resolution
5. Dictionary
6. Wikipedia
7. General Search
8. (Optional) Currency conversion, calculator, news

Tools must be:
- Rarely blocking
- Configurable
- Modular
- Auto-registered

────────────────────────────────────────
⚙️ PART 4 — Implement the Tool Registry Module
────────────────────────────────────────
Gemini must build or upgrade a **ToolRegistry**:

Each tool follows:
{
  name: string,
  detect?: (query) => score OR boolean,
  execute: async (params) => { ...data }
}

ToolRegistry must expose:
runTool(toolName, params)
listTools()

────────────────────────────────────────
🔗 PART 5 — Integrate Tools Into Prompt Pipeline
────────────────────────────────────────
Modify the existing backend so the flow becomes:

1. User text arrives.
2. MemoryManager gets short-term + long-term + session memory.
3. **First LLM call (decision)**:
   → Does this require a tool?
4. If YES:
   → Run tool → Get tool data.
5. **Second LLM call (final answer)**:
   → Produce the human-friendly response.
6. Stream response to user → TTS pipeline.

PromptBuilder must be updated to:
- Handle Stage 1 decision prompt
- Handle Stage 2 post-tool prompt
- Insert tool output in structured format
- Avoid duplication
- Respect token limits

────────────────────────────────────────
🌍 PART 6 — Update Environment Variables
────────────────────────────────────────
Gemini must add fields to .env:
WEATHER_API_KEY
SEARCH_API_KEY
WIKIPEDIA_ENDPOINT
MAPS_API_KEY

Also detect existing config conventions.

────────────────────────────────────────
🔐 PART 7 — Error Handling + Fallbacks
────────────────────────────────────────
Gemini must:
- Gracefully fallback to LLM-only answering if a tool fails.
- Avoid breaking the streaming pipeline.
- Add logging consistent with existing conventions.
- Cache expensive results using Redis.

────────────────────────────────────────
🛠 PART 8 — Backwards Compatibility
────────────────────────────────────────
Gemini must ensure:
- Existing LLM behavior remains intact.
- No disruption to ASR/TTS.
- Existing API endpoints continue working.
- No changes break the electron frontend.

────────────────────────────────────────
📦 PART 9 — Final Output
────────────────────────────────────────
After finishing implementation, output:

1. Summary of changes.
2. New two-stage tool architecture.
3. File/module names created or updated.
4. How to test tool decision flow.
5. How to test tool execution manually.
6. How to add new tools in future.

Important:
- Do NOT ask for file names; detect everything yourself.
- Follow all naming patterns, architecture style, and folder structure already used.
- Keep entire streaming LLM pipeline stable.
