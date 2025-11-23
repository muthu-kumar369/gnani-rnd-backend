// src/utils/textCleaner.ts
import logger from '../core/logger/logger.js';

class TextCleaner {
    constructor() {
        logger.info('TextCleaner initialized.');
    }

    clean(text: string): string {
        if (!text || typeof text !== 'string') {
            return '';
        }

        let cleanedText = text.toLowerCase();

        const fillerWords = ['uh', 'um', 'ah', 'er', 'hmm', 'mhm', 'you know', 'like', 'i mean'];
        fillerWords.forEach(filler => {
            cleanedText = cleanedText.replace(new RegExp(`\b${filler}\b`, 'g'), '');
        });

        cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
        cleanedText = cleanedText.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');

        logger.debug(`Cleaned text: "${text}" -> "${cleanedText}"`);
        return cleanedText;
    }
}

export default new TextCleaner();
