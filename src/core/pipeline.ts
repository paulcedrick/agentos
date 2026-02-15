/**
 * Pipeline - Multi-Team Support with Agent Routing
 */

import type {
	Config,
	Goal,
	Task,
	Adapter,
	AgentConfig,
	LLMClient,
} from "../types/index.ts";
import { StateMachine } from "./state-machine.ts";
import { LLMParseStage } from "../stages/parse.ts";
import { LLMDecomposeStage } from "../stages/decompose.ts";
import { LLMClarifyStage } from "../stages/clarify.ts";
import { LLMExecuteStage } from "../stages/execute.ts";
import { Logger } from "../utils/logger.ts";

export class Pipeline {
	#stateMachine: StateMachine;
	#parseStage: LLMParseStage;
	#decomposeStage: LLMDecomposeStage;
	#clarifyStage: LLMClarifyStage;
	#executeStage: LLMExecuteStage;
	#logger: Logger;
	#config: Config;
	#adapter: Adapter;

	constructor(config: Config, adapter: Adapter, llm: LLMClient) {
		this.#config = config;
		this.#adapter = adapter;
		this.#stateMachine = new StateMachine();
		this.#parseStage = new LLMParseStage(llm);
		this.#decomposeStage = new LLMDecomposeStage(llm);
		this.#clarifyStage = new LLMClarifyStage(llm);
		this.#executeStage = new LLMExecuteStage(llm, config.pipeline.execute);
		this.#logger = new Logger("Pipeline");
	}

	async runCycle(teamId?: string): Promise<void> {
		// Fetch goals for specific team or all teams
		const goals = await this.#adapter.pollGoals(teamId);

		this.#logger.info(
			`Processing ${goals.length} goals${teamId ? ` for team ${teamId}` : ""}`,
		);

