// src/modules/asr/whisper-cpp.service.ts
import { spawn } from 'child_process';
import { createContextualLogger } from '../../core/logger/logger.js';
import metrics from '../../core/monitoring/metrics.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Logger } from 'winston';

export class WhisperCppService {
  private logger: Logger;
  private whisperPath: string;
  private modelPath: string;
  private isAvailable: boolean = false;
  private useWsl: boolean = false;

  constructor() {
    this.logger = createContextualLogger({ module: 'WhisperCppService' });

    // Default paths (will be overridden if WSL is used)
    const homeDir = os.homedir();
    this.whisperPath = path.join(homeDir, '.gnani', 'whisper-cpp', 'main');
    this.modelPath = path.join(homeDir, '.gnani', 'whisper-cpp', 'models', 'ggml-base.en.bin');

    this.verifyInstallation();
  }

  private verifyInstallation(): void {
    // Check local installation first
    if (fs.existsSync(this.whisperPath) && fs.existsSync(this.modelPath)) {
      this.isAvailable = true;
      this.useWsl = false;
      this.logger.info('Whisper.cpp found locally (Windows/Native)');
      return;
    }

    // If on Windows, check WSL
    if (os.platform() === 'win32') {
      this.checkWslInstallation();
    } else {
      this.logger.warn(`Whisper.cpp not found at ${this.whisperPath}`);
      this.isAvailable = false;
    }
  }

  private checkWslInstallation(): void {
    try {
      // Check if WSL is available and binary exists
      // We check /root/.gnani/whisper-cpp/main as that's where it seems to be installed for root
      const wslPath = '/root/.gnani/whisper-cpp/main';
      const wslModelPath = '/root/.gnani/whisper-cpp/models/ggml-base.en.bin';

      // Use wsl to check file existence
      const checkCmd = `wsl -d UbuntuDistro [ -f "${wslPath}" ] && [ -f "${wslModelPath}" ] && echo "FOUND"`;
      const result = require('child_process').execSync(checkCmd).toString().trim();

      if (result === 'FOUND') {
        this.isAvailable = true;
        this.useWsl = true;
        this.whisperPath = wslPath;
        this.modelPath = wslModelPath;
        this.logger.info('Whisper.cpp found in WSL (UbuntuDistro)');
      } else {
        this.logger.warn('Whisper.cpp not found in WSL (UbuntuDistro) at /root/.gnani/whisper-cpp');
        this.isAvailable = false;
      }
    } catch (error) {
      this.logger.warn('Failed to check WSL installation', { error });
      this.isAvailable = false;
    }
  }

  async transcribe(sessionId: string, audioBuffer: Buffer, sampleRate: number): Promise<string> {
    if (!this.isAvailable) {
      throw new Error('Whisper.cpp not available. Please run setup script.');
    }

    const startTime = Date.now();

    // Save audio to temp file (whisper.cpp requires file input)
    const tempFile = path.join(os.tmpdir(), `audio-${sessionId}-${Date.now()}.wav`);

    try {
      // Write WAV file with proper header
      this.writeWavFile(tempFile, audioBuffer, sampleRate);

      const transcript = await this.runWhisper(tempFile);

      // Record metrics
      const duration = Date.now() - startTime;
      metrics.recordSTTLatency(duration);
      metrics.incWhisperTranscription(sessionId, 'success');

      this.logger.info('Whisper.cpp transcription complete', {
        sessionId,
        duration,
        transcriptLength: transcript.length
      });

      return transcript;

    } catch (error: any) {
      metrics.incWhisperTranscription(sessionId, 'failure');
      this.logger.error('Whisper.cpp transcription failed', {
        sessionId,
        error: error.message
      });
      throw error;

    } finally {
      // Cleanup temp file
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }

  // Month-3: Add compatibility method for AudioProcessor
  async sendAudioChunk(
    sessionId: string,
    chunk: Buffer,
    callback: (transcript: string, isFinal: boolean) => void,
    isFinal: boolean = false
  ): Promise<void> {
    // For now, Whisper.cpp service is designed for file-based transcription
    // We'll accumulate chunks in the AudioProcessor buffer and transcribe only when needed
    // This method is a placeholder to satisfy the interface

    if (isFinal) {
      // If it's the final chunk, we could trigger transcription here
      // But AudioProcessor calls transcribe() separately
    }
  }

  private writeWavFile(filePath: string, audioBuffer: Buffer, sampleRate: number): void {
    const numChannels = 1; // Mono
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);

    const header = Buffer.alloc(44);

    // RIFF header
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + audioBuffer.length, 4);
    header.write('WAVE', 8);

    // fmt chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // fmt chunk size
    header.writeUInt16LE(1, 20); // PCM format
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);

    // data chunk
    header.write('data', 36);
    header.writeUInt32LE(audioBuffer.length, 40);

    const wavFile = Buffer.concat([header, audioBuffer]);
    fs.writeFileSync(filePath, wavFile);
  }

  private runWhisper(audioFile: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let cmd: string;
      let args: string[];

      if (this.useWsl) {
        // Convert Windows path to WSL path
        // e.g. C:\Users\foo\temp.wav -> /mnt/c/Users/foo/temp.wav
        const wslAudioFile = audioFile.replace(/^([a-zA-Z]):/, (match, drive) => `/mnt/${drive.toLowerCase()}`).replace(/\\/g, '/');

        cmd = 'wsl';
        args = [
          '-d', 'UbuntuDistro',
          this.whisperPath,
          '-m', this.modelPath,
          '-f', wslAudioFile,
          '-nt', // No timestamps
          '-l', 'en', // English
          '-t', '4' // 4 threads
        ];
      } else {
        cmd = this.whisperPath;
        args = [
          '-m', this.modelPath,
          '-f', audioFile,
          '-nt', // No timestamps
          '-l', 'en', // English
          '-t', '4' // 4 threads
        ];
      }

      const whisper = spawn(cmd, args);

      let output = '';
      let error = '';

      whisper.stdout.on('data', (data) => {
        output += data.toString();
      });

      whisper.stderr.on('data', (data) => {
        error += data.toString();
      });

      whisper.on('close', (code) => {
        if (code === 0) {
          const transcript = this.parseOutput(output);
          resolve(transcript);
        } else {
          reject(new Error(`Whisper.cpp failed with code ${code}: ${error}`));
        }
      });

      whisper.on('error', (err) => {
        reject(new Error(`Failed to spawn whisper.cpp: ${err.message}`));
      });
    });
  }

  private parseOutput(output: string): string {
    // Whisper.cpp output format:
    // [00:00:00.000 --> 00:00:02.000]   Transcript text here

    const lines = output.split('\n');
    const transcriptLines: string[] = [];

    for (const line of lines) {
      // Look for lines with timestamps
      const match = line.match(/\[[\d:.]+\s*-->\s*[\d:.]+\]\s*(.+)/);
      if (match && match[1]) {
        transcriptLines.push(match[1].trim());
      }
    }

    return transcriptLines.join(' ').trim();
  }

  isReady(): boolean {
    return this.isAvailable;
  }

  cleanup(sessionId: string): void {
    // Cleanup any session-specific resources
    this.logger.debug(`Whisper.cpp cleaned up session: ${sessionId}`);
  }
}

export default new WhisperCppService();
