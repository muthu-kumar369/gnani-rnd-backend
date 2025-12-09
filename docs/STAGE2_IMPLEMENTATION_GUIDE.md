# Stage 2: Security Hardening - Implementation Summary

## Overview

**Duration:** 7 days  
**Priority:** P0 (Blocking Production)  
**Status:** Ready for Implementation

This document provides a complete implementation guide for Stage 2: Security Hardening, covering all 7 days of work with code examples, configurations, and best practices.

---

## Day 1: gRPC Rate Limiting ✅

### Files to Create

1. **`src/middleware/grpc-rate-limit.middleware.ts`** - Core rate limiter
2. **`src/config/rate-limits.config.ts`** - Rate limit configurations
3. **`tests/middleware/grpc-rate-limit.test.ts`** - Unit tests

### Implementation Pattern

```typescript
// src/middleware/grpc-rate-limit.middleware.ts
import { ServerUnaryCall, status } from '@grpc/grpc-js';
import redis from '../config/redis.config.js';
import metrics from '../core/monitoring/metrics.js';

export class GrpcRateLimiter {
  async checkRateLimit(call: ServerUnaryCall<any, any>, config: RateLimitConfig): Promise<void> {
    const key = this.generateKey(call);
    const rateLimitKey = `rate_limit:grpc:${key}`;
    
    const current = await redis.incr(rateLimitKey);
    
    if (current === 1) {
      await redis.expire(rateLimitKey, Math.ceil(config.windowMs / 1000));
    }
    
    if (current > config.maxRequests) {
      metrics.incrementRateLimitExceeded('grpc');
      throw {
        code: status.RESOURCE_EXHAUSTED,
        message: `Rate limit exceeded. Try again in ${config.windowMs / 1000}s`,
      };
    }
  }
  
  private generateKey(call: any): string {
    const userId = call.metadata.get('user-id')?.[0];
    const ip = call.metadata.get('x-forwarded-for')?.[0] || call.getPeer();
    return userId || ip;
  }
}
```

### Rate Limit Policies

```typescript
// src/config/rate-limits.config.ts
export const RATE_LIMIT_CONFIGS = {
  audioStream: { windowMs: 60000, maxRequests: 10 },
  sessionManagement: { windowMs: 60000, maxRequests: 60 },
  llmRequests: { windowMs: 60000, maxRequests: 30 },
  toolExecution: { windowMs: 60000, maxRequests: 50 },
  authentication: { windowMs: 900000, maxRequests: 5 },
};
```

---

## Day 2: Input Validation & Sanitization ✅

### Files to Create

1. **`src/core/validation/schemas.ts`** - Zod validation schemas
2. **`src/middleware/validation.middleware.ts`** - Validation middleware
3. **`tests/validation/schemas.test.ts`** - Schema tests

### Installation

```bash
npm install zod
```

### Implementation Pattern

```typescript
// src/core/validation/schemas.ts
import { z } from 'zod';

export const createSessionSchema = z.object({
  userId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  systemPrompt: z.string().max(5000).optional().transform(sanitizeHtml),
  model: z.string().regex(/^[a-zA-Z0-9\-_.]+$/).optional(),
});

export const llmRequestSchema = z.object({
  messages: z.array(z.object({
    content: z.string().min(1).max(10000).transform(sanitizeHtml),
    role: z.enum(['user', 'assistant', 'system']),
  })).min(1).max(100),
  model: z.string().regex(/^[a-zA-Z0-9\-_.]+$/),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(8192).optional(),
});

export const audioChunkSchema = z.object({
  sessionId: z.string().uuid(),
  audioData: z.instanceof(Buffer)
    .refine(buf => buf.length > 0)
    .refine(buf => buf.length <= 1024 * 1024),
  sampleRate: z.number().refine(rate => [8000, 16000, 44100, 48000].includes(rate)),
});

function sanitizeHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim();
}
```

