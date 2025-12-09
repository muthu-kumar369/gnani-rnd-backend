/**
 * Integrated Audio Preprocessor
 * Combines AEC, Noise Suppression, and AGC in a single pipeline
 */

const AECProcessor = require('../audio/aec-processor');
const NoiseSuppressor = require('../audio/noise-suppressor');
const AGCProcessor = require('../audio/agc-processor');
const QualityMonitor = require('./qualityMonitor');

class AudioPreprocessor {
    constructor() {
        this.aec = new AECProcessor();
        this.noiseSuppressor = new NoiseSuppressor();
        this.agc = new AGCProcessor();
        this.qualityMonitor = new QualityMonitor();

        this.speakerBuffer = []; // Buffer for speaker output (for AEC)
        this.initialized = false;
        this.sampleRate = 16000;

        // Processing statistics
        this.stats = {
            totalProcessed: 0,
            averageLatency: 0,
            lastProcessTime: 0,
        };
    }

    /**
     * Initialize all audio processors
     * @param {number} sampleRate - Sample rate in Hz (default: 16000)
     */
    async initialize(sampleRate = 16000) {
        this.sampleRate = sampleRate;

        await this.aec.initialize(sampleRate);
        await this.noiseSuppressor.initialize();

        this.initialized = true;
        console.log('Audio preprocessor initialized at', sampleRate, 'Hz');
    }

    /**
     * Process audio chunk through full pipeline
     * @param {Buffer} inputBuffer - Raw microphone input
     * @returns {Object} Processed audio and metadata
     */
    process(inputBuffer) {
        if (!this.initialized) {
            throw new Error('Preprocessor not initialized');
        }

        const startTime = Date.now();
        let processed = inputBuffer;

        try {
            // 1. Acoustic Echo Cancellation
            const referenceBuffer = this.getSpeakerReference(inputBuffer.length);
            processed = this.aec.process(processed, referenceBuffer);

            // 2. Noise Suppression
            processed = this.noiseSuppressor.process(processed);

            // 3. Automatic Gain Control
            processed = this.agc.process(processed, this.sampleRate);

            // 4. Quality monitoring
            const quality = this.qualityMonitor.analyze(processed);

            // Update statistics
            const processingTime = Date.now() - startTime;
            this.updateStats(processingTime);

            return {
                audio: processed,
                quality: quality,
                metadata: {
                    aecEnabled: true,
                    nsEnabled: true,
                    agcEnabled: true,
                    currentGain: this.agc.getCurrentGain(),
                    voiceProbability: this.noiseSuppressor.getVoiceProbability(),
                    processingTime: processingTime,
                },
            };
        } catch (error) {
            console.error('Audio preprocessing error:', error);
            // Return original audio if processing fails
            return {
                audio: inputBuffer,
                quality: null,
                metadata: {
                    error: error.message,
                    aecEnabled: false,
                    nsEnabled: false,
                    agcEnabled: false,
                },
            };
        }
    }

    /**
     * Add speaker output for echo cancellation
     * @param {Buffer} buffer - Speaker output audio
     */
    addSpeakerOutput(buffer) {
        this.speakerBuffer.push(buffer);

        // Keep only last 2 seconds of speaker output
        const maxLength = this.sampleRate * 2 * 2; // 2 seconds, 16-bit samples
        while (this.getTotalBufferLength() > maxLength) {
            this.speakerBuffer.shift();
        }
    }

    /**
     * Get speaker reference for AEC
     * @param {number} length - Required buffer length
     * @returns {Buffer} Reference audio for echo cancellation
     */
    getSpeakerReference(length) {
        const totalLength = this.getTotalBufferLength();

        if (totalLength === 0) {
            // No speaker output - return silence
            return Buffer.alloc(length);
        }

        // Concatenate all speaker buffers
        const combined = Buffer.concat(this.speakerBuffer);

        // Return last 'length' bytes
        if (combined.length >= length) {
            return combined.slice(combined.length - length);
        } else {
            // Pad with silence if not enough data
            const padded = Buffer.alloc(length);
            combined.copy(padded, length - combined.length);
            return padded;
        }
    }

    /**
     * Get total length of speaker buffer
     */
    getTotalBufferLength() {
        return this.speakerBuffer.reduce((sum, buf) => sum + buf.length, 0);
    }

    /**
     * Update processing statistics
     */
    updateStats(processingTime) {
        this.stats.totalProcessed++;
        this.stats.lastProcessTime = processingTime;

        // Calculate moving average
        const alpha = 0.1;
        this.stats.averageLatency =
            alpha * processingTime +
            (1 - alpha) * this.stats.averageLatency;
    }

    /**
     * Get processing statistics
     */
    getStats() {
        return {
            ...this.stats,
            qualityMetrics: this.qualityMonitor.getAverageMetrics(),
        };
    }

    /**
     * Reset all processors
     */
    reset() {
        this.aec.reset();
        this.agc.reset();
        this.qualityMonitor.reset();
        this.speakerBuffer = [];
        this.stats = {
            totalProcessed: 0,
            averageLatency: 0,
            lastProcessTime: 0,
        };
    }

    /**
     * Destroy and cleanup
     */
    destroy() {
        this.aec.destroy();
        this.noiseSuppressor.destroy();
        this.speakerBuffer = [];
        this.initialized = false;
    }
}

module.exports = AudioPreprocessor;
