You are my Senior GNANI Backend Engineer.

Stage 4a Goal: Setup **OpenAI Whisper (medium)** on a Linux system (WSL) for GNANI backend. This module ensures Whisper is installed, dependencies are satisfied, and the model is ready for real-time transcription.

Requirements:

1. **Python Environment**

- Install Python 3.10+ (if not already installed)
- Create a virtual environment for Whisper:
  - `python -m venv whisper_env`
  - Activate virtual environment
- Ensure pip is upgraded

2. **Whisper Installation**

- Install OpenAI Whisper from official repo:
  - `pip install git+https://github.com/openai/whisper.git`
- Install necessary dependencies:
  - torch (CPU or GPU version depending on system)
  - numpy, ffmpeg, or other Whisper dependencies
- Verify installation by running `whisper --help` or `python -c "import whisper"`

3. **Model Setup**

- Download **medium model** automatically if not present
- Allow configurable `MODEL_PATH` via `.env` or config file
- Ensure path is consistent across different machines

4. **FFmpeg Setup**

- Ensure `ffmpeg` is installed in system
- Verify version via `ffmpeg -version`
- Needed for audio decoding

5. **Testing**

- Provide a simple test Python script to:
  - Load the medium Whisper model
  - Accept a sample audio file (or WAV)
  - Print the transcript

6. **Cross-Machine Considerations**

- Include a setup script (`setup_whisper.sh`) that:
  - Installs Python packages
  - Downloads Whisper model
  - Verifies installation
- Document any GPU vs CPU setup options

7. **Logging & Verification**

- Log steps during setup for debugging
- Verify that Whisper model loads successfully without errors

Instructions for Gemini:

- Generate a **complete Whisper setup script** for Linux (WSL)
- Include:
  - Python virtual environment creation
  - Dependencies installation
  - Medium model download
  - FFmpeg check
  - Test script for verifying Whisper works
  - Comments explaining each step
- Ensure setup is repeatable for any developer machine
- Do not integrate Node.js yet — this is setup only
