# Audio Streaming Protocol for Frontend Integration

This document outlines the audio streaming protocol expected by the GNANI backend's gRPC `SendAudioStream` endpoint. Adhering to this protocol is crucial for successful real-time audio transcription and processing from the frontend.

---

## 1. Overview

The frontend should establish a bi-directional gRPC stream with the backend's `GnaniService.SendAudioStream` endpoint. Audio data is sent in a series of chunks, with a specific binary framing protocol for each chunk.

## 2. Audio Data Format

All raw audio data sent in the `audio_chunk` field MUST conform to the following specifications:

*   **Format:** Raw Pulse-Code Modulation (PCM)
*   **Sample Rate:** 16,000 Hz (16kHz)
*   **Bit Depth:** 16-bit (signed integers)
*   **Channels:** Mono (1 channel)
*   **Endianness:** Little-endian (standard for WAV files)
    *   *Note: While Node.js `Buffer.writeUInt32BE` implies Big-Endian for length prefixes, the actual raw audio data interpretation relies on the client's source and Python's `np.frombuffer(..., dtype=np.int16)` which handles system endianness. Ensure your audio source consistently provides 16-bit PCM little-endian data after WAV header stripping.*

## 3. Communication Protocol (Binary Framing)

Each message sent over the gRPC stream's `audio_chunk` contains metadata and the raw audio data. The backend (Python `whisper_runner.py`) expects a specific binary frame structure for each incoming chunk to correctly parse the data.

The frontend (via Node.js `WhisperService`) MUST send each chunk as a concatenated sequence of binary data:

1.  **Header Length (4 bytes, Binary Integer):**
    *   A 4-byte Buffer representing an unsigned 32-bit integer (UInt32).
    *   This integer indicates the length (in bytes) of the `Header Data` that follows.
    *   **Endianness:** Big-Endian (Network Byte Order).
    *   **Node.js Example:** `Buffer.alloc(4).writeUInt32BE(headerBuffer.length, 0)`

2.  **Header Data (Variable Length, UTF-8 Encoded Bytes):**
    *   The raw bytes of the header string, encoded in UTF-8.
    *   **Structure:** `sessionId:CHUNK_TYPE:some_marker`
        *   `sessionId`: A unique string identifier for the current session.
        *   `CHUNK_TYPE`: Either `LAST` (for the final audio chunk) or `CHUNK` (for intermediate chunks).
        *   `some_marker`: A placeholder (currently `_`), can be extended for future use.
    *   **Node.js Example:** `Buffer.from(sessionId + ':' + chunkType + ':_`, 'utf-8')`

3.  **Audio Data Length (4 bytes, Binary Integer):**
    *   A 4-byte Buffer representing an unsigned 32-bit integer (UInt32).
    *   This integer indicates the length (in bytes) of the `Raw Audio Data` that follows.
    *   **Endianness:** Big-Endian (Network Byte Order).
    *   **Node.js Example:** `Buffer.alloc(4).writeUInt32BE(audioChunk.length, 0)`

4.  **Raw Audio Data (Variable Length, Raw PCM Bytes):**
    *   The raw PCM audio data, stripped of any WAV headers, conforming to the specifications in Section 2.
    *   **Node.js Example:** `audioChunk` (which is already a Buffer containing raw PCM).

### Example Transmission Sequence (Conceptual)

```
[4-byte Header Length] [Header Data (UTF-8)] [4-byte Audio Length] [Raw Audio Data (PCM)]
```

## 4. Client-side Audio Preparation (Frontend/gRPC Client)

When preparing audio on the client side (e.g., in `tests/integration/grpc_client.js`):

*   **Source:** Ensure your audio source (e.g., a WAV file) is converted to 16kHz sample rate, 16-bit depth, mono channel.
*   **Header Stripping:** If using WAV files, strip the 44-byte WAV header to obtain the raw PCM data.
*   **Chunking:** Divide the raw PCM data into appropriate `audio_chunk` sizes (e.g., 3200 bytes per chunk). The last chunk must be clearly marked.

## 5. Avoiding Common Pitfalls

*   **No Base64 Encoding:** The audio data sent over the gRPC stream should NOT be Base64 encoded. It must be raw binary data.
*   **No Newlines for Lengths/Data:** Do not append newline characters after sending the length prefixes or the data buffers. The fixed-size binary length prefixes handle framing.
*   **Consistent Sample Rate/Bit Depth:** Mismatches in sample rate, bit depth, or channels between the client's audio and the Whisper model's expectations will lead to poor or empty transcriptions.
*   **Speech Content:** Ensure the audio actually contains human speech. Whisper models are not designed to transcribe arbitrary sounds or pure tones.

---

This protocol ensures robust and efficient communication of audio streams to the backend's Whisper transcription service. Following these guidelines will help integrate frontend audio capture seamlessly.
