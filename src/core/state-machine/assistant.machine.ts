// src/core/state-machine/assistant.machine.ts
// Stage 11: Assistant state machine implementation
import { EventEmitter } from 'events';
import { AssistantState, AssistantEvent, StateTransition, StateChangeEvent } from './assistant-states.js';
import { createContextualLogger } from '../logger/logger.js';

const logger = createContextualLogger({ module: 'StateMachine' });

export class AssistantStateMachine extends EventEmitter {
    private state: AssistantState = AssistantState.IDLE;
    private transitions: Map<string, StateTransition> = new Map();
    private stateHistory: Array<{ state: AssistantState; timestamp: Date }> = [];
    private readonly maxHistorySize = 100;

    constructor() {
        super();
        this.defineTransitions();
        logger.info('AssistantStateMachine initialized', { initialState: this.state });
    }

    private defineTransitions() {
        const transitions: StateTransition[] = [
            // From IDLE
            { from: AssistantState.IDLE, event: AssistantEvent.ACTIVATE, to: AssistantState.LISTENING },
            { from: AssistantState.IDLE, event: AssistantEvent.SPEECH_START, to: AssistantState.LISTENING },
            { from: AssistantState.IDLE, event: AssistantEvent.ERROR, to: AssistantState.ERROR },

            // From LISTENING
            { from: AssistantState.LISTENING, event: AssistantEvent.SPEECH_END, to: AssistantState.PROCESSING },
            { from: AssistantState.LISTENING, event: AssistantEvent.CANCEL, to: AssistantState.IDLE },
            { from: AssistantState.LISTENING, event: AssistantEvent.ERROR, to: AssistantState.ERROR },

            // From PROCESSING
            { from: AssistantState.PROCESSING, event: AssistantEvent.TRANSCRIPT_READY, to: AssistantState.THINKING },
            { from: AssistantState.PROCESSING, event: AssistantEvent.ERROR, to: AssistantState.ERROR },
            { from: AssistantState.PROCESSING, event: AssistantEvent.CANCEL, to: AssistantState.IDLE },

            // From THINKING
            { from: AssistantState.THINKING, event: AssistantEvent.CONTEXT_READY, to: AssistantState.GENERATING },
            { from: AssistantState.THINKING, event: AssistantEvent.ERROR, to: AssistantState.ERROR },
            { from: AssistantState.THINKING, event: AssistantEvent.CANCEL, to: AssistantState.IDLE },

            // From GENERATING
            { from: AssistantState.GENERATING, event: AssistantEvent.LLM_COMPLETE, to: AssistantState.SPEAKING },
            { from: AssistantState.GENERATING, event: AssistantEvent.TOOL_START, to: AssistantState.TOOL_EXECUTING },
            { from: AssistantState.GENERATING, event: AssistantEvent.CANCEL, to: AssistantState.IDLE },
            { from: AssistantState.GENERATING, event: AssistantEvent.ERROR, to: AssistantState.ERROR },

            // From TOOL_EXECUTING
            { from: AssistantState.TOOL_EXECUTING, event: AssistantEvent.TOOL_COMPLETE, to: AssistantState.GENERATING },
            { from: AssistantState.TOOL_EXECUTING, event: AssistantEvent.ERROR, to: AssistantState.ERROR },
            { from: AssistantState.TOOL_EXECUTING, event: AssistantEvent.CANCEL, to: AssistantState.IDLE },

            // From SPEAKING
            { from: AssistantState.SPEAKING, event: AssistantEvent.TTS_COMPLETE, to: AssistantState.IDLE },
            { from: AssistantState.SPEAKING, event: AssistantEvent.SPEECH_START, to: AssistantState.LISTENING }, // Barge-in
            { from: AssistantState.SPEAKING, event: AssistantEvent.CANCEL, to: AssistantState.IDLE },
            { from: AssistantState.SPEAKING, event: AssistantEvent.ERROR, to: AssistantState.ERROR },

            // From ERROR
            { from: AssistantState.ERROR, event: AssistantEvent.RESET, to: AssistantState.IDLE },
            { from: AssistantState.ERROR, event: AssistantEvent.CANCEL, to: AssistantState.IDLE }
        ];

        transitions.forEach(t => {
            const key = `${t.from}:${t.event}`;
            this.transitions.set(key, t);
        });

        logger.info(`Defined ${transitions.length} state transitions`);
    }