### Validation Middleware

```typescript
// src/middleware/validation.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

export function validateRequest(schema: AnyZodObject) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      next(error);
    }
  };
}
```

---

## Day 3: Secrets Management ✅

### Files to Create

1. **`src/core/secrets/vault.service.ts`** - Vault integration
2. **`scripts/migrate-secrets-to-vault.ts`** - Migration script
3. **`docker-compose.yml`** - Add Vault service

### Docker Compose Addition

```yaml
vault:
  image: vault:latest
  ports:
    - "8200:8200"
  environment:
    VAULT_DEV_ROOT_TOKEN_ID: "dev-root-token"
    VAULT_DEV_LISTEN_ADDRESS: "0.0.0.0:8200"
  cap_add:
    - IPC_LOCK
  volumes:
    - vault-data:/vault/data
```

### Installation

```bash
npm install node-vault
```

### Implementation Pattern

```typescript
// src/core/secrets/vault.service.ts
import vault from 'node-vault';
import { createContextualLogger } from '../logger/logger.js';

const logger = createContextualLogger({ module: 'VaultService' });

class VaultService {
  private client: any;
  private readonly secretPath = 'secret/data/gnani';

  constructor() {
    this.client = vault({
      endpoint: process.env.VAULT_ADDR || 'http://localhost:8200',
      token: process.env.VAULT_TOKEN,
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.client.health();
      logger.info('Connected to Vault successfully');
      await this.loadSecrets();
    } catch (error) {
      logger.error('Failed to connect to Vault', error);
      throw new Error('Vault initialization failed');
    }
  }

  async getSecret(key: string): Promise<string> {
    const result = await this.client.read(`${this.secretPath}/${key}`);
    return result.data.data.value;
  }

  async setSecret(key: string, value: string): Promise<void> {
    await this.client.write(`${this.secretPath}/${key}`, { data: { value } });
    logger.info(`Secret updated: ${key}`);
  }

  private async loadSecrets(): Promise<void> {
    const secretKeys = [
      'JWT_SECRET', 'MONGODB_URI', 'REDIS_URL',
      'OLLAMA_BASE_URL', 'CHROMADB_URL',
      'SLACK_WEBHOOK_URL', 'SMTP_PASSWORD'
    ];

    for (const key of secretKeys) {
      try {
        const value = await this.getSecret(key);
        process.env[key] = value;
      } catch (error) {
        logger.warn(`Secret not found in Vault: ${key}, using .env fallback`);
      }
    }
  }
}

export const vaultService = new VaultService();
```

---

## Day 4: PII Detection & Masking ✅

### Files to Create

1. **`src/core/security/pii-detector.service.ts`** - PII detection
2. **`src/core/security/pii-masker.service.ts`** - PII masking
3. **`tests/security/pii-detector.test.ts`** - Tests

### Implementation Pattern

```typescript
// src/core/security/pii-detector.service.ts
export interface PIIMatch {
  type: 'email' | 'phone' | 'ssn' | 'credit_card';
  value: string;
  start: number;
  end: number;
  confidence: number;
}

export class PIIDetectorService {
  private readonly patterns = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /\b(\+\d{1,3}[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b/g,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
  };

  detectPII(text: string): PIIMatch[] {
    const matches: PIIMatch[] = [];
    
    for (const [type, pattern] of Object.entries(this.patterns)) {
      const regex = new RegExp(pattern);
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          type: type as any,
          value: match[0],
          start: match.index,
          end: match.index + match[0].length,
          confidence: 0.9,
        });
      }
    }
    
    return matches;
  }

  maskPII(text: string, maskChar: string = '*'): string {
    const matches = this.detectPII(text);
    let maskedText = text;
    
    // Sort matches by start position (descending) to avoid index issues
    matches.sort((a, b) => b.start - a.start);
    
    for (const match of matches) {
      const masked = this.maskValue(match.value, match.type, maskChar);
      maskedText = maskedText.substring(0, match.start) + 
                   masked + 
                   maskedText.substring(match.end);
    }
    
    return maskedText;
  }

  private maskValue(value: string, type: string, maskChar: string): string {
    switch (type) {
      case 'email':
        const [local, domain] = value.split('@');
        return `${local[0]}${'*'.repeat(local.length - 1)}@${domain}`;
      case 'phone':
        return `***-***-${value.slice(-4)}`;
      case 'ssn':
        return `***-**-${value.slice(-4)}`;
      case 'credit_card':
        return `****-****-****-${value.slice(-4)}`;
      default:
        return maskChar.repeat(value.length);
    }
  }
}

export const piiDetector = new PIIDetectorService();
```

