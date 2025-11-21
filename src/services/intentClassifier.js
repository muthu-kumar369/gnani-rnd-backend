// src/services/intentClassifier.js
const logger = require('../utils/logger');

class IntentClassifier {
    constructor() {
        this.keywords = {
            system_command: ['gnani', 'system', 'execute', 'run', 'open', 'close', 'shutdown', 'reboot'],
            search_query: ['search', 'find', 'google', 'look up', 'browse'],
            utility_request: ['set timer', 'calculator', 'note', 'reminder', 'weather', 'time', 'date'],
            multi_step_instruction: ['first', 'then', 'after that', 'next', 'and also'],
        };
        logger.info('IntentClassifier initialized.');
    }

    /**
     * Classifies the given text into an intent type.
     * @param {string} text - The cleaned text to classify.
     * @returns {string} The classified intent type (e.g., 'conversation', 'system_command').
     */
    classify(text) {
        if (!text || typeof text !== 'string') {
            return 'conversation'; // Default to conversation for empty or invalid input
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
        return 'conversation'; // Default intent
    }

    /**
     * Placeholder for future ML/NLP model integration.
     * @param {string} text - The text to classify.
     * @returns {Promise<string>} A promise that resolves to the classified intent.
     */
    async classifyWithML(text) {
        logger.debug(`[ML/NLP Placeholder] Classifying text with ML model: "${text}"`);
        // In a real scenario, this would call an external ML model or an NLP library.
        return this.classify(text); // Fallback to keyword-based for now
    }
}

module.exports = new IntentClassifier();
