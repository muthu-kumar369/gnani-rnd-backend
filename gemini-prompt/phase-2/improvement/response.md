You are an expert AI systems engineer.  
Analyze and fix the backend project:  
`gnani-rnd-backend`

We recently upgraded the backend with:
- Real vector embeddings  
- Dynamic prompt building  
- Dynamic memory retrieval  
- Performance improvements (2× faster)  

These upgrades are working great.

Now fix the following **two critical issues** without breaking ANY existing working flow:

===========================================================
🔥 ISSUE 1 — TOOL LAYER NOT WORKING
===========================================================

The tool layer is currently failing.  
Examples:
- “What is the time now?” → Tool not triggered  
- “What is today’s date?” → Not working  
- Weather, search, calculate → Not triggered  

You must:

1. **Analyze why the model is not returning the tool schema.**  
   - Check system instrutions  
   - Check tool schema definitions  
   - Check how messages are constructed  
   - Check how assistant role messages are appended  
   - Check if the prompt confuses the model  
   - Check if memory is interfering with tool-use detection

2. **Fix the tool execution pipeline:**
   - User → Text/Transcribed audio  
   - System prompt builder  
   - Model → JSON tool response  
   - Validate JSON  
   - Run tool  
   - Append tool result  
   - Second model call → humanized text  
   - Stream response to frontend  

3. Ensure this logic is consistent:
   - **If tool is needed:** ALWAYS return structured JSON  
   - **If tool is NOT needed:** Model must respond normally  
   - **Context memory MUST NOT override tool instructions**  
   - Tool instructions should have highest priority  

4. Strengthen the prompt so model ALWAYS picks the correct tool for:
   - Time  
   - Date  
   - Weather  
   - Search  
   - Calculator  
   - Any future tool

5. DO NOT remove or break:
   - Existing working dynamic prompt builder  
   - Embedding & memory system  
   - Session flow  
   - Streaming mechanism  

===========================================================
🔥 ISSUE 2 — MODEL IS REPEATING & NOT FOCUSING ON CURRENT QUESTION
===========================================================

Symptoms:
- Repeats old answers (example: still giving JavaScript explanation even after 4 new messages)  
- Not focusing on the newest user query  
- Gives unnecessary greetings too often  
- Ends responses prematurely  
- Context memory is getting mixed incorrectly  
- Long-term memory appears to override priority of the latest message  
- Some responses start or end with irrelevant greetings

Your tasks:

1. **Analyze the root cause**
   - Fix the prompt construction for system + memory + user  
   - Fix the order of message injection  
   - Fix memory ranking (vector score, recency, or both)  
   - Ensure last user message has highest relevance  
   - Ensure model does NOT overfit on long-term memory  
   - Identify if the system prompt is confusing the model

2. **Fix unnecessary repetition**
   - Improve instruction to NOT repeat  
   - Remove duplicated context  
   - Stop adding redundant assistant messages into the model history  
   - Fix prompt contamination from memory retrieval

3. **Fix greeting logic**
   - Only greet ONCE per session  
   - Do NOT greet randomly  
   - Do NOT say “how can I assist you?” unless conversation STARTS  
   - Add guardrails to control tone and avoid repetition

4. **Improve task focus**
   - Make the model prioritize *current question* over memory  
   - Memory should be “supportive,” not “dominant”  
   - Ensure short-term memory is clean and structured  

5. **Fix hallucinations caused by over-context**
   - Reduce noise in prompt  
   - Make instructions crisp  
   - Validate system message building  

===========================================================
🎯 FINAL EXPECTATION
===========================================================

Without breaking any existing flow, you must deliver:

1. A **fixed tool layer** that reliably triggers for all tool-based queries  
2. A **context-stable model** that:
   - NEVER repeats unnecessarily  
   - NEVER answers old questions again  
   - ALWAYS focuses on the newest query  
   - ONLY greets appropriately  
   - Maintains consistent tone through long conversations  
   - Uses memory only when truly relevant  

3. Updated:
   - System prompt builder  
   - Model call logic  
   - Message order  
   - Memory ranking & retrieval  
   - Tool schema clarity  
   - Tool execution pipeline  
   - Guardrails for repetition  

4. Full explanation of:
   - What was wrong  
   - What was fixed  
   - Why the fix improves accuracy  
   - How to maintain this long-term  

Begin your analysis now, and implement code-level changes where applicable.
