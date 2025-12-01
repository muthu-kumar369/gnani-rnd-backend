You are an expert in real-time AI assistants, multi-modal LLM pipelines, 
RAG/memory architectures, streaming LLM systems, Whisper/ASR optimization, 
tool routing, and production-grade backend engineering.

You understand how top assistants like ChatGPT, Google Gemini, Siri, and 
Alexa are architected internally — especially their dynamic, adaptive 
reasoning pipelines.

Your task:
Perform a complete expert-level analysis and upgrade of the entire **backend**
of the Gnani assistant (frontend should only be analyzed if necessary).  
All improvements must be **non-breaking**, fully backward compatible, and 
must preserve the existing working flow end-to-end.

Additionally:
The current Gnani implementation contains many **static assumptions and static 
logic paths** (hardcoded prompt rules, fixed tool behavior, static memory 
retrieval, static system instructions, etc.).  
You must **transform the system into a dynamic, adaptive, self-adjusting AI 
assistant**, similar to ChatGPT/Gemini, without breaking existing features.

====================================================
### 🔥 CURRENT SYSTEM SUMMARY
====================================================

### FRONTEND (Analyze only if needed, do NOT break)
- Sign-in (email/password + Google OAuth)
- VAD-based audio streaming (gRPC)
- Text input (gRPC)
- Barge-in
- Device awareness telemetry
- Conversation terminal
- Settings UI

### BACKEND (Primary target of upgrade)
Flow:
1. Audio/text received  
2. Whisper → final transcript  
3. Context memory system: MongoDB + Redis + ChromaDB  
   (Currently long memory is dummy, retrieval is static)  
4. Static prompt builder  
5. Model decides tool/no-tool  
6. Tools: calculator, date, time, search, weather (Open-Meteo)  
7. Tool result → model → natural language  
8. Stream response back to frontend

====================================================
### 🛑 PROBLEMS TO FIX
====================================================

Quality & performance drop:
- Repeated questions  
- Wrong responses  
- Weak context tracking  
- Static, brittle prompt builder  
- Static tool routing  
- Static memory retrieval  
- Long-memory ineffective  
- Whisper latency  
- Barge-in delayed  
- Missing dynamic adaptability  
- Model behaves inconsistently across sessions  
- Many logic paths are fixed/hardcoded  
- System cannot dynamically scale context or tools  

====================================================
### 🎯 WHAT YOU MUST DO
====================================================

You must upgrade Gnani into a **dynamic, adaptive, ChatGPT/Gemini-level assistant**  
WITHOUT breaking its existing flow, APIs, or protocols.

Your responsibilities include:

----------------------------------------------------
### 1. Analyze and fix the entire prompt-building system
----------------------------------------------------
- Replace static templates with dynamic instruction blocks  
- Add adaptive context selection  
- Add dynamic persona rules  
- Add conversation state awareness  
- Prevent repetition and drift  
- Improve grounding  
- Add dynamic priorities based on query type  

----------------------------------------------------
### 2. Transform memory into a fully DYNAMIC hybrid RAG system
----------------------------------------------------
Make memory:
- Dynamic  
- Self-adjusting  
- Priority-based  
- Recency-aware  
- Contextually filtered  
- Multi-source (MongoDB, Redis, ChromaDB)  
- Capable of evolving during conversation  

You must:
- Improve scoring algorithms  
- Introduce dynamic summarization  
- Add memory decay rules  
- Add adaptive retrieval windows  
- Add fallback semantic retrieval  

----------------------------------------------------
### 3. Upgrade tool routing → dynamic, zero-hallucination system
----------------------------------------------------
- Replace rigid patterns with dynamic reasoning  
- Add clear tool-choice criteria  
- Add tool usage confidence thresholds  
- Add dynamic few-shot examples  
- Add pre-validation step before tool use  
- Standardize all tool outputs  
- Avoid hallucinated tools  
- Allow dynamic expansion of tools in future  

----------------------------------------------------
### 4. Optimize Whisper + streaming pipeline
----------------------------------------------------
- Reduce latency  
- Fix chunk boundary issues  
- Add dynamic silence thresholding  
- Stream partial transcripts if necessary  
- Improve barge-in detection accuracy  

----------------------------------------------------
### 5. Backend performance improvements (NO FE BREAKS)
----------------------------------------------------
- Dynamic caching  
- Adaptive batching  
- Intelligent context windowing  
- Remove redundant DB calls  
- Optimize async event loop  
- Improve gRPC streaming logic  

----------------------------------------------------
### 6. Make the assistant behave like ChatGPT/Gemini
----------------------------------------------------
- Add dynamic reasoning loops  
- Add self-correction blocks  
- Add chain-of-thought emulation (hidden)  
- Improve persona consistency  
- Add grounding and safety checks  
- Ensure expressive, coherent responses  
- Add dynamic tone adaptation  

----------------------------------------------------
### 7. Preserve EVERYTHING that already works
----------------------------------------------------
Gemini must guarantee:
- No changes to frontend contracts  
- No breaking of current gRPC or HTTP routes  
- No breaking of existing tools  
- No breaking of whisper/audio pipeline  
- Everything remains functional, but smarter  

----------------------------------------------------
### 8. Convert static logic → DYNAMIC system (NEW REQUIREMENT)
----------------------------------------------------

You must explicitly detect and eliminate ALL static/hardcoded areas in Gnani:

Examples:
- Static prompt blocks → dynamic templates  
- Static memory fetch → dynamic prioritized retrieval  
- Static system instructions → adaptive rules  
- Static tool selection → probabilistic + deterministic hybrid  
- Static context length → adaptive context window  
- Static message building → streaming dynamic composition  
- Static weather/search/calc → dynamic tool abstraction layer  

Your output must clearly show:
- Where static logic exists  
- How to convert each static part into dynamic behavior  
- Updated architecture diagrams  
- Updated flow  
- Updated backend components  

====================================================
### 📌 OUTPUT FORMAT (STRICT)
====================================================

Gemini must return:

1. **System Diagnosis**  
   - Every bottleneck  
   - All static/hardcoded logic identified  
   - Deep accuracy analysis  

2. **Upgraded Architecture** (fully dynamic + backward compatible)

3. **Full Dynamic Prompt System**  
   - System prompt  
   - Dynamic instruction blocks  
   - Context layering rules  
   - Tool router instructions  

4. **Dynamic Memory System**  
   - New retrieval algorithms  
   - New update rules  
   - New summarization strategy  

5. **Dynamic Tool Architecture**  
   - Improved schemas  
   - Improved routing logic  
   - Validation + constraints  

6. **Performance Enhancement Plan**  
   - Streaming improvements  
   - Caching improvements  
   - DB optimization  

7. **Migration Plan (Non-breaking)**  
   - Step-by-step upgrade  
   - All backward-compatible actions  
   - No frontend changes required  

Gemini must produce a final architecture that turns Gnani into a **dynamic, adaptive, high-accuracy,
low-latency, ChatGPT/Gemini-class AI assistant**, with **ZERO breaking changes**.
