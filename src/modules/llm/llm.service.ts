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

class LlmService {
    private logger: Logger;
    private llmApiUrl: string;

    constructor() {
        this.logger = createContextualLogger({ module: 'LlmService' });
        this.llmApiUrl = LLM_SERVER_URL;
        this.logger.info('LlmService initialized.');
        auditService.logEvent('LLM_SERVICE_INIT', null, null, {}, 'success');
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
                temperature: LLM_TEMPERATURE,
                stream: LLM_STREAMING_ENABLED,
            };

            let llmOutput = '';
            let action = null;

            if (LLM_STREAMING_ENABLED && onPartialResponse) {
                const response = await axios.post(this.llmApiUrl + '/api/generate', requestBody, { headers, responseType: 'stream' });
                await new Promise<void>((resolve, reject) => {
                    response.data.on('data', (chunk: any) => {
                        try {
                            const chunkData = JSON.parse(chunk.toString());
                            if (chunkData.response) {
                                llmOutput += chunkData.response;
                                onPartialResponse({ text: chunkData.response });
                            }
                        } catch (e: any) {
                            this.logger.error(`Error parsing LLM streaming chunk: ${e.message}`);
                        }
                    });
                    response.data.on('end', () => {
                        this.logger.debug('LLM streaming response ended.');
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

        promptParts.push(`System: ${structuredPrompt.system_message}`);

        structuredPrompt.conversation_history.forEach((interaction: any) => {
            promptParts.push(`User: ${interaction.query}`);
            promptParts.push(`Assistant: ${interaction.response}`);
        });

        promptParts.push(`User: User query (intent: ${structuredPrompt.classified_intent}): ${structuredPrompt.current_user_query}`);

        promptParts.push(`System: User Settings: ${structuredPrompt.user_settings}`);
        promptParts.push(`System: User Preferences: ${structuredPrompt.user_preferences}`);
        promptParts.push(`System: User Roles: ${structuredPrompt.user_roles.join(', ')}`);
        promptParts.push(`System: User Permissions: ${structuredPrompt.user_permissions.join(', ')}`);
        promptParts.push(`System: Long-term Context: ${structuredPrompt.long_term_context}`);
        promptParts.push(`System: ${structuredPrompt.action_directives_guide}`);
        
        return promptParts.join('\n');
    }
}

export default new LlmService();
