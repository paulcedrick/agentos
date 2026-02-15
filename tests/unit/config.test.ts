import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { ConfigLoader } from "../../src/config/config.ts";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("ConfigLoader", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "config-test-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	function writeConfig(config: any): string {
		const path = join(tempDir, "config.json");
		writeFileSync(path, JSON.stringify(config));
		return path;
	}

	function validConfig() {
		return {
			agents: {
				a1: {
					id: "a1",
					name: "Agent 1",
					capabilities: ["code"],
					teams: ["t1"],
					maxParallelTasks: 1,
					isActive: true,
				},
			},
			teams: {
				t1: {
					id: "t1",
					name: "Team 1",
					agents: ["a1"],
					goalsDir: "team-1",
				},
			},
			models: {
				"model-1": {
					provider: "moonshot",
					package: "test",
					modelId: "m1",
					baseUrl: "https://api.moonshot.cn/v1",
					apiKeyEnv: "KEY",
					pricing: { inputPer1k: 0.01, outputPer1k: 0.02 },
				},
			},
			pipeline: {
				parse: { primary: "model-1" },
				decompose: { primary: "model-1" },
				clarify: { primary: "model-1" },
				execute: { default: "model-1" },
			},
			costTracking: {
				enabled: false,
				monthlyBudget: 100,
				currency: "USD",
				alertAtPercent: 80,
			},
			adapters: { filesystem: { enabled: true, baseDir: "/tmp/test" } },
			pollingIntervalMs: 60000,
		};
	}

	test("loads valid config successfully", async () => {
		const path = writeConfig(validConfig());
		const config = await ConfigLoader.load(path);
		expect(config.agents["a1"].name).toBe("Agent 1");
		expect(config.teams["t1"].agents).toContain("a1");
	});

	test("throws on missing config file", async () => {
		await expect(ConfigLoader.load("/nonexistent/path.json")).rejects.toThrow(
			"Config file not found",
		);
	});

	test("throws when no agents defined", async () => {
		const cfg = validConfig();
		cfg.agents = {};
		const path = writeConfig(cfg);
		await expect(ConfigLoader.load(path)).rejects.toThrow("at least one agent");
	});

	test("throws when no teams defined", async () => {
		const cfg = validConfig();
		cfg.teams = {};
		const path = writeConfig(cfg);
		await expect(ConfigLoader.load(path)).rejects.toThrow("at least one team");
	});

	test("throws when team references unknown agent", async () => {
		const cfg = validConfig();
		cfg.teams["t1"].agents = ["nonexistent"];
		const path = writeConfig(cfg);
		await expect(ConfigLoader.load(path)).rejects.toThrow("unknown agent");
	});

	test("throws when agent references unknown team", async () => {
		const cfg = validConfig();
		cfg.agents["a1"].teams = ["nonexistent"];
		const path = writeConfig(cfg);
		await expect(ConfigLoader.load(path)).rejects.toThrow("unknown team");
	});

	test("throws when pipeline references unknown model", async () => {
		const cfg = validConfig();
		cfg.pipeline.parse.primary = "nonexistent";
		const path = writeConfig(cfg);
		await expect(ConfigLoader.load(path)).rejects.toThrow("unknown model");
	});

	test("expands environment variables", async () => {
		process.env.TEST_VAR_FOR_CONFIG = "expanded_value";
		const cfg = validConfig();
		cfg.adapters.filesystem.baseDir = "${TEST_VAR_FOR_CONFIG}/goals";
		const path = writeConfig(cfg);
		const config = await ConfigLoader.load(path);
		expect(config.adapters.filesystem.baseDir).toBe("expanded_value/goals");
		delete process.env.TEST_VAR_FOR_CONFIG;
	});
});
