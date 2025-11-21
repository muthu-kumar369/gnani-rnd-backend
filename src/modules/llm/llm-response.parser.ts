// src/utils/llmResponseParser.ts
import logger from '../../core/logger/logger.js';

interface LlmRawResponse {
    text?: string;
    action?: any;
}

class LlmResponseParser {
    constructor() {
        logger.info('LlmResponseParser initialized.');
    }

    parse(llmRawResponse: LlmRawResponse): { textResponse: string, actionInstructions: any | null } {
        let textResponse = llmRawResponse.text || '';
        let actionInstructions = llmRawResponse.action || null;

        const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
        const match = textResponse.match(jsonRegex);

        if (match && match[1]) {
            try {
                const parsedJson = JSON.parse(match[1]);
                if (parsedJson.action) {
                    actionInstructions = parsedJson;
                    textResponse = textResponse.replace(match[0], '').trim();
                }
            } catch (e: any) {
                logger.warn(`Failed to parse JSON from LLM response: ${e.message}`);
            }
        }

        logger.debug(`Parsed LLM response. Text: "${textResponse}", Action: ${JSON.stringify(actionInstructions)}`);

        return { textResponse, actionInstructions };
    }
}

export default new LlmResponseParser();
