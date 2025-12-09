import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 60000,
    retries: 2,
    workers: 1,
    reporter: [
        ['list'],
        ['html', { outputFolder: 'playwright-report' }],
        ['json', { outputFile: 'test-results.json' }]
    ],
    use: {
        baseURL: process.env.BASE_URL || 'http://localhost:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'api-tests',
            testMatch: /.*\.e2e\.ts/,
        },
    ],
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000/api/status/health',
        timeout: 120000,
        reuseExistingServer: !process.env.CI,
    },
});
