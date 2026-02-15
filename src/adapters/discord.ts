/**
 * Discord Adapter - Post tasks to Discord and poll for responses
 */

import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import type {
	Goal,
	Adapter,
	Config,
	GoalStatus,
	TaskStatus,
	ReportOptions,
} from "../types/index.ts";
import { Logger } from "../utils/logger.ts";

interface DiscordConnectionConfig {
	botToken: string;
	taskChannelId: string;
	guildId?: string;
}

export class DiscordAdapter implements Adapter {
	name = "discord";
	#client: Client;
	#config: DiscordConnectionConfig;
	#configData?: Config;
	#isReady = false;
	#logger = new Logger("DiscordAdapter");

	constructor(config: DiscordConnectionConfig) {
		this.#config = config;
		this.#client = new Client({
			intents: [
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.MessageContent,
			],
		});
	}

	setConfig(config: Config): void {
		this.#configData = config;
	}

	async initialize(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.#client.once("clientReady", () => {
				this.#logger.info(`Bot logged in as ${this.#client.user?.tag}`);
				this.#isReady = true;
				resolve();
			});

			this.#client.on("error", (error: Error) => {
				this.#logger.error("Client error:", error);
				reject(error);
			});

			this.#client.login(this.#config.botToken).catch(reject);
		});
	}

	#ensureReady(): void {
		if (!this.#isReady) {
			throw new Error(
				"Discord adapter not initialized. Call initialize() first.",
			);
		}
	}

	async pollGoals(_teamId?: string): Promise<Goal[]> {
		// Discord adapter doesn't poll for goals from files.
		// Goals are created via other mechanisms (e.g., slash commands, messages).
		return [];
	}

	async fetchInputs(_teamId?: string): Promise<string[]> {
		return [];
	}

	getGoalsDir(_teamId: string): string {
		return "";
	}

	async claim(_inputId: string, agentId: string): Promise<boolean> {
		const agent = this.#configData?.agents[agentId];
		if (!agent?.discordId) {
			this.#logger.warn(`No Discord ID for agent: ${agentId}`);
			return false;
		}
		return true;
	}

	async report(
		id: string,
		status: GoalStatus | TaskStatus,
		message: string,
		_options?: ReportOptions,
	): Promise<void> {
		this.#ensureReady();

		try {
			const channel = await this.#client.channels.fetch(
				this.#config.taskChannelId,
			);
			if (!channel?.isTextBased()) return;

			const textChannel = channel as TextChannel;
			const threads = await textChannel.threads.fetchActive();
			const thread = threads.threads.find(
				(threadCandidate) => threadCandidate.name === `task-${id}`,
			);

			if (thread) {
				await thread.send(`**Status Update**: ${status}\n${message}`);
			} else {
				this.#logger.warn(`Thread not found for task: ${id}`);
			}
		} catch (error) {
			this.#logger.error("Failed to report:", error);
		}
	}

	async notify(message: string): Promise<void> {
		this.#ensureReady();

		try {
			const channel = await this.#client.channels.fetch(
				this.#config.taskChannelId,
			);
			if (channel?.isTextBased()) {
				await (channel as TextChannel).send(message);
			}
		} catch (error) {
			this.#logger.error("Failed to notify:", error);
		}
	}

	async requestClarification(goalId: string, question: string): Promise<void> {
		this.#ensureReady();

		const adminUserId = this.#configData?.adapters.discord?.adminUserId;
		if (!adminUserId) {
			this.#logger.warn("No adminUserId configured for clarification requests");
			return;
		}

		try {
			const channel = await this.#client.channels.fetch(
				this.#config.taskChannelId,
			);
			if (!channel?.isTextBased()) return;

			await (channel as TextChannel).send(
				`<@${adminUserId}> **Clarification Needed**\n\n` +
					`Goal: ${goalId}\n\n` +
					`${question}`,
			);
		} catch (error) {
			this.#logger.error("Failed to request clarification:", error);
		}
	}

	async destroy(): Promise<void> {
		await this.#client.destroy();
		this.#isReady = false;
	}
}
