// src/core/prompts/prompt-selector.ts
// Stage 13: Intent-based prompt selection
import { Intent } from '../nlp/intent-classifier.js';

export class PromptSelector {
    private prompts: Map<Intent, string> = new Map();

    constructor() {
        this.initializePrompts();
    }

    private initializePrompts() {
        this.prompts.set(
            Intent.QUESTION_ANSWERING,
            `You are a knowledgeable assistant focused on providing accurate, concise answers to questions. Cite sources when possible and explain complex concepts clearly.`
        );

        this.prompts.set(
            Intent.TASK_EXECUTION,
            `You are a task-oriented assistant. Break down complex tasks into clear steps and execute them systematically. Use available tools when appropriate and confirm actions with the user.`
        );

        this.prompts.set(
            Intent.CODE_ASSISTANCE,
            `You are a coding assistant. Provide clear, well-commented code examples. Explain your reasoning, suggest best practices, and help debug issues effectively.`
        );

        this.prompts.set(
            Intent.SYSTEM_CONTROL,
            `You are a system control assistant. Execute system commands safely and confirm potentially destructive actions with the user. Provide clear feedback on system operations.`
        );

        this.prompts.set(
            Intent.CREATIVE_WRITING,
            `You are a creative writing assistant. Be imaginative, descriptive, and engaging in your responses. Help users craft compelling narratives and creative content.`
        );

        this.prompts.set(
            Intent.INFORMATION_RETRIEVAL,
            `You are an information retrieval assistant. Help users find relevant information efficiently. Use search tools and databases when available, and present findings clearly.`
        );

        this.prompts.set(
            Intent.GENERAL_CONVERSATION,
            `You are a friendly, helpful AI assistant. Engage in natural conversation and assist with various tasks. Be conversational, empathetic, and helpful.`
        );

        this.prompts.set(
            Intent.UNKNOWN,
            `You are a helpful AI assistant. Try to understand the user's intent and provide the best assistance possible.`
        );
    }

    /**
     * Get prompt for specific intent
     */
    getPrompt(intent: Intent): string {
        return this.prompts.get(intent) || this.prompts.get(Intent.GENERAL_CONVERSATION)!;
    }

    /**
     * Get combined system prompt with intent-specific guidance
     */
    getSystemPrompt(intent: Intent, basePrompt: string): string {
        const intentPrompt = this.getPrompt(intent);
        return `${basePrompt}\n\n${intentPrompt}`;
    }

    /**
     * Update prompt for specific intent
     */
    setPrompt(intent: Intent, prompt: string): void {
        this.prompts.set(intent, prompt);
    }

    /**
     * Get all prompts
     */
    getAllPrompts(): Map<Intent, string> {
        return new Map(this.prompts);
    }
}

export default new PromptSelector();
