You are my Senior GNANI Backend Engineer.

Stage 1 Goal: Setup the GNANI backend infrastructure on Linux (WSL) using Node.js, Express.js, and gRPC. This will serve as the foundation for the GNANI assistant pipeline.

Requirements:

1. **Project Structure**
   Create the following folder structure:

/backend
│
├── /src
│ ├── /server
│ │ ├── express_server.js # Express.js server, REST API skeleton
│ │ ├── grpc_server.js # gRPC server skeleton for audio streaming
│ │ └── routes.js # Express route definitions
│ │
│ ├── /config
│ │ ├── config.js # Load environment variables
│ │ └── logger.js # Logging utility (console + file)
│ │
│ ├── /services
│ │ ├── asr_service.js # Placeholder for Whisper integration
│ │ ├── llm_service.js # Placeholder for LLM integration
│ │ └── action_service.js # Placeholder for future system executor
│ │
│ ├── /utils
│ │ ├── helpers.js # General utility functions
│ │ └── error_handler.js # Centralized error handling
│ │
│ └── app.js # Main entry point that initializes Express + gRPC
│
├── package.json
├── .env # Environment variables
└── README.md # Setup instructions

---

2. **Express.js Server**

- Initialize Express.js server in `express_server.js`.
- Include middleware for JSON parsing, error handling, logging.
- Add placeholder REST endpoints:
  - GET /status → returns "OK"
  - POST /auth/login → placeholder
  - POST /auth/register → placeholder
  - GET /settings → placeholder
- Structure routes modularly in `routes.js`.

3. **gRPC Server**

- Initialize gRPC server in `grpc_server.js`.
- Implement placeholder service definitions:
  - `StartSession()`
  - `SendAudioStream()`
  - `EndSession()`
- Include proper error handling and session management.
- Add comments for future Whisper streaming integration.

4. **Configuration**

- Load `.env` variables via `config.js`:
  - EXPRESS_PORT
  - GRPC_PORT
  - LOG_LEVEL
  - ASR_ENGINE_PATH
  - LLM_SERVER_URL (optional)
- Ensure easy modification for future environments.

5. **Logging**

- Central logging system via `logger.js`:
  - Supports console and file output
  - Includes timestamp, level, and message
  - Logs all REST and gRPC requests

6. **Modularity**

- All future stages (ASR, Query Processor, Context Engine, Action Dispatcher, TTS) must be easily pluggable.
- Include comments indicating where each module will integrate.

7. **README.md**

- Include instructions:
  - npm install
  - npm run dev
  - Configure .env
  - Explain folder structure
  - Placeholder info for ASR & LLM

---

Instructions for Gemini:

- Generate fully working backend skeleton with Express.js + gRPC server.
- Include modular folder structure.
- Include comments for future Whisper, LLM, and system executor integration.
- Include error handling and session management.
- Do not implement Whisper or LLM yet — placeholders only.
