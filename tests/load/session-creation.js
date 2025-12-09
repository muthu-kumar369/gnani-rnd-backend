// k6 Load Test - Session Creation
// Run with: k6 run tests/load/session-creation.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
    stages: [
        { duration: '2m', target: 100 },   // Ramp up to 100 users
        { duration: '5m', target: 100 },   // Stay at 100 users
        { duration: '2m', target: 500 },   // Ramp up to 500 users
        { duration: '5m', target: 500 },   // Stay at 500 users
        { duration: '2m', target: 1000 },  // Ramp up to 1000 users
        { duration: '5m', target: 1000 },  // Stay at 1000 users
        { duration: '2m', target: 0 },     // Ramp down to 0 users
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
        errors: ['rate<0.01'],             // Error rate must be below 1%
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token';

export default function () {
    // 1. Create session
    const createRes = http.post(
        `${BASE_URL}/api/v1/sessions`,
        JSON.stringify({
            userId: `user-${__VU}-${__ITER}`,
        }),
        {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AUTH_TOKEN}`,
            },
        }
    );

    check(createRes, {
        'session created': (r) => r.status === 201,
        'has session ID': (r) => r.json('sessionId') !== undefined,
    }) || errorRate.add(1);

    const sessionId = createRes.json('sessionId');

    sleep(1);

    // 2. Send message
    const messageRes = http.post(
        `${BASE_URL}/api/v1/sessions/${sessionId}/messages`,
        JSON.stringify({
            content: 'Hello, how are you?',
            role: 'user',
        }),
        {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AUTH_TOKEN}`,
            },
        }
    );

    check(messageRes, {
        'message sent': (r) => r.status === 200,
        'has response': (r) => r.json('response') !== undefined,
    }) || errorRate.add(1);

    sleep(2);

    // 3. End session
    const endRes = http.del(
        `${BASE_URL}/api/v1/sessions/${sessionId}`,
        null,
        {
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
            },
        }
    );

    check(endRes, {
        'session ended': (r) => r.status === 200,
    }) || errorRate.add(1);

    sleep(1);
}

export function handleSummary(data) {
    return {
        'summary.json': JSON.stringify(data),
        stdout: textSummary(data, { indent: ' ', enableColors: true }),
    };
}

function textSummary(data, options) {
    const indent = options.indent || '';
    const colors = options.enableColors;

    let summary = '\n';
    summary += `${indent}✓ checks.........................: ${data.metrics.checks.values.passes}/${data.metrics.checks.values.fails + data.metrics.checks.values.passes}\n`;
    summary += `${indent}✓ http_req_duration..............: avg=${data.metrics.http_req_duration.values.avg.toFixed(2)}ms p95=${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
    summary += `${indent}✓ http_reqs......................: ${data.metrics.http_reqs.values.count}\n`;
    summary += `${indent}✓ errors.........................: ${(data.metrics.errors.values.rate * 100).toFixed(2)}%\n`;

    return summary;
}
