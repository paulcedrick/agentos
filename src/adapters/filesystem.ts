/**
 * FileSystem Adapter - Multi-Team Support
 * Reads goals from team-specific subdirectories
 */

import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type {
	Goal,
	Adapter,
	Config,
	GoalStatus,
	TaskStatus,
	ReportOptions,
} from "../types/index.ts";
import { Logger } from "../utils/logger.ts";

export interface FileSystemAdapterConfig {
	baseDir: string;
}

export class FileSystemAdapter implements Adapter {
	name = "filesystem";
	#logger = new Logger("FileSystemAdapter");
	#baseDir: string;
	#config?: Config;

	constructor(config: FileSystemAdapterConfig) {
		this.#baseDir = config.baseDir.replace("~", process.env["HOME"] || "");
	}

	setConfig(config: Config): void {
		this.#config = config;
	}

	async initialize(): Promise<void> {
		// Create base directory
		await mkdir(this.#baseDir, { recursive: true });

		// Create team subdirectories
		if (this.#config) {
			const teamIds = Object.keys(this.#config.teams);
			for (const [, team] of Object.entries(this.#config.teams)) {
				const teamDir = join(this.#baseDir, team.goalsDir);
				await mkdir(teamDir, { recursive: true });

				// Create done subdirectory for each team
				await mkdir(join(teamDir, "done"), { recursive: true });
				await mkdir(join(teamDir, "task-status"), { recursive: true });
			}
			this.#logger.info(
				`Initialized ${teamIds.length} team directories under ${this.#baseDir}`,
			);
		}
	}

	getGoalsDir(teamId: string): string {
		if (!this.#config) {
			throw new Error("Config not set");
		}
		const team = this.#config.teams[teamId];
		if (!team) {
			throw new Error(`Team not found: ${teamId}`);
		}
		return join(this.#baseDir, team.goalsDir);
	}

	async fetchInputs(teamId?: string): Promise<string[]> {
		if (teamId) {
			// Fetch from specific team
			const teamDir = this.getGoalsDir(teamId);
			return this.#fetchFromDirectory(teamDir);
		}

		// Fetch from all teams
		const allInputs: string[] = [];
		for (const teamId of Object.keys(this.#config?.teams || {})) {
			const teamDir = this.getGoalsDir(teamId);
			const inputs = await this.#fetchFromDirectory(teamDir);
			allInputs.push(...inputs);
		}
		return allInputs;
	}

	async #fetchFromDirectory(dir: string): Promise<string[]> {
		try {
			const files = await readdir(dir);
			const goalFiles = files.filter((f) => f.endsWith(".goal.md"));

			const inputs: string[] = [];
			for (const file of goalFiles) {
				const content = await readFile(join(dir, file), "utf-8");
				inputs.push(content);
			}
			return inputs;
		} catch (error) {
			this.#logger.warn(`Failed to read goals from ${dir}`, {
				error: String(error),
			});
			return [];
		}
	}

	async pollGoals(teamId?: string): Promise<Goal[]> {
		const inputs = await this.fetchInputs(teamId);
		const goals: Goal[] = [];

		for (const input of inputs) {
			const goal = await this.#parseGoalFile(input);
			if (goal.status === "pending") {
				goals.push(goal);
			}
		}

		this.#logger.info(
			`Polled ${teamId || "all teams"}: found ${goals.length} pending goals`,
		);
		return goals;
	}

	async #parseGoalFile(content: string): Promise<Goal> {
		// Extract team from frontmatter or parse it
		const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

		let frontmatter: Record<string, any> = {};
		let body = content;

		if (match) {
			const [, fmStr, bodyStr] = match;
			body = bodyStr.trim();

			for (const line of fmStr.split("\n")) {
				const idx = line.indexOf(":");
				if (idx > 0) {
					frontmatter[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
				}
			}
		}

		return {
			id: (frontmatter["id"] as string) || `goal-${Date.now()}`,
			source: "filesystem",
			sourceId: (frontmatter["id"] as string) || "unknown",
			teamId: (frontmatter["team"] as string) || "unknown",
			description: body,
			successCriteria:
				typeof frontmatter["successCriteria"] === "string"
					? (frontmatter["successCriteria"] as string).split(",")
					: [],
			priority: ((frontmatter["priority"] as Goal["priority"]) || "medium"),
			status: ((frontmatter["status"] as Goal["status"]) || "pending"),
			createdBy: (frontmatter["createdBy"] as string) || "unknown",
			createdAt:
				(frontmatter["createdAt"] as string) || new Date().toISOString(),
			metadata: { frontmatter },
		};
	}

	async claim(inputId: string, agentId: string): Promise<boolean> {
		// Find the goal file and create a lock
		for (const teamId of Object.keys(this.#config?.teams || {})) {
			const teamDir = this.getGoalsDir(teamId);
			const lockFile = join(teamDir, `${inputId}.lock`);

			try {
				await writeFile(lockFile, agentId, { flag: "wx" });
				this.#logger.info(`Claimed ${inputId} for agent=${agentId}`);
				return true;
			} catch {
				// Lock exists, try next team or return false
			}
		}
		this.#logger.warn(
			`Failed to claim ${inputId} for agent=${agentId} (already locked)`,
		);
		return false;
	}

	async report(
		inputId: string,
		status: GoalStatus | TaskStatus,
		message?: string,
		options?: ReportOptions,
	): Promise<void> {
		const entity =
			options?.entity || (inputId.includes("-task-") ? "task" : "goal");
		if (entity === "task") {
			const teamDir = await this.#findTeamDirForTask(inputId, options?.teamId);
			if (!teamDir) {
				this.#logger.warn(`Could not resolve team for task report: ${inputId}`);
				return;
			}

			const taskStatusPath = join(teamDir, "task-status", `${inputId}.json`);
			const payload = {
				taskId: inputId,
				status,
				message: message || "",
				updatedAt: new Date().toISOString(),
			};
			await writeFile(taskStatusPath, JSON.stringify(payload, null, 2));
			this.#logger.info(`Report ${inputId}: task status → ${status}`);
			return;
		}

		// Goal reports update source goal files
		for (const teamId of Object.keys(this.#config?.teams || {})) {
			const teamDir = this.getGoalsDir(teamId);
			const goalFile = join(teamDir, `${inputId}.goal.md`);

			try {
				const content = await readFile(goalFile, "utf-8");
				const updated = this.#replaceGoalStatus(content, status);
				await writeFile(goalFile, updated);
				this.#logger.info(`Report ${inputId}: status → ${status}`);
				return;
			} catch {
				// File not in this team, continue
			}
		}

		this.#logger.warn(`Goal file not found for report: ${inputId}`);
	}

	async notify(message: string): Promise<void> {
		this.#logger.info(message);
	}

	async requestClarification(goalId: string, question: string): Promise<void> {
		for (const teamId of Object.keys(this.#config?.teams || {})) {
			const teamDir = this.getGoalsDir(teamId);
			const clarFile = join(teamDir, `${goalId}.clarification.md`);

			try {
				await writeFile(clarFile, `# Clarification Request\n\n${question}\n`);
				return;
			} catch {
				// Continue to next team
			}
		}
	}

	#replaceGoalStatus(content: string, status: GoalStatus | TaskStatus): string {
		if (/^status:.*$/m.test(content)) {
			return content.replace(/^status:.*$/m, `status: ${status}`);
		}

		const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);
		if (frontmatterMatch) {
			const updatedFrontmatter = `---\n${frontmatterMatch[1]}\nstatus: ${status}\n---\n`;
			return content.replace(/^---\n([\s\S]*?)\n---\n?/, updatedFrontmatter);
		}

		return `---\nstatus: ${status}\n---\n${content}`;
	}

	async #findTeamDirForTask(
		taskId: string,
		preferredTeamId?: string,
	): Promise<string | null> {
		const candidates = preferredTeamId
			? [preferredTeamId, ...Object.keys(this.#config?.teams || {})]
			: Object.keys(this.#config?.teams || {});

		const goalId = taskId.split("-task-")[0];
		for (const teamId of candidates) {
			try {
				const teamDir = this.getGoalsDir(teamId);
				await readFile(join(teamDir, `${goalId}.goal.md`), "utf-8");
				return teamDir;
			} catch {
				// Continue searching
			}
		}

		if (candidates.length > 0) {
			return this.getGoalsDir(candidates[0]);
		}

		return null;
	}
}
