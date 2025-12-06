// src/config/feature-flags.ts
// Feature flags for gradual rollout of new features

export const FEATURE_FLAGS = {
  // Month-3: Whisper.cpp integration
  // Default to true - will use whisper.cpp if available, otherwise falls back to Python Whisper
  // Set to 'false' in environment to force Python Whisper
  USE_WHISPER_CPP: process.env.USE_WHISPER_CPP !== 'false',

  // Month-3: Caching
  ENABLE_LLM_CACHE: process.env.ENABLE_LLM_CACHE === 'true',
  ENABLE_TOOL_CACHE: process.env.ENABLE_TOOL_CACHE === 'true',

  // Future features
  ENABLE_MULTI_AGENT: process.env.ENABLE_MULTI_AGENT === 'true',
} as const;

export default FEATURE_FLAGS;
