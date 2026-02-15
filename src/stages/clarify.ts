/**
 * Clarify Stage - Detect unclear goals/tasks and ask questions
 */

import { z } from "zod";
import type { Goal, Task, LLMClient } from "../types/index.ts";
import { Logger } from "../utils/logger.ts";

const ClarificationSchema = z.object({
	isClearEnough: z.boolean(),
	confidence: z.number().min(0).max(100),
	questions: z.array(
		z.object({
			question: z.string(),
			blocking: z.boolean(),
			urgency: z.enum(["low", "medium", "high"]),
			why: z.string(),
			assumptionIfUnanswered: z.string(),
		}),
	),
});

export interface ClarificationResult {
	shouldAsk: boolean;
	blocking: boolean;
	questions: Array<{
		question: string;
		blocking: boolean;
		urgency: "low" | "medium" | "high";
		why: string;
	}>;
}

export interface ClarifyStage {
	shouldAsk(goal: Goal): Promise<ClarificationResult>;
	shouldAskForTask(task: Task, goal: Goal): Promise<ClarificationResult>;
}

export class LLMClarifyStage implements ClarifyStage {
	#llm: LLMClient;
	#logger = new Logger("ClarifyStage");

	constructor(llm: LLMClient) {
		this.#llm = llm;
	}

	async shouldAsk(goal: Goal): Promise<ClarificationResult> {
		this.#logger.info(`Clarifying goal=${goal.id} (goal-level)`);

		const prompt = `Analyze this goal for clarity.

Goal: ${goal.description}
Success Criteria: ${goal.successCriteria.join(", ") || "Not specified"}
Context: ${goal.context || "None provided"}

Identify:
1. Missing critical information
2. Ambiguous terms
3. Implicit assumptions
4. Anything that could lead to wrong outcomes

For each issue, determine if it's blocking (can't proceed without answer) or non-blocking (can make reasonable assumption).`;

		const result = await this.#llm.generate("clarify", prompt, {
			schema: ClarificationSchema,
		});

		let parsed: unknown;
		try {
			parsed = JSON.parse(result.text);
		} catch (error) {
			this.#logger.error(`Invalid JSON from LLM for goal=${goal.id}`, error);
			throw new Error(
				`Clarify stage: LLM returned invalid JSON: ${result.text.slice(0, 200)}`,
			);
		}
		const validated = ClarificationSchema.parse(parsed);

		const hasBlocking = validated.questions.some((q) => q.blocking);
		const blocking =
			!validated.isClearEnough || validated.confidence < 60 || hasBlocking;

		this.#logger.info(
			`Clarify goal=${goal.id}: confidence=${validated.confidence}, questions=${validated.questions.length}, blocking=${blocking}`,
		);

		return {
			shouldAsk: validated.questions.length > 0,
			blocking,
			questions: validated.questions.map((q) => ({
				question: q.question,
				blocking: q.blocking,
				urgency: q.urgency,
				why: q.why,
			})),
		};
	}

	async shouldAskForTask(task: Task, goal: Goal): Promise<ClarificationResult> {
		this.#logger.info(`Clarifying task=${task.id} (task-level)`);

		const prompt = `Analyze this task for clarity.

Task: ${task.description}
Type: ${task.type}

Goal Context: ${goal.description}
${goal.context ? `Additional Context: ${goal.context}` : ""}

Is this task clear enough to execute? What, if anything, is missing or ambiguous?`;

		const result = await this.#llm.generate("clarify", prompt, {
			schema: ClarificationSchema,
		});

		let parsed2: unknown;
		try {
			parsed2 = JSON.parse(result.text);
		} catch (error) {
			this.#logger.error(`Invalid JSON from LLM for task=${task.id}`, error);
			throw new Error(
				`Clarify stage: LLM returned invalid JSON: ${result.text.slice(0, 200)}`,
			);
		}
		const validated = ClarificationSchema.parse(parsed2);

		const hasBlocking = validated.questions.some((q) => q.blocking);
		const blocking =
			!validated.isClearEnough || validated.confidence < 60 || hasBlocking;

		this.#logger.info(
			`Clarify task=${task.id}: confidence=${validated.confidence}, questions=${validated.questions.length}, blocking=${blocking}`,
		);

		return {
			shouldAsk: validated.questions.length > 0,
			blocking,
			questions: validated.questions.map((q) => ({
				question: q.question,
				blocking: q.blocking,
				urgency: q.urgency,
				why: q.why,
			})),
		};
	}
}
