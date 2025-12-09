# Stage 2: Security Hardening - Integration Guide

## Overview

This guide shows how to integrate the Stage 2 security services into your existing codebase.

---

## 1. LLM Service Integration

### File: `src/modules/llm/llm.service.ts`

Add imports at the top:
```typescript
import { contentFilter } from '../../core/security/content-filter.service.js';
import { piiDetector } from '../../core/security/pii-detector.service.js';
import { securityAudit } from '../../core/logger/security-audit.service.js';
```

Modify `getLlmResponse` method (around line 203):
```typescript
async getLlmResponse(structuredPrompt: any, onPartialResponse: any = null, preferredModel?: string): Promise<any> {
    const sessionId = structuredPrompt.session_id;
    const userId = structuredPrompt.user_id;
    
    // ADD: Content filtering for input
    const inputFilter = await contentFilter.filterInput(
        structuredPrompt.current_user_query, 
        userId
    );
    
    if (!inputFilter.allowed) {
        securityAudit.logContentFiltered(userId, inputFilter.reason!, inputFilter.categories);
        throw new Error(`Content policy violation: ${inputFilter.reason}`);
    }
    
    // ... existing code ...
    
    // After getting LLM response, before returning:
    // ADD: Mask PII in response
    if (llmOutput) {
        llmOutput = piiDetector.maskPII(llmOutput);
    }
    
    return { text: llmOutput, action, tokenUsage };
}
```

---

## 2. gRPC Server Integration

### File: `src/grpc/server.ts` (or wherever gRPC handlers are defined)

Add imports:
```typescript
import { createGrpcRateLimiter } from '../middleware/grpc-rate-limit.middleware.js';
import { RATE_LIMIT_CONFIGS } from '../config/rate-limits.config.js';
import { validateGrpcRequest } from '../middleware/validation.middleware.js';
import { createSessionSchema, audioChunkSchema } from '../core/validation/schemas.js';
```

Create rate limiters:
```typescript
const sessionLimiter = createGrpcRateLimiter(RATE_LIMIT_CONFIGS.sessionManagement);
const audioLimiter = createGrpcRateLimiter(RATE_LIMIT_CONFIGS.audioStream);
const llmLimiter = createGrpcRateLimiter(RATE_LIMIT_CONFIGS.llmRequests);
```

Wrap gRPC handlers:
```typescript
server.addService(SessionServiceDefinition, {
    async createSession(call, callback) {
        try {
            // Rate limiting
            await sessionLimiter.checkUnaryRateLimit(call);
            
            // Validation
            const validated = await validateGrpcRequest(createSessionSchema, call.request);
            
            // ... existing implementation with validated data ...
            
        } catch (error) {
            callback(error);
        }
    },
    
    async streamAudio(call) {
        try {
            // Rate limiting for stream
            await audioLimiter.checkStreamRateLimit(call);
            
            // ... existing implementation ...
            
        } catch (error) {
            call.destroy(error);
        }
    },
});
```

---

## 3. Logger Integration (PII Masking)

### File: `src/core/logger/logger.ts`

Add import:
```typescript
import { piiDetector } from '../security/pii-detector.service.js';
```

Modify `createContextualLogger`:
```typescript
export function createContextualLogger(context: any) {
    return {
        info: (message: string, metadata?: any) => {
            const maskedMessage = piiDetector.maskPII(message);
            const maskedMetadata = piiDetector.maskPIIInObject(metadata);
            winston.info(maskedMessage, { ...context, ...maskedMetadata });
        },
        
        warn: (message: string, metadata?: any) => {
            const maskedMessage = piiDetector.maskPII(message);
            const maskedMetadata = piiDetector.maskPIIInObject(metadata);
            winston.warn(maskedMessage, { ...context, ...maskedMetadata });
        },
        
        error: (message: string, metadata?: any) => {
            const maskedMessage = piiDetector.maskPII(message);
            const maskedMetadata = piiDetector.maskPIIInObject(metadata);
            winston.error(maskedMessage, { ...context, ...maskedMetadata });
        },
        
        debug: (message: string, metadata?: any) => {
            const maskedMessage = piiDetector.maskPII(message);
            const maskedMetadata = piiDetector.maskPIIInObject(metadata);
            winston.debug(maskedMessage, { ...context, ...maskedMetadata });
        },
    };
}
```

