/**
 * Acoustic Echo Cancellation (AEC) Processor
 * Uses LMS (Least Mean Squares) adaptive filter algorithm
 */

class AECProcessor {
    constructor() {
        this.filterLength = 512;
        this.filter = new Float32Array(this.filterLength);
        this.stepSize = 0.01; // LMS algorithm step size
        this.initialized = false;
        this.sampleRate = 16000;
    }

    async initialize(sampleRate = 16000) {
        this.sampleRate = sampleRate;
        this.initialized = true;
        console.log('AEC initialized at', sampleRate, 'Hz');
    }

    /**
     * Process audio with echo cancellation
     * @param {Buffer} inputBuffer - Microphone input
     * @param {Buffer} referenceBuffer - Speaker output (for echo estimation)
     * @returns {Buffer} Echo-cancelled audio
     */
    process(inputBuffer, referenceBuffer) {
        if (!this.initialized) {
            throw new Error('AEC not initialized');
        }

        const input = this.bufferToFloat32(inputBuffer);
        const reference = this.bufferToFloat32(referenceBuffer);
        const output = new Float32Array(input.length);

        // Adaptive filter (LMS algorithm)
        for (let i = 0; i < input.length; i++) {
            // Estimate echo from reference signal
            let echo = 0;
            for (let j = 0; j < this.filterLength && i - j >= 0; j++) {
                echo += this.filter[j] * (reference[i - j] || 0);
            }

            // Subtract estimated echo from input
            const error = input[i] - echo;
            output[i] = error;

            // Update filter coefficients using LMS algorithm
            for (let j = 0; j < this.filterLength && i - j >= 0; j++) {
                this.filter[j] += this.stepSize * error * (reference[i - j] || 0);
            }
        }

        return this.float32ToBuffer(output);
    }

    /**
     * Convert Buffer to Float32Array
     */
    bufferToFloat32(buffer) {
        const float32 = new Float32Array(buffer.length / 2);
        for (let i = 0; i < float32.length; i++) {
            const int16 = buffer.readInt16LE(i * 2);
            float32[i] = int16 / 32768.0; // Normalize to [-1, 1]
        }
        return float32;
    }

    /**
     * Convert Float32Array to Buffer
     */
    float32ToBuffer(float32) {
        const buffer = Buffer.alloc(float32.length * 2);
        for (let i = 0; i < float32.length; i++) {
            const int16 = Math.max(-32768, Math.min(32767, Math.round(float32[i] * 32768)));
            buffer.writeInt16LE(int16, i * 2);
        }
        return buffer;
    }

    /**
     * Reset filter coefficients
     */
    reset() {
        this.filter = new Float32Array(this.filterLength);
    }

    destroy() {
        this.initialized = false;
        this.filter = null;
    }
}

module.exports = AECProcessor;
