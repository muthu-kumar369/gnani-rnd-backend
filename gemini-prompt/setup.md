You are my Senior GNANI Backend Engineer.

Goal: Generate a **comprehensive setup script** for GNANI backend (Node.js + Express) that prepares the environment for all 11 stages. This setup should install dependencies, configure databases, vector DB, Python Whisper/TTS environment, and prepare a **modern, scalable backend folder structure** starting from the current directory.

Requirements:

1. **System Packages**

- Install/update essential system packages:
  - build-essential, git, curl, wget, unzip, ffmpeg
  - Python3 and pip
  - Node.js (latest stable) and npm
  - MongoDB (latest stable)
  - Vector DB (Chroma / Weaviate / Milvus)
- Configure system PATH and environment variables as needed

2. **Python Environment**

- Create a Python virtual environment for Whisper and TTS
- Install necessary Python packages:
  - `openai-whisper` (medium model)
  - `numpy`, `scipy`
  - `torch` (CPU/GPU version)
  - Dependencies for open-source TTS (Coqui TTS, Mozilla TTS)
- Ensure Python scripts can be called from Node.js via `child_process` or `spawn`

3. **Node.js Environment**

- Initialize Node.js backend in current directory
- Install packages:
  - express, mongoose, dotenv
  - gRPC libraries
  - Vector DB client SDKs
  - Logging packages (winston, pino)
  - Other backend dependencies from previous stages
- Configure `.env` template with placeholders for:
  - MongoDB (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
  - Vector DB (VECTOR_DB_HOST, VECTOR_DB_PORT, COLLECTION_NAME, API_KEY)
  - Whisper/TTS settings (MODEL_PATH, VOICE, LANGUAGE, SAMPLE_RATE)

4. **Backend Folder Structure (Advanced MVC)**

- Current directory (`/`) contains:
  - `index.js` → main entry point, bootstraps Express server
  - `.env` → environment variables
  - `package.json` → Node.js project file
- `/src/` contains:
  - `controllers/` → request handlers for API/gRPC
  - `services/` → business logic, memory handling, LLM integration
  - `models/` → Mongoose schemas (User, Session, Settings)
  - `routes/` → Express routes or gRPC route handlers
  - `middlewares/` → authentication, validation, error handling
  - `utils/` → helper functions
  - `configs/` → database, vector DB, Whisper/TTS, general configs
  - `logs/` → centralized logs (Stage 11)
  - `scripts/` → setup, test, verification, and maintenance scripts
- Optional: `/tests/` for unit/integration tests

5. **MongoDB Setup**

- Verify MongoDB installation
- Provide script to initialize GNANI database
- Placeholder commands for User, Session, and Settings collections (Stage 2 & 10a)
- Ensure Mongoose creates schemas automatically

6. **Vector DB Setup**

- Install and configure vector DB (Chroma / Weaviate / Milvus)
- Include script to create initial embedding collection
- Environment variables for DB access
- Functional integration handled in Stage 10b

7. **Verification**

- Script should verify:
  - MongoDB connection
  - Vector DB connection
  - Python packages (Whisper/TTS)
  - Node.js dependencies
  - Sample Whisper/TTS audio test
- Ensure logs are created in `/src/logs`

8. **Cross-Stage Readiness**

- After setup, backend should be ready for all 11 stages:
  - Stage 1 → Express server and API routing
  - Stage 2 → MongoDB user schema
  - Stage 4 → Whisper STT
  - Stage 5 → VAD, audio streaming
  - Stage 6 → Context Engine
  - Stage 7 → LLM
  - Stage 8 → System Executor
  - Stage 9 → TTS Engine
  - Stage 10a/b → Settings + Vector DB integration
  - Stage 11 → Logging & observability
- Multi-user and multi-session ready
- Idempotent: can run multiple times safely

9. **Comments & Instructions**

- Include detailed comments in setup scripts
- Modularize setup:
  - `setup_node.sh` → Node.js modules and folder structure
  - `setup_python.sh` → Python virtual environment + Whisper/TTS
  - `setup_db.sh` → MongoDB and Vector DB
- Include instructions for running scripts
- Ensure setup follows **modern, scalable, enterprise-grade backend structure**

Instructions for Gemini:

- Generate a **comprehensive setup script** that installs all dependencies, prepares Python and Node.js environments, configures MongoDB & vector DB, and creates a **modern backend folder structure** starting from current directory
- Include verification scripts for each component
- Ensure setup prepares backend for **all 11 stages of GNANI**
- Include comments explaining purpose of each section
- Ensure idempotency and modularity
