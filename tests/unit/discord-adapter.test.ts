import { describe, test, expect, beforeEach, mock } from "bun:test";
import { DiscordAdapter } from "../../src/adapters/discord.ts";
import type { Config } from "../../src/types/index.ts";

// Mock discord.js Client to avoid real connections
mock.module("discord.js", () => {
	class MockClient {
		user = { tag: "TestBot#0001" };
		#readyCallback: (() => void) | null = null;

		constructor(_opts: any) {}

		once(event: string, cb: () => void) {
			if (event === "clientReady") {
				this.#readyCallback = cb;
			}
		}

		on(_event: string, _cb: (...args: any[]) => void) {}

		async login(_token: string) {
			// Simulate async ready
			queueMicrotask(() => this.#readyCallback?.());
		}

		channels = {
			fetch: async (_id: string) => null,
		};

		async destroy() {}
	}

	return {
		Client: MockClient,
		GatewayIntentBits: {
			Guilds: 1,
			GuildMessages: 2,
			MessageContent: 3,
		},
		TextChannel: class {},
	};
});

function makeConfig(overrides?: Partial<Config>): Config {
	return {
		agents: {
			a1: {
				id: "a1",
				name: "Agent 1",
				capabilities: ["code"],
				discordId: "123456",
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
		models: {},
		pipeline: {
			parse: { primary: "" },
			decompose: { primary: "" },
			clarify: { primary: "" },
			execute: { default: "" },
		},
		costTracking: {
			enabled: false,
			monthlyBudget: 0,
			currency: "USD",
			alertAtPercent: 80,
		},
		adapters: {
			filesystem: { enabled: true, baseDir: "/tmp" },
			discord: {
				enabled: true,
				botToken: "test-token",
				taskChannelId: "chan-1",
				adminUserId: "admin-123",
			},
		},
		pollingIntervalMs: 60000,
		...overrides,
	};
}

describe("DiscordAdapter", () => {
	let adapter: DiscordAdapter;

	beforeEach(() => {
		adapter = new DiscordAdapter({
			botToken: "test-token",
			taskChannelId: "chan-1",
		});
	});

	test("has name 'discord'", () => {
		expect(adapter.name).toBe("discord");
	});

	test("initialize() resolves after client ready", async () => {
		await adapter.initialize();
		// If we get here, initialize resolved successfully
		expect(true).toBe(true);
	});

	test("pollGoals() returns empty array", async () => {
		const goals = await adapter.pollGoals("t1");
		expect(goals).toEqual([]);
	});

	test("fetchInputs() returns empty array", async () => {
		const inputs = await adapter.fetchInputs();
		expect(inputs).toEqual([]);
	});

	test("getGoalsDir() returns empty string", () => {
		expect(adapter.getGoalsDir("t1")).toBe("");
	});

	test("claim() returns false when no config set", async () => {
		const result = await adapter.claim("input-1", "a1");
		expect(result).toBe(false);
	});

	test("claim() returns true when agent has discordId", async () => {
		adapter.setConfig(makeConfig());
		const result = await adapter.claim("input-1", "a1");
		expect(result).toBe(true);
	});

	test("claim() returns false when agent has no discordId", async () => {
		const config = makeConfig();
		delete config.agents["a1"].discordId;
		adapter.setConfig(config);
		const result = await adapter.claim("input-1", "a1");
		expect(result).toBe(false);
	});

	test("claim() returns false for unknown agent", async () => {
		adapter.setConfig(makeConfig());
		const result = await adapter.claim("input-1", "unknown");
		expect(result).toBe(false);
	});

	test("report() throws before initialize()", async () => {
		expect(() => adapter.report("id", "done", "msg")).toThrow(
			"not initialized",
		);
	});

	test("notify() throws before initialize()", async () => {
		expect(() => adapter.notify("hello")).toThrow("not initialized");
	});

	test("requestClarification() throws before initialize()", async () => {
		expect(() => adapter.requestClarification("goal-1", "question?")).toThrow(
			"not initialized",
		);
	});

	test("report() does not throw after initialize()", async () => {
		await adapter.initialize();
		// Channel fetch returns null, so it returns early without error
		await adapter.report("id", "done", "msg");
	});

	test("notify() does not throw after initialize()", async () => {
		await adapter.initialize();
		await adapter.notify("hello");
	});

	test("requestClarification() warns when no adminUserId configured", async () => {
		await adapter.initialize();
		adapter.setConfig(
			makeConfig({
				adapters: {
					filesystem: { enabled: true, baseDir: "/tmp" },
					discord: {
						enabled: true,
						botToken: "test",
						taskChannelId: "chan",
					},
				},
			}),
		);
		// Should not throw, just log a warning
		await adapter.requestClarification("goal-1", "question?");
	});

	test("destroy() can be called", async () => {
		await adapter.initialize();
		await adapter.destroy();
		// After destroy, methods should throw (not ready)
		expect(() => adapter.report("id", "done", "msg")).toThrow(
			"not initialized",
		);
	});
});
