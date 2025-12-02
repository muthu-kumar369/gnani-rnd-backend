# Backend Analysis Report

## Executive Summary

The Gnani backend is architected as a modern, modular Node.js application using Express, gRPC, and WebSocket. It features a sophisticated context management system (Hybrid RAG), extensible tool plugin architecture, and robust observability.

However, to achieve "Advanced AI Assistant" status comparable to ChatGPT or Gemini, several critical gaps must be addressed, particularly in real-time text communication, global security, and voice synthesis integration.

## Architecture Overview

- **Core Framework**: Express.js (REST) + gRPC (Audio Streaming) + Socket.IO (Real-time).
- **Database**: MongoDB (Data) + Redis (Session/Cache) + ChromaDB (Vector Memory).
- **AI Engine**: Modular design separating ASR (Whisper), LLM (Ollama/External), and TTS.
- **Context System**: Advanced "Hybrid RAG" combining short-term, long-term, and semantic memory.

## Critical Gaps (Must Fix)

### 1. WebSocket Implementation is a Placeholder
- **Issue**: `src/websocket/assistant.socket.ts` is currently a skeleton that just echoes messages.
- **Impact**: Real-time text chat with streaming responses (like ChatGPT) is not functional via WebSocket. The gRPC stream works for audio, but text-only clients need the WebSocket path.
- **Recommendation**: Implement full `sessionManager` integration in `assistant.socket.ts` to support streaming text responses.

### 2. Global Rate Limiting Missing
- **Issue**: `rate-limit.middleware.ts` exists but is not applied globally in `server.ts`. It is likely used only on specific auth routes.
- **Impact**: The API is vulnerable to DDoS or abuse on non-auth endpoints.
- **Recommendation**: Apply a global rate limiter in `server.ts` for all `/api` routes.

### 3. TTS Service Disabled
- **Issue**: `src/modules/tts/tts.service.ts` explicitly states `// TTS disabled. Text is streamed directly.`
- **Impact**: The backend cannot generate voice responses, relying entirely on the frontend or external services.
- **Recommendation**: Enable the TTS service or implement a proper configuration switch to toggle it.

## Improvements for "Advanced AI" Status

### 1. Advanced Context & Memory
- **Status**: **Excellent**. The `memory.manager.ts` implements a sophisticated Hybrid RAG system with semantic search, recency boosting, and automatic summarization.
- **Action**: Ensure `summarizationJob` is running correctly (it is scheduled in `app.ts`).

### 2. Observability & Monitoring
- **Status**: **Good**. `src/core/monitoring/metrics.ts` implements Prometheus metrics for all key services (LLM, ASR, TTS, HTTP).
- **Action**: Verify that the `/api/status/metrics` endpoint is exposed and protected.

### 3. Tooling & Plugins
- **Status**: **Good**. The `tool.registry.ts` allows for easy extension.
- **Action**: Add more "Agentic" tools (e.g., file system access, code execution) to match Gemini's capabilities.

### 4. Error Handling
- **Status**: **Good**. Centralized `error.middleware.ts` is used.
- **Action**: Ensure all async errors are caught and passed to `next(err)` to avoid unhandled promise rejections.

## Code Quality & Standards

- **TypeScript**: Used consistently.
- **Linting**: Some unused variables and imports detected (e.g., in `assistant.socket.ts`).
- **Structure**: Clean separation of concerns (Modules vs Core).

## Implementation Roadmap

1.  **Phase 1: Real-time Text Chat**
    -   Implement `AssistantSocket` to use `SessionManager`.
    -   Enable streaming responses via WebSocket.

2.  **Phase 2: Security Hardening**
    -   Apply global rate limiting.
    -   Audit all routes for auth middleware usage.

3.  **Phase 3: Voice Output**
    -   Re-enable TTS service with a high-quality model (e.g., Coqui TTS or OpenAI TTS).

4.  **Phase 4: Advanced Tools**
    -   Implement "Code Interpreter" sandbox.
    -   Implement "Web Browsing" capability (already partially there).
