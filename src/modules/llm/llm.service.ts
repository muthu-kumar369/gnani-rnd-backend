// src/services/llmService.ts
import axios from 'axios';
import { createContextualLogger } from '../../core/logger/logger.js';
import metrics from '../../core/monitoring/metrics.js';
import auditService from '../../core/logger/audit.service.js';
import {
    LLM_SERVER_URL,
    LLM_MODEL_PATH,
    LLM_API_KEY,
    LLM_MAX_TOKENS,
    LLM_TEMPERATURE,
    LLM_STREAMING_ENABLED
} from '../../config/env.config.js';
import { Logger } from 'winston';

import { CircuitBreaker } from '../../core/reliability/circuit-breaker.js';

class LlmService {
    private logger: Logger;
    private llmApiUrl: string;
    private circuitBreaker: CircuitBreaker;

    constructor() {
        this.logger = createContextualLogger({ module: 'LlmService' });
        this.llmApiUrl = LLM_SERVER_URL;

        // Initialize Circuit Breaker
        this.circuitBreaker = new CircuitBreaker('LLM_API', {
            failureThreshold: 5,
            resetTimeoutMs: 30000, // 30 seconds
            requestTimeoutMs: 60000 // 60 seconds
        });

        this.logger.info('LlmService initialized with Circuit Breaker.');
        auditService.logEvent('LLM_SERVICE_INIT', null, null, {}, 'success');
    }

