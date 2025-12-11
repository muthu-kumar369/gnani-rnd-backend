import { Router } from 'express';
import { HealthController } from '../controllers/health.controller.js';

const router = Router();
const healthController = new HealthController();

// Liveness probe - is the app running?
router.get('/live', (req, res) => healthController.liveness(req, res));

// Readiness probe - is the app ready to serve traffic?
router.get('/ready', (req, res) => healthController.readiness(req, res));

// Startup probe - has the app finished starting?
router.get('/startup', (req, res) => healthController.startup(req, res));

// STAGE 1: Comprehensive health check using service
router.get('/health', (req, res) => healthController.health(req, res));

export default router;
