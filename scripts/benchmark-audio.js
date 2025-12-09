/**
 * Audio Preprocessing Benchmark Script
 * Measures latency and performance of audio processing pipeline
 */

const AudioPreprocessor = require('../electron/mic/audioPreprocessor');
const fs = require('fs');
const path = require('path');

class AudioBenchmark {
    constructor() {
        this.preprocessor = new AudioPreprocessor();
        this.results = [];
    }

    async initialize() {
        await this.preprocessor.initialize(16000);
        console.log('Audio preprocessor initialized for benchmarking\n');
    }

    /**
     * Generate test audio buffer
     */
    generateTestAudio(durationMs = 30, sampleRate = 16000) {
        const samples = Math.floor((durationMs / 1000) * sampleRate);
        const buffer = Buffer.alloc(samples * 2); // 16-bit samples

        // Generate sine wave with noise
        for (let i = 0; i < samples; i++) {
            const t = i / sampleRate;
            const sine = Math.sin(2 * Math.PI * 440 * t); // 440 Hz tone
            const noise = (Math.random() - 0.5) * 0.1; // 10% noise
            const sample = (sine + noise) * 0.5;

            const int16 = Math.max(-32768, Math.min(32767, Math.round(sample * 32768)));
            buffer.writeInt16LE(int16, i * 2);
        }

        return buffer;
    }

    /**
     * Benchmark processing latency
     */
    async benchmarkLatency(iterations = 100) {
        console.log(`Running latency benchmark (${iterations} iterations)...`);

        const testAudio = this.generateTestAudio(30); // 30ms frame
        const latencies = [];

        for (let i = 0; i < iterations; i++) {
            const start = process.hrtime.bigint();
            this.preprocessor.process(testAudio);
            const end = process.hrtime.bigint();

            const latencyMs = Number(end - start) / 1_000_000; // Convert to ms
            latencies.push(latencyMs);
        }

        // Calculate statistics
        latencies.sort((a, b) => a - b);
        const stats = {
            min: latencies[0],
            max: latencies[latencies.length - 1],
            avg: latencies.reduce((a, b) => a + b, 0) / latencies.length,
            p50: latencies[Math.floor(latencies.length * 0.5)],
            p95: latencies[Math.floor(latencies.length * 0.95)],
            p99: latencies[Math.floor(latencies.length * 0.99)],
        };

        return stats;
    }

    /**
     * Benchmark throughput
     */
    async benchmarkThroughput(durationSeconds = 10) {
        console.log(`\nRunning throughput benchmark (${durationSeconds}s)...`);

        const testAudio = this.generateTestAudio(30);
        const startTime = Date.now();
        let framesProcessed = 0;

        while ((Date.now() - startTime) < durationSeconds * 1000) {
            this.preprocessor.process(testAudio);
            framesProcessed++;
        }

        const actualDuration = (Date.now() - startTime) / 1000;
        const framesPerSecond = framesProcessed / actualDuration;
        const audioProcessed = (framesProcessed * 30) / 1000; // seconds of audio

        return {
            framesProcessed,
            duration: actualDuration,
            framesPerSecond: framesPerSecond,
            audioProcessed: audioProcessed,
            realtimeFactor: audioProcessed / actualDuration,
        };
    }

    /**
     * Benchmark quality metrics calculation
     */
    async benchmarkQualityMetrics(iterations = 1000) {
        console.log(`\nRunning quality metrics benchmark (${iterations} iterations)...`);

        const testAudio = this.generateTestAudio(30);
        const start = Date.now();

        for (let i = 0; i < iterations; i++) {
            const result = this.preprocessor.process(testAudio);
            // Quality metrics are calculated in process()
        }

        const end = Date.now();
        const totalTime = end - start;
        const avgTime = totalTime / iterations;

        return {
            totalTime,
            iterations,
            avgTimePerFrame: avgTime,
        };
    }

    /**
     * Run all benchmarks
     */
    async runAll() {
        console.log('='.repeat(60));
        console.log('AUDIO PREPROCESSING BENCHMARK');
        console.log('='.repeat(60));

        // Latency benchmark
        const latency = await this.benchmarkLatency(100);
        console.log('\n📊 Latency Statistics:');
        console.log(`   Min:     ${latency.min.toFixed(2)} ms`);
        console.log(`   Average: ${latency.avg.toFixed(2)} ms`);
        console.log(`   p50:     ${latency.p50.toFixed(2)} ms`);
        console.log(`   p95:     ${latency.p95.toFixed(2)} ms`);
        console.log(`   p99:     ${latency.p99.toFixed(2)} ms`);
        console.log(`   Max:     ${latency.max.toFixed(2)} ms`);
        console.log(`   Target:  < 50 ms`);
        console.log(`   Status:  ${latency.p95 < 50 ? '✅ PASS' : '❌ FAIL'}`);

        // Throughput benchmark
        const throughput = await this.benchmarkThroughput(5);
        console.log('\n📊 Throughput Statistics:');
        console.log(`   Frames processed:   ${throughput.framesProcessed}`);
        console.log(`   Duration:           ${throughput.duration.toFixed(2)}s`);
        console.log(`   Frames/second:      ${throughput.framesPerSecond.toFixed(1)}`);
        console.log(`   Audio processed:    ${throughput.audioProcessed.toFixed(1)}s`);
        console.log(`   Realtime factor:    ${throughput.realtimeFactor.toFixed(2)}x`);
        console.log(`   Status:             ${throughput.realtimeFactor > 1 ? '✅ PASS' : '❌ FAIL'}`);

        // Quality metrics benchmark
        const quality = await this.benchmarkQualityMetrics(1000);
        console.log('\n📊 Quality Metrics Performance:');
        console.log(`   Total time:         ${quality.totalTime} ms`);
        console.log(`   Iterations:         ${quality.iterations}`);
        console.log(`   Avg per frame:      ${quality.avgTimePerFrame.toFixed(3)} ms`);

        // Overall summary
        console.log('\n' + '='.repeat(60));
        console.log('SUMMARY');
        console.log('='.repeat(60));
        console.log(`Latency (p95):        ${latency.p95.toFixed(2)} ms ${latency.p95 < 50 ? '✅' : '❌'}`);
        console.log(`Realtime factor:      ${throughput.realtimeFactor.toFixed(2)}x ${throughput.realtimeFactor > 1 ? '✅' : '❌'}`);
        console.log(`Quality overhead:     ${quality.avgTimePerFrame.toFixed(3)} ms`);
        console.log('='.repeat(60));

        // Save results
        this.saveResults({
            latency,
            throughput,
            quality,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Save benchmark results to file
     */
    saveResults(results) {
        const resultsDir = path.join(__dirname, '../benchmark-results');
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
        }

        const filename = `audio-benchmark-${Date.now()}.json`;
        const filepath = path.join(resultsDir, filename);

        fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
        console.log(`\n📁 Results saved to: ${filepath}`);
    }

    async cleanup() {
        this.preprocessor.destroy();
    }
}

// Run benchmark if executed directly
if (require.main === module) {
    (async () => {
        const benchmark = new AudioBenchmark();

        try {
            await benchmark.initialize();
            await benchmark.runAll();
        } catch (error) {
            console.error('Benchmark failed:', error);
            process.exit(1);
        } finally {
            await benchmark.cleanup();
        }
    })();
}

module.exports = AudioBenchmark;