---

## Day 5: Content Filtering ✅

### Files to Create

1. **`src/core/security/content-filter.service.ts`** - Content filtering
2. **`src/config/content-filter.config.ts`** - Filter rules
3. **`tests/security/content-filter.test.ts`** - Tests

### Implementation Pattern

```typescript
// src/core/security/content-filter.service.ts
export interface FilterResult {
  allowed: boolean;
  reason?: string;
  categories: string[];
  confidence: number;
}

export class ContentFilterService {
  private readonly bannedPatterns = [
    /\b(violence|harm|kill|attack)\b/i,
    /\b(illegal|drugs|weapons)\b/i,
    /\b(hate|racist|sexist)\b/i,
  ];

  private readonly sensitiveTopics = [
    'self-harm', 'suicide', 'terrorism',
    'child-safety', 'illegal-activities'
  ];

  async filterInput(text: string): Promise<FilterResult> {
    const categories: string[] = [];
    
    // Check banned patterns
    for (const pattern of this.bannedPatterns) {
      if (pattern.test(text)) {
        categories.push('banned-content');
      }
    }
    
    // Check sensitive topics
    const lowerText = text.toLowerCase();
    for (const topic of this.sensitiveTopics) {
      if (lowerText.includes(topic)) {
        categories.push('sensitive-topic');
      }
    }
    
    const allowed = categories.length === 0;
    
    return {
      allowed,
      reason: allowed ? undefined : 'Content violates safety policies',
      categories,
      confidence: 0.85,
    };
  }

  async filterOutput(text: string): Promise<FilterResult> {
    // Similar logic for output filtering
    return this.filterInput(text);
  }
}

export const contentFilter = new ContentFilterService();
```

---

## Day 6: Security Audit Logging ✅

### Files to Create

1. **`src/core/logger/security-audit.service.ts`** - Security audit logging
2. **`monitoring/grafana/dashboards/security-audit.json`** - Security dashboard

### Implementation Pattern

```typescript
// src/core/logger/security-audit.service.ts
import { createContextualLogger } from './logger.js';
import metrics from '../monitoring/metrics.js';

const logger = createContextualLogger({ module: 'SecurityAudit' });

export class SecurityAuditService {
  logAuthAttempt(userId: string, success: boolean, metadata?: any): void {
    logger.info('Authentication attempt', {
      userId,
      success,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
    
    if (!success) {
      metrics.incrementErrors('auth_failed', 'authentication');
    }
  }

  logRateLimitExceeded(endpoint: string, userId: string): void {
    logger.warn('Rate limit exceeded', {
      endpoint,
      userId,
      timestamp: new Date().toISOString(),
    });
    
    metrics.incrementRateLimitExceeded(endpoint);
  }

  logPIIDetected(userId: string, piiType: string, masked: boolean): void {
    logger.info('PII detected', {
      userId,
      piiType,
      masked,
      timestamp: new Date().toISOString(),
    });
  }

  logContentFiltered(userId: string, reason: string, categories: string[]): void {
    logger.warn('Content filtered', {
      userId,
      reason,
      categories,
      timestamp: new Date().toISOString(),
    });
  }

  logSecurityEvent(event: string, severity: 'info' | 'warning' | 'critical', metadata?: any): void {
    logger[severity](`Security event: ${event}`, {
      event,
      severity,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }
}

export const securityAudit = new SecurityAuditService();
```