---

## 4. Application Startup (Vault Initialization)

### File: `src/index.ts`

Add import:
```typescript
import { vaultService } from './core/secrets/vault.service.js';
```

Modify startup:
```typescript
async function bootstrap() {
    try {
        // Initialize Vault first (before any other services)
        console.log('Initializing Vault...');
        await vaultService.initialize();
        
        if (vaultService.isAvailable()) {
            console.log('✅ Vault initialized successfully');
        } else {
            console.log('⚠️  Vault not available, using .env fallback');
        }
        
        // Then start other services
        await startServer();
        
    } catch (error) {
        console.error('Failed to start application:', error);
        process.exit(1);
    }
}

bootstrap();
```

---

## 5. Express Routes Integration

### Example: `src/routes/session.routes.ts`

Add imports:
```typescript
import { validateRequest } from '../middleware/validation.middleware.js';
import { createSessionSchema } from '../core/validation/schemas.js';
import { z } from 'zod';
```

Apply validation:
```typescript
router.post(
    '/sessions',
    validateRequest(z.object({
        body: createSessionSchema,
    })),
    sessionController.createSession
);
```

---

## 6. Environment Variables

Update `.env` file:
```env
# Vault Configuration (after running setup script)
VAULT_ADDR=http://localhost:8200
VAULT_TOKEN=dev-root-token

# Security Features
RATE_LIMIT_ENABLED=true
CONTENT_FILTER_ENABLED=true
PII_DETECTION_ENABLED=true
PII_MASKING_ENABLED=true

# After migration, remove or empty these:
# JWT_SECRET=
# MONGODB_URI=
# REDIS_URL=
# (Vault will provide these)
```

---

## 7. Package.json Scripts

Add to `package.json`:
```json
{
  "scripts": {
    "setup:security": "node scripts/setup-stage2-security.ps1",
    "migrate:secrets": "node scripts/migrate-secrets-to-vault.js"
  }
}
```

---

## Integration Checklist

- [ ] Import security services in LLM service
- [ ] Add content filtering to LLM input
- [ ] Add PII masking to LLM output
- [ ] Create gRPC rate limiters
- [ ] Wrap gRPC handlers with rate limiting
- [ ] Add validation to gRPC handlers
- [ ] Integrate PII masking in logger
- [ ] Initialize Vault in application startup
- [ ] Add validation to Express routes
- [ ] Update environment variables
- [ ] Run Vault setup script
- [ ] Migrate secrets to Vault
- [ ] Test all integrations

---

## Testing Integration

### 1. Test Rate Limiting
```bash
# Make rapid requests to test rate limiting
for i in {1..100}; do
  curl -X POST http://localhost:3001/api/sessions
done
```

### 2. Test Content Filtering
```bash
# Try to send harmful content
curl -X POST http://localhost:3001/api/llm \
  -H "Content-Type: application/json" \
  -d '{"query": "how to harm someone"}'
```

### 3. Test PII Masking
```bash
# Check logs for masked PII
tail -f logs/app.log | grep "email"
```

### 4. Test Vault Integration
```bash
# Check if secrets are loaded from Vault
curl http://localhost:8200/v1/secret/data/gnani/JWT_SECRET \
  -H "X-Vault-Token: dev-root-token"
```

---

## Troubleshooting

### Vault Not Available
- Ensure Vault is running: `docker ps | grep vault`
- Check Vault logs: `docker logs gnani-vault`
- Verify VAULT_ADDR and VAULT_TOKEN in .env

### Rate Limiting Not Working
- Check Redis is running
- Verify rate limit configs in `rate-limits.config.ts`
- Check metrics: `curl http://localhost:3001/metrics | grep rate_limit`

### Validation Errors
- Check Zod schema definitions
- Verify request payload matches schema
- Check validation middleware is applied

### PII Not Masked
- Verify PII_MASKING_ENABLED=true in .env
- Check logger integration
- Test PII detector: `piiDetector.detectPII("test@email.com")`

---

## Next Steps After Integration

1. Run integration tests
2. Monitor security metrics in Grafana
3. Review security audit logs
4. Tune rate limit thresholds
5. Add custom content filter rules
6. Set up production Vault instance

---

**Created:** December 9, 2025  
**Status:** Integration Guide Complete
