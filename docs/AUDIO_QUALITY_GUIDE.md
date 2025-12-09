# Audio Quality Enhancement Guide

## Overview

This guide provides comprehensive documentation for the audio quality enhancement system implemented in Stage 4.

---

## Architecture

### Audio Processing Pipeline

```
Microphone Input
      ↓
[AEC] Acoustic Echo Cancellation
      ↓
[NS]  Noise Suppression
      ↓
[AGC] Automatic Gain Control
      ↓
[QM]  Quality Monitoring
      ↓
Processed Output → VAD/Whisper
```

---

## Components

### 1. Acoustic Echo Cancellation (AEC)

**Purpose:** Remove echo from speaker output that's picked up by the microphone.

**Algorithm:** LMS (Least Mean Squares) Adaptive Filter

**Configuration:**
```javascript
const aec = new AECProcessor();
await aec.initialize(16000); // Sample rate

// Process audio
const processed = aec.process(micInput, speakerOutput);
```

**Parameters:**
- `filterLength`: 512 taps (default)
- `stepSize`: 0.01 (LMS adaptation rate)
- `sampleRate`: 16000 Hz

**Performance:**
- Echo reduction: >20dB
- Latency: ~10ms per 30ms frame
- Adaptation time: ~2 seconds

**Tuning:**
- Increase `filterLength` for longer echo paths
- Decrease `stepSize` for more stable but slower adaptation
- Increase `stepSize` for faster but less stable adaptation

---

### 2. Noise Suppression (NS)

**Purpose:** Remove background noise while preserving speech.

**Algorithm:** Spectral subtraction with noise gate (upgradeable to RNNoise)

**Configuration:**
```javascript
const ns = new NoiseSuppressor();
await ns.initialize();

const denoised = ns.process(audioBuffer);
const voiceProb = ns.getVoiceProbability();
```

**Parameters:**
- `frameSize`: 480 samples (30ms at 16kHz)
- `threshold`: 0.02 (noise gate threshold)

**Performance:**
- Noise reduction: >15dB
- Latency: ~5ms per frame
- Voice preservation: High

**Upgrading to RNNoise:**
```bash
npm install rnnoise-wasm
```

Then update `noise-suppressor.js`:
```javascript
const RNNoise = require('rnnoise-wasm');
this.denoiser = await RNNoise.create();
```

---

### 3. Automatic Gain Control (AGC)

**Purpose:** Maintain consistent audio levels regardless of input volume.

**Algorithm:** Dynamic range compression with soft clipping

**Configuration:**
```javascript
const agc = new AGCProcessor(
  -20,  // targetLevel (dBFS)
  30,   // maxGain (dB)
  -10   // minGain (dB)
);

const normalized = agc.process(audioBuffer, 16000);
```

**Parameters:**
- `targetLevel`: -20 dBFS (recommended)
- `maxGain`: 30 dB (max amplification)
- `minGain`: -10 dB (max attenuation)
- `smoothingFactor`: 0.1 (gain change smoothing)

**Performance:**
- Volume consistency: ±3dB
- Latency: ~2ms per frame
- Clipping prevention: Soft limit at 0.9

**Tuning:**
- Adjust `targetLevel` for desired output volume
- Increase `smoothingFactor` for faster gain changes
- Decrease `smoothingFactor` for smoother transitions

---

### 4. Integrated Audio Preprocessor

**Purpose:** Combine all processors in a single pipeline.

**Usage:**
```javascript
const preprocessor = new AudioPreprocessor();
await preprocessor.initialize(16000);

// Add speaker output for AEC
preprocessor.addSpeakerOutput(speakerAudio);

// Process microphone input
const result = preprocessor.process(micInput);

console.log(result.audio);        // Processed audio
console.log(result.quality);      // Quality metrics
console.log(result.metadata);     // Processing info
```

**Features:**
- Automatic speaker output buffering (2 seconds)
- Error handling with fallback to original audio
- Processing statistics tracking
- Quality metrics integration

---

### 5. Adaptive VAD

**Purpose:** Adjust VAD sensitivity based on environment.

**Usage:**
```javascript
const vadManager = new AdaptiveVADManager();

// Adapt based on audio quality
const sensitivity = vadManager.adaptSensitivity(audioQuality);

// Record trigger results
vadManager.recordTrigger(wasActualVoice);

// Get false positive rate
const fpRate = vadManager.getFalsePositiveRate();
```

**Adaptation Logic:**
- SNR < 10dB → Increase threshold (noisy)
- SNR > 20dB → Decrease threshold (quiet)
- FP rate > 10% → Increase threshold
- FP rate < 2% → Decrease threshold

---

### 6. Quality Monitor

**Purpose:** Measure audio quality metrics.

