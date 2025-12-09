# Stage 4: Audio Quality Enhancement - Implementation Guide

## Overview

**Duration:** 5 days  
**Priority:** P1 (Critical for UX)  
**Target:** AEC >20dB, NS >15dB, AGC ±3dB, VAD <5% false positives  
**Current Completion:** Ready for Implementation

This document provides a complete implementation guide for Stage 4: Audio Quality Enhancement.

---

## Day 1: Acoustic Echo Cancellation (AEC)

### Implementation: WebRTC-based AEC

**File:** `electron/audio/aec-processor.js`

```javascript
class AECProcessor {
  constructor() {
    this.filterLength = 512;
    this.filter = new Float32Array(this.filterLength);
    this.stepSize = 0.01; // LMS algorithm step size
    this.initialized = false;
  }

  async initialize(sampleRate = 16000) {
    this.sampleRate = sampleRate;
    this.initialized = true;
    console.log('AEC initialized at', sampleRate, 'Hz');
  }

  /**
   * Process audio with echo cancellation
   * @param {Buffer} inputBuffer - Microphone input
   * @param {Buffer} referenceBuffer - Speaker output
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
      // Estimate echo
      let echo = 0;
      for (let j = 0; j < this.filterLength && i - j >= 0; j++) {
        echo += this.filter[j] * (reference[i - j] || 0);
      }

      // Subtract echo from input
      const error = input[i] - echo;
      output[i] = error;

      // Update filter coefficients
      for (let j = 0; j < this.filterLength && i - j >= 0; j++) {
        this.filter[j] += this.stepSize * error * (reference[i - j] || 0);
      }
    }

    return this.float32ToBuffer(output);
  }

  bufferToFloat32(buffer) {
    const float32 = new Float32Array(buffer.length / 2);
    for (let i = 0; i < float32.length; i++) {
      float32[i] = buffer.readInt16LE(i * 2) / 32768.0;
    }
    return float32;
  }

  float32ToBuffer(float32) {
    const buffer = Buffer.alloc(float32.length * 2);
    for (let i = 0; i < float32.length; i++) {
      const int16 = Math.max(-32768, Math.min(32767, float32[i] * 32768));
      buffer.writeInt16LE(int16, i * 2);
    }
    return buffer;
  }

  destroy() {
    this.initialized = false;
  }
}

module.exports = AECProcessor;
```

**Dependencies:**
```bash
npm install wrtc  # Optional: for WebRTC support
```

---

## Day 2: Noise Suppression (NS)

### Implementation: RNNoise

**File:** `electron/audio/noise-suppressor.js`

```javascript
const RNNoise = require('rnnoise-wasm');

class NoiseSuppressor {
  constructor() {
    this.denoiser = null;
    this.initialized = false;
  }

  async initialize() {
    this.denoiser = await RNNoise.create();
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

    // RNNoise expects 480 samples (30ms at 16kHz)
    const frameSize = 480;
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

      // Process with RNNoise
      const denoisedFrame = this.denoiser.process(floatFrame);

      // Convert back to Int16
      for (let j = 0; j < frameSize; j++) {
        const sample = Math.max(-32768, Math.min(32767, denoisedFrame[j] * 32768));
        output.writeInt16LE(sample, frameStart + j * 2);
      }
    }

    return output;
  }

  getVoiceProbability() {
    return this.denoiser?.getVoiceProbability() || 0;
  }

  destroy() {
    if (this.denoiser) {
      this.denoiser.destroy();
    }
    this.initialized = false;
  }
}

module.exports = NoiseSuppressor;
```

**Dependencies:**
```bash
npm install rnnoise-wasm
```

---

## Day 3: Automatic Gain Control (AGC)

### Implementation: Dynamic Range Compression

**File:** `electron/audio/agc-processor.js`

```javascript
class AGCProcessor {
  constructor(targetLevel = -20, maxGain = 30, minGain = -10) {
    this.targetLevel = targetLevel;     // Target dBFS
    this.maxGain = maxGain;             // Max gain in dB
    this.minGain = minGain;             // Min gain in dB
    this.currentGain = 0;               // Current gain in dB
    this.smoothingFactor = 0.1;         // Gain smoothing
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

    // Smooth gain changes
    this.currentGain = 
      this.smoothingFactor * clampedGain + 
      (1 - this.smoothingFactor) * this.currentGain;

    // Apply gain
    const linearGain = Math.pow(10, this.currentGain / 20);

    for (let i = 0; i < samples; i++) {
      const sample = inputBuffer.readInt16LE(i * 2) / 32768.0;
      const gained = sample * linearGain;
      
      // Soft clipping to prevent distortion
      const clipped = this.softClip(gained);
      
      const int16 = Math.max(-32768, Math.min(32767, clipped * 32768));
      output.writeInt16LE(int16, i * 2);
    }

    return output;
  }

  /**
   * Soft clipping function
   */
  softClip(x) {
    if (Math.abs(x) < 0.5) {
      return x;
    } else if (Math.abs(x) < 1.0) {
      return Math.sign(x) * (0.5 + 0.5 * Math.tanh(2 * (Math.abs(x) - 0.5)));
    } else {
      return Math.sign(x) * 0.9;
    }
  }

  getCurrentGain() {
    return this.currentGain;
  }

  setTargetLevel(level) {
    this.targetLevel = level;
  }
}

module.exports = AGCProcessor;
```

