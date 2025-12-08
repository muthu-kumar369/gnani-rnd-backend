// src/core/nlp/intent-classifier.ts
// Stage 13: Intent classification for better routing
import { createContextualLogger } from '../logger/logger.js';
import { Logger } from 'winston';

export enum Intent {
    GENERAL_CONVERSATION = 'GENERAL_CONVERSATION',
    QUESTION_ANSWERING = 'QUESTION_ANSWERING',
    TASK_EXECUTION = 'TASK_EXECUTION',
    INFORMATION_RETRIEVAL = 'INFORMATION_RETRIEVAL',
    CREATIVE_WRITING = 'CREATIVE_WRITING',
    CODE_ASSISTANCE = 'CODE_ASSISTANCE',
    SYSTEM_CONTROL = 'SYSTEM_CONTROL',
    UNKNOWN = 'UNKNOWN'
}

export interface IntentClassification {
    intent: Intent;
    confidence: number;
    subIntent?: string;
    entities?: Record<string, any>;
}

export class IntentClassifier {
    private logger: Logger;

    constructor() {
        this.logger = createContextualLogger({ module: 'IntentClassifier' });
    }

    /**
     * Classify user intent from text
     */
    async classify(text: string, context?: any): Promise<IntentClassification> {
        const lowerText = text.toLowerCase().trim();

        // Question patterns
        if (this.isQuestion(lowerText)) {
            return {
                intent: Intent.QUESTION_ANSWERING,
                confidence: 0.9,
                entities: this.extractQuestionEntities(lowerText)
            };
        }

        // Task execution patterns
        if (this.isTaskRequest(lowerText)) {
            return {
                intent: Intent.TASK_EXECUTION,
                confidence: 0.85,
                entities: this.extractTaskEntities(lowerText)
            };
        }

        // Code assistance patterns
        if (this.isCodeRelated(lowerText)) {
            return {
                intent: Intent.CODE_ASSISTANCE,
                confidence: 0.8,
                subIntent: this.getCodeSubIntent(lowerText)
            };
        }

        // System control patterns
        if (this.isSystemControl(lowerText)) {
            return {
                intent: Intent.SYSTEM_CONTROL,
                confidence: 0.9,
                entities: this.extractSystemEntities(lowerText)
            };
        }

        // Creative writing patterns
        if (this.isCreativeRequest(lowerText)) {
            return {
                intent: Intent.CREATIVE_WRITING,
                confidence: 0.75
            };
        }

        // Information retrieval patterns
        if (this.isInformationRetrieval(lowerText)) {
            return {
                intent: Intent.INFORMATION_RETRIEVAL,
                confidence: 0.8
            };
        }

        // Default to general conversation
        return {
            intent: Intent.GENERAL_CONVERSATION,
            confidence: 0.6
        };
    }

    private isQuestion(text: string): boolean {
        const questionWords = ['what', 'when', 'where', 'who', 'why', 'how', 'which', 'can you', 'could you', 'would you', 'is there', 'are there'];
        const startsWithQuestion = questionWords.some(word => text.startsWith(word));
        const hasQuestionMark = text.includes('?');
        return startsWithQuestion || hasQuestionMark;
    }

    private isTaskRequest(text: string): boolean {
        const taskVerbs = ['create', 'make', 'build', 'generate', 'write', 'send', 'open', 'close', 'start', 'stop', 'run', 'execute', 'launch', 'install', 'delete', 'remove'];
        return taskVerbs.some(verb => text.includes(` ${verb} `) || text.startsWith(verb));
    }

    private isCodeRelated(text: string): boolean {
        const codeKeywords = ['code', 'function', 'class', 'variable', 'bug', 'error', 'debug', 'refactor', 'implement', 'algorithm', 'programming', 'script', 'syntax'];
        return codeKeywords.some(keyword => text.includes(keyword));
    }

    private isSystemControl(text: string): boolean {
        const systemKeywords = ['open app', 'close app', 'screenshot', 'volume', 'brightness', 'wifi', 'bluetooth', 'system', 'settings'];
        return systemKeywords.some(keyword => text.includes(keyword));
    }

    private isCreativeRequest(text: string): boolean {
        const creativeKeywords = ['write a story', 'poem', 'song', 'creative', 'imagine', 'describe', 'tell me a story', 'compose'];
        return creativeKeywords.some(keyword => text.includes(keyword));
    }

    private isInformationRetrieval(text: string): boolean {
        const retrievalKeywords = ['find', 'search', 'look up', 'get information', 'tell me about', 'show me', 'lookup'];
        return retrievalKeywords.some(keyword => text.includes(keyword));
    }

    private extractQuestionEntities(text: string): Record<string, any> {
        return {
            questionType: this.getQuestionType(text)
        };
    }

    private extractTaskEntities(text: string): Record<string, any> {
        return {
            action: this.extractAction(text),
            target: this.extractTarget(text)
        };
    }

    private extractSystemEntities(text: string): Record<string, any> {
        return {
            systemAction: this.extractSystemAction(text)
        };
    }

    private getQuestionType(text: string): string {
        if (text.startsWith('what')) return 'definition';
        if (text.startsWith('how')) return 'process';
        if (text.startsWith('why')) return 'reason';
        if (text.startsWith('when')) return 'time';
        if (text.startsWith('where')) return 'location';
        if (text.startsWith('who')) return 'person';
        return 'general';
    }

    private getCodeSubIntent(text: string): string {
        if (text.includes('debug') || text.includes('error') || text.includes('bug')) return 'debugging';
        if (text.includes('refactor')) return 'refactoring';
        if (text.includes('implement') || text.includes('create')) return 'implementation';
        if (text.includes('explain') || text.includes('understand')) return 'explanation';
        return 'general';
    }

    private extractAction(text: string): string {
        const actionMatch = text.match(/\b(create|make|build|generate|write|send|open|close|start|stop|run|execute)\b/i);
        return actionMatch ? actionMatch[1].toLowerCase() : 'unknown';
    }

    private extractTarget(text: string): string {
        const words = text.split(' ');
        const actionIndex = words.findIndex(w =>
            ['create', 'make', 'build', 'generate', 'write', 'send', 'open', 'close', 'start', 'stop'].includes(w.toLowerCase())
        );
        return actionIndex >= 0 && actionIndex < words.length - 1 ? words[actionIndex + 1] : 'unknown';
    }

    private extractSystemAction(text: string): string {
        if (text.includes('screenshot')) return 'screenshot';
        if (text.includes('volume')) return 'volume';
        if (text.includes('brightness')) return 'brightness';
        if (text.includes('wifi')) return 'wifi';
        if (text.includes('bluetooth')) return 'bluetooth';
        return 'unknown';
    }
}

export default new IntentClassifier();
