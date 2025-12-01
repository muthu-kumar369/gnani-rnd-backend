// src/services/contextEngine.ts
import logger from '../../core/logger/logger.js';
import contextBuilder from './context.builder.js';
import queryAnalyzer from './query-analyzer.js';
import templateSelector from './template-selector.js';

class ContextEngine {
    constructor() {
        logger.info('ContextEngine initialized with dynamic features.');
    }

    async buildLLMPrompt(sessionId: string, userId: string, processedQuery: { cleanedText: string; intent: string; }, toolDefinitions: any[] = []): Promise<any> {
        logger.debug(`Building LLM prompt for session ${sessionId}, user ${userId}. Intent: ${processedQuery.intent}`);

        // PHASE 2A: Analyze query complexity for adaptive features
        const complexity = queryAnalyzer.analyzeComplexity(processedQuery.cleanedText);
        logger.debug(`Query complexity: ${complexity.category} (score: ${complexity.score.toFixed(2)})`);

        const context = await contextBuilder.buildContext(
            userId,
            sessionId,
            processedQuery.cleanedText,
            4000, // Base budget - will be overridden by adaptive calculation
            complexity.score // Pass complexity for adaptive budgeting
        );

        // PHASE 1: Simplified conversation history formatting with semantic deduplication
        const rawHistory: Array<{ role: string, content: string }> = [];

        if (Array.isArray(context.shortTermMemory)) {
            for (const msg of context.shortTermMemory) {
                rawHistory.push({
                    role: msg.role, // 'user' or 'assistant'
                    content: msg.content
                });
            }
        }

        // Apply semantic deduplication
        const deduplicatedHistory = this.deduplicateHistory(rawHistory);

        // Format for LLM prompt (convert to query/response pairs for backward compatibility)
        const sanitizedHistory: any[] = [];
        for (let i = 0; i < deduplicatedHistory.length; i++) {
            const msg = deduplicatedHistory[i];
            if (msg.role === 'user') {
                // Look ahead for assistant response
                const nextMsg = deduplicatedHistory[i + 1];
                if (nextMsg && nextMsg.role === 'assistant') {
                    sanitizedHistory.push({
                        query: msg.content,
                        response: nextMsg.content
                    });
                    i++; // Skip the assistant message in next iteration
                } else {
                    // User message without response (shouldn't add if it's current query)
                    const isCurrentQuery = msg.content.trim() === context.currentQuery.trim();
                    if (!isCurrentQuery) {
                        sanitizedHistory.push({
                            query: msg.content,
                            response: ""
                        });
                    }
                }
            }
        }

        // Format long-term context
        const longTermContextStr = Array.isArray(context.longTermContext)
            ? context.longTermContext.join('\n\n')
            : '';

        // PHASE 2A: Select appropriate template based on query type
        const selectedTemplate = templateSelector.selectTemplate({
            query: processedQuery.cleanedText,
            intent: processedQuery.intent,
            complexity,
            conversationHistory: sanitizedHistory
        });

        logger.debug(`Selected template: ${selectedTemplate.name}`);

        // PHASE 2: Integrated Tool Routing
        // Append tool definitions to system message
        let systemMessage = selectedTemplate.systemMessage;
        if (toolDefinitions.length > 0) {
            const toolsJson = JSON.stringify(toolDefinitions, null, 2);
            systemMessage += `\n\n# AVAILABLE TOOLS\nYou have access to the following tools. Use them when necessary to fulfill the user's request.\n${toolsJson}\n\n# TOOL USE INSTRUCTIONS\nIf you need to use a tool, your response MUST be a valid JSON object matching this schema:\n{\n  "tool": "tool_name",\n  "params": { ... }\n}\n\nIf no tool is needed, respond naturally with text.`;
        }

        const llmPrompt = {
            system_message: systemMessage,
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
            system_message: `You are a precise tool classification engine. Your ONLY job is to output valid JSON.

AVAILABLE TOOLS
===============
${toolsJson}

JSON OUTPUT SCHEMA (STRICT)
===========================
{
  "needs_tool": boolean,
  "tool_name": string | null,
  "parameters": object
}

RULES:
1. Output MUST be valid JSON matching the schema above
2. "tool_name" MUST be from the available tools list or null
3. "parameters" MUST match the tool's parameter schema
4. If uncertain whether a tool is needed, set "needs_tool" to false
5. Extract parameters precisely from the user query

FEW-SHOT EXAMPLES
=================

Example 1 - Calculator Tool:
User Query: "What is 25 times 4?"
JSON Output:
{
  "needs_tool": true,
  "tool_name": "calculator",
  "parameters": {
    "expression": "25 * 4"
  }
}

Example 2 - Weather Tool:
User Query: "What's the weather like in Paris?"
JSON Output:
{
  "needs_tool": true,
  "tool_name": "get_weather",
  "parameters": {
    "location": "Paris, France"
  }
}

Example 3 - Time Tool:
User Query: "What time is it?"
JSON Output:
{
  "needs_tool": true,
  "tool_name": "get_current_time",
  "parameters": {}
}

Example 4 - Date Tool:
User Query: "What's today's date?"
JSON Output:
{
  "needs_tool": true,
  "tool_name": "get_current_date",
  "parameters": {}
}

Example 5 - Search Tool:
User Query: "Search for the latest news about AI"
JSON Output:
{
  "needs_tool": true,
  "tool_name": "web_search",
  "parameters": {
    "query": "latest news about AI"
  }
}

Example 6 - No Tool Needed:
User Query: "Hello, how are you?"
JSON Output:
{
  "needs_tool": false
}

Example 7 - No Tool Needed (Conversational):
User Query: "Tell me a joke"
JSON Output:
{
  "needs_tool": false
}

Example 8 - No Tool Needed (General Knowledge):
User Query: "What is the capital of France?"
JSON Output:
{
  "needs_tool": false
}

PARAMETER EXTRACTION GUIDELINES
================================
1. CALCULATOR: Extract mathematical expression exactly
   - Normalize: "x" or "X" -> "*", "divided by" -> "/"
   - Examples: "5+5", "10 * 3", "100 / 4"

2. WEATHER: Extract location with city and country/state
   - Normalize: "NYC" -> "New York, NY", "LA" -> "Los Angeles, CA"
   - Default to adding country if ambiguous: "London" -> "London, UK"

3. SEARCH: Extract search query verbatim (remove "search for", "look up")
   - Keep user's phrasing for best results

4. TIME/DATE: No parameters needed (uses system time)

CURRENT USER QUERY
==================
"${userQuery}"

YOUR JSON OUTPUT (NO OTHER TEXT)
=================================`
        };
    }

