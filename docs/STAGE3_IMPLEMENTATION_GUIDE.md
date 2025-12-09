# Stage 3: Testing & Quality Assurance - Implementation Guide

## Overview

**Duration:** 10 days  
**Priority:** P1 (Critical for UX)  
**Target:** 80% test coverage, 1000+ concurrent users  
**Current Completion:** Ready for Implementation

This document provides a complete implementation guide for Stage 3: Testing & Quality Assurance.

---

## Day 1-4: Unit Testing (80% Coverage Target)

### Test Structure

```
tests/
├── unit/
│   ├── modules/
│   │   ├── llm/
│   │   │   └── llm.service.test.ts
│   │   ├── session/
│   │   │   └── session.coordinator.test.ts
│   │   ├── memory/
│   │   │   └── memory.manager.test.ts
│   │   └── tool/
│   │       └── tool.service.test.ts
│   ├── core/
│   │   ├── security/
│   │   │   ├── pii-detector.test.ts
│   │   │   └── content-filter.test.ts
│   │   └── reliability/
│   │       └── circuit-breaker.test.ts
│   └── helpers/
│       └── test-utils.ts
├── integration/
├── load/
└── e2e/
```

### Jest Configuration

Update `jest.config.js`:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.interface.ts',
    '!src/index.ts',
    '!src/**/*.test.ts',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};
```

### Example Unit Tests

#### 1. PII Detector Test
```typescript
// tests/unit/core/security/pii-detector.test.ts
import { piiDetector } from '@/core/security/pii-detector.service';

describe('PIIDetectorService', () => {
  describe('detectPII', () => {
    it('should detect email addresses', () => {
      const text = 'Contact me at john.doe@example.com';
      const matches = piiDetector.detectPII(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe('email');
      expect(matches[0].value).toBe('john.doe@example.com');
    });

    it('should detect phone numbers', () => {
      const text = 'Call me at +1-555-123-4567';
      const matches = piiDetector.detectPII(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe('phone');
    });

    it('should detect multiple PII types', () => {
      const text = 'Email: test@email.com, Phone: 555-1234';
      const matches = piiDetector.detectPII(text);
      
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('maskPII', () => {
    it('should mask email addresses', () => {
      const text = 'Email: john.doe@example.com';
      const masked = piiDetector.maskPII(text);
      
      expect(masked).not.toContain('john.doe@example.com');
      expect(masked).toContain('j***@example.com');
    });

    it('should preserve non-PII text', () => {
      const text = 'Hello world, no PII here';
      const masked = piiDetector.maskPII(text);
      
      expect(masked).toBe(text);
    });
  });
});
```

#### 2. Content Filter Test
```typescript
// tests/unit/core/security/content-filter.test.ts
import { contentFilter } from '@/core/security/content-filter.service';

describe('ContentFilterService', () => {
  describe('filterInput', () => {
    it('should allow safe content', async () => {
      const result = await contentFilter.filterInput('Hello, how are you?');
      
      expect(result.allowed).toBe(true);
      expect(result.categories).toHaveLength(0);
    });

    it('should block violent content', async () => {
      const result = await contentFilter.filterInput('how to harm someone');
      
      expect(result.allowed).toBe(false);
      expect(result.categories).toContain('violence');
    });

    it('should block self-harm content', async () => {
      const result = await contentFilter.filterInput('I want to end my life');
      
      expect(result.allowed).toBe(false);
      expect(result.categories).toContain('self-harm');
    });
  });
});
```

#### 3. Circuit Breaker Test
```typescript
// tests/unit/core/reliability/circuit-breaker.test.ts
import { CircuitBreaker } from '@/core/reliability/circuit-breaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker('test', {
      failureThreshold: 3,
      resetTimeoutMs: 1000,
    });
  });

  it('should execute function when closed', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    const result = await breaker.execute(fn);
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalled();
  });

  it('should open after threshold failures', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fail'));
    
    // Trigger failures
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(fn)).rejects.toThrow();
    }
    
    // Circuit should be open
    await expect(breaker.execute(fn)).rejects.toThrow('Circuit breaker open');
  });

  it('should reset after timeout', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');
    
    // Open circuit
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(fn)).rejects.toThrow();
    }
    
    // Wait for reset
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Should work again
    const result = await breaker.execute(fn);
    expect(result).toBe('success');
  });
});
```

### Running Unit Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test pii-detector.test.ts

# Run in watch mode
npm test -- --watch

# Generate HTML coverage report
npm run test:coverage:html
```

---

## Day 5-6: Integration Testing

### Integration Test Examples

