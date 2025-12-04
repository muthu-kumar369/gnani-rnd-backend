// src/modules/llm/llm.routes.ts
import express from 'express';
import llmController from './llm.controller.js';

const router = express.Router();

// GET /api/llm/models - Get available models
router.get('/models', llmController.getAvailableModels.bind(llmController));

export default router;
