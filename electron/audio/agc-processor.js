/**
 * Automatic Gain Control (AGC) Processor
 * Maintains consistent audio levels using dynamic range compression
 */

class AGCProcessor {
    constructor(targetLevel = -20, maxGain = 30, minGain = -10) {
        this.targetLevel = targetLevel;     // Target dBFS
        this.maxGain = maxGain;             // Max gain in dB
        this.minGain = minGain;             // Min gain in dB
        this.currentGain = 0;               // Current gain in dB
        this.smoothingFactor = 0.1;         // Gain smoothing (0-1)
        this.attackTime = 0.001;            // Attack time in seconds
        this.releaseTime = 0.1;             // Release time in seconds
    }

    /**
     * Process audio with automatic gain control
     * @param {Buffer} inputBuffer - Raw audio data
     * @param {number} sampleRate - Sample rate in Hz
     * @returns {Buffer} Gain-adjusted audio
     */
    process(inputBuffer, sampleRate = 16000) {
        const samples = inputBuffer.length / 2;
        const output = Buffer.alloc(inputBuffer.length);

        // Calculate RMS level
        let sumSquares = 0;
        for (let i = 0; i < samples; i++) {
            const sample = inputBuffer.readInt16LE(i * 2) / 32768.0;
            sumSquares += sample * sample;
        }
        const rms = Math.sqrt(sumSquares / samples);
        const currentLevel = 20 * Math.log10(rms + 1e-10); // dBFS

        // Calculate required gain
        const requiredGain = this.targetLevel - currentLevel;
        const clampedGain = Math.max(this.minGain, Math.min(this.maxGain, requiredGain));

        // Smooth gain changes to avoid artifacts
        const alpha = this.smoothingFactor;
        this.currentGain = alpha * clampedGain + (1 - alpha) * this.currentGain;

        // Apply gain
        const linearGain = Math.pow(10, this.currentGain / 20);

        for (let i = 0; i < samples; i++) {
            const sample = inputBuffer.readInt16LE(i * 2) / 32768.0;
            const gained = sample * linearGain;

            // Soft clipping to prevent harsh distortion
            const clipped = this.softClip(gained);

            const int16 = Math.max(-32768, Math.min(32767, Math.round(clipped * 32768)));
            output.writeInt16LE(int16, i * 2);
        }

        return output;
    }

    /**
     * Soft clipping function to prevent harsh distortion
     * Uses tanh-based soft clipping for smooth saturation
     */
    softClip(x) {
        if (Math.abs(x) < 0.5) {
            return x;
        } else if (Math.abs(x) < 1.0) {
            // Smooth transition zone
            return Math.sign(x) * (0.5 + 0.5 * Math.tanh(2 * (Math.abs(x) - 0.5)));
        } else {
            // Hard limit at 0.9 to prevent clipping
            return Math.sign(x) * 0.9;
        }
    }

    /**
     * Get current gain in dB
     */
    getCurrentGain() {
        return this.currentGain;
    }

    /**
     * Set target level
     */
    setTargetLevel(level) {
        this.targetLevel = level;
    }

    /**
     * Set gain limits
     */
    setGainLimits(minGain, maxGain) {
        this.minGain = minGain;
        this.maxGain = maxGain;
    }

    /**
     * Reset AGC state
     */
    reset() {
        this.currentGain = 0;
    }
}

module.exports = AGCProcessor;
