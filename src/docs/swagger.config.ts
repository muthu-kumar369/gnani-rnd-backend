import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Application } from 'express';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Gnani API Documentation',
            version: '1.0.0',
            description: 'AI Assistant Backend API - Production-grade voice assistant with real-time audio processing, LLM integration, and session management',
            contact: {
                name: 'Gnani Team',
                email: 'support@gnani.ai'
            },
            license: {
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT'
            }
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Development server'
            },
            {
                url: 'https://api.gnani.ai',
                description: 'Production server'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT authentication token'
                }
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        error: {
                            type: 'object',
                            properties: {
                                code: { type: 'string', example: 'VALIDATION_ERROR' },
                                message: { type: 'string', example: 'Invalid input' },
                                details: { type: 'object' }
                            }
                        }
                    }
                },
                HealthStatus: {
                    type: 'object',
                    properties: {
                        status: { type: 'string', enum: ['ok', 'degraded', 'error'] },
                        timestamp: { type: 'string', format: 'date-time' },
                        uptime: { type: 'number' },
                        checks: {
                            type: 'object',
                            properties: {
                                database: { type: 'object' },
                                redis: { type: 'object' },
                                llm: { type: 'object' }
                            }
                        }
                    }
                },
                Session: {
                    type: 'object',
                    properties: {
                        sessionId: { type: 'string', format: 'uuid' },
                        userId: { type: 'string' },
                        conversationId: { type: 'string', format: 'uuid' },
                        createdAt: { type: 'string', format: 'date-time' },
                        lastActivity: { type: 'string', format: 'date-time' }
                    }
                },
                Message: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        role: { type: 'string', enum: ['user', 'assistant', 'system'] },
                        content: { type: 'string' },
                        timestamp: { type: 'string', format: 'date-time' },
                        metadata: { type: 'object' }
                    }
                }
            }
        },
        tags: [
            {
                name: 'Health',
                description: 'Health check and monitoring endpoints'
            },
            {
                name: 'Session',
                description: 'Session management'
            },
            {
                name: 'Conversation',
                description: 'Conversation and messaging'
            },
            {
                name: 'Metrics',
                description: 'Prometheus metrics'
            }
        ]
    },
    apis: [
        './src/routes/*.ts',
        './src/modules/**/*.routes.ts',
        './src/middleware/*.ts'
    ]
};

export const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Application): void {
    // Swagger UI
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'Gnani API Docs'
    }));

    // Swagger JSON
    app.get('/api-docs.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerSpec);
    });
}
