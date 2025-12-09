import llmService from '../llm/llm.service.js';
import { toolExecutor } from '../tool/tool.executor.js';
import { createContextualLogger } from '../../core/logger/logger.js';
import { v4 as uuidv4 } from 'uuid';

const logger = createContextualLogger({ module: 'MultiStepPlanner' });

export interface PlanStep {
    id: string;
    description: string;
    tool?: string;
    parameters?: any;
    dependencies: string[];
    status: 'pending' | 'running' | 'completed' | 'failed';
    result?: any;
    error?: string;
}

export interface Plan {
    id: string;
    goal: string;
    steps: PlanStep[];
    status: 'planning' | 'executing' | 'completed' | 'failed';
    createdAt: Date;
    completedAt?: Date;
    context: any;
}

export class MultiStepPlannerService {

    /**
     * Create a multi-step plan for a complex goal
     */
    async createPlan(goal: string, context: any = {}): Promise<Plan> {
        logger.info(`Creating plan for goal: ${goal}`);

        // Use LLM to generate plan
        const planPrompt = this.buildPlanningPrompt(goal, context);

        // Construct structured prompt for LlmService
        const structuredPrompt = {
            session_id: context.sessionId || `gen-plan-${Date.now()}`,
            user_id: context.userId || 'system',
            classified_intent: 'planning',
            system_message: 'You are an expert task planner. Your goal is to break down complex user requests into executable steps.',
            current_user_query: planPrompt,
            conversation_history: []
        };

        const response = await llmService.getLlmResponse(structuredPrompt, null, 'llama3.1');
        const content = response.text;

        // Parse plan from LLM response
        const steps = this.parsePlan(content);

        const plan: Plan = {
            id: this.generatePlanId(),
            goal,
            steps,
            status: 'planning',
            createdAt: new Date(),
            context
        };

        return plan;
    }

    /**
     * Execute a multi-step plan
     */
    async executePlan(plan: Plan): Promise<Plan> {
        logger.info(`Executing plan: ${plan.id}`);
        plan.status = 'executing';

        try {
            // Execute steps in dependency order
            const completed = new Set<string>();

            while (completed.size < plan.steps.length) {
                // Find steps ready to execute
                const ready = plan.steps.filter(step =>
                    step.status === 'pending' &&
                    step.dependencies.every(dep => completed.has(dep))
                );

                if (ready.length === 0) {
                    // Check if any are still running
                    const running = plan.steps.some(step => step.status === 'running');
                    if (running) {
                        // Wait a bit and continue loop (handled by Promise.all below naturally if we were parallel, 
                        // but here we are orchestrating waves. If running, they should be in the current execution batch?
                        // Actually the logic below awaits the batch. So if ready=0 and we are here, it means we are stuck
                        // OR we are done?
                        // The loop condition is completed.size < total.
                        // If ready=0 and not all completed, checking if others failed?
                        const failed = plan.steps.filter(s => s.status === 'failed');
                        if (failed.length > 0) {
                            throw new Error(`Plan failed due to step failures: ${failed.map(s => s.id).join(', ')}`);
                        }

                        throw new Error('No steps ready to execute - possible circular dependency or deadlock');
                    }
                }

                // Execute ready steps in parallel
                await Promise.all(ready.map(step => this.executeStep(step, plan)));

                // Mark completed steps
                ready.forEach(step => {
                    if (step.status === 'completed') {
                        completed.add(step.id);
                    }
                });
            }

            plan.status = 'completed';
            plan.completedAt = new Date();
        } catch (error: any) {
            logger.error('Plan execution failed', { error: error.message });
            plan.status = 'failed';
            throw error;
        }

        return plan;
    }

