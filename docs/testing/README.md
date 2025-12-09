# Testing Guide

## Overview

This project uses **Vitest** for unit and integration testing, **Playwright** for E2E testing, and includes performance benchmarks.

---

## Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e          # E2E tests only
npm run test:benchmark    # Performance benchmarks

# Watch mode (auto-rerun on changes)
npm run test:watch

# Test UI (visual test runner)
npm run test:ui
```

---

## Test Structure

```
tests/
├── unit/              # Unit tests (15 tests)
│   ├── audio/
│   ├── core/
│   ├── llm/
│   ├── memory/
│   └── session/
├── integration/       # Integration tests (10 tests)
│   ├── grpc.test.ts
│   ├── rest_api.test.ts
│   └── ...
├── e2e/              # End-to-end tests (20 tests)
│   ├── auth-flow.e2e.ts
│   ├── conversation-flow.e2e.ts
│   └── tool-execution.e2e.ts
└── benchmarks/       # Performance benchmarks
    ├── llm-response.bench.ts
    ├── database-queries.bench.ts
    └── tool-execution.bench.ts
```

---

## Coverage

### Thresholds

- **Lines:** 80%
- **Functions:** 80%
- **Branches:** 75%
- **Statements:** 80%

### Generate Coverage Report

```bash
npm run test:coverage

# Open HTML report
open coverage/index.html  # macOS
start coverage/index.html # Windows
```

### CI/CD Coverage

Coverage is automatically:
- Collected on every PR
- Uploaded to Codecov
- Checked against thresholds
- Fails CI if below thresholds

---

## E2E Tests

### Running E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test tests/e2e/auth-flow.e2e.ts

# Run in headed mode (see browser)
npx playwright test --headed

# Debug mode
npx playwright test --debug
```

### E2E Test Suites

1. **Auth Flow** (7 tests)
   - User registration
   - Login/logout
   - Token refresh
   - Protected routes

2. **Conversation Flow** (8 tests)
   - Create conversation
   - Send messages
   - Edit messages
   - Regenerate responses
   - Delete conversation

3. **Tool Execution** (5 tests)
   - List tools
   - Execute tools
   - Toggle tool status
   - Error handling
   - Caching

---

## Benchmarks

### Running Benchmarks

```bash
npm run test:benchmark
```

### Benchmark Suites

1. **LLM Response Time**
   - Simple queries: < 500ms
   - Complex queries: < 1000ms
   - Tool execution: < 1500ms

2. **Database Queries**
   - Conversation retrieval: < 100ms
   - Message insertion: < 50ms
   - Memory search: < 200ms
   - Session lookup: < 20ms

3. **Tool Execution**
   - Sequential (3 tools): < 1200ms
   - Parallel (3 tools): < 500ms
   - Cached: < 50ms
   - Circuit breaker: < 500ms

---

## CI/CD Integration

### GitHub Actions

Tests run automatically on:
- Every push to `main`
- Every pull request
- Manual workflow dispatch

### Pipeline Steps

1. **Lint** - TypeScript type checking
2. **Unit Tests** - Fast, isolated tests
3. **Integration Tests** - With MongoDB & Redis
4. **Coverage** - Collect and verify thresholds
5. **Upload** - Send coverage to Codecov

### Services

- **MongoDB 7** - For integration tests
- **Redis 7** - For caching tests

---

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { MyService } from './my-service';

describe('MyService', () => {
  it('should do something', () => {
    const service = new MyService();
    const result = service.doSomething();
    expect(result).toBe('expected');
  });
});
```

### Integration Test Example

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';

describe('API Integration', () => {
  it('should return 200', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
  });
});
```

### E2E Test Example

```typescript
import { test, expect } from '@playwright/test';

test('should login successfully', async ({ request }) => {
  const response = await request.post('/api/auth/login', {
    data: { email: 'test@example.com', password: 'password' }
  });
  expect(response.status()).toBe(200);
});
```

---

## Troubleshooting

### Tests Failing Locally

```bash
# Make sure services are running
docker-compose up -d mongodb redis

# Check environment variables
cp .env.example .env

# Clear cache
rm -rf node_modules coverage
npm install
```

### Coverage Not Generated

```bash
# Make sure coverage package is installed
npm install --save-dev @vitest/coverage-v8

# Run with coverage explicitly
npx vitest run --coverage
```

### E2E Tests Timing Out

```bash
# Increase timeout in playwright.config.ts
timeout: 120000  # 2 minutes

# Or per-test
test.setTimeout(120000);
```

---

## Best Practices

1. **Keep tests fast** - Unit tests < 100ms, integration < 1s
2. **Use descriptive names** - `should return user when authenticated`
3. **Test one thing** - Each test should verify one behavior
4. **Clean up** - Use `afterEach` to reset state
5. **Mock external services** - Don't call real APIs in tests
6. **Use fixtures** - Share test data across tests
7. **Avoid test interdependence** - Tests should run in any order

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Coverage Thresholds](https://vitest.dev/config/#coverage-thresholds)
- [GitHub Actions](https://docs.github.com/en/actions)
