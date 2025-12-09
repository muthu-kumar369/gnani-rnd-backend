const AECProcessor = require('../../electron/audio/aec-processor');

describe('AECProcessor', () => {
    let aec;

    beforeEach(async () => {
        aec = new AECProcessor();
        await aec.initialize(16000);
    });

    afterEach(() => {
        aec.destroy();
    });

    describe('initialization', () => {
        it('should initialize successfully', async () => {
            const processor = new AECProcessor();
            await processor.initialize(16000);

            expect(processor.initialized).toBe(true);
            expect(processor.sampleRate).toBe(16000);

            processor.destroy();
        });

        it('should throw error if processing before initialization', () => {
            const processor = new AECProcessor();
            const buffer = Buffer.alloc(1024);

            expect(() => processor.process(buffer, buffer)).toThrow('AEC not initialized');
        });
    });

    describe('process', () => {
        it('should process audio without crashing', () => {
            const inputBuffer = generateSineWave(480, 16000, 440);
            const referenceBuffer = generateSineWave(480, 16000, 440);

            const output = aec.process(inputBuffer, referenceBuffer);

            expect(output).toBeInstanceOf(Buffer);
            expect(output.length).toBe(inputBuffer.length);
        });

        it('should reduce echo when reference matches input', () => {
            // Generate identical input and reference (pure echo)
            const signal = generateSineWave(480, 16000, 440);

            // Process multiple frames to allow filter to adapt
            for (let i = 0; i < 50; i++) {
                aec.process(signal, signal);
            }

            // After adaptation, output should be reduced
            const output = aec.process(signal, signal);
            const inputRMS = calculateRMS(signal);
            const outputRMS = calculateRMS(output);

            // Echo should be reduced
            expect(outputRMS).toBeLessThan(inputRMS);
        });

        it('should preserve signal when no echo present', () => {
            const inputBuffer = generateSineWave(480, 16000, 440);
            const referenceBuffer = Buffer.alloc(inputBuffer.length); // Silence

            const output = aec.process(inputBuffer, referenceBuffer);
            const inputRMS = calculateRMS(inputBuffer);
            const outputRMS = calculateRMS(output);

            // Signal should be mostly preserved
            expect(outputRMS).toBeGreaterThan(inputRMS * 0.8);
        });

        it('should handle different buffer sizes', () => {
            const sizes = [240, 480, 960, 1920]; // 15ms, 30ms, 60ms, 120ms at 16kHz

            sizes.forEach(size => {
                const input = generateSineWave(size, 16000, 440);
                const reference = Buffer.alloc(input.length);

                const output = aec.process(input, reference);
                expect(output.length).toBe(input.length);
            });
        });
    });

    describe('reset', () => {
        it('should reset filter coefficients', () => {
            const signal = generateSineWave(480, 16000, 440);

            // Adapt filter
            for (let i = 0; i < 50; i++) {
                aec.process(signal, signal);
            }

            // Reset
            aec.reset();

            // Filter should be back to initial state
            expect(aec.filter.every(v => v === 0)).toBe(true);
        });
    });

    describe('buffer conversion', () => {
        it('should convert Buffer to Float32Array correctly', () => {
            const buffer = Buffer.alloc(4);
            buffer.writeInt16LE(16384, 0);  // 0.5 in normalized form
            buffer.writeInt16LE(-16384, 2); // -0.5 in normalized form

            const float32 = aec.bufferToFloat32(buffer);

            expect(float32[0]).toBeCloseTo(0.5, 2);
            expect(float32[1]).toBeCloseTo(-0.5, 2);
        });

        it('should convert Float32Array to Buffer correctly', () => {
            const float32 = new Float32Array([0.5, -0.5]);
            const buffer = aec.float32ToBuffer(float32);

            expect(buffer.readInt16LE(0)).toBeCloseTo(16384, -2);
            expect(buffer.readInt16LE(2)).toBeCloseTo(-16384, -2);
        });
    });
});

// Helper functions
function generateSineWave(samples, sampleRate, frequency) {
    const buffer = Buffer.alloc(samples * 2);

    for (let i = 0; i < samples; i++) {
        const t = i / sampleRate;
        const value = Math.sin(2 * Math.PI * frequency * t);
        const int16 = Math.round(value * 32767);
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