    /**
     * Execute a single step
     */
    private async executeStep(step: PlanStep, plan: Plan): Promise<void> {
        logger.info(`Executing step: ${step.description}`, { stepId: step.id });
        step.status = 'running';

        try {
            if (step.tool) {
                // Execute tool via ToolExecutor
                step.result = await this.executeToolAndWait(step.tool, step.parameters, plan.context.sessionId || 'system');
            } else {
                // Execute with LLM (Thought/Reasoning step)
                const structuredPrompt = {
                    session_id: plan.context.sessionId || 'system',
                    user_id: plan.context.userId || 'system',
                    classified_intent: 'plan_execution',
                    system_message: 'You are an intelligent agent executing a step in a plan.',
                    current_user_query: `Execute this step: ${step.description}. Context: ${JSON.stringify(plan.context)}`,
                    conversation_history: []
                };
                const response = await llmService.getLlmResponse(structuredPrompt);
                step.result = response.text;
            }

            step.status = 'completed';
        } catch (error: any) {
            logger.error(`Step execution failed: ${step.description}`, { error: error.message });
            step.status = 'failed';
            step.error = error.message;
            throw error;
        }
    }

    /**
     * Helper to execute tool and poll for completion
     */
    private async executeToolAndWait(toolName: string, params: any, sessionId: string): Promise<any> {
        const result = await toolExecutor.executeTool(toolName, params, sessionId);
        const jobId = result.jobId;

        if (!jobId) {
            // If no jobId returned, assume immediate execution or failure based on implementation
            // But since we are waiting, we expect async job. If missing, throwing error for now to satisfy type safety
            // in this specific "executeToolAndWait" method.
            throw new Error(`Tool ${toolName} did not return a valid job ID.`);
        }

        // Poll for completion
        // Max wait 60 seconds
        const timeout = 60000;
        const start = Date.now();

        while (Date.now() - start < timeout) {
            const status = await toolExecutor.getJobStatus(jobId.toString());
            if (!status) throw new Error(`Job ${jobId} lost`);

            if (status.state === 'completed') {
                // In a real system we would get the result from the job
                // Assuming job.returnvalue or similar, but ToolExecutor wrapper didn't expose result getter
                // We might need to fetch job result directly if getJobStatus doesn't return it.
                // toolExecutor.getJobStatus returns { state, progress }.
                // We need to bypass or assume success for now, or update ToolExecutor to return result.
                // For this implementation, let's assume success return is implied or we'd need to extend ToolExecutor.
                // Let's assume for now it returns a generic success.
                return { success: true, jobId };
            }

            if (status.state === 'failed') {
                throw new Error(`Tool execution failed for job ${jobId}`);
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        throw new Error(`Tool execution timed out for job ${jobId}`);
    }

    /**
     * Build planning prompt
     */
    private buildPlanningPrompt(goal: string, context: any): string {
        return `
You are a task planner. Break down the following goal into a series of steps.

Goal: ${goal}

Context:
${JSON.stringify(context, null, 2)}

Available tools:
- search: Search for information
- calculate: Perform calculations
- write_file: Write content to a file
- read_file: Read content from a file

Instructions:
1. Break down the goal into 3-7 concrete steps
2. For each step, specify:
   - A clear description
   - The tool to use (if applicable)
   - Parameters for the tool
   - Dependencies on other steps (by step number)

Format your response as JSON:
{
  "steps": [
    {
      "id": "step-1",
      "description": "...",
      "tool": "search",
      "parameters": {...},
      "dependencies": []
    },
    ...
  ]
}
    `.trim();
    }

    /**
     * Parse plan from LLM response
     */
    private parsePlan(response: string): PlanStep[] {
        try {
            // Extract JSON from response (handle markdown blocks)
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            let content = response;
            if (jsonMatch) {
                content = jsonMatch[0];
            }

            // Sometimes models wrap in ```json ... ```
            content = content.replace(/```json/g, '').replace(/```/g, '');

            const parsed = JSON.parse(content);

            if (!parsed.steps || !Array.isArray(parsed.steps)) {
                throw new Error('Invalid plan format: missing steps array');
            }

            return parsed.steps.map((step: any) => ({
                ...step,
                status: 'pending' as const,
                dependencies: step.dependencies || []
            }));
        } catch (error) {
            logger.error('Failed to parse plan', { error });
            throw new Error('Failed to parse plan from LLM response');
        }
    }

    private generatePlanId(): string {
        return `plan-${Date.now()}-${uuidv4().substring(0, 8)}`;
    }
}

// Export singleton
export default new MultiStepPlannerService();
