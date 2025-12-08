import assistantStateMachine, { AssistantStateMachine } from '../../src/core/state-machine/assistant.machine.js';
import { AssistantState, AssistantEvent } from '../../src/core/state-machine/assistant-states.js';

describe('AssistantStateMachine', () => {
    let stateMachine: AssistantStateMachine;

    beforeEach(() => {
        // Create fresh instance for each test
        stateMachine = new AssistantStateMachine();
    });

    describe('Initial State', () => {
        it('should start in IDLE state', () => {
            expect(stateMachine.getState()).toBe(AssistantState.IDLE);
        });

        it('should have empty history initially', () => {
            expect(stateMachine.getHistory()).toHaveLength(0);
        });
    });

    describe('Valid Transitions', () => {
        it('should transition from IDLE to LISTENING on ACTIVATE', async () => {
            const success = await stateMachine.transition(AssistantEvent.ACTIVATE);

            expect(success).toBe(true);
            expect(stateMachine.getState()).toBe(AssistantState.LISTENING);
        });

        it('should transition from LISTENING to PROCESSING on SPEECH_END', async () => {
            await stateMachine.transition(AssistantEvent.ACTIVATE);
            const success = await stateMachine.transition(AssistantEvent.SPEECH_END);

            expect(success).toBe(true);
            expect(stateMachine.getState()).toBe(AssistantState.PROCESSING);
        });

        it('should transition through full flow', async () => {
            // IDLE -> LISTENING
            await stateMachine.transition(AssistantEvent.ACTIVATE);
            expect(stateMachine.getState()).toBe(AssistantState.LISTENING);

            // LISTENING -> PROCESSING
            await stateMachine.transition(AssistantEvent.SPEECH_END);
            expect(stateMachine.getState()).toBe(AssistantState.PROCESSING);

            // PROCESSING -> THINKING
            await stateMachine.transition(AssistantEvent.TRANSCRIPT_READY);
            expect(stateMachine.getState()).toBe(AssistantState.THINKING);

            // THINKING -> GENERATING
            await stateMachine.transition(AssistantEvent.CONTEXT_READY);
            expect(stateMachine.getState()).toBe(AssistantState.GENERATING);

            // GENERATING -> SPEAKING
            await stateMachine.transition(AssistantEvent.LLM_COMPLETE);
            expect(stateMachine.getState()).toBe(AssistantState.SPEAKING);

            // SPEAKING -> IDLE
            await stateMachine.transition(AssistantEvent.TTS_COMPLETE);
            expect(stateMachine.getState()).toBe(AssistantState.IDLE);
        });

        it('should handle barge-in (SPEAKING -> LISTENING)', async () => {
            // Get to SPEAKING state
            await stateMachine.transition(AssistantEvent.ACTIVATE);
            await stateMachine.transition(AssistantEvent.SPEECH_END);
            await stateMachine.transition(AssistantEvent.TRANSCRIPT_READY);
            await stateMachine.transition(AssistantEvent.CONTEXT_READY);
            await stateMachine.transition(AssistantEvent.LLM_COMPLETE);

            expect(stateMachine.getState()).toBe(AssistantState.SPEAKING);

            // Barge-in
            const success = await stateMachine.transition(AssistantEvent.SPEECH_START);
            expect(success).toBe(true);
            expect(stateMachine.getState()).toBe(AssistantState.LISTENING);
        });

        it('should handle tool execution flow', async () => {
            // Get to GENERATING state
            await stateMachine.transition(AssistantEvent.ACTIVATE);
            await stateMachine.transition(AssistantEvent.SPEECH_END);
            await stateMachine.transition(AssistantEvent.TRANSCRIPT_READY);
            await stateMachine.transition(AssistantEvent.CONTEXT_READY);

            // GENERATING -> TOOL_EXECUTING
            await stateMachine.transition(AssistantEvent.TOOL_START);
            expect(stateMachine.getState()).toBe(AssistantState.TOOL_EXECUTING);

            // TOOL_EXECUTING -> GENERATING
            await stateMachine.transition(AssistantEvent.TOOL_COMPLETE);
            expect(stateMachine.getState()).toBe(AssistantState.GENERATING);
        });
    });

    describe('Invalid Transitions', () => {
        it('should reject invalid transition', async () => {
            const success = await stateMachine.transition(AssistantEvent.TTS_COMPLETE);

            expect(success).toBe(false);
            expect(stateMachine.getState()).toBe(AssistantState.IDLE);
        });

        it('should not transition from IDLE to SPEAKING', async () => {
            const success = await stateMachine.transition(AssistantEvent.TTS_START);

            expect(success).toBe(false);
            expect(stateMachine.getState()).toBe(AssistantState.IDLE);
        });
    });

    describe('Error Handling', () => {
        it('should transition to ERROR state on error event', async () => {
            await stateMachine.transition(AssistantEvent.ACTIVATE);
            await stateMachine.transition(AssistantEvent.ERROR);

            expect(stateMachine.getState()).toBe(AssistantState.ERROR);
        });

        it('should recover from ERROR state with RESET', async () => {
            await stateMachine.transition(AssistantEvent.ACTIVATE);
            await stateMachine.transition(AssistantEvent.ERROR);
            await stateMachine.transition(AssistantEvent.RESET);

            expect(stateMachine.getState()).toBe(AssistantState.IDLE);
        });
    });

    describe('State History', () => {
        it('should track state history', async () => {
            await stateMachine.transition(AssistantEvent.ACTIVATE);
            await stateMachine.transition(AssistantEvent.SPEECH_END);

            const history = stateMachine.getHistory();
            expect(history).toHaveLength(2);
            expect(history[0].state).toBe(AssistantState.LISTENING);
            expect(history[1].state).toBe(AssistantState.PROCESSING);
        });

        it('should limit history to 100 entries', async () => {
            // Transition 150 times
            for (let i = 0; i < 75; i++) {
                await stateMachine.transition(AssistantEvent.ACTIVATE);
                await stateMachine.transition(AssistantEvent.CANCEL);
            }

            const history = stateMachine.getHistory();
            expect(history.length).toBeLessThanOrEqual(100);
        });
    });

    describe('State Queries', () => {
        it('should check if in specific state', async () => {
            expect(stateMachine.isInState(AssistantState.IDLE)).toBe(true);

            await stateMachine.transition(AssistantEvent.ACTIVATE);
            expect(stateMachine.isInState(AssistantState.LISTENING)).toBe(true);
            expect(stateMachine.isInState(AssistantState.IDLE)).toBe(false);
        });

        it('should check if can transition', () => {
            expect(stateMachine.canTransition(AssistantEvent.ACTIVATE)).toBe(true);
            expect(stateMachine.canTransition(AssistantEvent.TTS_COMPLETE)).toBe(false);
        });

        it('should get available transitions', () => {
            const available = stateMachine.getAvailableTransitions();

            expect(available).toContain(AssistantEvent.ACTIVATE);
            expect(available).toContain(AssistantEvent.SPEECH_START);
            expect(available).toContain(AssistantEvent.ERROR);
        });
    });

    describe('Event Emission', () => {
        it('should emit stateChange event on transition', async () => {
            const listener = jest.fn();
            stateMachine.on('stateChange', listener);

            await stateMachine.transition(AssistantEvent.ACTIVATE);

            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({
                    from: AssistantState.IDLE,
                    to: AssistantState.LISTENING,
                    event: AssistantEvent.ACTIVATE
                })
            );
        });

        it('should emit action events on state entry', async () => {
            const listener = jest.fn();
            stateMachine.on('action:startListening', listener);

            await stateMachine.transition(AssistantEvent.ACTIVATE);

            expect(listener).toHaveBeenCalled();
        });

        it('should emit action events on state exit', async () => {
            const listener = jest.fn();
            stateMachine.on('action:stopListening', listener);

            await stateMachine.transition(AssistantEvent.ACTIVATE);
            await stateMachine.transition(AssistantEvent.SPEECH_END);

            expect(listener).toHaveBeenCalled();
        });
    });

    describe('Reset', () => {
        it('should reset to IDLE from ERROR', async () => {
            await stateMachine.transition(AssistantEvent.ACTIVATE);
            await stateMachine.transition(AssistantEvent.ERROR);
            await stateMachine.reset();

            expect(stateMachine.getState()).toBe(AssistantState.IDLE);
        });
    });

    describe('Status', () => {
        it('should get current status', async () => {
            await stateMachine.transition(AssistantEvent.ACTIVATE);

            const status = stateMachine.getStatus();

            expect(status.currentState).toBe(AssistantState.LISTENING);
            expect(status.availableTransitions).toBeDefined();
            expect(status.historySize).toBeGreaterThan(0);
            expect(status.recentHistory).toBeDefined();
        });
    });
});
