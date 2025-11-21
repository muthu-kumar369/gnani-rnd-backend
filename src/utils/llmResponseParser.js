// src/utils/llmResponseParser.js
const logger = require('./logger');

class LlmResponseParser {
    constructor() {
        logger.info('LlmResponseParser initialized.');
    }

    /**
     * Parses the raw LLM response into a structured object containing text and optional action instructions.
     * This method assumes the LLM might return a specific format, possibly JSON within its text output.
     * For a simple text completion model, it might just be the text.
     * For advanced models, it could be structured JSON.
     *
     * @param {Object} llmRawResponse - The raw response object from the LLM service.
     *                                  Expected to have a 'text' field and potentially an 'action' field.
     * @returns {Object} Structured object: { textResponse: string, actionInstructions: Object | null }.
     */
    parse(llmRawResponse) {
        let textResponse = llmRawResponse.text || '';
        let actionInstructions = llmRawResponse.action || null; // Direct action from llmService if simulated

        // Advanced parsing logic: if LLM returns a structured JSON string within its text
        // Example: LLM might output "Sure, I can open that. ```json{"action":"OPEN_APP","app_name":"Calculator"}```"
        const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
        const match = textResponse.match(jsonRegex);

        if (match && match[1]) {
            try {
                const parsedJson = JSON.parse(match[1]);
                if (parsedJson.action) {
                    actionInstructions = parsedJson;
                    // Optionally, remove the JSON block from the text response
                    textResponse = textResponse.replace(match[0], '').trim();
                }
            } catch (e) {
                logger.warn(`Failed to parse JSON from LLM response: ${e.message}`);
            }
        }

        logger.debug(`Parsed LLM response. Text: "${textResponse}", Action: ${JSON.stringify(actionInstructions)}`);

        return { textResponse, actionInstructions };
    }
}

module.exports = new LlmResponseParser();