		for (const goal of goals) {
			await this.#processGoal(goal);
		}
	}

	async #processGoal(goal: Goal): Promise<void> {
		this.#logger.info(`[${goal.id}] Processing goal for team ${goal.teamId}`);

		try {
			// STAGE 1: PARSE
			this.#logger.info(`[${goal.id}] Parsing...`);
			const parsedGoal = await this.#parseStage.run(goal.description, goal.id);
			// Preserve teamId from original goal
			parsedGoal.teamId = goal.teamId;

			// STAGE 2: CLARIFY
			this.#logger.info(`[${goal.id}] Checking clarifications...`);
			const clarification = await this.#clarifyStage.shouldAsk(parsedGoal);

			if (clarification.blocking) {
				this.#logger.info(`[${goal.id}] Blocking clarification needed`);
				await this.#requestClarification(goal, clarification.questions);
				await this.#adapter.report(
					goal.id,
					"blocked",
					"Blocking clarification required",
					{ entity: "goal", teamId: goal.teamId },
				);
				return;
			}

			// STAGE 3: DECOMPOSE
			this.#logger.info(`[${goal.id}] Decomposing...`);
			const tasks = await this.#decomposeStage.run(parsedGoal);

			this.#logger.info(`[${goal.id}] Created ${tasks.length} tasks`);

			// STAGE 4: EXECUTE tasks (dependency-aware with agent matching)
			const executionSummary = await this.#executeTasksWithDependencies(
				tasks,
				parsedGoal,
			);

			if (executionSummary.failed > 0) {
				await this.#adapter.report(
					goal.id,
					"failed",
					`${executionSummary.failed} task(s) failed, ${executionSummary.completed} completed`,
					{ entity: "goal", teamId: goal.teamId },
				);
				return;
			}

			if (executionSummary.blocked > 0) {
				await this.#adapter.report(
					goal.id,
					"blocked",
					`${executionSummary.blocked} task(s) blocked, ${executionSummary.completed} completed`,
					{ entity: "goal", teamId: goal.teamId },
				);
				return;
			}

			this.#logger.info(`[${goal.id}] Completed`);
			await this.#adapter.report(goal.id, "completed", "All tasks completed", {
				entity: "goal",
				teamId: goal.teamId,
			});
		} catch (error) {
			this.#logger.error(`[${goal.id}] Failed`, error);
			await this.#adapter.report(goal.id, "failed", String(error), {
				entity: "goal",
				teamId: goal.teamId,
			});
		}
	}

	async #executeTasksWithDependencies(
		tasks: Task[],
		goal: Goal,
	): Promise<{ completed: number; failed: number; blocked: number }> {
		const allTaskIds = new Set(tasks.map((task) => task.id));
		const remaining = new Map(tasks.map((task) => [task.id, task]));
		const completed = new Set<string>();
		const failed = new Set<string>();
		const blocked = new Set<string>();

		while (remaining.size > 0) {
			let progressed = false;

			for (const [taskId, task] of Array.from(remaining.entries())) {
				const unknownDependencies = task.dependencies.filter(
					(dependencyId) => !allTaskIds.has(dependencyId),
				);
				if (unknownDependencies.length > 0) {
					await this.#adapter.report(
						task.id,
						"blocked",
						`Unknown dependencies: ${unknownDependencies.join(", ")}`,
						{ entity: "task", teamId: goal.teamId },
					);
					blocked.add(task.id);
					remaining.delete(taskId);
					progressed = true;
					continue;
				}

				const blockedDependencies = task.dependencies.filter(
					(dependencyId) =>
						failed.has(dependencyId) || blocked.has(dependencyId),
				);
				if (blockedDependencies.length > 0) {
					await this.#adapter.report(
						task.id,
						"blocked",
						`Blocked by dependency: ${blockedDependencies.join(", ")}`,
						{ entity: "task", teamId: goal.teamId },
					);
					blocked.add(task.id);
					remaining.delete(taskId);
					progressed = true;
					continue;
				}

				const waitingDependencies = task.dependencies.filter(
					(dependencyId) => !completed.has(dependencyId),
				);
				if (waitingDependencies.length > 0) {
					continue;
				}

				const status = await this.#executeTaskWithAgentMatching(task, goal);
				if (status === "completed") {
					completed.add(task.id);
				} else if (status === "failed") {
					failed.add(task.id);
				} else {
					blocked.add(task.id);
				}
				remaining.delete(taskId);
				progressed = true;
			}

			if (!progressed) {
				for (const task of remaining.values()) {
					const unresolved = task.dependencies.filter(
						(dependencyId) => !completed.has(dependencyId),
					);
					await this.#adapter.report(
						task.id,
						"blocked",
						`Unresolvable dependencies: ${unresolved.join(", ") || "none"}`,
						{ entity: "task", teamId: goal.teamId },
					);
					blocked.add(task.id);
				}
				break;
			}
		}

		return {
			completed: completed.size,
			failed: failed.size,
			blocked: blocked.size,
		};
	}

	async #executeTaskWithAgentMatching(
		task: Task,
		goal: Goal,
	): Promise<"completed" | "failed" | "blocked"> {
		// Find best agent for this task based on capabilities
		const agent = this.#findBestAgent(task, goal.teamId);

		if (!agent) {
			this.#logger.warn(
				`[${task.id}] No agent found with capabilities: ${task.requiredCapabilities.join(", ")}`,
			);
			await this.#adapter.report(
				task.id,
				"blocked",
				`No agent available for capabilities: ${task.requiredCapabilities.join(", ")}`,
				{ entity: "task", teamId: goal.teamId },
			);
			return "blocked";
		}

		this.#logger.info(`[${task.id}] Assigning to agent: ${agent.name}`);

		// Check for task-level clarifications
		const taskClarification = await this.#clarifyStage.shouldAskForTask(
			task,
			goal,
		);
		if (taskClarification.blocking) {
			await this.#adapter.report(task.id, "blocked", "Needs clarification", {
				entity: "task",
				teamId: goal.teamId,
			});
			return "blocked";
		}

		// Claim task for this agent
		const claimed = await this.#adapter.claim(task.id, agent.id);
		if (!claimed) {
			this.#logger.info(`[${task.id}] Already claimed`);
			return "blocked";
		}

		const claimedTransition = this.#stateMachine.transition(task, "claimed");
		if (!claimedTransition.success) {
			throw new Error(
				`[${task.id}] Failed to transition to claimed: ${claimedTransition.error}`,
			);
		}

		const inProgressTransition = this.#stateMachine.transition(
			task,
			"in_progress",
		);
		if (!inProgressTransition.success) {
			throw new Error(
				`[${task.id}] Failed to transition to in_progress: ${inProgressTransition.error}`,
			);
		}
		await this.#adapter.report(
			task.id,
			"in_progress",
			`Assigned to ${agent.name}`,
			{ entity: "task", teamId: goal.teamId },
		);

		try {
			const result = await this.#executeStage.run(task, goal);
			task.result = result;

			const completedTransition = this.#stateMachine.transition(
				task,
				"completed",
			);
			if (!completedTransition.success) {
				throw new Error(
					`[${task.id}] Failed to transition to completed: ${completedTransition.error}`,
				);
			}
			await this.#adapter.report(task.id, "completed", result.summary, {
				entity: "task",
				teamId: goal.teamId,
			});
			return "completed";
		} catch (error) {
			this.#logger.error(`[${task.id}] Execution failed`, error);
			const failedTransition = this.#stateMachine.transition(task, "failed");
			if (!failedTransition.success) {
				this.#logger.warn(
					`[${task.id}] Failed to transition task to failed state`,
				);
			}
			await this.#adapter.report(task.id, "failed", String(error), {
				entity: "task",
				teamId: goal.teamId,
			});
			return "failed";
		}
	}

	#findBestAgent(task: Task, teamId: string): AgentConfig | null {
		// Get agents for this team
		const team = this.#config.teams[teamId];
		if (!team) return null;

		const teamAgents = team.agents
			.map((id) => this.#config.agents[id])
			.filter((a) => a?.isActive);

		// Find agent with matching capabilities
		for (const agent of teamAgents) {
			const hasCapabilities = task.requiredCapabilities.every((cap) =>
				agent.capabilities.includes(cap),
			);
			if (hasCapabilities) {
				return agent;
			}
		}

		// Fallback: return first agent if no exact match
		return teamAgents[0] || null;
	}

	async #requestClarification(
		goal: Goal,
		questions: Array<{ question: string; blocking: boolean; urgency: string }>,
	): Promise<void> {
		const message = questions
			.map(
				(q, i) =>
					`${i + 1}. [${q.blocking ? "BLOCKING" : "Non-blocking"}] ${q.question}`,
			)
			.join("\n");

		await this.#adapter.requestClarification(goal.id, message);
	}
}
