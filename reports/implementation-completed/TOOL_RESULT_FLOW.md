# Tool Result to Human Text Flow

## Overview

When a tool is executed, the result must be converted to natural, human-readable text and streamed to the frontend. Here's how the flow works:

## Complete Flow Diagram

```
User Query: "What time is it?"
         ↓
    [Turn 1: Tool Detection]
         ↓
    LLM Call #1 (with tool instructions)
         ↓
    LLM Response: {"tool": "get_current_time", "params": {}}
         ↓
    Tool Detected ✓
         ↓
    Execute Tool: get_current_time
         ↓
    Tool Result: {time: "2:42 PM", date: "...", ...}
         ↓
    Enrich Prompt with Tool Result
    (Add result + instruction to respond naturally)
         ↓
    [Turn 2: Natural Response]
         ↓
    LLM Call #2 (with tool result in system message)
         ↓
    LLM Response: "It's currently 2:42 PM" ← STREAMED ✓
         ↓
    No Tool Detected (plain text)
         ↓
    Parse & Return Final Response
         ↓
    Frontend receives: "It's currently 2:42 PM"
```

## Code Flow

### 1. Initial LLM Call ([session.manager.ts:281-285](file:///D:/learning/hey/gnani-rnd-backend/src/modules/session/session.manager.ts#L281-L285))

```typescript
const llmRawResponse = await llmService.getLlmResponse(currentPrompt, (partialResponse: any) => {
    if (session.onLlmChunkCallback) {
        session.onLlmChunkCallback(partialResponse); // Streaming callback
    }
});
```

**First call**: Model sees tool instructions and returns JSON tool call

### 2. Tool Detection ([session.manager.ts:290-328](file:///D:/learning/hey/gnani-rnd-backend/src/modules/session/session.manager.ts#L290-L328))

```typescript
// Enhanced JSON extraction (handles markdown blocks)
if (trimmedResponse.includes('"tool"') || trimmedResponse.includes('```json')) {
    // Extract JSON from markdown or braces
    const parsed = JSON.parse(jsonContent);
    
    // Validate tool exists
    if (parsed.tool && toolRegistry.getTool(parsed.tool)) {
        toolCall = parsed;
    }
}
```

### 3. Tool Execution ([session.manager.ts:330-342](file:///D:/learning/hey/gnani-rnd-backend/src/modules/session/session.manager.ts#L330-L342))

```typescript
if (toolCall) {
    // Execute tool
    const result = await toolRegistry.executeTool(toolCall.tool, toolCall.params);
    
    // Enrich prompt with result
    currentPrompt = contextEngine.enrichPromptWithToolResult(currentPrompt, result);
    
    // Continue loop → LLM will be called again
    continue;
}
```

### 4. Prompt Enrichment ([context.engine.ts:283-312](file:///D:/learning/hey/gnani-rnd-backend/src/modules/context/context.engine.ts#L283-L312))

```typescript
enrichPromptWithToolResult(originalPrompt: any, toolResult: any): any {
    const toolContext = `
TOOL EXECUTION CONTEXT
======================

Tool Name: ${toolResult.toolName}
Status: SUCCESS

Output:
${JSON.stringify(toolResult.data, null, 2)}

INSTRUCTION
===========

The tool has been executed. Now you MUST respond with NATURAL TEXT (NOT JSON).

Use the tool output above to answer the user's query naturally and conversationally.
- Do NOT output JSON
- Do NOT call another tool
- Format the information in a user-friendly way

User's Original Query: "${originalPrompt.current_user_query}"

Your task: Provide a natural, helpful response using the tool data above.
`;

    // Add to system message
    originalPrompt.system_message = originalPrompt.system_message + "\n\n" + toolContext;
    return originalPrompt;
}
```

**Key points**:
- ✅ Explicitly instructs: "MUST respond with NATURAL TEXT (NOT JSON)"
- ✅ Includes tool result data
- ✅ Reminds model of original user query
- ✅ Tells model to format naturally

### 5. Second LLM Call (Automatic via Loop)

Loop continues → `llmService.getLlmResponse()` called again (line 281)

**Second call**: 
- Model sees tool result in system message
- Model sees instruction to respond naturally
- Model generates: "It's currently 2:42 PM"
- **Response is STREAMED** via same callback (line 282-284)

### 6. Final Response ([session.manager.ts:343-349](file:///D:/learning/hey/gnani-rnd-backend/src/modules/session/session.manager.ts#L343-L349))

```typescript
else {
    // Final Response (No tool needed)
    const parsed = llmResponseParser.parse(llmRawResponse);
    llmResponseText = parsed.textResponse;
    actionDirective = parsed.actionInstructions;
    break; // Exit loop
}
```

No tool detected in second response → Parse and return

## Streaming Behavior

**Important**: Streaming works for BOTH calls:

1. **First call** (tool detection):
   - Response: `{"tool": "get_current_time", ...}`
   - Streamed but usually ignored by frontend (JSON)

2. **Second call** (natural response):
   - Response: "It's currently 2:42 PM"
   - **Streamed to frontend** ✓
   - User sees text appear word-by-word

## Example Scenarios

### Scenario 1: Time Query

**User**: "What time is it?"

**Turn 1**:
- LLM Output: `{"tool": "get_current_time", "params": {}}`
- Tool executed: `{time: "2:42 PM", ...}`

**Turn 2**:
- LLM Output: "It's currently 2:42 PM" ← **STREAMED**
- User sees: "It's currently 2:42 PM"

### Scenario 2: Weather Query

**User**: "What's the weather in London?"

**Turn 1**:
- LLM Output: `{"tool": "get_weather", "params": {"location": "London, UK"}}`
- Tool executed: `{temperature: 15, condition: "Cloudy", ...}`

**Turn 2**:
- LLM Output: "According to the weather service, it's currently 15°C and cloudy in London." ← **STREAMED**
- User sees natural response

### Scenario 3: Calculator

**User**: "What is 25 times 4?"

**Turn 1**:
- LLM Output: `{"tool": "calculator", "params": {"expression": "25 * 4"}}`
- Tool executed: `{result: 100}`

**Turn 2**:
- LLM Output: "25 times 4 equals 100." ← **STREAMED**
- User sees: "25 times 4 equals 100."

## Recent Improvement

**Added explicit instruction** to prevent model from outputting JSON after tool execution:

```diff
+ The tool has been executed. Now you MUST respond with NATURAL TEXT (NOT JSON).
+ 
  Use the tool output above to answer the user's query naturally and conversationally.
+ - Do NOT output JSON
+ - Do NOT call another tool
  - Do NOT just repeat the raw data
```

This ensures the model always responds with human-readable text in Turn 2.

## Summary

✅ **Tool results ARE converted to human text**
✅ **Responses ARE streamed** via `onLlmChunkCallback`
✅ **Flow is correct**: Tool execution → Prompt enrichment → Second LLM call → Natural response
✅ **Improved**: Added explicit instruction to prevent JSON output after tool execution

The streaming works exactly like ChatGPT/Gemini - users see the natural language response appear word-by-word.
