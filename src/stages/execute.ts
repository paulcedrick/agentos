/**
 * Execute Stage - Execute a Task and produce results
 */

import type { Goal, Task, TaskResult, LLMClient } from "../types/index.ts";

export interface ExecuteStage {
	run(task: Task, goal: Goal): Promise<TaskResult>;
}

export class LLMExecuteStage implements ExecuteStage {
	#llm: LLMClient;

	constructor(llm: LLMClient) {
		this.#llm = llm;
	}

	async run(task: Task, goal: Goal): Promise<TaskResult> {
		const startTime = Date.now();

		const prompt = `Execute this task and provide results.

TASK: ${task.description}
TYPE: ${task.type}

GOAL CONTEXT:
${goal.description}

Success Criteria:
${goal.successCriteria.map((c) => `- ${c}`).join("\n")}

${goal.context ? `Additional Context:\n${goal.context}\n` : ""}

Execute the task and provide:
1. A summary of what was accomplished
2. Key outputs or findings
3. Any issues encountered
4. Recommendations for next steps

Be specific and actionable in your response.`;

		// Use task type to determine model (code tasks need better models)
		const modelAlias = this.#selectModelForTaskType(task.type);

		const result = await this.#llm.generate("execute", prompt, {
			modelAlias,
		});

		const duration = Math.floor((Date.now() - startTime) / 60000); // minutes

		return {
			summary: result.text,
			artifacts: [], // TODO: Extract artifacts from result
			metrics: {
				durationMinutes: duration,
				tokensUsed: result.usage.prompt + result.usage.completion,
			},
		};
	}

	#selectModelForTaskType(type: Task["type"]): string | undefined {
		// Higher quality models for complex tasks
		const highQualityTypes = ["code", "design", "architecture"];
		if (highQualityTypes.includes(type)) {
			return "kimi-k2"; // Use best model
		}
		// Let pipeline config decide for others
		return undefined;
	}
}
