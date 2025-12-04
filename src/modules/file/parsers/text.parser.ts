// src/modules/file/parsers/text.parser.ts
import { createContextualLogger } from '../../../core/logger/logger.js';

const logger = createContextualLogger({ module: 'TextParser' });

/**
 * Extract text content from plain text or markdown buffer
 */
export async function parseText(buffer: Buffer): Promise<string> {
    try {
        // Try UTF-8 first
        const text = buffer.toString('utf-8');
        logger.debug(`Text parsed: ${text.length} characters`);
        return text.trim();
    } catch (error: any) {
        logger.error(`Text parsing failed: ${error.message}`);
        throw new Error(`Failed to parse text: ${error.message}`);
    }
}
