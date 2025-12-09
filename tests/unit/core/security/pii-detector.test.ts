import { piiDetector } from '../../../src/core/security/pii-detector.service';

describe('PIIDetectorService', () => {
    describe('detectPII', () => {
        it('should detect email addresses', () => {
            const text = 'Contact me at john.doe@example.com';
            const matches = piiDetector.detectPII(text);

            expect(matches).toHaveLength(1);
            expect(matches[0].type).toBe('email');
            expect(matches[0].value).toBe('john.doe@example.com');
            expect(matches[0].confidence).toBeGreaterThan(0.8);
        });

        it('should detect phone numbers', () => {
            const text = 'Call me at +1-555-123-4567';
            const matches = piiDetector.detectPII(text);

            expect(matches).toHaveLength(1);
            expect(matches[0].type).toBe('phone');
            expect(matches[0].confidence).toBeGreaterThan(0.7);
        });

        it('should detect SSN', () => {
            const text = 'SSN: 123-45-6789';
            const matches = piiDetector.detectPII(text);

            expect(matches).toHaveLength(1);
            expect(matches[0].type).toBe('ssn');
            expect(matches[0].value).toBe('123-45-6789');
        });

        it('should detect credit card numbers', () => {
            const text = 'Card: 4532-1234-5678-9010';
            const matches = piiDetector.detectPII(text);

            expect(matches).toHaveLength(1);
            expect(matches[0].type).toBe('creditCard');
        });

        it('should detect IP addresses', () => {
            const text = 'Server IP: 192.168.1.1';
            const matches = piiDetector.detectPII(text);

            expect(matches).toHaveLength(1);
            expect(matches[0].type).toBe('ipAddress');
            expect(matches[0].value).toBe('192.168.1.1');
        });

        it('should detect multiple PII types', () => {
            const text = 'Email: test@email.com, Phone: 555-1234, IP: 10.0.0.1';
            const matches = piiDetector.detectPII(text);

            expect(matches.length).toBeGreaterThanOrEqual(3);
        });

        it('should return empty array for text without PII', () => {
            const text = 'Hello world, no PII here';
            const matches = piiDetector.detectPII(text);

            expect(matches).toHaveLength(0);
        });
    });

    describe('maskPII', () => {
        it('should mask email addresses', () => {
            const text = 'Email: john.doe@example.com';
            const masked = piiDetector.maskPII(text);

            expect(masked).not.toContain('john.doe@example.com');
            expect(masked).toContain('@example.com');
            expect(masked).toMatch(/j\*+@example\.com/);
        });

        it('should mask phone numbers', () => {
            const text = 'Phone: +1-555-123-4567';
            const masked = piiDetector.maskPII(text);

            expect(masked).toContain('***-***-4567');
            expect(masked).not.toContain('555-123');
        });

        it('should mask SSN', () => {
            const text = 'SSN: 123-45-6789';
            const masked = piiDetector.maskPII(text);

            expect(masked).toContain('***-**-6789');
            expect(masked).not.toContain('123-45');
        });

        it('should mask credit card numbers', () => {
            const text = 'Card: 4532-1234-5678-9010';
            const masked = piiDetector.maskPII(text);

            expect(masked).toContain('****-****-****-9010');
            expect(masked).not.toContain('4532');
        });

        it('should preserve non-PII text', () => {
            const text = 'Hello world, no PII here';
            const masked = piiDetector.maskPII(text);

            expect(masked).toBe(text);
        });

        it('should mask multiple PII instances', () => {
            const text = 'Email: test@test.com, Phone: 555-1234';
            const masked = piiDetector.maskPII(text);

            expect(masked).not.toContain('test@test.com');
            expect(masked).not.toContain('555-1234');
        });
    });

    describe('maskPIIInObject', () => {
        it('should mask PII in string properties', () => {
            const obj = {
                email: 'test@example.com',
                message: 'Call me at 555-1234',
            };

            const masked = piiDetector.maskPIIInObject(obj);

            expect(masked.email).not.toContain('test@example.com');
            expect(masked.message).toContain('***-***-1234');
        });

        it('should handle nested objects', () => {
            const obj = {
                user: {
                    email: 'user@test.com',
                    phone: '555-9876',
                },
            };

            const masked = piiDetector.maskPIIInObject(obj);

            expect(masked.user.email).not.toContain('user@test.com');
            expect(masked.user.phone).toContain('***-***-9876');
        });

        it('should handle arrays', () => {
            const obj = {
                emails: ['test1@test.com', 'test2@test.com'],
            };

            const masked = piiDetector.maskPIIInObject(obj);

            expect(masked.emails[0]).not.toContain('test1@test.com');
            expect(masked.emails[1]).not.toContain('test2@test.com');
        });

        it('should preserve non-PII data', () => {
            const obj = {
                name: 'John',
                age: 30,
                active: true,
            };

            const masked = piiDetector.maskPIIInObject(obj);

            expect(masked).toEqual(obj);
        });
    });

    describe('containsPII', () => {
        it('should return true if text contains PII', () => {
            const text = 'Email: test@example.com';
            expect(piiDetector.containsPII(text)).toBe(true);
        });

        it('should return false if text does not contain PII', () => {
            const text = 'Hello world';
            expect(piiDetector.containsPII(text)).toBe(false);
        });
    });
});
