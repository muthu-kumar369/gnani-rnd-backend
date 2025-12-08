// src/shared/errors/error-types.ts

// Stage 3: Error severity levels
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

// Stage 3: Error categories
export enum ErrorCategory {
  NETWORK = 'NETWORK',
  DATABASE = 'DATABASE',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  SYSTEM = 'SYSTEM'
}

// Stage 3: Error context for debugging
export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  timestamp: Date;
  stackTrace?: string;
  additionalData?: Record<string, any>;
}

// Stage 3: Base AppError class
export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public severity: ErrorSeverity,
    public category: ErrorCategory,
    public isRetryable: boolean = false,
    public context?: ErrorContext
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      severity: this.severity,
      category: this.category,
      isRetryable: this.isRetryable,
      context: this.context
    };
  }
}

// Legacy GnaniError for backward compatibility
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

// Stage 3: Specific error classes
export class NetworkError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super('NETWORK_ERROR', message, ErrorSeverity.MEDIUM, ErrorCategory.NETWORK, true, context);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super('DATABASE_ERROR', message, ErrorSeverity.HIGH, ErrorCategory.DATABASE, true, context);
  }
}

export class LLMError extends AppError {
  constructor(message: string, isRetryable: boolean = true, context?: ErrorContext) {
    super('LLM_ERROR', message, ErrorSeverity.HIGH, ErrorCategory.EXTERNAL_SERVICE, isRetryable, context);
  }
}

export class STTError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super('STT_ERROR', message, ErrorSeverity.HIGH, ErrorCategory.EXTERNAL_SERVICE, true, context);
  }
}

export class ToolError extends AppError {
  constructor(message: string, public toolName: string, context?: ErrorContext) {
    super('TOOL_ERROR', message, ErrorSeverity.MEDIUM, ErrorCategory.EXTERNAL_SERVICE, true, context);
  }
}

export class SessionError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super('SESSION_ERROR', message, ErrorSeverity.MEDIUM, ErrorCategory.BUSINESS_LOGIC, false, context);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super('VALIDATION_ERROR', message, ErrorSeverity.LOW, ErrorCategory.VALIDATION, false, context);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super('AUTH_ERROR', message, ErrorSeverity.MEDIUM, ErrorCategory.AUTHENTICATION, false, context);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super('AUTHZ_ERROR', message, ErrorSeverity.MEDIUM, ErrorCategory.AUTHORIZATION, false, context);
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string, isRetryable: boolean = true, context?: ErrorContext) {
    super('EXTERNAL_SERVICE_ERROR', message, ErrorSeverity.HIGH, ErrorCategory.EXTERNAL_SERVICE, isRetryable, context);
  }
}

export class SystemError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super('SYSTEM_ERROR', message, ErrorSeverity.CRITICAL, ErrorCategory.SYSTEM, false, context);
  }
}
