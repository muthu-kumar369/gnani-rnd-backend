/**
 * Adaptive VAD (Voice Activity Detection) Manager
 * Adjusts sensitivity based on environment and false positive rate
 */

class AdaptiveVADManager {
    constructor() {
        this.baseSensitivity = 0.5;
        this.currentSensitivity = 0.5;
        this.adaptationRate = 0.1;
        this.recentTriggers = [];
        this.maxHistoryLength = 100;
        this.noiseLevel = 0;
    }

    /**
     * Adapt sensitivity based on audio quality metrics
     * @param {Object} audioQuality - Quality metrics from quality monitor
     * @returns {number} Adjusted sensitivity (0-1)
     */
    adaptSensitivity(audioQuality) {
        const { snr, rms } = audioQuality;

        // Adjust based on Signal-to-Noise Ratio
        if (snr < 10) {
            // Noisy environment - increase threshold to reduce false positives
            this.currentSensitivity = Math.min(0.8, this.baseSensitivity + 0.2);
        } else if (snr > 20) {
            // Quiet environment - decrease threshold for better detection
            this.currentSensitivity = Math.max(0.3, this.baseSensitivity - 0.1);
        } else {
            // Normal SNR - use base sensitivity
            this.currentSensitivity = this.baseSensitivity;
        }

        // Smooth the adaptation
        const alpha = this.adaptationRate;
        this.currentSensitivity =
            alpha * this.currentSensitivity +
            (1 - alpha) * this.currentSensitivity;

        return this.currentSensitivity;
    }

    /**
     * Record VAD trigger and adjust if too many false positives
     * @param {boolean} wasVoice - Whether the trigger was actual voice
     */
    recordTrigger(wasVoice) {
        this.recentTriggers.push(wasVoice);

        // Keep history limited
        if (this.recentTriggers.length > this.maxHistoryLength) {
            this.recentTriggers.shift();
        }

        // Calculate false positive rate
        const falsePositives = this.recentTriggers.filter(v => !v).length;
        const falsePositiveRate = falsePositives / this.recentTriggers.length;

        // If too many false positives, increase threshold
        if (falsePositiveRate > 0.1) {
            this.baseSensitivity = Math.min(0.9, this.baseSensitivity + 0.05);
            console.log(`VAD: Increased sensitivity to ${this.baseSensitivity.toFixed(2)} (FP rate: ${(falsePositiveRate * 100).toFixed(1)}%)`);
        }

        // If very few false positives, can decrease threshold
        if (falsePositiveRate < 0.02 && this.recentTriggers.length >= 50) {
            this.baseSensitivity = Math.max(0.3, this.baseSensitivity - 0.02);
            console.log(`VAD: Decreased sensitivity to ${this.baseSensitivity.toFixed(2)} (FP rate: ${(falsePositiveRate * 100).toFixed(1)}%)`);
        }
    }

    /**
     * Get current sensitivity
     */
    getSensitivity() {
        return this.currentSensitivity;
    }

    /**
     * Get false positive rate
     */
    getFalsePositiveRate() {
        if (this.recentTriggers.length === 0) return 0;
        const falsePositives = this.recentTriggers.filter(v => !v).length;
        return falsePositives / this.recentTriggers.length;
    }

    /**
     * Reset adaptation
     */
    reset() {
        this.baseSensitivity = 0.5;
        this.currentSensitivity = 0.5;
        this.recentTriggers = [];
    }
}

module.exports = AdaptiveVADManager;
