import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '1m', target: 100 },  // Ramp up to 100 users
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.1'],    // Error rate must be less than 10%
  },
};

const BASE_URL = 'http://localhost:3000/api';

export default function () {
  // 1. Health Check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
  });

  // 2. Create Session
  const sessionPayload = JSON.stringify({ userId: 'load-test-user' });
  const sessionHeaders = { 'Content-Type': 'application/json' };
  const sessionRes = http.post(`${BASE_URL}/session`, sessionPayload, { headers: sessionHeaders });
  
  check(sessionRes, {
    'session created': (r) => r.status === 201 || r.status === 200,
  });

  let sessionId;
  try {
      sessionId = sessionRes.json('sessionId');
  } catch (e) {
      // Handle potential JSON parse error if request failed
  }

  if (sessionId) {
      // 3. Simulate Chat Interaction (if session created)
      const chatPayload = JSON.stringify({ 
          sessionId: sessionId,
          text: 'Hello, this is a load test message.' 
      });
      
      // Note: This assumes a synchronous chat endpoint for simplicity in load testing
      // For streaming, k6 has limited support, so we test the initial request latency
      const chatRes = http.post(`${BASE_URL}/chat`, chatPayload, { headers: sessionHeaders });
      
      check(chatRes, {
          'chat response success': (r) => r.status === 200 || r.status === 201,
      });
  }

  sleep(1);
}
