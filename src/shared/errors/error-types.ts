// src/shared/errors/error-types.ts
export class GnaniError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class LLMError extends GnaniError {
  constructor(message: string, public provider: string) {
    super(message, 'LLM_ERROR', 503, true);
  }
}

export class STTError extends GnaniError {
  constructor(message: string) {
    super(message, 'STT_ERROR', 503, true);
  }
}

export class ToolError extends GnaniError {
  constructor(message: string, public toolName: string) {
    super(message, 'TOOL_ERROR', 500, true);
  }
}

export class SessionError extends GnaniError {
  constructor(message: string) {
    super(message, 'SESSION_ERROR', 404, true);
  }
}

export class ValidationError extends GnaniError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400, true);
  }
}
