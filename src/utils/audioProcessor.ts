// src/utils/audioProcessor.ts
import { WHISPER_SAMPLE_RATE } from '../configs/config.js';
import logger from './logger.js';

class AudioProcessor {
    constructor() {
        logger.info('AudioProcessor initialized.');
    }

    processAudioForWhisper(audioBuffer: Buffer, inputSampleRate = 16000): Buffer {
        if (inputSampleRate !== WHISPER_SAMPLE_RATE) {
            logger.warn(`Audio sample rate mismatch. Input: ${inputSampleRate}Hz, Expected: ${WHISPER_SAMPLE_RATE}Hz. Resampling might be needed.`);
        }

        logger.debug(`Audio processed for Whisper. Original size: ${audioBuffer.length}`);
        return audioBuffer;
    }

    addWavHeader(pcmData: Buffer, sampleRate: number, numChannels: number, bitDepth: number): Buffer {
        const header = Buffer.alloc(44);
        const byteRate = sampleRate * numChannels * bitDepth / 8;
        const blockAlign = numChannels * bitDepth / 8;
        const dataLength = pcmData.length;

        header.write('RIFF', 0);
        header.writeUInt32LE(dataLength + 36, 4);
        header.write('WAVE', 8);
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16);
        header.writeUInt16LE(1, 20);
        header.writeUInt16LE(numChannels, 22);
        header.writeUInt32LE(sampleRate, 24);
        header.writeUInt32LE(byteRate, 28);
        header.writeUInt16LE(blockAlign, 32);
        header.writeUInt16LE(bitDepth, 34);
        header.write('data', 36);
        header.writeUInt32LE(dataLength, 40);

        logger.debug(`WAV header added. Sample rate: ${sampleRate}, Channels: ${numChannels}, Bit depth: ${bitDepth}`);
        return Buffer.concat([header, pcmData]);
    }
}

export default new AudioProcessor();
