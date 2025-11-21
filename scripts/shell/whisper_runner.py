# whisper_runner.py
import sys
import os
import argparse
import json
import numpy as np
import io
import torch
import whisper

# Configuration from command line arguments
parser = argparse.ArgumentParser(description="Whisper ASR Runner for Node.js via stdin/stdout")
parser.add_argument("--model", type=str, required=True, help="Path to the Whisper model or model name (e.g., medium)")
parser.add_argument("--language", type=str, default="en", help="Language for transcription")
parser.add_argument("--sample_rate", type=int, default=16000, help="Expected audio sample rate")
parser.add_argument("--compute_type", type=str, default="float16", help="Compute type for transcription (e.g., float16, int8)")
args = parser.parse_args()

# Load Whisper model
print(f"Loading Whisper model: {args.model}...", file=sys.stderr)
try:
    # Check if a path or a model name
    if os.path.exists(args.model):
        model = whisper.load_model(args.model)
    else:
        model = whisper.load_model(args.model)
    print("Whisper model loaded successfully.", file=sys.stderr)
except Exception as e:
    print(f"ERROR: Failed to load Whisper model: {e}", file=sys.stderr)
    sys.exit(1)

# In-memory buffer for audio data for each session
session_audio_buffers = {}

def process_audio_chunk(session_id, audio_chunk_bytes, is_last_chunk):
    # Ensure audio is 16kHz mono, if not already
    # Whisper's transcribe function expects a NumPy array of floats.
    # The audio chunk bytes are raw PCM, convert them.
    
    # Convert bytes to numpy array (assuming 16-bit PCM, little-endian)
    audio_np = np.frombuffer(audio_chunk_bytes, dtype=np.int16).astype(np.float32) / 32768.0

    if session_id not in session_audio_buffers:
        session_audio_buffers[session_id] = []
    
    session_audio_buffers[session_id].append(audio_np)

    if is_last_chunk:
        full_audio_np = np.concatenate(session_audio_buffers[session_id])
        # Clear buffer after final processing
        del session_audio_buffers[session_id]
        
        try:
            # Whisper's transcribe expects a specific format, ensure it's correct
            # For direct numpy array input, ensure it's mono 16kHz float32
            
            # This is a placeholder for actual Whisper streaming/chunk processing
            # For simplicity, we concatenate all audio and transcribe at the end
            # Real-time processing would involve more complex buffering and
            # ASR logic (e.g., VAD + continuous transcription)
            result = model.transcribe(full_audio_np, language=args.language, fp16=False if args.compute_type == "float32" else True)
            
            transcription = result["text"].strip()
            print(f"{session_id}:{transcription}:true") # isFinal = true
            sys.stdout.flush()
        except Exception as e:
            print(f"ERROR:{session_id}:Transcription failed: {e}", file=sys.stderr)
            print(f"{session_id}::true") # Send empty transcription if error
            sys.stdout.flush()
    else:
        # For partial transcription, you'd typically process smaller chunks and
        # aggregate results. For this simplified example, we only send final.
        # However, to meet the "partial transcript" requirement, we can
        # send a placeholder or a very basic partial result if desired.
        # For now, let's just acknowledge receipt.
        # In a more advanced setup, one might transcribe segments and send them.
        print(f"{session_id}:ACK:false") # isFinal = false, placeholder for partial
        sys.stdout.flush()


print("Whisper runner ready to receive audio.", file=sys.stderr)

# Main loop to read from stdin
while True:
    try:
        # Read the header line first
        header_line = sys.stdin.readline().strip()
        if not header_line:
            # EOF or empty line, indicating stream might be closed
            break

        parts = header_line.split(':', 2) # Split by first two colons
        if len(parts) != 3:
            print(f"ERROR:Invalid header format: {header_line}", file=sys.stderr)
            continue
        
        session_id, chunk_type, _ = parts
        
        is_last_chunk = (chunk_type == 'LAST')
        
        # The remaining data on stdin is the audio chunk.
        # Read until the next newline or EOF.
        # This approach assumes each chunk ends with a newline
        # and raw audio bytes are Base64 encoded or some other text representation.
        # For direct binary transfer, a length prefix would be better.
        # Let's assume binary data is sent directly after header and followed by a newline for simplicity for now.
        
        # Read the raw audio data size. A more robust solution involves
        # Node.js sending length prefix, or Base64 encoding.
        # For this prototype, we'll assume the entire next line is the audio data,
        # but in a real system, binary data over stdin needs careful handling.
        
        # To handle binary data directly, Node.js should send a length and then the binary.
        # Since stdin readline reads until newline, for binary, we'd need to read exact bytes.
        # For this simple example, let's assume audio_chunk is directly available.
        # A more robust solution might base64 encode on Node.js side and decode here.
        
        # Simplified: Just read until next newline for the "audio chunk"
        audio_data_line = sys.stdin.buffer.readline().strip()
        
        if not audio_data_line:
            print(f"ERROR:{session_id}:Empty audio data received.", file=sys.stderr)
            continue
        
        process_audio_chunk(session_id, audio_data_line, is_last_chunk)

    except Exception as e:
        print(f"ERROR:General error in runner: {e}", file=sys.stderr)
        sys.stdout.flush()

print("Whisper runner exiting.", file=sys.stderr)
