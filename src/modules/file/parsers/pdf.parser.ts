// src/modules/file/parsers/pdf.parser.ts
import { createContextualLogger } from '../../../core/logger/logger.js';

const logger = createContextualLogger({ module: 'PDFParser' });

// Lazy load pdf-parse to avoid canvas initialization at startup
let pdfParse: any = null;
async function loadPdfParse() {
    if (!pdfParse) {
        try {
            const module = await import('pdf-parse');
            pdfParse = (module as any).default || module;
            logger.debug('pdf-parse module loaded successfully');
        } catch (error: any) {
            logger.error(`Failed to load pdf-parse: ${error.message}`);
            throw new Error(`PDF parsing unavailable: ${error.message}`);
        }
    }
    return pdfParse;
}

/**
 * Extract text content from PDF buffer
 */
export async function parsePDF(buffer: Buffer): Promise<string> {
    try {
        const parser = await loadPdfParse();
        const data = await parser(buffer);
        logger.debug(`PDF parsed: ${data.numpages} pages, ${data.text.length} characters`);
        return data.text.trim();
    } catch (error: any) {
        logger.error(`PDF parsing failed: ${error.message}`);
        throw new Error(`Failed to parse PDF: ${error.message}`);
    }
}
