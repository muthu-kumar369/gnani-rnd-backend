You are an expert in real-time AI voice assistants, multi-modal LLM systems, 
streaming architectures, memory frameworks, whisper pipelines, tool routing, and 
production-grade backend engineering. You understand the internal workings of 
advanced assistants like ChatGPT, Google Gemini, and Apple Intelligence.

Your task:
Analyze and upgrade the **entire backend pipeline of Gnani** (and only analyze frontend if needed),
and generate a fully improved architecture that increases accuracy, performance, 
context understanding, tool routing reliability, and memory effectiveness — 
**WITHOUT breaking the existing working flow**.

====================================================
### 🔥 CURRENT SYSTEM SUMMARY (IMPORTANT)
====================================================

### FRONTEND (Analyze only if required, do NOT break)
- Sign-in (email/password + Google OAuth)
- Audio streaming via VAD (gRPC)
- Text input via gRPC
- Barge-in supported
- Device awareness (battery, mic, internet, OS)
- Conversation panel
- Settings page

### BACKEND (Upgradable core)
Flow:
1. Receive audio stream or text
2. If audio → Whisper generates final text
3. Context memory layer uses:
   - MongoDB (short memory)
   - Redis (fast session state)
   - ChromaDB (long memory, dummy now)
4. Prompt builder constructs a merged prompt
5. Model decides:
   - Normal response  
   - OR tool action (structured JSON)
6. Tools implemented:
   - calculator  
   - date  
   - time  
   - search  
   - weather (Open-Meteo)
7. If tool needed:
   - Run tool  
   - Send result back to LLM for natural reply
8. Stream final text response to frontend

====================================================
### 🛑 PROBLEM STATEMENT
====================================================

The system works end-to-end, but quality is far below ChatGPT/Gemini-level:
- Accuracy is unpredictable  
- Model repeats questions  
- Context is misunderstood  
- Memory retrieval weak  
- Tools triggered incorrectly  
- Prompt builder noisy  
- Whisper → LLM latency high  
- Tool responses inconsistent  
- Long-memory dummy, not effective  
- Barge-in sometimes slow  
- Assistant lacks personality coherence  

Your goal is to significantly upgrade the system **without altering or breaking the existing working flow**.  
All improvements must be additive or compatible.

====================================================
### 🎯 WHAT YOU MUST DO
====================================================

You must analyze **every backend layer**, identify issues, and propose industry-level improvements, while respecting:

➡️ **All existing endpoints, pipelines, protocols, and flows must remain intact**  
➡️ **Frontend must not break**  
➡️ **Upgrade must happen inside backend logic, memory, prompts, and models**

Your responsibilities include:

----------------------------------------------------
### 1. Deeply analyze the prompt-building architecture
----------------------------------------------------
- Identify missing context
- Identify redundant/incorrect instruction ordering
- Fix conversation drift
- Prevent self-repetition
- Add hierarchical context layering
- Improve grounding logic

----------------------------------------------------
### 2. Re-architect memory system (MUST remain backward compatible)
----------------------------------------------------
- Improve retrieval strategy (RAG)
- Add hybrid scoring (semantic + recency)
- Improve MongoDB short memory structure
- Fix long-memory logic (ChromaDB)
- Improve Redis state (turn context)
- Propose batching, caching, summarization

----------------------------------------------------
### 3. Upgrade tool-routing intelligence
----------------------------------------------------
- Improve JSON schema
- Add few-shot examples
- Enforce deterministic tool selection
- Add better constraints to avoid hallucinated tools
- Standardize tool outputs  
- Validate tool arguments

----------------------------------------------------
### 4. Optimize the Whisper → Text → LLM pipeline
----------------------------------------------------
- Analyze VAD handling
- Improve chunk boundary detection
- Reduce Whisper latency
- Add streaming transcription strategy
- Optimize barge-in responsiveness

----------------------------------------------------
### 5. Improve backend performance without changing frontend protocols
----------------------------------------------------
- Optimize async flow
- Cache expensive operations
- Add model output streaming improvements
- Introduce light-weight context windows
- Reduce unnecessary DB fetches

----------------------------------------------------
### 6. Enhance response quality to match ChatGPT/Gemini
----------------------------------------------------
- Add self-correction prompt blocks
- Add agent-thinking pre-processing
- Add structured conversation guidelines
- Add system persona refinement
- Improve grounding rules for consistent behavior

----------------------------------------------------
### 7. Produce upgrade plan that does NOT break existing working features
----------------------------------------------------
Gemini must:
- Preserve existing gRPC endpoints  
- Preserve existing WebSocket/HTTP responses  
- Maintain all tool API signatures  
- Keep frontend requirements intact  
- Ensure backward-compatible memory changes  

====================================================
### 📌 OUTPUT FORMAT (STRICT)
====================================================

Gemini must return:

1. **Full System Diagnosis**  
   - Detailed evaluation of every step  
   - Root cause analysis of accuracy issues  
   - Latency breakdown  

2. **Upgraded Architecture (compatible with existing system)**  
   - New backend flow  
   - Memory integrations  
   - Whisper + tool + LLM flow  

3. **Improved Prompt Templates**  
   - System prompt  
   - Prompt builder template  
   - Tool routing instruction block  
   - Self-correction + grounding block  

4. **Improved Memory Architecture**  
   - Schema improvements  
   - Retrieval rules  
   - Embedding strategies  
   - Summarization patterns  

5. **Optimized Tool Design**  
   - Updated schemas  
   - Updated tool selection logic  
   - Standard output format  

6. **Performance Improvements**  
   - caching strategies  
   - streaming optimization  
   - concurrency improvements  

7. **Migration Plan**  
   - Step-by-step changes  
   - All changes must be backward compatible  
   - No breaking changes to frontend  

====================================================
### 📣 FINAL INSTRUCTIONS
====================================================

Use the provided details **AND** your own reasoning.  
You may assume missing pieces where needed.  
Your goal is to make Gnani behave like ChatGPT/Gemini-level assistant, while preserving the entire existing pipeline and ensuring non-breaking enhancements.

Return a **complete, detailed, production-level upgrade plan.**

