// src/modules/file/parsers/pdf.parser.ts
import * as pdfParse from 'pdf-parse';
import { createContextualLogger } from '../../../core/logger/logger.js';

const logger = createContextualLogger({ module: 'PDFParser' });

/**
 * Extract text content from PDF buffer
 */
export async function parsePDF(buffer: Buffer): Promise<string> {
    try {
        const data = await (pdfParse as any)(buffer);
        logger.debug(`PDF parsed: ${data.numpages} pages, ${data.text.length} characters`);
        return data.text.trim();
    } catch (error: any) {
        logger.error(`PDF parsing failed: ${error.message}`);
        throw new Error(`Failed to parse PDF: ${error.message}`);
    }
}
