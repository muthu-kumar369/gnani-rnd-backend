/**
 * Audio Quality Monitor
 * Analyzes audio quality metrics: SNR, RMS, peak, clipping, etc.
 */

class QualityMonitor {
    constructor() {
        this.history = [];
        this.maxHistory = 100;
    }

    /**
     * Analyze audio quality
     * @param {Buffer} audioBuffer - Audio data to analyze
     * @returns {Object} Quality metrics
     */
    analyze(audioBuffer) {
        const samples = this.bufferToFloat32(audioBuffer);

        const metrics = {
            snr: this.calculateSNR(samples),
            rms: this.calculateRMS(samples),
            peak: this.calculatePeak(samples),
            crestFactor: this.calculateCrestFactor(samples),
            clipping: this.detectClipping(samples),
            silence: this.detectSilence(samples),
            timestamp: Date.now(),
        };

        // Store in history
        this.history.push(metrics);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }

        return metrics;
    }

    /**
     * Calculate Signal-to-Noise Ratio (SNR)
     * Estimates signal and noise power from amplitude distribution
     */
    calculateSNR(samples) {
        // Sort samples by absolute value
        const sorted = [...samples].map(Math.abs).sort((a, b) => b - a);

        // Estimate signal power (top 50% of samples)
        const signalSamples = sorted.slice(0, Math.floor(sorted.length * 0.5));
        const signalPower = signalSamples.reduce((sum, s) => sum + s * s, 0) / signalSamples.length;

        // Estimate noise power (bottom 50% of samples)
        const noiseSamples = sorted.slice(Math.floor(sorted.length * 0.5));
        const noisePower = noiseSamples.reduce((sum, s) => sum + s * s, 0) / noiseSamples.length;

        // SNR in dB
        return 10 * Math.log10(signalPower / (noisePower + 1e-10));
    }

    /**
     * Calculate RMS (Root Mean Square) level
     */
    calculateRMS(samples) {
        const sumSquares = samples.reduce((sum, s) => sum + s * s, 0);
        return Math.sqrt(sumSquares / samples.length);
    }

    /**
     * Calculate peak amplitude
     */
    calculatePeak(samples) {
        return Math.max(...samples.map(Math.abs));
    }

    /**
     * Calculate crest factor (peak/RMS ratio)
     * High crest factor indicates dynamic content
     */
    calculateCrestFactor(samples) {
        const peak = this.calculatePeak(samples);
        const rms = this.calculateRMS(samples);
        return peak / (rms + 1e-10);
    }

    /**
     * Detect clipping
     * Returns percentage of samples near maximum amplitude
     */
    detectClipping(samples, threshold = 0.95) {
        const clipped = samples.filter(s => Math.abs(s) > threshold).length;
        return clipped / samples.length;
    }

    /**
     * Detect silence
     * Returns true if RMS is below threshold
     */
    detectSilence(samples, threshold = 0.01) {
        const rms = this.calculateRMS(samples);
        return rms < threshold;
    }

    /**
     * Get average metrics over recent history
     */
    getAverageMetrics() {
        if (this.history.length === 0) {
            return null;
        }

        const avg = {
            snr: 0,
            rms: 0,
            peak: 0,
            crestFactor: 0,
            clipping: 0,
        };

        for (const metrics of this.history) {
            avg.snr += metrics.snr;
            avg.rms += metrics.rms;
            avg.peak += metrics.peak;
            avg.crestFactor += metrics.crestFactor;
            avg.clipping += metrics.clipping;
        }

        const count = this.history.length;
        return {
            snr: avg.snr / count,
            rms: avg.rms / count,
            peak: avg.peak / count,
            crestFactor: avg.crestFactor / count,
            clipping: avg.clipping / count,
        };
    }

    /**
     * Convert Buffer to Float32Array
     */
    bufferToFloat32(buffer) {
        const float32 = new Float32Array(buffer.length / 2);
        for (let i = 0; i < float32.length; i++) {
            const int16 = buffer.readInt16LE(i * 2);
            float32[i] = int16 / 32768.0;
        }
        return float32;
    }

    /**
     * Reset history
     */
    reset() {
        this.history = [];
    }
}

module.exports = QualityMonitor;
