// gnani-rnd-backend/tests/unit/llm/ollama.provider.test.ts

import { describe, it, expect } from '@jest/globals';
import { OllamaProvider } from '../../../src/core/llm/ollama.provider.js';

describe('OllamaProvider', () => {
    it('should initialize with default config', () => {
        const provider = new OllamaProvider();
        expect(provider.name).toBe('ollama');
        expect(provider.supportsFunctionCalling).toBe(true);
        expect(provider.maxContextLength).toBe(8192);
    });

    it('should initialize with custom config', () => {
        const provider = new OllamaProvider({
            baseUrl: 'http://custom:11434',
            model: 'llama3.1:70b'
        });
        expect(provider.getModel()).toBe('llama3.1:70b');
    });

    it('should return model name', () => {
        const provider = new OllamaProvider({ model: 'test-model' });
        expect(provider.getModel()).toBe('test-model');
    });

    // Note: Actual generation and availability tests require Ollama to be running
    // These are integration tests and should be run separately
});
