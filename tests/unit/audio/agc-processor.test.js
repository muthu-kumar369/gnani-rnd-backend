const AGCProcessor = require('../../electron/audio/agc-processor');

describe('AGCProcessor', () => {
    let agc;

    beforeEach(() => {
        agc = new AGCProcessor(-20, 30, -10);
    });

    describe('initialization', () => {
        it('should initialize with default parameters', () => {
            const processor = new AGCProcessor();
            expect(processor.targetLevel).toBe(-20);
            expect(processor.maxGain).toBe(30);
            expect(processor.minGain).toBe(-10);
        });

        it('should initialize with custom parameters', () => {
            const processor = new AGCProcessor(-15, 25, -5);
            expect(processor.targetLevel).toBe(-15);
            expect(processor.maxGain).toBe(25);
            expect(processor.minGain).toBe(-5);
        });
    });

    describe('process', () => {
        it('should process audio without crashing', () => {
            const buffer = generateAudio(480, 0.1);
            const output = agc.process(buffer, 16000);

            expect(output).toBeInstanceOf(Buffer);
            expect(output.length).toBe(buffer.length);
        });

        it('should amplify quiet audio', () => {
            const quietBuffer = generateAudio(480, 0.01); // Very quiet

            const output = agc.process(quietBuffer, 16000);
            const inputRMS = calculateRMS(quietBuffer);
            const outputRMS = calculateRMS(output);

            // Output should be louder
            expect(outputRMS).toBeGreaterThan(inputRMS);
            expect(agc.getCurrentGain()).toBeGreaterThan(0);
        });

        it('should attenuate loud audio', () => {
            const loudBuffer = generateAudio(480, 0.9); // Very loud

            const output = agc.process(loudBuffer, 16000);
            const inputRMS = calculateRMS(loudBuffer);
            const outputRMS = calculateRMS(output);

            // Output should be quieter
            expect(outputRMS).toBeLessThan(inputRMS);
            expect(agc.getCurrentGain()).toBeLessThan(0);
        });

        it('should maintain consistent output level', () => {
            const levels = [0.01, 0.1, 0.5, 0.9];
            const outputs = [];

            // Process multiple frames with different levels
            levels.forEach(level => {
                for (let i = 0; i < 10; i++) {
                    const buffer = generateAudio(480, level);
                    const output = agc.process(buffer, 16000);
                    outputs.push(calculateRMS(output));
                }
            });

            // Calculate variance of output levels
            const mean = outputs.reduce((a, b) => a + b) / outputs.length;
            const variance = outputs.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / outputs.length;
            const stdDev = Math.sqrt(variance);

            // Standard deviation should be small (consistent levels)
            expect(stdDev).toBeLessThan(0.1);
        });

        it('should prevent clipping', () => {
            const loudBuffer = generateAudio(480, 1.0); // Maximum level

            const output = agc.process(loudBuffer, 16000);
            const peak = calculatePeak(output);

            // Peak should be below 1.0 (no clipping)
            expect(peak).toBeLessThan(1.0);
        });

        it('should smooth gain changes', () => {
            const gains = [];

            // Sudden level change
            for (let i = 0; i < 5; i++) {
                agc.process(generateAudio(480, 0.01), 16000);
                gains.push(agc.getCurrentGain());
            }

            for (let i = 0; i < 5; i++) {
                agc.process(generateAudio(480, 0.9), 16000);
                gains.push(agc.getCurrentGain());
            }

            // Gain should change gradually, not instantly
            for (let i = 1; i < gains.length; i++) {
                const change = Math.abs(gains[i] - gains[i - 1]);
                expect(change).toBeLessThan(10); // Max 10dB change per frame
            }
        });
    });

    describe('softClip', () => {
        it('should pass through small values unchanged', () => {
            expect(agc.softClip(0.3)).toBeCloseTo(0.3, 5);
            expect(agc.softClip(-0.3)).toBeCloseTo(-0.3, 5);
        });

        it('should apply soft clipping to large values', () => {
            const clipped = agc.softClip(1.5);
            expect(clipped).toBeLessThan(1.0);
            expect(clipped).toBeGreaterThan(0.8);
        });

        it('should be symmetric', () => {
            const positive = agc.softClip(1.2);
            const negative = agc.softClip(-1.2);
            expect(positive).toBeCloseTo(-negative, 5);
        });
    });

    describe('gain control', () => {
        it('should respect max gain limit', () => {
            const veryQuiet = generateAudio(480, 0.0001);

            for (let i = 0; i < 20; i++) {
                agc.process(veryQuiet, 16000);
            }

            expect(agc.getCurrentGain()).toBeLessThanOrEqual(agc.maxGain);
        });

        it('should respect min gain limit', () => {
            const veryLoud = generateAudio(480, 0.99);

            for (let i = 0; i < 20; i++) {
                agc.process(veryLoud, 16000);
            }

            expect(agc.getCurrentGain()).toBeGreaterThanOrEqual(agc.minGain);
        });

        it('should allow setting target level', () => {
            agc.setTargetLevel(-15);
            expect(agc.targetLevel).toBe(-15);
        });

        it('should allow setting gain limits', () => {
            agc.setGainLimits(-5, 25);
            expect(agc.minGain).toBe(-5);
            expect(agc.maxGain).toBe(25);
        });
    });

    describe('reset', () => {
        it('should reset current gain', () => {
            // Build up gain
            for (let i = 0; i < 10; i++) {
                agc.process(generateAudio(480, 0.01), 16000);
            }

            expect(agc.getCurrentGain()).not.toBe(0);

            agc.reset();
            expect(agc.getCurrentGain()).toBe(0);
        });
    });
});

// Helper functions
function generateAudio(samples, amplitude) {
    const buffer = Buffer.alloc(samples * 2);

    for (let i = 0; i < samples; i++) {
        const value = (Math.random() - 0.5) * 2 * amplitude;
        const int16 = Math.max(-32768, Math.min(32767, Math.round(value * 32768)));
        buffer.writeInt16LE(int16, i * 2);
    }

    return buffer;
}

function calculateRMS(buffer) {
    let sumSquares = 0;
    const samples = buffer.length / 2;

    for (let i = 0; i < samples; i++) {
        const sample = buffer.readInt16LE(i * 2) / 32768.0;
        sumSquares += sample * sample;
    }

    return Math.sqrt(sumSquares / samples);
}

function calculatePeak(buffer) {
    let peak = 0;
    const samples = buffer.length / 2;

    for (let i = 0; i < samples; i++) {
        const sample = Math.abs(buffer.readInt16LE(i * 2) / 32768.0);
        peak = Math.max(peak, sample);
    }

    return peak;
}
