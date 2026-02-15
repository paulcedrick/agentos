import type { Config } from "../types/index.ts";
import { Logger } from "../utils/logger.ts";

export class ConfigLoader {
	static #logger = new Logger("Config");

	static async load(path: string): Promise<Config> {
		this.#logger.info(`Loading config from ${path}`);
		const file = Bun.file(path);

		if (!(await file.exists())) {
			throw new Error(`Config file not found: ${path}`);
		}

		const content = await file.text();
		const config = JSON.parse(content) as Config;

		// Validate required fields
		this.validate(config);

		// Expand environment variables
		const expanded = this.expandEnvVars(config);

		this.#logger.info(
			`Config loaded: ${Object.keys(config.agents).length} agents, ${Object.keys(config.teams).length} teams, ${Object.keys(config.models).length} models`,
		);

		return expanded;
	}

	private static validate(config: Config): void {
		// Validate agents exist
		if (!config.agents || Object.keys(config.agents).length === 0) {
			throw new Error("Config must have at least one agent defined");
		}

		// Validate teams exist
		if (!config.teams || Object.keys(config.teams).length === 0) {
			throw new Error("Config must have at least one team defined");
		}

		// Validate team agents reference existing agents
		for (const [teamId, team] of Object.entries(config.teams)) {
			for (const agentId of team.agents) {
				if (!config.agents[agentId]) {
					throw new Error(
						`Team ${teamId} references unknown agent: ${agentId}`,
					);
				}
			}
		}

		// Validate agent teams reference existing teams
		for (const [agentId, agent] of Object.entries(config.agents)) {
			for (const teamId of agent.teams) {
				if (!config.teams[teamId]) {
					throw new Error(
						`Agent ${agentId} references unknown team: ${teamId}`,
					);
				}
			}
		}

		// Validate Discord adapter if enabled
		if (config.adapters.discord?.enabled) {
			if (!config.adapters.discord.botToken) {
				throw new Error("Discord adapter enabled but botToken is missing");
			}
			if (!config.adapters.discord.taskChannelId) {
				throw new Error("Discord adapter enabled but taskChannelId is missing");
			}
		}
		if (!config.models || Object.keys(config.models).length === 0) {
			throw new Error("Config must have at least one model defined");
		}

		// Validate each model has baseUrl and an API key source
		for (const [alias, model] of Object.entries(config.models)) {
			if (!model.baseUrl) {
				throw new Error(`Model "${alias}" is missing required baseUrl`);
			}
			if (!model.apiKey && !model.apiKeyEnv) {
				throw new Error(
					`Model "${alias}" must have either apiKey or apiKeyEnv`,
				);
			}
		}

		// Validate pipeline stages reference valid models
		const modelNames = Object.keys(config.models);
		const coreStages = ["parse", "decompose", "clarify"] as const;

		for (const stage of coreStages) {
			const stageConfig = config.pipeline[stage];
			if (!modelNames.includes(stageConfig.primary)) {
				throw new Error(
					`Pipeline stage ${stage} references unknown model: ${stageConfig.primary}`,
				);
			}
			if (stageConfig.fallback && !modelNames.includes(stageConfig.fallback)) {
				throw new Error(
					`Pipeline stage ${stage} references unknown fallback model: ${stageConfig.fallback}`,
				);
			}
		}

		const executeConfig = config.pipeline.execute;
		if (!modelNames.includes(executeConfig.default)) {
			throw new Error(
				`Pipeline stage execute references unknown default model: ${executeConfig.default}`,
			);
		}
		if (
			executeConfig.fallback &&
			!modelNames.includes(executeConfig.fallback)
		) {
			throw new Error(
				`Pipeline stage execute references unknown fallback model: ${executeConfig.fallback}`,
			);
		}
		for (const [taskType, alias] of Object.entries(executeConfig.byType || {})) {
			if (!modelNames.includes(alias)) {
				throw new Error(
					`Pipeline stage execute.byType["${taskType}"] references unknown model: ${alias}`,
				);
			}
		}

		this.#logger.debug("Validation passed");
	}

	private static expandEnvVars(config: Config): Config {
		const configStr = JSON.stringify(config);
		let expandCount = 0;
		const expanded = configStr.replace(/\$\{([^}]+)\}/g, (_, varName) => {
			expandCount++;
			return process.env[varName] || "";
		});
		if (expandCount > 0) {
			this.#logger.debug(`Expanded ${expandCount} env vars`);
		}
		return JSON.parse(expanded);
	}
}
