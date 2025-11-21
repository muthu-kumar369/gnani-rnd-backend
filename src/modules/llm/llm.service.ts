// src/services/llmService.ts
import axios from 'axios';
import { createContextualLogger } from '../utils/logger.js';
import metrics from '../utils/metrics.js';
import auditService from './auditService.js';
import {
    LLM_SERVER_URL,
    LLM_MODEL_PATH,
    LLM_API_KEY,
    LLM_MAX_TOKENS,
    LLM_TEMPERATURE,
    LLM_STREAMING_ENABLED
} from '../configs/config.js';
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

            const requestBody = {
                model: LLM_MODEL_PATH,
                prompt: this._formatPromptForLLM(structuredPrompt),
                max_tokens: LLM_MAX_TOKENS,
                temperature: LLM_TEMPERATURE,
                stream: LLM_STREAMING_ENABLED,
            };

            let llmOutput = '';
            let action = null;

            if (LLM_STREAMING_ENABLED && onPartialResponse) {
                const response = await axios.post(this.llmApiUrl + '/stream', requestBody, { headers, responseType: 'stream' });
                await new Promise<void>((resolve, reject) => {
                    response.data.on('data', (chunk: any) => {
                        const partialData = chunk.toString();
                        llmOutput += partialData;
                        onPartialResponse({ text: partialData });
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
                const response = await axios.post(this.llmApiUrl + '/completions', requestBody, { headers });
                llmOutput = response.data.choices[0].text;

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

    private _formatPromptForLLM(structuredPrompt: any): any[] {
        let promptMessages = [
            { role: "system", content: structuredPrompt.system_message },
        ];

        structuredPrompt.conversation_history.forEach((interaction: any) => {
            promptMessages.push({ role: "user", content: interaction.query });
            promptMessages.push({ role: "assistant", content: interaction.response });
        });

        promptMessages.push({ role: "user", content: `User query (intent: ${structuredPrompt.classified_intent}): ${structuredPrompt.current_user_query}` });

        promptMessages.push({
            role: "system",
            content: `User Settings: ${structuredPrompt.user_settings}\n` +
                     `User Preferences: ${structuredPrompt.user_preferences}\n` +
                     `User Roles: ${structuredPrompt.user_roles.join(', ')}\n` +
                     `User Permissions: ${structuredPrompt.user_permissions.join(', ')}\n` +
                     `Long-term Context: ${structuredPrompt.long_term_context}`
        });

        promptMessages.push({
            role: "system",
            content: structuredPrompt.action_directives_guide
        });
        
        return promptMessages;
    }
}

export default new LlmService();
