// gnani-rnd-backend/jest.config.js

export default {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1'
    },
    transform: {
        '^.+\\.ts$': ['ts-jest', {
            useESM: true
        }]
    },
    testMatch: ['**/tests/**/*.test.ts'],
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/index.ts',
        '!src/server.ts'
    ],
    coverageThreshold: {
        global: {
            lines: 70,
            functions: 70,
            branches: 70,
            statements: 70
        }
    },
    coverageReporters: ['text', 'lcov', 'html'],
    testTimeout: 10000
};
