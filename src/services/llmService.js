// src/services/llmService.js
const axios = require('axios');
const { createContextualLogger } = require('../utils/logger'); // Import logger factory
const metrics = require('../utils/metrics'); // Import metrics
const auditService = require('../services/auditService'); // Import audit service
const {
    LLM_SERVER_URL,
    LLM_MODEL_PATH, // For local models, this might not be used directly here but by a runner
    LLM_API_KEY,
    LLM_MAX_TOKENS,
    LLM_TEMPERATURE,
    LLM_STREAMING_ENABLED
} = require('../configs/config');

class LlmService {
    constructor() {
        this.logger = createContextualLogger({ module: 'LlmService' }); // Create a logger instance
        this.llmApiUrl = LLM_SERVER_URL;
        this.logger.info('LlmService initialized.');
        auditService.logEvent('LLM_SERVICE_INIT', null, null, {}, 'success');
    }

    /**
     * Sends a structured prompt to the LLM and receives its response.
     * @param {Object} structuredPrompt - The prompt object built by ContextEngine.
     * @param {Function} [onPartialResponse] - Callback for streaming partial responses.
     * @returns {Promise<Object>} The full LLM response.
     */
    async getLlmResponse(structuredPrompt, onPartialResponse = null) {
        const sessionId = structuredPrompt.session_id;
        const userId = structuredPrompt.user_id;
        this.logger.debug(`Sending prompt to LLM for session ${sessionId}: ${JSON.stringify(structuredPrompt)}`);
        auditService.logLlmEvent(userId, sessionId, structuredPrompt, null, 'info', null);

        try {
            const headers = {
                'Content-Type': 'application/json',
            };
            if (LLM_API_KEY && LLM_API_KEY !== 'your_llm_api_key_here') {
                headers['Authorization'] = `Bearer ${LLM_API_KEY}`;
            }

            const requestBody = {
                model: LLM_MODEL_PATH, // Or specific model name for API
                prompt: this._formatPromptForLLM(structuredPrompt), // Convert structured prompt to LLM's expected string/array format
                max_tokens: LLM_MAX_TOKENS,
                temperature: LLM_TEMPERATURE,
                stream: LLM_STREAMING_ENABLED,
                // Add other LLM specific parameters
            };

            let llmOutput = '';
            let action = null;

            if (LLM_STREAMING_ENABLED && onPartialResponse) {
                const response = await axios.post(this.llmApiUrl + '/stream', requestBody, { headers, responseType: 'stream' });
                await new Promise((resolve, reject) => {
                    response.data.on('data', (chunk) => {
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
                    response.data.on('error', (err) => {
                        this.logger.error(`LLM streaming error for session ${sessionId}: ${err.message}`);
                        metrics.incLlmCall(sessionId, structuredPrompt.classified_intent, 'failure');
                        auditService.logLlmEvent(userId, sessionId, structuredPrompt, null, 'failure', err.message);
                        reject(new Error(`LLM streaming error: ${err.message}`));
                    });
                });
            } else {
                const response = await axios.post(this.llmApiUrl + '/completions', requestBody, { headers });
                llmOutput = response.data.choices[0].text; // Adjust based on actual API response structure

                if (structuredPrompt.classified_intent === 'system_command' || structuredPrompt.classified_intent === 'utility_request') {
                    action = { action: 'OPEN_APP', app_name: 'Terminal' }; // Simulating action from LLM response
                }
                metrics.incLlmCall(sessionId, structuredPrompt.classified_intent, 'success');
                auditService.logLlmEvent(userId, sessionId, structuredPrompt, { text: llmOutput, action }, 'success');
            }

            return { text: llmOutput, action };

        } catch (error) {
            this.logger.error(`Error calling LLM at ${this.llmApiUrl} for session ${sessionId}: ${error.message}`);
            metrics.incLlmCall(sessionId, structuredPrompt.classified_intent, 'failure');
            auditService.logLlmEvent(userId, sessionId, structuredPrompt, null, 'failure', error.message);
            return {
                text: "I'm sorry, I'm having trouble connecting to my brain right now. Please try again later.",
                action: null
            };
        }
    }

    /**
     * Formats the structured prompt into a string or array expected by the LLM.
     * This is highly dependent on the LLM being used.
     * @param {Object} structuredPrompt - The prompt object.
     * @returns {string|Array<Object>} Formatted prompt.
     */
    _formatPromptForLLM(structuredPrompt) {
        let promptMessages = [
            { role: "system", content: structuredPrompt.system_message },
        ];

        structuredPrompt.conversation_history.forEach(interaction => {
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

module.exports = new LlmService();