    enrichPromptWithToolResult(originalPrompt: any, toolResult: any): any {
        // Format tool result as structured context block
        const toolContext = `
TOOL EXECUTION CONTEXT
======================

Tool Name: ${toolResult.toolName}
Status: ${toolResult.error ? 'ERROR' : 'SUCCESS'}

${toolResult.error ? `Error: ${toolResult.error}` : `Output:\n${JSON.stringify(toolResult.data, null, 2)}`}

INSTRUCTION
===========

Use the tool output above to answer the user's query naturally and conversationally.
- Do NOT just repeat the raw data
- Format the information in a user-friendly way
- If there was an error, explain it helpfully and suggest alternatives
- Cite the tool as your source (e.g., "According to the weather service...")

User's Original Query: "${originalPrompt.current_user_query}"

Your task: Provide a natural, helpful response using the tool data.
`;

        // Prepend tool context to system message (higher priority than history)
        originalPrompt.system_message = originalPrompt.system_message + "\n\n" + toolContext;

        return originalPrompt;
    }

    /**
     * PHASE 1: Deduplicate conversation history using semantic similarity
     * Replaces hardcoded "JavaScript" hallucination filter with generic approach
     */
    private deduplicateHistory(history: Array<{ role: string, content: string }>): Array<{ role: string, content: string }> {
        const deduplicated: Array<{ role: string, content: string }> = [];
        const seenResponses = new Set<string>();

        for (const msg of history) {
            if (msg.role === 'user') {
                // Always keep user messages
                deduplicated.push(msg);
            } else if (msg.role === 'assistant') {
                // Deduplicate assistant responses
                const normalized = msg.content.trim().toLowerCase();

                // Check for exact duplicates
                if (seenResponses.has(normalized)) {
                    logger.warn(`Skipping duplicate assistant response: "${msg.content.substring(0, 50)}..."`);
                    continue;
                }

                // Check for high similarity (> 80% overlap)
                let isDuplicate = false;
                for (const seen of seenResponses) {
                    const similarity = this.calculateSimilarity(normalized, seen);
                    if (similarity > 0.8) {
                        logger.warn(`Skipping similar assistant response (${(similarity * 100).toFixed(0)}% match)`);
                        isDuplicate = true;
                        break;
                    }
                }

                if (!isDuplicate) {
                    deduplicated.push(msg);
                    seenResponses.add(normalized);
                }
            }
        }

        return deduplicated;
    }

    /**
     * PHASE 1: Calculate Jaccard similarity between two strings
     * Returns value between 0 (no similarity) and 1 (identical)
     */
    private calculateSimilarity(str1: string, str2: string): number {
        // Simple Jaccard similarity on word sets
        const words1 = new Set(str1.split(/\s+/));
        const words2 = new Set(str2.split(/\s+/));

        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);

        return union.size > 0 ? intersection.size / union.size : 0;
    }
}

export default new ContextEngine();
