// STAGE 1: Context window management for LLM
import { encoding_for_model } from 'tiktoken';
import logger from '../../core/logger/logger.js';

interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface ContextWindow {
    messages: Message[];
    totalTokens: number;
    truncated: boolean;
}

export class ContextManager {
    private encoder: any;
    private maxTokens: number;
    private reserveTokens: number; // Reserve for response

    constructor(model: string = 'gpt-3.5-turbo', maxTokens: number = 4096) {
        try {
            this.encoder = encoding_for_model(model as any);
        } catch (error) {
            // Fallback to cl100k_base for unknown models
            logger.warn(`Unknown model ${model}, using cl100k_base encoding`);
            this.encoder = encoding_for_model('gpt-3.5-turbo' as any);
        }
        this.maxTokens = maxTokens;
        this.reserveTokens = 1000; // Reserve 1000 tokens for response
    }

    countTokens(text: string): number {
        return this.encoder.encode(text).length;
    }

    countMessagesTokens(messages: Message[]): number {
        let total = 0;
        for (const msg of messages) {
            total += this.countTokens(msg.content);
            total += 4; // Overhead per message
        }
        return total;
    }

    truncateContext(messages: Message[], systemPrompt?: string): ContextWindow {
        const maxAllowed = this.maxTokens - this.reserveTokens;
        let totalTokens = 0;
        const result: Message[] = [];

        // Always include system prompt first
        if (systemPrompt) {
            const systemMsg: Message = { role: 'system', content: systemPrompt };
            const systemTokens = this.countTokens(systemPrompt) + 4;
            result.push(systemMsg);
            totalTokens += systemTokens;
        }

        // Strategy: Keep most recent messages, summarize older ones
        const recentMessages: Message[] = [];
        const olderMessages: Message[] = [];

        // Split messages (keep last 10 as recent)
        const splitIndex = Math.max(0, messages.length - 10);
        olderMessages.push(...messages.slice(0, splitIndex));
        recentMessages.push(...messages.slice(splitIndex));

        // Count recent messages tokens
        const recentTokens = this.countMessagesTokens(recentMessages);

        // If recent messages fit, include them all
        if (totalTokens + recentTokens <= maxAllowed) {
            result.push(...recentMessages);
            totalTokens += recentTokens;

            // Try to include older messages
            for (let i = olderMessages.length - 1; i >= 0; i--) {
                const msg = olderMessages[i];
                const msgTokens = this.countTokens(msg.content) + 4;

                if (totalTokens + msgTokens <= maxAllowed) {
                    result.splice(systemPrompt ? 1 : 0, 0, msg);
                    totalTokens += msgTokens;
                } else {
                    break;
                }
            }
        } else {
            // Recent messages don't fit - truncate them
            logger.warn('Context window exceeded, truncating recent messages');

            for (let i = recentMessages.length - 1; i >= 0; i--) {
                const msg = recentMessages[i];
                const msgTokens = this.countTokens(msg.content) + 4;

                if (totalTokens + msgTokens <= maxAllowed) {
                    result.splice(systemPrompt ? 1 : 0, 0, msg);
                    totalTokens += msgTokens;
                } else {
                    break;
                }
            }
        }

        const truncated = result.length < messages.length + (systemPrompt ? 1 : 0);

        if (truncated) {
            logger.info('Context truncated', {
                original: messages.length,
                truncated: result.length - (systemPrompt ? 1 : 0),
                tokens: totalTokens
            });
        }

        return {
            messages: result,
            totalTokens,
            truncated
        };
    }

    cleanup() {
        if (this.encoder && this.encoder.free) {
            this.encoder.free();
        }
    }
}
