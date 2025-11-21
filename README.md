# GNANI Backend

This repository contains the backend infrastructure for the GNANI assistant, built with Node.js, Express.js, and gRPC.

## Project Structure

```
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
│ ├── /proto
│ │ └── gnani.proto # Protocol Buffer definitions for gRPC
│ │
│ └── app.js # Main entry point that initializes Express + gRPC
│
├── package.json
├── .env # Environment variables
└── README.md # This file
```

## Setup Instructions

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in the `backend/` directory based on the provided `.env` example.
    ```
    EXPRESS_PORT=3000
    GRPC_PORT=50051
    LOG_LEVEL=info
    ASR_ENGINE_PATH=./whisper_engine # Path to your Whisper ASR engine (placeholder)
    LLM_SERVER_URL=http://localhost:8080 # URL for your LLM server (optional, placeholder)
    ```

4.  **Run the Application:**
    ```bash
    npm start
    # or for development
    npm run dev
    ```

## Functionality Overview

*   **Express.js Server:** Provides RESTful APIs for status, authentication, and settings.
*   **gRPC Server:** Handles real-time audio streaming for ASR (Automatic Speech Recognition) and integrates with LLM (Large Language Model) and action services.
*   **Configuration:** Manages environment variables for flexible deployment.
*   **Logging:** Centralized logging system for monitoring and debugging.

## Future Integrations (Placeholders)

*   **ASR Service (`asr_service.js`):** Will integrate with Whisper or similar ASR engines for transcribing audio streams.
*   **LLM Service (`llm_service.js`):** Will connect to an LLM server for natural language understanding and generation.
*   **Action Service (`action_service.js`):** Will be responsible for executing system actions based on LLM outputs.
