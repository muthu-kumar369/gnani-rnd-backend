// gnani-rnd-backend/tests/unit/llm/llm.manager.test.ts

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LLMManager } from '../../../src/core/llm/llm.manager.js';

describe('LLMManager', () => {
    let manager: LLMManager;

    beforeEach(() => {
        manager = new LLMManager();
    });

    it('should initialize with default Ollama provider', () => {
        const info = manager.getProviderInfo();
        expect(info.name).toBe('ollama');
        expect(info.supportsFunctionCalling).toBe(true);
    });

    it('should return provider info', () => {
        const info = manager.getProviderInfo();
        expect(info).toHaveProperty('name');
        expect(info).toHaveProperty('supportsFunctionCalling');
        expect(info).toHaveProperty('maxContextLength');
        expect(info).toHaveProperty('model');
    });

    it('should select provider based on task type', () => {
        manager.selectProvider('code');
        const info = manager.getProviderInfo();
        expect(info.name).toBe('ollama'); // For now, always Ollama
    });

    it('should check if provider exists', () => {
        expect(manager.hasProvider('ollama')).toBe(true);
        expect(manager.hasProvider('nonexistent')).toBe(false);
    });

    // Note: Actual generation tests require Ollama to be running
    // These are integration tests and should be run separately
});
