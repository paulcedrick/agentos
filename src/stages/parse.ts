/**
 * Parse Stage - Extract structured Goal from raw input using LLM
 */

import { z } from "zod";
import type { Goal, LLMClient } from "../types/index.ts";
import { Logger } from "../utils/logger.ts";

const GoalParseSchema = z.object({
	description: z.string().describe("Clear, concise description of the goal"),
	successCriteria: z
		.array(z.string())
		.describe("Specific, measurable outcomes"),
	context: z
		.string()
		.optional()
		.describe("Background information and constraints"),
	priority: z
		.enum(["low", "medium", "high", "urgent"])
		.describe("Priority level"),
});

export interface ParseStage {
	run(input: string, goalId: string): Promise<Goal>;
}

export class LLMParseStage implements ParseStage {
	#llm: LLMClient;
	#logger = new Logger("ParseStage");

	constructor(llm: LLMClient) {
		this.#llm = llm;
	}

	async run(input: string, goalId: string): Promise<Goal> {
		this.#logger.info(`Starting parse for goal=${goalId}`);
		this.#logger.debug(`Input (${input.length} chars)`, {
			input: input.slice(0, 200),
		});

		const prompt = `Analyze this goal description and extract structured information.

Input:
"""
${input}
"""

Extract:
1. A clear, concise description of what needs to be done
2. Specific, measurable success criteria (how will we know it's done?)
3. Any background context or constraints
4. Priority level (low, medium, high, urgent)

Respond with structured data.`;

		const result = await this.#llm.generate("parse", prompt, {
			schema: GoalParseSchema,
		});

		this.#logger.debug("LLM call complete", { textLength: result.text.length });

		let parsed: unknown;
		try {
			parsed = JSON.parse(result.text);
		} catch (error) {
			this.#logger.error(`Invalid JSON from LLM for goal=${goalId}`, error);
			throw new Error(
				`Parse stage: LLM returned invalid JSON: ${result.text.slice(0, 200)}`,
			);
		}
		const validated = GoalParseSchema.parse(parsed);

		this.#logger.info(
			`Parsed goal=${goalId}: priority=${validated.priority}, criteria=${validated.successCriteria.length}`,
		);

		return {
			id: goalId,
			source: "filesystem",
			sourceId: goalId,
			teamId: "unknown",
			description: validated.description,
			successCriteria: validated.successCriteria,
			context: validated.context,
			priority: validated.priority,
			status: "pending",
			createdBy: "agentos",
			createdAt: new Date().toISOString(),
			metadata: {
				parsedAt: new Date().toISOString(),
				inputLength: input.length,
			},
		};
	}
}
