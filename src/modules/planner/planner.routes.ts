// src/modules/planner/planner.routes.ts
import { Router } from 'express';
import multiStepPlannerService from './multi-step-planner.service.js';
import { createContextualLogger } from '../../core/logger/logger.js';

const router = Router();
const logger = createContextualLogger({ module: 'PlannerRoutes' });

/**
 * Create a Plan
 * POST /api/planner/plan
 * Body: { goal: string, context?: object }
 */
router.post('/plan', async (req, res) => {
    try {
        const { goal, context } = req.body;

        if (!goal) {
            return res.status(400).json({ success: false, error: 'Goal is required' });
        }

        const plan = await multiStepPlannerService.createPlan(goal, context || {});

        res.json({
            success: true,
            data: plan
        });
    } catch (error: any) {
        logger.error(`Plan creation failed: ${error.message}`);
        res.status(500).json({ success: false, error: 'Plan creation failed' });
    }
});

/**
 * Execute a Plan directly (Create + Execute)
 * POST /api/planner/execute
 * Body: { goal: string, context?: object }
 */
router.post('/execute', async (req, res) => {
    try {
        const { goal, context } = req.body;

        if (!goal) {
            return res.status(400).json({ success: false, error: 'Goal is required' });
        }

        // 1. Create
        const plan = await multiStepPlannerService.createPlan(goal, context || {});

        // 2. Execute
        // Note: Execution might be long running. Ideally this returns a job ID. 
        // For now we await it as per simple design, or could trigger async.
        // Given http timeout risk, we'll try to await but user should know.
        const executedPlan = await multiStepPlannerService.executePlan(plan);

        res.json({
            success: true,
            data: executedPlan
        });
    } catch (error: any) {
        logger.error(`Plan execution failed: ${error.message}`);
        res.status(500).json({ success: false, error: 'Plan execution failed' });
    }
});

export default router;
