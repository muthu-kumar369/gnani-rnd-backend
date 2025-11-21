// src/services/intentClassifier.ts
import logger from '../utils/logger.js';

class IntentClassifier {
    private keywords: { [key: string]: string[] };

    constructor() {
        this.keywords = {
            system_command: ['gnani', 'system', 'execute', 'run', 'open', 'close', 'shutdown', 'reboot'],
            search_query: ['search', 'find', 'google', 'look up', 'browse'],
            utility_request: ['set timer', 'calculator', 'note', 'reminder', 'weather', 'time', 'date'],
            multi_step_instruction: ['first', 'then', 'after that', 'next', 'and also'],
        };
        logger.info('IntentClassifier initialized.');
    }

    classify(text: string): string {
        if (!text || typeof text !== 'string') {
            return 'conversation';
        }

        const lowerText = text.toLowerCase();

        for (const intentType in this.keywords) {
            for (const keyword of this.keywords[intentType]) {
                if (lowerText.includes(keyword)) {
                    logger.debug(`Text "${text}" classified as: ${intentType} (keyword: ${keyword})`);
                    return intentType;
                }
            }
        }

        logger.debug(`Text "${text}" classified as: conversation (no specific intent detected)`);
        return 'conversation';
    }

    async classifyWithML(text: string): Promise<string> {
        logger.debug(`[ML/NLP Placeholder] Classifying text with ML model: "${text}"`);
        return this.classify(text);
    }
}

export default new IntentClassifier();
