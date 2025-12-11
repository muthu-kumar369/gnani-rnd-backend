import { Logger } from 'winston';
import { llmManager } from '../../../core/llm/llm.manager.js';
import { traceAsyncOperation } from '../../../core/monitoring/tracing.helper.js';

export class ToolDecisionHelper {
    constructor(private logger: Logger) { }

    async getToolDecision(decisionPrompt: any, modelPath: string): Promise<{ needs_tool: boolean, tool_name?: string, parameters?: any }> {
        const sessionId = decisionPrompt.session_id;
        this.logger.debug(`Getting tool decision for session ${sessionId}`);

        return traceAsyncOperation('llm.getToolDecision', async () => {
            try {
                const promptText = `System: ${decisionPrompt.system_message}\n\nUser: ${decisionPrompt.user_query}`;

                const options = {
                    model: modelPath,
                    maxTokens: 200,
                    temperature: 0.1,
                    stream: false,
                    stopSequences: ["User:", "System:"]
                };

                let content = '';
                const iterator = llmManager.generate(promptText, options);

                for await (const chunk of iterator) {
                    content += chunk.text;
                }

                // Parse JSON
                const markdownMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (markdownMatch) {
                    content = markdownMatch[1];
                } else {
                    const firstBrace = content.indexOf('{');
                    const lastBrace = content.lastIndexOf('}');
                    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                        content = content.substring(firstBrace, lastBrace + 1);
                    }
                }

                try {
                    const decision = JSON.parse(content);
                    this.logger.info(`Tool decision for session ${sessionId}: ${JSON.stringify(decision)}`);
                    return decision;
                } catch (e) {
                    this.logger.warn(`Failed to parse tool decision JSON: ${content}`);
                    return { needs_tool: false };
                }

            } catch (error: any) {
                this.logger.error(`Error getting tool decision: ${error.message}`);
                return { needs_tool: false };
            }
        }, { 'session.id': sessionId, 'model': modelPath });
    }
}