---

## Day 4: Integrated Audio Pipeline

### Update: `electron/mic/audioPreprocessor.js`

```javascript
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
    
    this.speakerBuffer = []; // For AEC
    this.initialized = false;
  }

  async initialize(sampleRate = 16000) {
    await this.aec.initialize(sampleRate);
    await this.noiseSuppressor.initialize();
    
    this.initialized = true;
    console.log('Audio preprocessor initialized');
  }

  /**
   * Process audio through full pipeline
   * @param {Buffer} inputBuffer - Raw microphone input
   * @returns {Object} Processed audio and metadata
   */
  process(inputBuffer) {
    if (!this.initialized) {
      throw new Error('Preprocessor not initialized');
    }

    let processed = inputBuffer;

    // 1. Acoustic Echo Cancellation
    const referenceBuffer = this.getSpeakerReference(inputBuffer.length);
    processed = this.aec.process(processed, referenceBuffer);

    // 2. Noise Suppression
    processed = this.noiseSuppressor.process(processed);

    // 3. Automatic Gain Control
    processed = this.agc.process(processed);

    // 4. Quality monitoring
    const quality = this.qualityMonitor.analyze(processed);
    
    return {
      audio: processed,
      quality: quality,
      metadata: {
        aecEnabled: true,
        nsEnabled: true,
        agcEnabled: true,
        currentGain: this.agc.getCurrentGain(),
        voiceProbability: this.noiseSuppressor.getVoiceProbability(),
      },
    };
  }

  /**
   * Add speaker output for echo cancellation
   */
  addSpeakerOutput(buffer) {
    this.speakerBuffer.push(buffer);
    
    // Keep only last 2 seconds
    const maxLength = 16000 * 2 * 2; // 2 seconds at 16kHz, 16-bit
    while (this.getTotalBufferLength() > maxLength) {
      this.speakerBuffer.shift();
    }
  }

  getSpeakerReference(length) {
    const totalLength = this.getTotalBufferLength();
    
    if (totalLength === 0) {
      return Buffer.alloc(length); // Silence
    }

    const combined = Buffer.concat(this.speakerBuffer);
    
    if (combined.length >= length) {
      return combined.slice(combined.length - length);
    } else {
      const padded = Buffer.alloc(length);
      combined.copy(padded, length - combined.length);
      return padded;
    }
  }

  getTotalBufferLength() {
    return this.speakerBuffer.reduce((sum, buf) => sum + buf.length, 0);
  }

  destroy() {
    this.aec.destroy();
    this.noiseSuppressor.destroy();
    this.initialized = false;
  }
}

module.exports = AudioPreprocessor;
```

---

## Day 5: Adaptive VAD & Quality Metrics

### Adaptive VAD

**File:** `electron/vad/adaptive-vad.js`

```javascript
class AdaptiveVADManager {
  constructor() {
    this.baseSensitivity = 0.5;
    this.currentSensitivity = 0.5;
    this.adaptationRate = 0.1;
    this.recentTriggers = [];
    this.maxHistoryLength = 100;
  }

  /**
   * Adapt sensitivity based on environment
   */
  adaptSensitivity(audioQuality) {
    const { snr } = audioQuality;

    // Adjust based on SNR
    if (snr < 10) {
      // Noisy environment - increase threshold
      this.currentSensitivity = Math.min(0.8, this.baseSensitivity + 0.2);
    } else if (snr > 20) {
      // Quiet environment - decrease threshold
      this.currentSensitivity = Math.max(0.3, this.baseSensitivity - 0.1);
    } else {
      this.currentSensitivity = this.baseSensitivity;
    }

    return this.currentSensitivity;
  }

  recordTrigger(wasVoice) {
    this.recentTriggers.push(wasVoice);
    
    if (this.recentTriggers.length > this.maxHistoryLength) {
      this.recentTriggers.shift();
    }

    // Calculate false positive rate
    const falsePositives = this.recentTriggers.filter(v => !v).length;
    const falsePositiveRate = falsePositives / this.recentTriggers.length;

    // Adjust if too many false positives
    if (falsePositiveRate > 0.1) {
      this.baseSensitivity = Math.min(0.9, this.baseSensitivity + 0.05);
    }
  }

  getSensitivity() {
    return this.currentSensitivity;
  }
}

module.exports = AdaptiveVADManager;
```

