/**
 * Execute Stage - Execute a Task and produce results
 */

import type {
	Goal,
	Task,
	TaskResult,
	LLMClient,
	ExecutePipelineStageConfig,
} from "../types/index.ts";
import { Logger } from "../utils/logger.ts";

export interface ExecuteStage {
	run(task: Task, goal: Goal): Promise<TaskResult>;
}

export class LLMExecuteStage implements ExecuteStage {
	#llm: LLMClient;
	#config: ExecutePipelineStageConfig;
	#logger = new Logger("ExecuteStage");

	constructor(llm: LLMClient, config: ExecutePipelineStageConfig) {
		this.#llm = llm;
		this.#config = config;
	}

	async run(task: Task, goal: Goal): Promise<TaskResult> {
		const startTime = Date.now();
		const modelAlias = this.#selectModelForTaskType(task.type);

		this.#logger.info(
			`Starting execute task=${task.id}, type=${task.type}, model=${modelAlias || "default"}`,
		);

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

		let result;
		try {
			result = await this.#llm.generate("execute", prompt, {
				modelAlias,
			});
		} catch (error) {
			this.#logger.error(`Execute failed for task=${task.id}`, error);
			throw error;
		}

		const durationMs = Date.now() - startTime;
		const duration = Math.floor(durationMs / 60000); // minutes
		const tokens = result.usage.prompt + result.usage.completion;

		this.#logger.info(
			`Completed task=${task.id} in ${durationMs}ms, tokens=${tokens}`,
		);

		return {
			summary: result.text,
			artifacts: [], // TODO: Extract artifacts from result
			metrics: {
				durationMinutes: duration,
				tokensUsed: tokens,
			},
		};
	}

	#selectModelForTaskType(type: Task["type"]): string | undefined {
		return this.#config.byType?.[type] || this.#config.default;
	}
}
