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
    // Updated paths for newly built whisper.cpp
    this.whisperPath = path.join(homeDir, '.gnani', 'whisper.cpp', 'build', 'bin', 'whisper-cli');
    this.modelPath = path.join(homeDir, '.gnani', 'whisper.cpp', 'models', 'ggml-base.en.bin');

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
      // Updated paths for newly built whisper.cpp
      const wslPath = '/root/.gnani/whisper.cpp/build/bin/whisper-cli';
      const wslModelPath = '/root/.gnani/whisper.cpp/models/ggml-base.en.bin';

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

    // Log buffer size to debug empty audio
    this.logger.info('Whisper.cpp transcribe called', {
      sessionId,
      audioBufferSize: audioBuffer.length,
      sampleRate
    });

    if (audioBuffer.length === 0) {
      this.logger.warn('Empty audio buffer received for transcription', { sessionId });
      return '';
    }

    // Save audio to temp file (whisper.cpp requires file input)
    const tempFile = path.join(os.tmpdir(), `audio-${sessionId}-${Date.now()}.wav`);

    try {
      // Write WAV file with proper header
      this.writeWavFile(tempFile, audioBuffer, sampleRate);

      this.logger.info('WAV file created for debugging', {
        sessionId,
        tempFile,
        fileSize: audioBuffer.length,
        wavFileExists: fs.existsSync(tempFile)
      });

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
      // Keep temp file for debugging - comment out deletion
      // if (fs.existsSync(tempFile)) {
      //   fs.unlinkSync(tempFile);
      // }
      this.logger.info('Temp file kept for debugging', { tempFile });
    }
  }

  // Buffer management for streaming
  private sessionBuffers: Map<string, Buffer[]> = new Map();

  async sendAudioChunk(
    sessionId: string,
    chunk: Buffer,
    callback: (transcript: string, isFinal: boolean) => void,
    isFinal: boolean = false
  ): Promise<void> {
    // Whisper.cpp is file-based, so we accumulate chunks and transcribe on final

    // Skip partial chunks - only process final
    if (!isFinal) {
      // Accumulate the chunk for later transcription
      if (!this.sessionBuffers.has(sessionId)) {
        this.sessionBuffers.set(sessionId, []);
      }
      this.sessionBuffers.get(sessionId)!.push(chunk);
      this.logger.debug(`Whisper.cpp: Accumulated chunk for session ${sessionId}, total chunks: ${this.sessionBuffers.get(sessionId)!.length}, chunk size: ${chunk.length}`);
      return;
    }

    // Final chunk - transcribe accumulated buffer
    this.logger.info(`Whisper.cpp: Final chunk received for session ${sessionId}`);
    try {
      const buffers = this.sessionBuffers.get(sessionId) || [];
      this.logger.info(`Whisper.cpp: Accumulated ${buffers.length} buffers for session ${sessionId}`);

      const combinedBuffer = Buffer.concat(buffers);
      this.logger.info(`Whisper.cpp: Combined buffer size: ${combinedBuffer.length} bytes`);

      // Clean up session buffer
      this.sessionBuffers.delete(sessionId);

      if (combinedBuffer.length === 0) {
        this.logger.warn('Whisper.cpp: No audio data to transcribe', { sessionId });
        callback('', true);
        return;
      }

      // Transcribe using the file-based method
      this.logger.info(`Whisper.cpp: Starting transcription for session ${sessionId}`);
      const transcript = await this.transcribe(sessionId, combinedBuffer, 16000);
      this.logger.info(`Whisper.cpp: Transcription complete for session ${sessionId}: "${transcript.substring(0, 50)}..."`);

      // Call the callback with final transcript
      callback(transcript, true);

    } catch (error: any) {
      this.logger.error('Whisper.cpp sendAudioChunk failed', {
        sessionId,
        error: error.message,
        stack: error.stack
      });
      // Clean up on error
      this.sessionBuffers.delete(sessionId);
      callback('', true); // Return empty on error
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
          '-l', 'en', // English
          '-t', '4' // 4 threads
          // Removed -nt flag so we get timestamps for parsing
        ];
      } else {
        cmd = this.whisperPath;
        args = [
          '-m', this.modelPath,
          '-f', audioFile,
          '-l', 'en', // English
          '-t', '4' // 4 threads
          // Removed -nt flag so we get timestamps for parsing
        ];
      }

      // Log the command being executed
      this.logger.info('Executing whisper.cpp command', {
        cmd,
        args: args.join(' '),
        audioFile,
        useWsl: this.useWsl
      });

      const whisper = spawn(cmd, args);

      let output = '';
      let error = '';

      whisper.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        this.logger.debug('Whisper.cpp stdout:', { chunk: chunk.substring(0, 200) });
      });

      whisper.stderr.on('data', (data) => {
        const chunk = data.toString();
        error += chunk;
        this.logger.warn('Whisper.cpp stderr:', { chunk });
      });

      whisper.on('close', (code) => {
        this.logger.info('Whisper.cpp process closed', {
          code,
          outputLength: output.length,
          errorLength: error.length,
          hasOutput: output.length > 0,
          hasError: error.length > 0
        });

        if (code === 0) {
          const transcript = this.parseOutput(output);
          this.logger.info('Whisper.cpp transcription result', {
            transcriptLength: transcript.length,
            transcript: transcript.substring(0, 100)
          });
          resolve(transcript);
        } else {
          const errorMsg = `Whisper.cpp failed with code ${code}. Stderr: ${error || '(empty)'}. Stdout: ${output.substring(0, 500)}`;
          this.logger.error('Whisper.cpp execution failed', {
            code,
            stderr: error,
            stdout: output.substring(0, 500)
          });
          reject(new Error(errorMsg));
        }
      });

      whisper.on('error', (err) => {
        this.logger.error('Failed to spawn whisper.cpp process', {
          error: err.message,
          cmd,
          args
        });
        reject(new Error(`Failed to spawn whisper.cpp: ${err.message}`));
      });
    });
  }

  private parseOutput(output: string): string {
    // Whisper.cpp output format:
    // [00:00:00.000 --> 00:00:02.000]   Transcript text here

    this.logger.debug('Parsing whisper.cpp output', {
      outputLength: output.length,
      firstLines: output.split('\n').slice(0, 10).join('\\n')
    });

    const lines = output.split('\n');
    const transcriptLines: string[] = [];

    for (const line of lines) {
      // Look for lines with timestamps - more flexible regex
      const match = line.match(/\[[\d:.]+\s*-->\s*[\d:.]+\]\s*(.+)/);
      if (match && match[1]) {
        const text = match[1].trim();
        if (text.length > 0) {
          transcriptLines.push(text);
          this.logger.debug('Found transcript line', { text });
        }
      }
    }

    const result = transcriptLines.join(' ').trim();
    this.logger.info('Parsed transcript result', {
      lineCount: transcriptLines.length,
      resultLength: result.length,
      result: result.substring(0, 200)
    });

    return result;
  }

  isReady(): boolean {
    return this.isAvailable;
  }

  cleanup(sessionId: string): void {
    // Cleanup any session-specific resources
    this.sessionBuffers.delete(sessionId);
    this.logger.debug(`Whisper.cpp cleaned up session: ${sessionId}`);
  }
}

export default new WhisperCppService();