    /**
     * Transition to new state
     */
    async transition(event: AssistantEvent, metadata?: any): Promise<boolean> {
        const key = `${this.state}:${event}`;
        const transition = this.transitions.get(key);

        if (!transition) {
            logger.warn(`Invalid transition attempted`, {
                from: this.state,
                event,
                metadata
            });
            return false;
        }

        // Check guard condition
        if (transition.guard && !transition.guard()) {
            logger.debug(`Transition guard failed`, { from: this.state, event });
            return false;
        }

        const previousState = this.state;

        // Exit current state
        await this.onExit(previousState);

        // Update state
        this.state = transition.to;

        // Record history
        this.stateHistory.push({
            state: this.state,
            timestamp: new Date()
        });

        // Keep last N states
        if (this.stateHistory.length > this.maxHistorySize) {
            this.stateHistory.shift();
        }

        // Enter new state
        await this.onEnter(this.state);

        // Execute transition action
        if (transition.action) {
            await transition.action();
        }

        logger.info(`State transition`, {
            from: previousState,
            event,
            to: this.state,
            metadata
        });

        // Emit state change event
        const stateChangeEvent: StateChangeEvent = {
            from: previousState,
            to: this.state,
            event,
            timestamp: new Date()
        };

        this.emit('stateChange', stateChangeEvent);

        return true;
    }

    /**
     * State entry actions
     */
    private async onEnter(state: AssistantState): Promise<void> {
        logger.debug(`Entering state: ${state}`);

        // State-specific entry actions
        switch (state) {
            case AssistantState.LISTENING:
                this.emit('action:startListening');
                break;
            case AssistantState.PROCESSING:
                this.emit('action:startProcessing');
                break;
            case AssistantState.THINKING:
                this.emit('action:startThinking');
                break;
            case AssistantState.GENERATING:
                this.emit('action:startGenerating');
                break;
            case AssistantState.SPEAKING:
                this.emit('action:startSpeaking');
                break;
            case AssistantState.TOOL_EXECUTING:
                this.emit('action:startToolExecution');
                break;
            case AssistantState.ERROR:
                this.emit('action:handleError');
                break;
        }
    }

    /**
     * State exit actions
     */
    private async onExit(state: AssistantState): Promise<void> {
        logger.debug(`Exiting state: ${state}`);

        // State-specific exit actions
        switch (state) {
            case AssistantState.LISTENING:
                this.emit('action:stopListening');
                break;
            case AssistantState.GENERATING:
                this.emit('action:stopGenerating');
                break;
            case AssistantState.SPEAKING:
                this.emit('action:stopSpeaking');
                break;
            case AssistantState.TOOL_EXECUTING:
                this.emit('action:stopToolExecution');
                break;
        }
    }

    /**
     * Get current state
     */
    getState(): AssistantState {
        return this.state;
    }

    /**
     * Check if in specific state
     */
    isInState(state: AssistantState): boolean {
        return this.state === state;
    }

    /**
     * Check if can transition to event
     */
    canTransition(event: AssistantEvent): boolean {
        const key = `${this.state}:${event}`;
        return this.transitions.has(key);
    }

    /**
     * Get state history
     */
    getHistory(): Array<{ state: AssistantState; timestamp: Date }> {
        return [...this.stateHistory];
    }

    /**
     * Get available transitions from current state
     */
    getAvailableTransitions(): AssistantEvent[] {
        const available: AssistantEvent[] = [];

        this.transitions.forEach((transition, key) => {
            if (transition.from === this.state) {
                available.push(transition.event);
            }
        });

        return available;
    }

    /**
     * Reset to IDLE
     */
    async reset(): Promise<void> {
        await this.transition(AssistantEvent.RESET);
    }

    /**
     * Force state (use with caution)
     */
    forceState(state: AssistantState): void {
        logger.warn(`Force setting state to ${state}`, { previousState: this.state });
        this.state = state;
        this.emit('stateChange', {
            from: this.state,
            to: state,
            event: 'FORCE' as any,
            timestamp: new Date()
        });
    }

    /**
     * Get state machine status
     */
    getStatus() {
        return {
            currentState: this.state,
            availableTransitions: this.getAvailableTransitions(),
            historySize: this.stateHistory.length,
            recentHistory: this.stateHistory.slice(-5)
        };
    }
}

// Export singleton instance
export default new AssistantStateMachine();