    async getToolDecision(decisionPrompt: any): Promise<{ needs_tool: boolean, tool_name?: string, parameters?: any }> {
        const sessionId = decisionPrompt.session_id;
        this.logger.debug(`Getting tool decision for session ${sessionId}`);

        try {
            const headers: any = {
                'Content-Type': 'application/json',
            };
            if (LLM_API_KEY && LLM_API_KEY !== 'your_llm_api_key_here') {
                headers['Authorization'] = `Bearer ${LLM_API_KEY}`;
            }

            // Format prompt for decision (simple system + user)
            const promptText = `System: ${decisionPrompt.system_message}\n\nUser: ${decisionPrompt.user_query}`;

            const requestBody = {
                model: LLM_MODEL_PATH,
                prompt: promptText,
                max_tokens: 200, // Short response expected
                temperature: 0.1, // Low temp for deterministic JSON
                stream: false,
                stop: ["User:", "System:"],
                // response_format: { type: "json_object" } // Uncomment if model supports it
            };

            const response = await axios.post(this.llmApiUrl + '/api/generate', requestBody, { headers });
            let content = response.data.response;

            // Extract JSON from content
            // 1. Try to find markdown code block first
            const markdownMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (markdownMatch) {
                content = markdownMatch[1];
            } else {
                // 2. Fallback: Try to find the first '{' and the last '}'
                const firstBrace = content.indexOf('{');
                const lastBrace = content.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    content = content.substring(firstBrace, lastBrace + 1);
                }
            }

            try {
                const decision = JSON.parse(content);
                this.logger.info(`Tool decision for session ${sessionId}: ${JSON.stringify(decision)}`);
                console.log(`[LlmService] Tool Decision Parsed: ${JSON.stringify(decision)}`);
                return decision;
            } catch (e) {
                this.logger.warn(`Failed to parse tool decision JSON: ${content}`);
                console.warn(`[LlmService] Failed to parse JSON: ${content}`);
                return { needs_tool: false };
            }

        } catch (error: any) {
            this.logger.error(`Error getting tool decision: ${error.message}`);
            console.error(`[LlmService] Error getting tool decision: ${error.message}`);
            return { needs_tool: false };
        }
    }

    async getLlmResponse(structuredPrompt: any, onPartialResponse: ((response: { text: string }) => void) | null = null): Promise<{ text: string, action: any }> {
        const sessionId = structuredPrompt.session_id;
        const userId = structuredPrompt.user_id;
        this.logger.debug(`Sending prompt to LLM for session ${sessionId}: ${JSON.stringify(structuredPrompt)}`);
        auditService.logLlmEvent(userId, sessionId, structuredPrompt, null, 'info', null);

        try {
            const headers: any = {
                'Content-Type': 'application/json',
            };
            if (LLM_API_KEY && LLM_API_KEY !== 'your_llm_api_key_here') {
                headers['Authorization'] = `Bearer ${LLM_API_KEY}`;
            }

            const formattedPrompt = this._formatPromptForLLM(structuredPrompt);
            this.logger.debug(`Crafted prompt for LLM: ${JSON.stringify(formattedPrompt)}`);

            const requestBody = {
                model: LLM_MODEL_PATH,
                prompt: formattedPrompt,
                max_tokens: LLM_MAX_TOKENS,
                temperature: 0.7, // Balanced for natural conversation
                top_p: 0.9,
                frequency_penalty: 1.3, // Strongly discourage repetition
                presence_penalty: 0.6,  // Encourage diverse topics
                stop: [
                    "User:",
                    "System:",
                    "Assistant:",
                    "\nUser:",
                    "\nAssistant:",
                    "Human:",
                    "\nHuman:"
                ], // Comprehensive stop sequences to prevent hallucinating conversation turns
                stream: LLM_STREAMING_ENABLED,
            };

            return await this.circuitBreaker.execute(async () => {
                let llmOutput = '';
                let action = null;

                if (LLM_STREAMING_ENABLED && onPartialResponse) {
                    // Send a debug chunk to verify pipeline
                    onPartialResponse({ type: 'debug', text: 'LLM_STREAM_START' } as any);

                    const response = await axios.post(this.llmApiUrl + '/api/generate', requestBody, { headers, responseType: 'stream' });

                    // Text Stabilization Buffer
                    let stabilizationBuffer = '';

                    await new Promise<void>((resolve, reject) => {
                        response.data.on('data', (chunk: any) => {
                            try {
                                const chunkData = JSON.parse(chunk.toString());
                                if (chunkData.response) {
                                    const newContent = chunkData.response;

                                    // Validate: Check for malformed/garbage responses
                                    const isMalformed = /^[\.\*\s\?\!,;:]{1,3}$/.test(newContent.trim());

                                    // Detect repetitive words (e.g., "it it it it")
                                    const words = newContent.trim().split(/\s+/);
                                    const isRepetitive = words.length > 2 && words.every((w: string, i: number) => i === 0 || w === words[0]);

                                    if (isMalformed || isRepetitive) {
                                        this.logger.warn(`Detected malformed/repetitive LLM chunk: "${newContent}". Proceeding anyway for debug.`);
                                        // return; // DISABLED FILTER FOR DEBUGGING
                                    }

                                    let delta = '';

                                    // Smart Delta Detection
                                    if (llmOutput.length > 0 && newContent.startsWith(llmOutput)) {
                                        delta = newContent.substring(llmOutput.length);
                                        llmOutput = newContent;
                                    } else if (llmOutput.length === 0) {
                                        delta = newContent;
                                        llmOutput = newContent;
                                    } else {
                                        // Fallback for non-matching delta
                                        delta = newContent;
                                        llmOutput += newContent;
                                    }

                                    if (delta.length > 0) {
                                        // Add to stabilization buffer
                                        stabilizationBuffer += delta;

                                        // Check if we have a complete word/sentence (ends with space or punctuation)
                                        // We look for the LAST delimiter to split safe vs unsafe text
                                        const lastDelimiterIndex = stabilizationBuffer.search(/[\s\.\,\!\?\;\:]+[^\s\.\,\!\?\;\:]*$/);

                                        if (lastDelimiterIndex !== -1) {
                                            // We have at least one stable word
                                            // "start the mu" -> "start the " is stable, "mu" is partial
                                            // Actually, regex above finds the START of the last non-delimiter group?
                                            // Let's use a simpler approach: split by delimiters, keep the last part if it doesn't end with delimiter

                                            // If buffer ends with delimiter, everything is stable
                                            if (/[\s\.\,\!\?\;\:]$/.test(stabilizationBuffer)) {
                                                const finalChunk = stabilizationBuffer;
                                                stabilizationBuffer = '';
                                                console.log(`[LLM Service] Sending FINAL: "${finalChunk}"`);
                                                // @ts-ignore - Sending object instead of string
                                                onPartialResponse({ type: 'final', text: finalChunk });
                                            } else {
                                                // Buffer does NOT end with delimiter (e.g. "start the mu")
                                                // Find the last delimiter
                                                const lastSpace = stabilizationBuffer.lastIndexOf(' ');
                                                // Also check for punctuation if space is not found or punctuation is later
                                                // For simplicity, let's just use space as the main stabilizer for words

                                                if (lastSpace !== -1) {
                                                    const stablePart = stabilizationBuffer.substring(0, lastSpace + 1);
                                                    const unstablePart = stabilizationBuffer.substring(lastSpace + 1);

                                                    stabilizationBuffer = unstablePart;

                                                    console.log(`[LLM Service] Sending FINAL: "${stablePart}"`);
                                                    // @ts-ignore
                                                    onPartialResponse({ type: 'final', text: stablePart });

                                                    if (unstablePart.length > 0) {
                                                        console.log(`[LLM Service] Sending PARTIAL: "${unstablePart}"`);
                                                        // @ts-ignore
                                                        onPartialResponse({ type: 'partial', text: unstablePart });
                                                    }
                                                } else {
                                                    // No space yet, just send partial
                                                    console.log(`[LLM Service] Sending PARTIAL: "${stabilizationBuffer}"`);
                                                    // @ts-ignore
                                                    onPartialResponse({ type: 'partial', text: stabilizationBuffer });
                                                }
                                            }
                                        } else {
                                            // No delimiters at all, send as partial
                                            console.log(`[LLM Service] Sending PARTIAL: "${stabilizationBuffer}"`);
                                            // @ts-ignore
                                            onPartialResponse({ type: 'partial', text: stabilizationBuffer });
                                        }
                                    }
                                }
                            } catch (e: any) {
                                this.logger.error(`Error parsing LLM streaming chunk: ${e.message}`);
                            }
                        });
                        response.data.on('end', () => {
                            this.logger.debug('LLM streaming response ended.');

                            // Flush remaining buffer as final
                            if (stabilizationBuffer.length > 0) {
                                console.log(`[LLM Service] Flushing FINAL: "${stabilizationBuffer}"`);
                                // @ts-ignore
                                onPartialResponse({ type: 'final', text: stabilizationBuffer });
                            }

                            console.log(`[LLM Service] Full Output: "${llmOutput}"`);
                            metrics.incLlmCall(sessionId, structuredPrompt.classified_intent, 'success');
                            auditService.logLlmEvent(userId, sessionId, structuredPrompt, { text: llmOutput }, 'success');
                            resolve();
                        });
                        response.data.on('error', (err: Error) => {
                            this.logger.error(`LLM streaming error for session ${sessionId}: ${err.message}`);
                            metrics.incLlmCall(sessionId, structuredPrompt.classified_intent, 'failure');
                            auditService.logLlmEvent(userId, sessionId, structuredPrompt, null, 'failure', err.message);
                            reject(new Error(`LLM streaming error: ${err.message}`));
                        });
                    });
                } else {
                    const response = await axios.post(this.llmApiUrl + '/api/generate', requestBody, { headers });
                    llmOutput = response.data.response;

                    if (structuredPrompt.classified_intent === 'system_command' || structuredPrompt.classified_intent === 'utility_request') {
                        action = { action: 'OPEN_APP', app_name: 'Terminal' };
                    }
                    metrics.incLlmCall(sessionId, structuredPrompt.classified_intent, 'success');
                    auditService.logLlmEvent(userId, sessionId, structuredPrompt, { text: llmOutput, action }, 'success');
                }

                return { text: llmOutput, action };
            });

        } catch (error: any) {
            this.logger.error(`Error calling LLM at ${this.llmApiUrl} for session ${sessionId}: ${error.message}`);
            metrics.incLlmCall(sessionId, structuredPrompt.classified_intent, 'failure');
            auditService.logLlmEvent(userId, sessionId, structuredPrompt, null, 'failure', error.message);
            return {
                text: "I'm sorry, I'm having trouble connecting to my brain right now. Please try again later.",
                action: null
            };
        }
    }

    private _formatPromptForLLM(structuredPrompt: any): string {
        let promptParts: string[] = [];

        // 1. Construct the System Message Block
        let systemBlock = `System: ${structuredPrompt.system_message}`;

        // Add context to system block if available
        if (structuredPrompt.long_term_context && structuredPrompt.long_term_context.trim()) {
            systemBlock += `\n\nRelevant Context from Memory:\n${structuredPrompt.long_term_context}`;
        }

        promptParts.push(systemBlock);

        // 2. Add Conversation History
        if (structuredPrompt.conversation_history && structuredPrompt.conversation_history.length > 0) {
            structuredPrompt.conversation_history.forEach((interaction: any) => {
                if (interaction.query) {
                    promptParts.push(`User: ${interaction.query}`);
                }
                if (interaction.response) {
                    promptParts.push(`Assistant: ${interaction.response}`);
                }
            });
        }

        // 3. Add Current User Query
        promptParts.push(`User: ${structuredPrompt.current_user_query}`);
        promptParts.push(`Assistant:`);

        return promptParts.join('\n');
    }
}

export default new LlmService();
