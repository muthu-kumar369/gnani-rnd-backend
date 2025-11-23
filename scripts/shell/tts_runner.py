# tts_runner.py
import sys
import os
import argparse
import json
import soundfile as sf
import io
import numpy as np
from TTS.api import TTS

# Configuration from command line arguments
parser = argparse.ArgumentParser(description="TTS Runner for Node.js via stdin/stdout")
parser.add_argument("--engine", type=str, default="coqui", help="TTS engine to use (e.g., coqui-tts)")
parser.add_argument("--voice", type=str, default="tts_models/en/ljspeech/vits", help="Specific voice to use")
parser.add_argument("--language", type=str, default="en", help="Language for TTS")
parser.add_argument("--sample_rate", type=int, default=22050, help="Output audio sample rate")
parser.add_argument("--chunk_size", type=int, default=1024, help="Size of audio chunks in bytes")

args = parser.parse_args()

# Initialize TTS model
print(f"Initializing TTS engine: {args.engine} with voice: {args.voice}...", file=sys.stdout)
try:
    if args.engine == "coqui":
        tts_model = TTS(model_name=args.voice, progress_bar=False, gpu=False)
        print("Coqui TTS model loaded successfully.", file=sys.stdout)
    else:
        print(f"ERROR: TTS engine '{args.engine}' is not supported.", file=sys.stderr)
        sys.exit(1)
except Exception as e:
    print(f"ERROR: Failed to initialize TTS engine: {e}", file=sys.stderr)
    sys.exit(1)

# Main loop to read from stdin
while True:
    try:
        line = sys.stdin.readline().strip()
        if not line:
            break

        if line.startswith('TEXT:'):
            parts = line[5:].split(':', 1)
            if len(parts) == 2:
                session_id, text_to_synthesize = parts
                print(f"Received text for session {session_id}: {text_to_synthesize}", file=sys.stdout)

                # Synthesize audio to a buffer
                synthesis_kwargs = {"text": text_to_synthesize}
                # Check if the model has speakers defined and pass the first one if so
                if hasattr(tts_model, 'speakers') and tts_model.speakers:
                    synthesis_kwargs["speaker"] = tts_model.speakers[0]
                
                # For single-language models like 'en/ljspeech/vits', do not pass 'language'
                # If a multi-lingual model is used in the future, this logic might need adjustment
                
                wav_bytes = tts_model.tts(**synthesis_kwargs)
                
                # Create a BytesIO object and write the WAV data
                buffer = io.BytesIO()
                sf.write(buffer, np.array(wav_bytes), tts_model.synthesizer.output_sample_rate, format='RAW', subtype='PCM_16')
                buffer.seek(0)
                
                # Stream the audio in chunks
                while True:
                    chunk = buffer.read(args.chunk_size)
                    if not chunk:
                        break
                    audio_base64 = base64.b64encode(chunk).decode('utf-8')
                    print(f"AUDIO:{session_id}:{audio_base64}")
                    sys.stdout.flush()
                
                print(f"END:{session_id}")
                sys.stdout.flush()
            else:
                print(f"ERROR:Invalid text command format: {line}", file=sys.stderr)
        else:
            print(f"ERROR:Unknown command: {line}", file=sys.stderr)

    except Exception as e:
        print(f"ERROR:General error in TTS runner: {e}", file=sys.stderr)
        sys.stdout.flush()
while True:
    try:
        line = sys.stdin.readline().strip()
        if not line:
            break

        if line.startswith('TEXT:'):
            parts = line[5:].split(':', 1)
            if len(parts) == 2:
                session_id, text_to_synthesize = parts
                print(f"Received text for session {session_id}: {text_to_synthesize}", file=sys.stdout)

                # Synthesize audio to a buffer
                synthesis_kwargs = {"text": text_to_synthesize}
                # Check if the model has speakers defined and pass the first one if so
                if hasattr(tts_model, 'speakers') and tts_model.speakers:
                    synthesis_kwargs["speaker"] = tts_model.speakers[0]
                
                # For single-language models like 'en/ljspeech/vits', do not pass 'language'
                # If a multi-lingual model is used in the future, this logic might need adjustment
                
                wav_bytes = tts_model.tts(**synthesis_kwargs)
                
                # Create a BytesIO object and write the WAV data
                buffer = io.BytesIO()
                sf.write(buffer, np.array(wav_bytes), tts_model.synthesizer.output_sample_rate, format='RAW', subtype='PCM_16')
                buffer.seek(0)
                
                # Stream the audio in chunks
                while True:
                    chunk = buffer.read(args.chunk_size)
                    if not chunk:
                        break
                    audio_base64 = base64.b64encode(chunk).decode('utf-8')
                    print(f"AUDIO:{session_id}:{audio_base64}")
                    sys.stdout.flush()
                
                print(f"END:{session_id}")
                sys.stdout.flush()
            else:
                print(f"ERROR:Invalid text command format: {line}", file=sys.stderr)
        else:
            print(f"ERROR:Unknown command: {line}", file=sys.stderr)

    except Exception as e:
        print(f"ERROR:General error in TTS runner: {e}", file=sys.stderr)
        sys.stdout.flush()

print("TTS runner exiting.", file=sys.stderr)