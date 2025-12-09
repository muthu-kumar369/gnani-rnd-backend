/**
 * Noise Suppression using RNNoise
 * RNNoise is a neural network-based noise suppressor
 */

// Note: RNNoise requires npm install rnnoise-wasm
// For now, we'll create a simplified version that can be replaced with RNNoise

class NoiseSuppressor {
    constructor() {
        this.initialized = false;
        this.noiseProfile = null;
        this.smoothingFactor = 0.98;
    }

    async initialize() {
        // In production, initialize RNNoise here:
        // this.denoiser = await RNNoise.create();

        this.initialized = true;
        console.log('Noise suppressor initialized');
    }

    /**
     * Process audio to remove noise
     * @param {Buffer} inputBuffer - Raw audio (16kHz, mono, 16-bit PCM)
     * @returns {Buffer} Denoised audio
     */
    process(inputBuffer) {
        if (!this.initialized) {
            throw new Error('Noise suppressor not initialized');
        }

        // Simplified spectral subtraction for noise reduction
        // In production, replace with: return this.processWithRNNoise(inputBuffer);

        const frameSize = 480; // 30ms at 16kHz
        const numFrames = Math.floor(inputBuffer.length / 2 / frameSize);
        const output = Buffer.alloc(numFrames * frameSize * 2);

        for (let i = 0; i < numFrames; i++) {
            const frameStart = i * frameSize * 2;
            const frameEnd = frameStart + frameSize * 2;
            const frame = inputBuffer.slice(frameStart, frameEnd);

            // Convert to Float32Array
            const floatFrame = new Float32Array(frameSize);
            for (let j = 0; j < frameSize; j++) {
                floatFrame[j] = frame.readInt16LE(j * 2) / 32768.0;
            }

            // Apply simple noise gate
            const denoisedFrame = this.applyNoiseGate(floatFrame);

            // Convert back to Int16
            for (let j = 0; j < frameSize; j++) {
                const sample = Math.max(-32768, Math.min(32767, Math.round(denoisedFrame[j] * 32768)));
                output.writeInt16LE(sample, frameStart + j * 2);
            }
        }

        return output;
    }

    /**
     * Simple noise gate implementation
     */
    applyNoiseGate(samples, threshold = 0.02) {
        const output = new Float32Array(samples.length);

        // Calculate RMS
        let sumSquares = 0;
        for (let i = 0; i < samples.length; i++) {
            sumSquares += samples[i] * samples[i];
        }
        const rms = Math.sqrt(sumSquares / samples.length);

        // Apply gate
        const gateOpen = rms > threshold;
        const attenuation = gateOpen ? 1.0 : 0.1;

        for (let i = 0; i < samples.length; i++) {
            output[i] = samples[i] * attenuation;
        }

        return output;
    }

    /**
     * Get voice activity probability
     * In production with RNNoise: return this.denoiser.getVoiceProbability();
     */
    getVoiceProbability() {
        return 0.5; // Placeholder
    }

    destroy() {
        // In production: this.denoiser?.destroy();
        this.initialized = false;
    }
}

module.exports = NoiseSuppressor;
