You are an elite AI systems engineer specializing in:
- Large-scale AI assistant architecture (ChatGPT, Google Gemini, Claude)
- Realtime streaming assistants (ASR → LLM → TTS)
- Tool routing systems
- Dynamic memory & hybrid RAG pipelines
- gRPC streaming, Electron, React, Node.js
- Whisper optimization
- Advanced AI reasoning, self-correction, grounding
- High-performance backend design

You must perform a FULL-SYSTEM ANALYSIS and UPGRADE of the entire Gnani project.

====================================================
### PROJECT YOU MUST ANALYZE
====================================================

FRONTEND (Electron + React):
- Repo name: **gnani-rnd**
- Handles wake word detection, VAD, audio streaming, barge-in,
  settings, conversation terminal, device awareness, profile management,
  OAuth UI, and TTS playback.

BACKEND (Node.js + gRPC + tools layer):
- Repo name: **gnani-rnd-backend**
- Handles ASR (Whisper), prompt building, tool routing,
  model interaction, memory (MongoDB + Redis + ChromaDB),
  streaming responses, and business logic.

You must:
- Analyze **every file** (frontend + backend)
- Understand the entire architecture
- Understand all flows, states, APIs, audio pipeline, memory pipeline,
  tool pipeline, authentication, models, schemas, and system behavior.

====================================================
### DO NOT BREAK EXISTING WORKING FLOW
====================================================

This is critical:
- You must preserve every existing feature and keep it working.
- All gRPC contracts must remain compatible.
- All APIs must remain compatible.
- All frontend flows must continue working as they do now.
- No regressions allowed.

You may only **enhance, optimize, fix, refactor, or extend**.

====================================================
### HIGH-LEVEL GOAL
====================================================

Upgrade Gnani into a **top-tier, production-grade, ChatGPT/Gemini-level AI assistant**  
capable of:
- Zero-latency ASR → LLM → TTS streaming
- High-accuracy context understanding
- Dynamic memory retrieval
- Advanced tool reasoning
- Strong system awareness
- Zero hallucinated tools
- Human-level conversational intelligence
- Grounded, state-aware, self-correcting responses

This upgrade must make Gnani:
- More accurate  
- More dynamic  
- More consistent  
- More intelligent  
- More scalable  
- More extensible  
- More stable  
- More natural  

And ready for future expansions such as:
- Full system-level actions
- Personal agent autonomy
- Cross-device context syncing
- Dynamic plugins/tools
- Embeddings (once implemented properly)

====================================================
### WHAT YOU MUST DO (FULL SCOPE)
====================================================

----------------------------------------------------
### 1. FULL PROJECT CODE ANALYSIS (FE + BE)
----------------------------------------------------
Gemini must identify:
- Architecture flaws
- API inconsistencies
- Performance bottlenecks
- Static/hardcoded logic paths
- Latency issues
- Memory pipeline issues
- Prompt-building weaknesses
- Tool routing mistakes
- Whisper/VAD pipeline problems
- TTS timing issues
- Missing edge-case handling

Deliver a full, detailed diagnosis.

----------------------------------------------------
### 2. UPGRADE AI REASONING PIPELINE TO ADVANCED LEVEL
----------------------------------------------------

You must redesign Gnani’s reasoning engine to:
- Use dynamic system instructions
- Use adaptive memory selection
- Use reasoning templates comparable to ChatGPT/Gemini
- Reduce repetition
- Increase answer correctness
- Improve grounding on tools/data
- Improve multi-turn consistency
- Handle ambiguous queries
- Avoid hallucinated tool usage

----------------------------------------------------
### 3. CONVERT ALL STATIC LOGIC → FULLY DYNAMIC SYSTEM
----------------------------------------------------

Eliminate ALL static/hardcoded behavior:
- Static prompts  
- Static memory fetch  
- Static context limits  
- Static tool invocation rules  
- Static thresholds  
- Static conversation block assembly  
- Static scenario handling  

