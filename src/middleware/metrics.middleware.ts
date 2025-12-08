// src/middleware/metrics.middleware.ts
// Stage 6: Metrics middleware for HTTP request tracking
import { Request, Response, NextFunction } from 'express';
import metrics from '../core/monitoring/metrics.js';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    // Track request size
    const requestSize = parseInt(req.headers['content-length'] || '0', 10);
    if (metrics.httpRequestSize) {
        metrics.httpRequestSize.observe({ method: req.method, route: req.route?.path || req.path }, requestSize);
    }

    // Capture response
    const originalSend = res.send;
    res.send = function (data: any) {
        const responseSize = Buffer.byteLength(JSON.stringify(data));
        if (metrics.httpResponseSize) {
            metrics.httpResponseSize.observe({ method: req.method, route: req.route?.path || req.path }, responseSize);
        }
        return originalSend.call(this, data);
    };

    // On response finish
    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const route = req.route?.path || req.path;

        // Record duration
        metrics.httpRequestDurationSeconds.observe(
            { method: req.method, route, status: res.statusCode.toString() },
            duration
        );

        // Increment counter
        metrics.httpRequestCounter.inc(
            { method: req.method, route, status: res.statusCode.toString() }
        );
    });

    next();
}
