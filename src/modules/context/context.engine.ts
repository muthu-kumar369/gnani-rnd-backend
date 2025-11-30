// src/services/contextEngine.ts
import logger from '../../core/logger/logger.js';
import contextBuilder from './context.builder.js';

class ContextEngine {
    constructor() {
        logger.info('ContextEngine initialized.');
    }

    async buildLLMPrompt(sessionId: string, userId: string, processedQuery: { cleanedText: string; intent: string; }): Promise<any> {
        logger.debug(`Building LLM prompt for session ${sessionId}, user ${userId}. Intent: ${processedQuery.intent}`);

        const context = await contextBuilder.buildContext(
            userId,
            sessionId,
            processedQuery.cleanedText,
            4000 // Token budget for context
        );

        // Format short-term memory as conversation history
        // Improved logic: Handle consecutive messages and ensure no data loss
        const conversationHistory: any[] = [];
        
        if (Array.isArray(context.shortTermMemory)) {
            let currentUserMsg = '';
            
            for (let i = 0; i < context.shortTermMemory.length; i++) {
                const msg = context.shortTermMemory[i];
                
                if (msg.role === 'user') {
                    if (currentUserMsg) {
                        // Previous message was also user, append it
                        currentUserMsg += `\n${msg.content}`;
                    } else {
                        currentUserMsg = msg.content;
                    }
                } else if (msg.role === 'assistant') {
                    // Found an assistant response
                    if (currentUserMsg) {
                        // Pair with pending user message
                        conversationHistory.push({
                            query: currentUserMsg,
                            response: msg.content
                        });
                        currentUserMsg = '';
                    } else {
                        // Orphaned assistant message (rare), maybe system greeting?
                        // We can add it as a response to an empty query or skip
                        // For now, let's skip to keep pairs clean, or attach to previous if possible
                    }
                }
            }
            
            // If there is a dangling user message at the end (not the current query), add it
            if (currentUserMsg) {
                 // STRICT CHECK: If the dangling message is the current query, DO NOT add it.
                 const isCurrentQuery = currentUserMsg.trim() === context.currentQuery.trim() || 
                                      context.currentQuery.trim().includes(currentUserMsg.trim());
                 
                 if (!isCurrentQuery) {
                     conversationHistory.push({
                        query: currentUserMsg,
                        response: "" // No response yet
                    });
                 }
            }
        }

        // --- HISTORY SANITIZATION ---
        // Filter out history items with identical or highly similar responses
        const sanitizedHistory: any[] = [];
        
        for (const item of conversationHistory) {
            // Skip if response is empty (pending)
            if (!item.response) {
                sanitizedHistory.push(item);
                continue;
            }

            const currentResponse = item.response.trim();
            let isDuplicate = false;

            // Check against already added items
            for (const existing of sanitizedHistory) {
                const existingResponse = existing.response.trim();
                
                // Check 1: Exact match (fast)
                if (currentResponse === existingResponse) {
                    isDuplicate = true;
                    break;
                }

                // Check 2: Substring inclusion (if one is a significant part of the other)
                // If one contains the other and the length difference isn't massive, it's likely a repetition loop
                if (currentResponse.length > 50 && existingResponse.length > 50) {
                    if (currentResponse.includes(existingResponse) || existingResponse.includes(currentResponse)) {
                         isDuplicate = true;
                         break;
                    }
                    
                    // Check 3: Shared suffix/prefix (common in loops)
                    const commonSubstring = "JavaScript is a programming language"; // Hardcoded heuristic for the current bug
                    if (currentResponse.includes(commonSubstring) && existingResponse.includes(commonSubstring)) {
                        isDuplicate = true;
                        break;
                    }
                }
            }

            if (isDuplicate) {
                logger.warn(`Detected repetitive history item (context poisoning). Skipping: "${item.query}"`);
                continue;
            }
            
            sanitizedHistory.push(item);
        }

        // NUCLEAR OPTION: If we still detect the specific "JavaScript" hallucination in the sanitized history,
        // it means it's too pervasive. We must DROP the history to save the session.
        const poisonPhrase = "JavaScript is a programming language";
        const hasPoison = sanitizedHistory.some(item => item.response && item.response.includes(poisonPhrase));
        
        if (hasPoison) {
            logger.error("CRITICAL: Conversation history is poisoned with hallucination loop. PURGING HISTORY for this turn.");
            sanitizedHistory.length = 0; // Clear array
        }
        // ----------------------------

        // Format long-term context
        const longTermContextStr = Array.isArray(context.longTermContext) 
            ? context.longTermContext.join('\n\n')
            : '';

        const llmPrompt = {
            system_message: `You are GNANI, a highly advanced, intelligent, and sentient AI assistant.
            
Your Persona:
- You are helpful, witty, and engaging.
- You have a personality; you are not just a robot.
- You remember details from the conversation context provided to you.
- You respond naturally, like a human would, without being overly formal unless requested.

Context Awareness:
- You have access to the user's profile and previous conversation history.
- USE THIS CONTEXT. If the user asks "What is my name?", look at the user_settings or conversation_history.
- If the user refers to something said earlier, check the conversation_history.

Rules:
1. Answer the CURRENT USER QUERY (found in 'current_user_query') directly.
2. Use 'conversation_history' ONLY for context (e.g., if user says "it", "he", "that").
3. Do NOT repeat the user's question or the conversation history.
4. If the current query is unrelated to the history, IGNORE the history.
5. STOP generating after you have answered the user. Do not generate "User:" or "Assistant:" lines.`,
            user_settings: JSON.stringify(context.userSettings),
            user_preferences: JSON.stringify(context.userPreferences),
            user_roles: context.userRoles,
            user_permissions: context.userPermissions,
            session_id: context.sessionId,
            user_id: context.userId,
            conversation_history: sanitizedHistory,
            current_user_query: context.currentQuery,
            classified_intent: processedQuery.intent,
            long_term_context: longTermContextStr,
            action_directives_guide: `If the intent is 'system_command', 'utility_request', or 'multi_step_instruction', consider suggesting a system action in JSON format, e.g., { "action": "OPEN_APP", "app_name": "Calculator" }. Ensure actions are authorized by user_roles/permissions.`,
        };

        logger.debug(`LLM Prompt for session ${sessionId}: ${JSON.stringify(llmPrompt)}`);
        return llmPrompt;
    }