Replace with:
- Dynamic context windowing  
- Dynamic memory weighting  
- Dynamic state management  
- Dynamic routing  
- Dynamic model instructions  
- Dynamic safety rules  
- Dynamic fallback logic  

----------------------------------------------------
### 4. REDESIGN MEMORY SYSTEM (MongoDB + Redis + ChromaDB)
----------------------------------------------------

Although embeddings are currently dummy, build:
- Full dynamic memory manager
- Recency + relevance + importance scoring
- Long-term vs short-term context separation
- Memory decay rules
- Automatic summarization of sessions
- Intelligent memory insertion workflow
- Dynamic chunk prioritization
- Future-proof design for when real embeddings get added

----------------------------------------------------
### 5. UPGRADE TOOL ROUTING SYSTEM
----------------------------------------------------

Tools must be:
- Context-aware  
- Confidence-scored  
- Zero-hallucination  
- Dynamically chosen  
- Structured and validated  
- Re-routed when ambiguity exists  

Add:
- Tool-choice rationale
- Pre-validation step
- Standardized input/output schemas
- Error recovery mechanism

----------------------------------------------------
### 6. OPTIMIZE AUDIO PIPELINE (ASR → LLM → TTS)
----------------------------------------------------

You must:
- Improve barge-in
- Reduce Whisper latency
- Fix chunk boundaries
- Improve VAD thresholds
- Improve streaming text alignment
- Reduce TTS cut-offs
- Improve smooth natural voice flow
- Ensure Siri/Google-level responsiveness

----------------------------------------------------
### 7. FRONTEND UPGRADE PLAN (ONLY IF NEEDED)
----------------------------------------------------
Only improve frontend if necessary to support:
- Better TTS flow
- Better streaming feedback
- Better conversation state visualization
- Better settings integration
- Consistency with upgraded backend

Keep all existing UI working.

----------------------------------------------------
### 8. FULL SYSTEM REWRITE PLAN WHERE NEEDED
----------------------------------------------------

Where necessary, Gemini may propose:
- New modules
- New services
- New utility layers
- New architecture blocks
- Better streaming logic
- Better internal data contracts

But must keep **external APIs and flows stable**.

====================================================
### REQUIRED OUTPUT (VERY STRUCTURED)
====================================================

Your output must include:

1. **Full Architectural Diagnosis**
   - Problems found  
   - Why each problem happened  
   - Severity rating  
   - Full reasoning  

2. **Proposed New Architecture**
   - Diagrams (text-based)
   - Component responsibilities
   - Data flow  
   - Audio pipeline flow  
   - Memory pipeline flow  
   - Tool routing flow  
   - LLM reasoning flow  

3. **Detailed Improvement Plan**
   - Backend fixes  
   - Optimization steps  
   - New dynamic logic  
   - Performance upgrades  
   - Stability upgrades  
   - Reasoning system upgrades  

4. **Updated Prompt-Building System**
   - Dynamic templates  
   - Adaptive rules  
   - Example prompts  

5. **Updated Memory System Design**
   - Retrieval  
   - Summaries  
   - Scoring  
   - Storage  
   - Future embedding support  

6. **Updated Tool Routing Logic**
   - Decision tree  
   - Confidence scoring  
   - Validation  
   - Error handling  

7. **Implementation Steps (Phased Roadmap)**
   - Phase 1: Critical fixes  
   - Phase 2: Intelligence upgrade  
   - Phase 3: Dynamic logic  
   - Phase 4: System stabilization  
   - Phase 5: Future extensions  

8. **Zero Regression Guarantee**
   - List of all existing flows  
   - Confirmation of compatibility  

====================================================
### REMINDERS
====================================================

- DO NOT break any existing flow.  
- DO NOT modify frontend APIs unless required.  
- DO NOT remove any existing working code.  
- DO NOT change contracts.  
- Only enhance, improve, refine, and upgrade.  
- You are allowed to redesign internals, but never break usage.  

Now scan the entire frontend + backend and produce the full analysis and upgrade plan.
