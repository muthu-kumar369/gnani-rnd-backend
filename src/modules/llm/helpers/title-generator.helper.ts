import { Logger } from 'winston';
import { llmManager } from '../../../core/llm/llm.manager.js';
import metrics from '../../../core/monitoring/metrics.js';
import { traceAsyncOperation } from '../../../core/monitoring/tracing.helper.js';

export class TitleGeneratorHelper {
    constructor(private logger: Logger) { }

    async generateTitle(conversationContext: string): Promise<string> {
        this.logger.debug('Generating conversation title');

        return traceAsyncOperation('llm.generateTitle', async () => {
            try {
                const systemPrompt = `You are a title generator. Given a conversation excerpt, generate a concise, descriptive title (max 60 characters). Output only the title, nothing else.`;
                const userPrompt = `Conversation:\n${conversationContext}\n\nGenerate a title:`;
                const promptText = `${systemPrompt}\n\n${userPrompt}`;

                let title = '';
                const iterator = llmManager.generate(promptText, {
                    maxTokens: 20,
                    temperature: 0.3,
                    stream: false,
                    stopSequences: ["\n", "User:", "Assistant:"]
                });

                for await (const chunk of iterator) {
                    title += chunk.text;
                }

                title = title.trim().replace(/^["']|["']$/g, '');

                if (title.length > 60) title = title.substring(0, 57) + '...';

                if (!title || title.length < 3) return 'New Conversation';

                metrics.incLlmCall('title-generation', 'title_generation', 'success');
                return title;

            } catch (error: any) {
                this.logger.error(`Error generating title: ${error.message}`);
                metrics.incLlmCall('title-generation', 'title_generation', 'failure');
                return 'New Conversation';
            }
        }, { 'context.length': conversationContext.length });
    }
}
