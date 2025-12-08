// src/core/state-machine/assistant-states.ts
// Stage 11: Assistant state machine definitions

export enum AssistantState {
    IDLE = 'IDLE',
    LISTENING = 'LISTENING',
    PROCESSING = 'PROCESSING',
    THINKING = 'THINKING',
    GENERATING = 'GENERATING',
    SPEAKING = 'SPEAKING',
    TOOL_EXECUTING = 'TOOL_EXECUTING',
    ERROR = 'ERROR'
}

export enum AssistantEvent {
    ACTIVATE = 'ACTIVATE',
    SPEECH_START = 'SPEECH_START',
    SPEECH_END = 'SPEECH_END',
    TRANSCRIPT_READY = 'TRANSCRIPT_READY',
    CONTEXT_READY = 'CONTEXT_READY',
    LLM_START = 'LLM_START',
    LLM_COMPLETE = 'LLM_COMPLETE',
    TTS_START = 'TTS_START',
    TTS_COMPLETE = 'TTS_COMPLETE',
    TOOL_START = 'TOOL_START',
    TOOL_COMPLETE = 'TOOL_COMPLETE',
    ERROR = 'ERROR',
    CANCEL = 'CANCEL',
    RESET = 'RESET'
}

export interface StateTransition {
    from: AssistantState;
    event: AssistantEvent;
    to: AssistantState;
    guard?: () => boolean;
    action?: () => void | Promise<void>;
}

export interface StateChangeEvent {
    from: AssistantState;
    to: AssistantState;
    event: AssistantEvent;
    timestamp: Date;
}