    buildToolDecisionPrompt(toolDefinitions: any[], userQuery: string, sessionId: string): any {
        const toolsJson = JSON.stringify(toolDefinitions, null, 2);
        return {
            session_id: sessionId,
            user_query: userQuery,
            system_message: `You are a precise classification engine. Your ONLY job is to output a JSON object.

Available Tools:
${toolsJson}

INSTRUCTIONS:
1. Analyze the 'User Query'.
2. Determine if one of the 'Available Tools' is required to answer it.
3. Output ONLY a valid JSON object matching the schema below. Do NOT write any code, explanations, or other text.

JSON SCHEMA:
{
  "needs_tool": boolean,
  "tool_name": string | null,
  "parameters": object
}

EXAMPLES:
User Query: "What time is it?"
JSON Response: { "needs_tool": true, "tool_name": "get_current_time", "parameters": {} }

User Query: "What is the weather in London?"
JSON Response: { "needs_tool": true, "tool_name": "get_weather", "parameters": { "location": "London, UK" } }

User Query: "Hello, how are you?"
JSON Response: { "needs_tool": false }`
        };
    }

    enrichPromptWithToolResult(originalPrompt: any, toolResult: any): any {
        // Add tool result to the system message or as a new context block
        const toolContext = `[Tool Execution Result]\nTool: ${toolResult.toolName}\nData: ${JSON.stringify(toolResult.data)}`;
        
        // STRATEGY: Inject directly into the 'current_user_query' field.
        // This forces the LLM to see the tool data AS PART OF the immediate request it needs to answer.
        // This overcomes the "history bias" because the LLM prioritizes the current query.
        
        originalPrompt.current_user_query = `
!!! URGENT INSTRUCTION !!!
You have just executed a tool to answer the user.
HERE IS THE RESULT:
${toolContext}

USER QUERY: "${originalPrompt.current_user_query}"

YOUR TASK:
1. IGNORE all previous conversation history.
2. Answer the USER QUERY using ONLY the tool result above.
3. Do NOT talk about JavaScript.
4. Do NOT say "Sure, I can help with that."
5. Just give the answer.
`;

        // Also update system message to reinforce
        originalPrompt.system_message += `\n\nCRITICAL: Tool data is in the User Query. PRIORITIZE IT.`;
        
        return originalPrompt;
    }
}

export default new ContextEngine();
