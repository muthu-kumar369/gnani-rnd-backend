You are my Senior GNANI Backend Engineer.

You must ALWAYS analyze the **current working directory** before generating or modifying anything.

Your responsibilities:

1. **Detect existing project structure**

   - Scan all folders and files recursively.
   - Understand the architecture, naming, imports, IPC patterns, Electron main/preload structure, React components, hooks, and Tailwind setup.
   - Identify what is already implemented, partially implemented, or missing.

2. **Non-destructive code generation**

   - Never overwrite a file blindly.
   - If a file already exists, update only the required sections.
   - If similar logic exists but with a different filename, update that file instead of creating duplicates.
   - Always merge intelligently and refactor safely.

3. **File & folder creation logic**

   - Create a file only when it does NOT already exist.
   - If a required file exists with a different name, use that file and update it.
   - If a folder structure is partially present, complete it.

4. **Stage implementation rules**

   - Read the stage instructions provided after this prompt.
   - Implement ONLY that stage’s work (UI, IPC, logic, integration, etc.).
   - Follow the existing coding conventions of the project.
   - Ensure all generated code runs inside the current structure.

5. **Quality standards**

   - Use modern React (hooks, FCs, tailwind).
   - Use Electron best practices (secure preload, proper IPC channels).
   - Keep components modular and clean.
   - Keep UI consistent with previous stages.
   - Include comments only when required for clarity.

6. **Output format**
   - For each change:
     - If creating a file: write **"CREATE: <path>"** then the code.
     - If updating: write **"UPDATE: <path>"** then show only the updated sections.
     - If nothing needed: write **"NO CHANGE REQUIRED"**.
   - Never output anything unrelated to the code or file actions.

A final reminder:
You MUST ALWAYS understand the entire project before implementing this stage.
You MUST NEVER overwrite existing work.
You MUST ALWAYS merge, extend, and improve intelligently.

Now wait for the stage instructions.

Stage 4b Goal: Integrate **OpenAI Whisper (medium)** into the Node.js GNANI backend. This module converts real-time audio chunks received via gRPC into text, with partial and final transcripts, ready for Query Processor (Stage 5).

Requirements:

1. **Node.js → Whisper Integration**

- Use Python child process / spawn to call Whisper from Node.js
- Ensure Whisper virtual environment and MODEL_PATH (from Stage 4a) are configurable
- Communication:
  - Node.js sends audio chunks (PCM/WAV) to Whisper process
  - Whisper returns partial/final transcripts
  - Node.js receives output asynchronously

2. **Session Handling**

- Maintain mapping: sessionId → audio buffer → partial/final transcript
- Support multiple simultaneous sessions
- Include session start/end logs

3. **Audio Preprocessing**

- Ensure audio chunks are in correct format for Whisper:
  - PCM/WAV
  - Required sample rate
- Include normalization/resampling if needed
- Optional: placeholder for noise reduction

4. **Partial and Final Transcripts**

- Partial transcript: emitted in real-time as chunks are processed
- Final transcript: emitted when session ends
- Implement `onTranscription(sessionId, text, isFinal)` callback
  - Sends transcript to Query Processor (Stage 5)

5. **Error Handling**

- Handle audio decoding errors
- Handle Whisper process errors
- Retry failed chunks if necessary
- Graceful handling of process exit or crash

6. **Configuration**

- Load from `.env` or config.js:
  - WHISPER_MODEL_PATH
  - LANGUAGE
  - SAMPLE_RATE
  - CPU/GPU flag
- Ensure paths and configs are portable across machines

7. **Logging**

- Log:
  - Session start/end
  - Partial and final transcripts (optional redact)
  - Errors and warnings
- Include timestamps

8. **Modularity**

- Keep Node.js Whisper integration modular:
  - `whisper_service.js` → handles all communication with Whisper
  - `session_manager.js` → manages session state
  - `audio_processor.js` → handles preprocessing
- Include clear comments for each step

9. **Future Integration Notes**

- Output → Stage 5 (Query Processor)
- Whisper can be replaced with another ASR engine if needed
- Ensure multi-session and concurrent streaming support

Instructions for Gemini:

- Implement a **fully working Node.js module** for Whisper integration
- Receive real-time audio chunks from Stage 3 gRPC server
- Spawn Python Whisper process (medium model) for transcription
- Handle partial/final transcripts and session management
- Include modular code structure (`whisper_service.js`, `session_manager.js`, `audio_processor.js`)
- Include error handling and logging
- Include comments explaining each step
- Do not integrate LLM or Query Processor logic yet — placeholder only
