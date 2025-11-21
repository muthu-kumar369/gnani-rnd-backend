// src/utils/textCleaner.js
const logger = require('./logger');

class TextCleaner {
    constructor() {
        logger.info('TextCleaner initialized.');
    }

    /**
     * Cleans and normalizes text transcript from ASR.
     * @param {string} text - The input text from ASR.
     * @returns {string} The cleaned and normalized text.
     */
    clean(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }

        // 1. Convert to lowercase
        let cleanedText = text.toLowerCase();

        // 2. Remove filler words (example list, can be expanded)
        const fillerWords = ['uh', 'um', 'ah', 'er', 'hmm', 'mhm', 'you know', 'like', 'i mean'];
        fillerWords.forEach(filler => {
            cleanedText = cleanedText.replace(new RegExp(`\b${filler}\b`, 'g'), '');
        });

        // 3. Remove extra spaces and trim
        cleanedText = cleanedText.replace(/\s+/g, ' ').trim();

        // 4. Handle punctuation (remove all for now, or selectively keep)
        // For query processing, often better to remove most punctuation
        cleanedText = cleanedText.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');

        // 5. Basic spell correction (placeholder - would typically use a library like 'correct-spell' or 'natural')
        // For now, this is just a placeholder to demonstrate the concept.
        // if (cleanedText.includes('wat')) cleanedText = cleanedText.replace('wat', 'what');

        logger.debug(`Cleaned text: "${text}" -> "${cleanedText}"`);
        return cleanedText;
    }
}

module.exports = new TextCleaner();
