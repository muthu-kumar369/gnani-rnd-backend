# whisper_runner.py
import sys
import os
import argparse
import json
import numpy as np
import io
import atexit # Import atexit

def exit_handler():
    print(f"Whisper runner exiting gracefully.", file=sys.stderr, flush=True)

atexit.register(exit_handler)

try:
    print("Whisper runner started. Python version:", sys.version, file=sys.stderr, flush=True)
    import torch

    import whisper
except Exception as e:
    print(f"ERROR:whisper_runner.py failed during initial setup/imports: {e}", file=sys.stderr, flush=True)
    sys.exit(1)

# Configuration from command line arguments
parser = argparse.ArgumentParser(description="Whisper ASR Runner for Node.js via stdin/stdout")
parser.add_argument("--model", type=str, required=True, help="Path to the Whisper model or model name (e.g., medium)")
parser.add_argument("--language", type=str, default="en", help="Language for transcription")
parser.add_argument("--sample_rate", type=int, default=16000, help="Expected audio sample rate")
parser.add_argument("--compute_type", type=str, default="float16", help="Compute type for transcription (e.g., float16, int8)")

args = parser.parse_args()

# Load Whisper model
try:
    # Check if a path or a model name
    if os.path.exists(args.model):
        model = whisper.load_model(args.model)
        print("Whisper model loaded successfully.", file=sys.stderr, flush=True)
    else:
        model = whisper.load_model(args.model)
        print("Whisper model loaded successfully.", file=sys.stderr, flush=True)
except Exception as e:
    print(f"ERROR: Failed to load Whisper model: {e}", file=sys.stderr, flush=True)
    sys.exit(1)

# In-memory buffer for audio data for each session
session_audio_buffers = {}
def process_audio_chunk(session_id, audio_chunk_bytes, is_last_chunk):
    # Ensure audio is 16kHz mono, if not already
    # Whisper's transcribe function expects a NumPy array of floats.
    # The audio chunk bytes are raw PCM, convert them.
    
    # Ensure the buffer size is a multiple of the element size (2 bytes for int16)
    if len(audio_chunk_bytes) % 2 != 0:
        audio_chunk_bytes = audio_chunk_bytes[:-1]

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
            print(f"{session_id}:{transcription}:true", flush=True) # isFinal = true
            sys.stdout.flush()
        except Exception as e:
            import traceback # Import traceback module
            print(f"ERROR:{session_id}:Transcription failed: {e}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr) # Print full traceback
            print(f"{session_id}::true", flush=True) # Send empty transcription if error
            sys.stdout.flush()
    else:
        # For partial transcription, you'd typically process smaller chunks and
        # aggregate results. For this simplified example, we only send final.
        # However, to meet the "partial transcript" requirement, we can
        # send a placeholder or a very basic partial result if desired.
        # For now, let's just acknowledge receipt.
        # In a more advanced setup, one might transcribe segments and send them.
        print(f"{session_id}:ACK:false", flush=True) # isFinal = false, placeholder for partial
        sys.stdout.flush()



# Main loop to read from stdin
while True:
    try:
        # Read the 4-byte header length
        header_len_bytes = sys.stdin.buffer.read(4)
        if not header_len_bytes:
            break # EOF
        header_length = int.from_bytes(header_len_bytes, 'big')

        # Read the header line
        header_line_bytes = sys.stdin.buffer.read(header_length)
        header_line = header_line_bytes.decode('utf-8')
                
        parts = header_line.split(':', 2) # Split by first two colons
        if len(parts) != 3:
            print(f"ERROR:Invalid header format: {header_line}", file=sys.stderr, flush=True)
            continue
        
        session_id, chunk_type, _ = parts
        is_last_chunk = (chunk_type == 'LAST')
        
        # Read the 4-byte audio data length
        audio_len_bytes = sys.stdin.buffer.read(4)
        if not audio_len_bytes:
            print(f"ERROR:{session_id}:Empty audio data length received (EOF).", file=sys.stderr, flush=True)
            break # EOF
        audio_length = int.from_bytes(audio_len_bytes, 'big')

        # Read the raw audio data
        audio_chunk_bytes = sys.stdin.buffer.read(audio_length)
        
        if audio_length > 0 and not audio_chunk_bytes:
            print(f"ERROR:{session_id}:Empty audio data received.", file=sys.stderr, flush=True)
            continue
        
        # Allow empty audio chunk if it's the LAST chunk (signal to finalize)
        if audio_length == 0 and not is_last_chunk:
             print(f"ERROR:{session_id}:Empty audio data length with no LAST flag.", file=sys.stderr, flush=True)
             continue
        
        # Debug logging
        print(f"DEBUG: Received header: {header_line.strip()}, Audio Len: {audio_length}", file=sys.stderr, flush=True)

        process_audio_chunk(session_id, audio_chunk_bytes, is_last_chunk)

    except Exception as e:
        print(f"ERROR:General error in runner: {e}", file=sys.stderr, flush=True)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.stdout.flush()

print("Whisper runner exiting.", file=sys.stderr)
