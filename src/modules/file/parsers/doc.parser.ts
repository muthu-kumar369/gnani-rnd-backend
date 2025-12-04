// src/modules/file/parsers/doc.parser.ts
import mammoth from 'mammoth';
import { createContextualLogger } from '../../../core/logger/logger.js';

const logger = createContextualLogger({ module: 'DOCParser' });

/**
 * Extract text content from DOCX buffer
 */
export async function parseDOCX(buffer: Buffer): Promise<string> {
    try {
        const result = await mammoth.extractRawText({ buffer });
        logger.debug(`DOCX parsed: ${result.value.length} characters`);

        if (result.messages.length > 0) {
            logger.warn('DOCX parsing warnings:', result.messages);
        }

        return result.value.trim();
    } catch (error: any) {
        logger.error(`DOCX parsing failed: ${error.message}`);
        throw new Error(`Failed to parse DOCX: ${error.message}`);
    }
}
