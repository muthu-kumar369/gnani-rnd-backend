import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            exclude: [
                'node_modules/',
                'dist/',
                'tests/',
                '**/*.test.ts',
                '**/*.test.js',
                '**/*.spec.ts',
                '**/*.bench.ts',
                'src/proto/',
                'scripts/',
                'coverage/'
            ],
            lines: 80,
            functions: 80,
            branches: 75,
            statements: 80,
            all: true
        },
        testTimeout: 30000,
        hookTimeout: 30000,
        include: ['tests/**/*.test.{ts,js}'],
        exclude: ['tests/e2e/**', 'tests/benchmarks/**', 'node_modules/**']
    }
});
