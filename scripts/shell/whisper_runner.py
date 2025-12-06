import sys
import struct
import torch
import numpy as np
import whisper
import argparse
import io
import os

# Increase recursion depth just in case
sys.setrecursionlimit(2000)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', type=str, default='base', help='Model to use')
    parser.add_argument('--language', type=str, default='en', help='Language')
    parser.add_argument('--sample_rate', type=int, default=16000, help='Sample rate')
    parser.add_argument('--compute_type', type=str, default='float16', help='Compute type')
    args = parser.parse_args()

    # --- GPU/CPU Fallback Logic ---
    # Check if CUDA is available
    use_gpu = torch.cuda.is_available()
    device = "cuda" if use_gpu else "cpu"
    
    # Adjust compute type based on device
    # float16 is often not supported or slower on CPU
    compute_type = args.compute_type
    if device == "cpu":
        compute_type = "int8" 
        
    print(f"ERROR:Initializing Whisper with device={device}, compute_type={compute_type}, model={args.model}", file=sys.stderr)
    sys.stderr.flush()

    try:
        # Load model
        # 'turbo' is a valid model name in newer whisper versions, or maps to large-v3-turbo
        # If loading fails, we might need to fallback to 'medium' or 'base'
        model = whisper.load_model(args.model, device=device)
    except Exception as e:
        print(f"ERROR:Failed to load model '{args.model}': {e}", file=sys.stderr)
        sys.exit(1)

    print("ERROR:Whisper model loaded successfully", file=sys.stderr)
    sys.stderr.flush()

    # Buffer to hold audio for sessions
    # Map<sessionId, numpy_array>
    session_buffers = {}

    # Use standard input buffer for binary reading
    stdin = sys.stdin.buffer

    while True:
        try:
            # 1. Read Header Length (4 bytes)
            header_len_bytes = stdin.read(4)
            if not header_len_bytes:
                break # EOF
            
            header_len = struct.unpack('>I', header_len_bytes)[0]

            # 2. Read Header
            header_bytes = stdin.read(header_len)
            header_str = header_bytes.decode('utf-8')
            
            # Header format: sessionId:CHUNK_TYPE:_
            parts = header_str.split(':')
            if len(parts) < 2:
                print(f"ERROR:Invalid header: {header_str}", file=sys.stderr)
                continue
                
            session_id = parts[0]
            chunk_type = parts[1] # CHUNK or LAST

            # 3. Read Audio Length (4 bytes)
            audio_len_bytes = stdin.read(4)
            audio_len = struct.unpack('>I', audio_len_bytes)[0]

            # 4. Read Audio Data
            audio_bytes = stdin.read(audio_len)
            
            # Convert audio bytes to numpy array (float32)
            # Assuming 16-bit PCM input (2 bytes per sample) from Node.js
            # We use int16 then normalize to float32 between -1.0 and 1.0
            audio_np = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0

            # Append to session buffer
            if session_id not in session_buffers:
                session_buffers[session_id] = np.array([], dtype=np.float32)
            
            session_buffers[session_id] = np.concatenate((session_buffers[session_id], audio_np))

            # Logic:
            # Only transcribe when we receive the LAST chunk (final)
            # This prevents partial transcripts and reduces processing overhead
            
            is_final = (chunk_type == 'LAST')
            
            # Only process final chunks
            if is_final:
                
                # Run transcription
                # fp16=False if CPU to avoid warnings/errors
                result = model.transcribe(
                    session_buffers[session_id], 
                    language=args.language,
                    fp16=(device == "cuda"),
                    condition_on_previous_text=False, # Prevent hallucination loops
                    no_speech_threshold=0.6,
                    logprob_threshold=-1.0 
                )
                
                text = result['text'].strip()
                
                # Output format expected by WhisperService.ts: 
                # sessionId:transcript:isFinal
                # Note: We print to stdout
                print(f"{session_id}:{text}:{str(is_final).lower()}")
                sys.stdout.flush()

                # Clear buffer after final transcription
                if session_id in session_buffers:
                    del session_buffers[session_id]

        except Exception as e:
            print(f"ERROR:Processing loop error: {e}", file=sys.stderr)
            sys.stderr.flush()

if __name__ == "__main__":
    main()
