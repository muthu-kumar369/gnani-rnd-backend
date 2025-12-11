import { Logger } from 'winston';
import { llmManager } from '../../../core/llm/llm.manager.js';
import { traceAsyncOperation } from '../../../core/monitoring/tracing.helper.js';
import config from '../../../config/app.config.js';

export class SynthesisHelper {
    constructor(private logger: Logger) { }

    async synthesizeFromPlan(plan: any, originalQuery: string, modelPath: string): Promise<string> {
        this.logger.debug('Synthesizing plan results');

        return traceAsyncOperation('llm.synthesizeFromPlan', async () => {
            const completedSteps = plan.steps
                .filter((s: any) => s.status === 'completed')
                .map((s: any, i: number) => `Step ${i + 1}: ${s.description}\nResult: ${JSON.stringify(s.result)}`)
                .join('\n\n');

            const prompt = `
You are an intelligent assistant. You have executed a multi-step plan to answer the user's request.
Synthesize the following step execution results into a coherent, natural language response.

User Request: "${originalQuery}"

Execution Results:
${completedSteps}

Please provide a comprehensive answer based on these results.
            `.trim();

            const options = {
                model: modelPath,
                maxTokens: config.LLM_MAX_TOKENS,
                temperature: 0.7, // Slightly higher for natural synthesis
                stream: false,
                stopSequences: ["User:", "System:"]
            };

            let synthesis = '';
            const iterator = llmManager.generate(prompt, options);

            for await (const chunk of iterator) {
                synthesis += chunk.text;
            }

            return synthesis;
        }, { planId: plan.id });
    }
}