---

## Day 7: Testing & Documentation ✅

### Testing Checklist

- [ ] gRPC rate limiting tests
- [ ] Input validation tests
- [ ] Vault integration tests
- [ ] PII detection accuracy tests
- [ ] Content filtering tests
- [ ] Security audit logging tests

### Documentation Files

1. **`docs/security/SECURITY.md`** - Security overview
2. **`docs/security/RATE_LIMITING.md`** - Rate limiting guide
3. **`docs/security/INPUT_VALIDATION.md`** - Validation guide
4. **`docs/security/SECRETS_MANAGEMENT.md`** - Secrets guide
5. **`docs/security/PII_HANDLING.md`** - PII handling guide
6. **`docs/security/CONTENT_FILTERING.md`** - Content filtering guide

---

## Integration Points

### 1. gRPC Server Integration

```typescript
// src/grpc/server.ts
import { createGrpcRateLimiter } from '../middleware/grpc-rate-limit.middleware.js';
import { RATE_LIMIT_CONFIGS } from '../config/rate-limits.config.js';

const sessionLimiter = createGrpcRateLimiter(redis, RATE_LIMIT_CONFIGS.sessionManagement);

server.addService(SessionServiceDefinition, {
  async createSession(call, callback) {
    try {
      await sessionLimiter.checkRateLimit(call);
      // existing implementation
    } catch (error) {
      callback(error);
    }
  },
});
```

### 2. LLM Service Integration

```typescript
// src/modules/llm/llm.service.ts
import { contentFilter } from '../../core/security/content-filter.service.js';
import { piiDetector } from '../../core/security/pii-detector.service.js';

async getLlmResponse(prompt: any): Promise<any> {
  // Filter input
  const inputFilter = await contentFilter.filterInput(prompt.current_user_query);
  if (!inputFilter.allowed) {
    throw new Error('Content violates safety policies');
  }
  
  // Get LLM response
  const response = await this.callLLM(prompt);
  
  // Mask PII in response
  response.text = piiDetector.maskPII(response.text);
  
  return response;
}
```

### 3. Logger Integration

```typescript
// src/core/logger/logger.ts
import { piiDetector } from '../security/pii-detector.service.js';

export function createContextualLogger(context: any) {
  return {
    info: (message: string, metadata?: any) => {
      const maskedMessage = piiDetector.maskPII(message);
      const maskedMetadata = maskPIIInObject(metadata);
      winston.info(maskedMessage, maskedMetadata);
    },
    // ... other log levels
  };
}
```

---

## Environment Variables

Add to `.env`:

```env
# Vault Configuration
VAULT_ADDR=http://localhost:8200
VAULT_TOKEN=dev-root-token

# Rate Limiting
RATE_LIMIT_ENABLED=true

# Content Filtering
CONTENT_FILTER_ENABLED=true
CONTENT_FILTER_STRICT_MODE=false

# PII Detection
PII_DETECTION_ENABLED=true
PII_MASKING_ENABLED=true
```

---

## Success Metrics

After implementation, verify:

- [ ] gRPC rate limiting blocks excessive requests
- [ ] All inputs validated with Zod schemas
- [ ] Secrets loaded from Vault successfully
- [ ] PII detected and masked in logs
- [ ] Harmful content blocked by filter
- [ ] Security events logged to audit service
- [ ] All tests passing
- [ ] Documentation complete

---

## Next Steps

1. Review this implementation guide
2. Implement each day sequentially
3. Test thoroughly after each day
4. Update documentation as you go
5. Create completion summary after Day 7

---

**Created:** December 9, 2025  
**Status:** Implementation Guide Complete  
**Ready for:** Full Stage 2 Implementation