### Enhanced Quality Monitor

**File:** `electron/mic/qualityMonitor.js`

```javascript
class QualityMonitor {
  analyze(audioBuffer) {
    const samples = this.bufferToFloat32(audioBuffer);

    return {
      snr: this.calculateSNR(samples),
      rms: this.calculateRMS(samples),
      peak: this.calculatePeak(samples),
      crestFactor: this.calculateCrestFactor(samples),
      clipping: this.detectClipping(samples),
      silence: this.detectSilence(samples),
    };
  }

  calculateSNR(samples) {
    // Estimate signal power (top 50%)
    const sorted = [...samples].map(Math.abs).sort((a, b) => b - a);
    const signalSamples = sorted.slice(0, Math.floor(sorted.length * 0.5));
    const signalPower = signalSamples.reduce((sum, s) => sum + s * s, 0) / signalSamples.length;

    // Estimate noise power (bottom 50%)
    const noiseSamples = sorted.slice(Math.floor(sorted.length * 0.5));
    const noisePower = noiseSamples.reduce((sum, s) => sum + s * s, 0) / noiseSamples.length;

    return 10 * Math.log10(signalPower / (noisePower + 1e-10));
  }

  calculateRMS(samples) {
    const sumSquares = samples.reduce((sum, s) => sum + s * s, 0);
    return Math.sqrt(sumSquares / samples.length);
  }

  calculatePeak(samples) {
    return Math.max(...samples.map(Math.abs));
  }

  calculateCrestFactor(samples) {
    const peak = this.calculatePeak(samples);
    const rms = this.calculateRMS(samples);
    return peak / (rms + 1e-10);
  }

  detectClipping(samples, threshold = 0.95) {
    const clipped = samples.filter(s => Math.abs(s) > threshold).length;
    return clipped / samples.length;
  }

  detectSilence(samples, threshold = 0.01) {
    const rms = this.calculateRMS(samples);
    return rms < threshold;
  }

  bufferToFloat32(buffer) {
    const float32 = new Float32Array(buffer.length / 2);
    for (let i = 0; i < float32.length; i++) {
      float32[i] = buffer.readInt16LE(i * 2) / 32768.0;
    }
    return float32;
  }
}

module.exports = QualityMonitor;
```

---

## Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Echo Reduction | >20dB | Compare input vs AEC output |
| Noise Reduction | >15dB | SNR before/after NS |
| Volume Consistency | ±3dB | RMS variance |
| VAD False Positives | <5% | Trigger accuracy |
| SNR | >20dB | After full pipeline |
| Processing Latency | <50ms | End-to-end timing |

---

## Testing

### Test Audio Samples Needed

1. **Clean speech** - Baseline
2. **Speech with echo** - Test AEC
3. **Speech with noise** - Test NS
4. **Varying volumes** - Test AGC
5. **Background music** - Test VAD

### Benchmark Script

```javascript
// benchmark-audio.js
const AudioPreprocessor = require('./electron/mic/audioPreprocessor');
const fs = require('fs');

async function benchmark() {
  const preprocessor = new AudioPreprocessor();
  await preprocessor.initialize();

  const testAudio = fs.readFileSync('test-samples/noisy-speech.raw');
  
  const iterations = 100;
  const start = Date.now();

  for (let i = 0; i < iterations; i++) {
    preprocessor.process(testAudio);
  }

  const end = Date.now();
  const avgLatency = (end - start) / iterations;

  console.log(`Average latency: ${avgLatency.toFixed(2)}ms`);
  console.log(`Target: <50ms`);
  console.log(`Status: ${avgLatency < 50 ? '✅ PASS' : '❌ FAIL'}`);
}

benchmark();
```

---

## Implementation Checklist

### Day 1: AEC
- [ ] Create `aec-processor.js`
- [ ] Implement LMS adaptive filter
- [ ] Test with echo samples
- [ ] Measure echo reduction

### Day 2: Noise Suppression
- [ ] Install RNNoise
- [ ] Create `noise-suppressor.js`
- [ ] Test with noisy samples
- [ ] Measure noise reduction

### Day 3: AGC
- [ ] Create `agc-processor.js`
- [ ] Implement soft clipping
- [ ] Test with varying volumes
- [ ] Measure consistency

### Day 4: Integration
- [ ] Update `audioPreprocessor.js`
- [ ] Integrate all processors
- [ ] Add speaker output tracking
- [ ] Test full pipeline

### Day 5: Quality & Testing
- [ ] Implement adaptive VAD
- [ ] Enhance quality monitor
- [ ] Run benchmarks
- [ ] Create documentation

---

**Created:** December 9, 2025  
**Status:** Implementation Guide Complete  
**Ready for:** Full Stage 4 Implementation
