// src/modules/context/template-selector.ts
import { createContextualLogger } from '../../core/logger/logger.js';
import { Logger } from 'winston';
import templateLibrary, { PromptTemplate } from './templates/template-library.js';
import { QueryComplexity } from './query-analyzer.js';

export interface TemplateSelectionContext {
    query: string;
    intent: string;
    complexity: QueryComplexity;
    userPreference?: string;
    conversationHistory?: any[];
}

class TemplateSelector {
    private logger: Logger;

    constructor() {
        this.logger = createContextualLogger({ module: 'TemplateSelector' });
    }

    /**
     * Select appropriate template based on context
     */
    selectTemplate(context: TemplateSelectionContext): PromptTemplate {
        // Priority 1: User preference (if set)
        if (context.userPreference) {
            const preferredTemplate = templateLibrary.getTemplate(context.userPreference);
            if (preferredTemplate) {
                this.logger.debug(`Selected template by user preference: ${context.userPreference}`);
                return preferredTemplate;
            }
        }

        // Priority 2: Intent-based selection
        const templateName = this.selectByIntent(context.intent, context.query);
        const template = templateLibrary.getTemplate(templateName);

        if (template) {
            this.logger.debug(`Selected template: ${templateName} (intent: ${context.intent})`);
            return template;
        }

        // Fallback: Default conversational template
        this.logger.debug('Using default conversational template');
        return templateLibrary.getDefaultTemplate();
    }

    /**
     * Select template based on intent and query analysis
     */
    private selectByIntent(intent: string, query: string): string {
        const queryLower = query.toLowerCase();

        // Technical queries
        if (this.isTechnicalQuery(intent, queryLower)) {
            return 'technical';
        }

        // Creative queries
        if (this.isCreativeQuery(intent, queryLower)) {
            return 'creative';
        }

        // Analytical queries
        if (this.isAnalyticalQuery(intent, queryLower)) {
            return 'analytical';
        }

        // Educational queries
        if (this.isEducationalQuery(intent, queryLower)) {
            return 'educational';
        }

        // Default: Conversational
        return 'conversational';
    }

    /**
     * Detect technical queries
     */
    private isTechnicalQuery(intent: string, query: string): boolean {
        const technicalIntents = [
            'technical_question',
            'coding_help',
            'debugging',
            'api_question',
            'system_command'
        ];

        const technicalKeywords = [
            'code', 'function', 'algorithm', 'debug', 'error', 'bug',
            'api', 'database', 'server', 'deploy', 'implement',
            'architecture', 'framework', 'library', 'package'
        ];

        return technicalIntents.includes(intent) ||
            technicalKeywords.some(keyword => query.includes(keyword));
    }

    /**
     * Detect creative queries
     */
    private isCreativeQuery(intent: string, query: string): boolean {
        const creativeIntents = [
            'creative_request',
            'storytelling',
            'brainstorming'
        ];

        const creativeKeywords = [
            'create', 'imagine', 'story', 'idea', 'brainstorm',
            'design', 'invent', 'creative', 'innovative', 'unique',
            'write a', 'come up with', 'think of'
        ];

        return creativeIntents.includes(intent) ||
            creativeKeywords.some(keyword => query.includes(keyword));
    }

    /**
     * Detect analytical queries
     */
    private isAnalyticalQuery(intent: string, query: string): boolean {
        const analyticalIntents = [
            'analysis_request',
            'comparison',
            'evaluation'
        ];

        const analyticalKeywords = [
            'analyze', 'compare', 'evaluate', 'assess', 'pros and cons',
            'advantages', 'disadvantages', 'difference between',
            'which is better', 'should i', 'decision'
        ];

        return analyticalIntents.includes(intent) ||
            analyticalKeywords.some(keyword => query.includes(keyword));
    }

    /**
     * Detect educational queries
     */
    private isEducationalQuery(intent: string, query: string): boolean {
        const educationalIntents = [
            'learning_query',
            'explanation_request',
            'how_to'
        ];

        const educationalKeywords = [
            'how to', 'how do', 'what is', 'what are', 'explain',
            'teach me', 'learn', 'understand', 'tutorial', 'guide',
            'step by step', 'show me how'
        ];

        return educationalIntents.includes(intent) ||
            educationalKeywords.some(keyword => query.includes(keyword));
    }

    /**
     * Get template selection statistics
     */
    getStats(): any {
        return {
            availableTemplates: templateLibrary.getTemplateNames(),
            selectionCriteria: [
                'User preference (highest priority)',
                'Intent-based selection',
                'Keyword analysis',
                'Default fallback (conversational)'
            ]
        };
    }
}

export default new TemplateSelector();