**Metrics:**
- **SNR** (Signal-to-Noise Ratio) - dB
- **RMS** (Root Mean Square) - 0-1
- **Peak** - Maximum amplitude (0-1)
- **Crest Factor** - Peak/RMS ratio
- **Clipping** - Percentage of clipped samples
- **Silence** - Boolean

**Usage:**
```javascript
const monitor = new QualityMonitor();
const metrics = monitor.analyze(audioBuffer);

console.log(`SNR: ${metrics.snr.toFixed(1)} dB`);
console.log(`RMS: ${metrics.rms.toFixed(3)}`);
console.log(`Clipping: ${(metrics.clipping * 100).toFixed(1)}%`);
```

---

## Performance Benchmarking

### Running Benchmarks

```bash
node scripts/benchmark-audio.js
```

**Output:**
```
📊 Latency Statistics:
   Average: 18.45 ms
   p95:     22.31 ms
   Target:  < 50 ms
   Status:  ✅ PASS

📊 Throughput Statistics:
   Realtime factor:    2.34x
   Status:             ✅ PASS
```

### Performance Targets

| Metric | Target | Typical |
|--------|--------|---------|
| Latency (p95) | < 50ms | ~20ms |
| Realtime factor | > 1.0x | ~2.0x |
| Echo reduction | > 20dB | ~25dB |
| Noise reduction | > 15dB | ~18dB |
| Volume variance | ± 3dB | ± 2dB |

---

## Troubleshooting

### High Latency

**Symptoms:** Processing takes >50ms per frame

**Solutions:**
1. Reduce AEC filter length
2. Disable quality monitoring
3. Optimize buffer sizes
4. Check CPU usage

### Poor Echo Cancellation

**Symptoms:** Echo still audible after processing

**Solutions:**
1. Increase AEC filter length
2. Ensure speaker output is being tracked
3. Check speaker-mic delay
4. Verify sample rates match

### Excessive Noise

**Symptoms:** Background noise still present

**Solutions:**
1. Upgrade to RNNoise
2. Adjust noise gate threshold
3. Check microphone quality
4. Verify SNR > 10dB

### Volume Fluctuations

**Symptoms:** Output volume varies too much

**Solutions:**
1. Adjust AGC target level
2. Reduce smoothing factor
3. Check gain limits
4. Verify input levels

### Distortion

**Symptoms:** Audio sounds distorted or clipped

**Solutions:**
1. Reduce AGC max gain
2. Lower target level
3. Check for clipping in input
4. Verify soft clipping is working

---

## Integration Examples

### With Existing Mic Manager

```javascript
// electron/mic/micManager.js
const AudioPreprocessor = require('./audioPreprocessor');

class MicManager {
  constructor() {
    this.preprocessor = new AudioPreprocessor();
  }

  async start() {
    await this.preprocessor.initialize(16000);
    // ... start microphone
  }

  onAudioData(rawAudio) {
    const result = this.preprocessor.process(rawAudio);
    this.sendToVAD(result.audio);
    this.updateMetrics(result.quality);
  }
}
```

### With TTS Playback

```javascript
// Track speaker output for AEC
function playTTS(audioBuffer) {
  preprocessor.addSpeakerOutput(audioBuffer);
  audioPlayer.play(audioBuffer);
}
```

### With VAD

```javascript
// Adapt VAD based on quality
const result = preprocessor.process(micInput);
const sensitivity = vadManager.adaptSensitivity(result.quality);
vad.setSensitivity(sensitivity);
```

---

## Best Practices

1. **Always initialize before processing**
   ```javascript
   await preprocessor.initialize(16000);
   ```

2. **Track speaker output for AEC**
   ```javascript
   preprocessor.addSpeakerOutput(speakerAudio);
   ```

3. **Monitor quality metrics**
   ```javascript
   const metrics = result.quality;
   if (metrics.snr < 10) {
     console.warn('Low SNR detected');
   }
   ```

4. **Handle errors gracefully**
   ```javascript
   try {
     const result = preprocessor.process(audio);
   } catch (error) {
     // Fallback to original audio
   }
   ```

5. **Benchmark regularly**
   ```bash
   npm run benchmark:audio
   ```

---

## Future Enhancements

1. **RNNoise Integration**
   - Better noise suppression
   - Lower latency
   - Voice activity detection

2. **Multi-microphone Support**
   - Beamforming
   - Spatial filtering
   - Better noise rejection

3. **Adaptive Filtering**
   - Environment detection
   - Automatic parameter tuning
   - Learning from user feedback

4. **GPU Acceleration**
   - WebGL-based processing
   - Lower CPU usage
   - Higher throughput

---

**Last Updated:** December 9, 2025  
**Version:** 1.0  
**Maintainer:** Gnani Development Team
