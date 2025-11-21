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

Stage 3 Goal: Implement the **Audio Streaming Receiver** for GNANI backend using gRPC. This module will receive real-time audio from the Electron frontend and prepare it for Whisper ASR processing.

Requirements:

1. **gRPC Server Setup**

- Implement gRPC server in `grpc_server.js` (Node.js)
- Listen on configurable GRPC_PORT from `.env`
- Include proper error handling and connection management
- Support multiple simultaneous sessions

2. **Service Definitions**
   Define gRPC service with the following methods:

- `StartSession(StartSessionRequest) → StartSessionResponse`
  - Initialize a new audio session
  - Return sessionId
- `SendAudioStream(AudioChunk) → StreamResponse`
  - Accept PCM or raw audio chunks from Electron
  - Buffer chunks for processing
  - Return ack/status for each chunk
- `EndSession(EndSessionRequest) → EndSessionResponse`
  - Close session
  - Clear buffers
  - Return success/failure

3. **Session Management**

- Maintain in-memory session map:
  - sessionId → userId
  - sessionId → audio buffer
- Handle session timeouts and cleanup
- Include logging for session start/end

4. **Audio Buffering**

- Buffer incoming audio chunks in memory
- Support partial streaming for real-time ASR
- Ensure minimal latency
- Include placeholder functions for preprocessing (resampling, normalization)

5. **Integration Points**

- Include placeholders for Whisper ASR integration in the future:
  - `processAudioChunk(chunk, sessionId)` → sends audio to Whisper
  - `finalizeSession(sessionId)` → finalize transcription

6. **Error Handling & Logging**

- Log all connection attempts, session starts/ends, and chunk receipts
- Graceful handling of broken connections
- Return meaningful gRPC error codes when failures occur

7. **Modularity**

- Separate gRPC server, session manager, and audio buffer utilities
- Include comments explaining where Whisper integration will be added

8. **Future Integration Notes**

- Once audio chunks are processed via Whisper, results will flow into:
  - Query Processor (Stage 5)
  - Context Engine (Stage 6)
  - LLM reasoning (Stage 7)
  - Action Dispatcher (Stage 8)

Instructions for Gemini:

- Generate a fully working Node.js gRPC server for audio streaming
- Include session management, buffering, and logging
- Modular and extensible for Whisper integration
- Do not integrate actual Whisper yet — placeholders only