#### 1. Session Flow Integration
```typescript
// tests/integration/session-flow.test.ts
import request from 'supertest';
import { app } from '@/app';
import { connectDB, disconnectDB } from '@/config/database.config';

describe('Session Flow Integration', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  it('should complete full session lifecycle', async () => {
    // 1. Create session
    const createRes = await request(app)
      .post('/api/v1/sessions')
      .send({ userId: 'test-user' })
      .expect(201);

    const sessionId = createRes.body.sessionId;

    // 2. Send message
    const messageRes = await request(app)
      .post(`/api/v1/sessions/${sessionId}/messages`)
      .send({
        content: 'Hello',
        role: 'user',
      })
      .expect(200);

    expect(messageRes.body).toHaveProperty('response');

    // 3. End session
    await request(app)
      .delete(`/api/v1/sessions/${sessionId}`)
      .expect(200);
  });
});
```

#### 2. LLM-Memory Integration
```typescript
// tests/integration/llm-memory.test.ts
import { llmService } from '@/modules/llm/llm.service';
import { memoryManager } from '@/modules/memory/memory.manager';

describe('LLM-Memory Integration', () => {
  it('should use memory context in LLM requests', async () => {
    const userId = 'test-user';
    
    // Store memory
    await memoryManager.storeMemory(userId, {
      content: 'User likes pizza',
      type: 'preference',
    });

    // Get LLM response
    const response = await llmService.getLlmResponse({
      user_id: userId,
      current_user_query: 'What do I like to eat?',
    });

    expect(response.text.toLowerCase()).toContain('pizza');
  });
});
```

---

## Day 7-8: Load Testing

### k6 Load Test Scripts

#### 1. Session Creation Load Test
```javascript
// tests/load/session-creation.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 500 },
    { duration: '5m', target: 500 },
    { duration: '2m', target: 1000 },
    { duration: '5m', target: 1000 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export default function () {
  const res = http.post(
    `${BASE_URL}/api/v1/sessions`,
    JSON.stringify({ userId: `user-${__VU}` }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(res, {
    'session created': (r) => r.status === 201,
  }) || errorRate.add(1);

  sleep(1);
}
```

#### 2. Run Load Tests
```bash
# Install k6
choco install k6  # Windows
brew install k6   # macOS

# Run load test
k6 run tests/load/session-creation.js

# Run with custom parameters
k6 run --vus 1000 --duration 10m tests/load/session-creation.js

# Export results
k6 run --out json=results.json tests/load/session-creation.js
```

---

## Day 9: E2E Testing

### Playwright E2E Tests

#### Setup
```bash
npm install --save-dev @playwright/test
npx playwright install
```

#### Example E2E Test
```typescript
// tests/e2e/voice-assistant.spec.ts
import { test, expect, _electron as electron } from '@playwright/test';

test.describe('Voice Assistant', () => {
  let app: any;
  let window: any;

  test.beforeAll(async () => {
    app = await electron.launch({ args: ['electron/main.js'] });
    window = await app.firstWindow();
  });

  test.afterAll(async () => {
    await app.close();
  });

  test('should complete voice interaction', async () => {
    await window.click('[data-testid="mic-button"]');
    await expect(window.locator('[data-testid="status"]'))
      .toHaveText('Listening...');
    
    // Verify response appears
    await expect(window.locator('[data-testid="response"]'))
      .not.toBeEmpty({ timeout: 10000 });
  });
});
```

---

## Day 10: Performance Benchmarking

### Benchmark Suite

```typescript
// tests/benchmarks/performance.bench.ts
import { performance } from 'perf_hooks';

async function benchmark(name: string, fn: () => Promise<void>, iterations = 100) {
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    times.push(end - start);
  }

  times.sort((a, b) => a - b);

  return {
    operation: name,
    iterations,
    avg: times.reduce((a, b) => a + b) / times.length,
    p50: times[Math.floor(times.length * 0.5)],
    p95: times[Math.floor(times.length * 0.95)],
    p99: times[Math.floor(times.length * 0.99)],
  };
}

describe('Performance Benchmarks', () => {
  it('should benchmark LLM response', async () => {
    const result = await benchmark(
      'LLM Response',
      async () => {
        await llmService.getLlmResponse({ /* ... */ });
      },
      50
    );

    console.table(result);
    expect(result.p95).toBeLessThan(3000);
  });
});
```

---

## Performance Targets

| Operation | p50 | p95 | p99 |
|-----------|-----|-----|-----|
| LLM Response (text) | 1s | 2s | 3s |
| LLM Streaming (TTFT) | 200ms | 400ms | 500ms |
| Session Creation | 50ms | 100ms | 150ms |
| Memory Retrieval | 100ms | 200ms | 300ms |
| Tool Execution | 500ms | 1s | 2s |

---

## Success Criteria

- [ ] 80%+ unit test coverage
- [ ] Integration tests for all critical paths
- [ ] Load test passing at 1000+ concurrent users
- [ ] E2E tests for 10+ critical flows
- [ ] Performance benchmarks documented
- [ ] All tests running in CI/CD

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    services:
      mongodb:
        image: mongo:latest
      redis:
        image: redis:latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:integration

  load-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: grafana/k6-action@v0.3.0
        with:
          filename: tests/load/session-creation.js
```

---

**Created:** December 9, 2025  
**Status:** Implementation Guide Complete  
**Ready for:** Full Stage 3 Implementation
