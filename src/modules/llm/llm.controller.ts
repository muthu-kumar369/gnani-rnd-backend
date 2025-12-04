// src/modules/llm/llm.controller.ts
import { Request, Response, NextFunction } from 'express';
import { getAvailableModelsList } from '../../config/llm.config.js';
import { createContextualLogger } from '../../core/logger/logger.js';
import { Logger } from 'winston';

class LlmController {
    private logger: Logger;

    constructor() {
        this.logger = createContextualLogger({ module: 'LlmController' });
    }

    async getAvailableModels(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const models = getAvailableModelsList();
            this.logger.debug(`Returning ${models.length} available models`);
            res.status(200).json({ models });
        } catch (error: any) {
            this.logger.error(`Error fetching available models: ${error.message}`);
            next(error);
        }
    }
}

export default new LlmController();
