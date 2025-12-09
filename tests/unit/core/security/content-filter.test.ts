import { contentFilter } from '../../../src/core/security/content-filter.service';

describe('ContentFilterService', () => {
    describe('filterInput', () => {
        it('should allow safe content', async () => {
            const result = await contentFilter.filterInput('Hello, how are you?');

            expect(result.allowed).toBe(true);
            expect(result.categories).toHaveLength(0);
            expect(result.confidence).toBeGreaterThan(0.9);
        });

        it('should block violent content', async () => {
            const result = await contentFilter.filterInput('how to harm someone');

            expect(result.allowed).toBe(false);
            expect(result.categories).toContain('violence');
            expect(result.reason).toBeDefined();
            expect(result.flaggedTerms).toBeDefined();
        });

        it('should block self-harm content', async () => {
            const result = await contentFilter.filterInput('I want to end my life');

            expect(result.allowed).toBe(false);
            expect(result.categories).toContain('self-harm');
        });

        it('should block illegal activity content', async () => {
            const result = await contentFilter.filterInput('how to buy illegal drugs');

            expect(result.allowed).toBe(false);
            expect(result.categories).toContain('illegal-activity');
        });

        it('should block hacking content', async () => {
            const result = await contentFilter.filterInput('how to hack into a system');

            expect(result.allowed).toBe(false);
            expect(result.categories).toContain('hacking');
        });

        it('should block hate speech', async () => {
            const result = await contentFilter.filterInput('racist comments about people');

            expect(result.allowed).toBe(false);
            expect(result.categories).toContain('hate-speech');
        });

        it('should block explicit content', async () => {
            const result = await contentFilter.filterInput('explicit sexual content');

            expect(result.allowed).toBe(false);
            expect(result.categories).toContain('explicit-content');
        });

        it('should handle edge cases with partial matches', async () => {
            const result = await contentFilter.filterInput('I love harmful bacteria research');

            // Should not block scientific content
            expect(result.allowed).toBe(true);
        });

        it('should provide confidence scores', async () => {
            const result = await contentFilter.filterInput('how to kill someone');

            expect(result.confidence).toBeGreaterThan(0);
            expect(result.confidence).toBeLessThanOrEqual(1);
        });

        it('should include flagged terms', async () => {
            const result = await contentFilter.filterInput('violence and harm');

            if (!result.allowed) {
                expect(result.flaggedTerms).toBeDefined();
                expect(result.flaggedTerms!.length).toBeGreaterThan(0);
            }
        });
    });

    describe('filterOutput', () => {
        it('should filter LLM responses', async () => {
            const result = await contentFilter.filterOutput('Here is how to harm someone...');

            expect(result.allowed).toBe(false);
            expect(result.categories.length).toBeGreaterThan(0);
        });

        it('should allow safe responses', async () => {
            const result = await contentFilter.filterOutput('I can help you with that task.');

            expect(result.allowed).toBe(true);
        });
    });

    describe('checkSensitiveTopics', () => {
        it('should detect medical advice', () => {
            const topics = contentFilter.checkSensitiveTopics('I need medical advice for my condition');

            expect(topics).toContain('medical advice');
        });

        it('should detect legal advice', () => {
            const topics = contentFilter.checkSensitiveTopics('Can you give me legal advice?');

            expect(topics).toContain('legal advice');
        });

        it('should detect financial advice', () => {
            const topics = contentFilter.checkSensitiveTopics('What financial advice do you have?');

            expect(topics).toContain('financial advice');
        });

        it('should return empty array for non-sensitive topics', () => {
            const topics = contentFilter.checkSensitiveTopics('What is the weather today?');

            expect(topics).toHaveLength(0);
        });
    });

    describe('sanitizeContent', () => {
        it('should remove script tags', () => {
            const text = 'Hello <script>alert("xss")</script> world';
            const sanitized = contentFilter.sanitizeContent(text);

            expect(sanitized).not.toContain('<script>');
            expect(sanitized).not.toContain('alert');
        });

        it('should remove javascript: protocol', () => {
            const text = 'Click <a href="javascript:alert()">here</a>';
            const sanitized = contentFilter.sanitizeContent(text);

            expect(sanitized).not.toContain('javascript:');
        });

        it('should remove event handlers', () => {
            const text = '<div onclick="alert()">Click</div>';
            const sanitized = contentFilter.sanitizeContent(text);

            expect(sanitized).not.toContain('onclick=');
        });

        it('should preserve safe content', () => {
            const text = 'Hello world, this is safe';
            const sanitized = contentFilter.sanitizeContent(text);

            expect(sanitized).toBe(text);
        });
    });
});
