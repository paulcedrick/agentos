/**
 * End-to-End Test for AgentOS
 *
 * Tests the full pipeline with mocked LLM providers.
 * No real API calls - all LLM responses are mocked.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
	mkdtempSync,
	writeFileSync,
	mkdirSync,
	rmSync,
	readFileSync,
	readdirSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { Config } from "../src/types/index.ts";
import { FileSystemAdapter } from "../src/adapters/filesystem.ts";
import { Pipeline } from "../src/core/pipeline.ts";

// Mock LLM Client
class MockLLMClient {
	#responses: Map<string, any> = new Map();

	setResponse(stage: string, response: any) {
		this.#responses.set(stage, response);
	}

	async generate(
		stage: string,
		prompt: string,
		options?: { schema?: object; modelAlias?: string },
	): Promise<{ text: string; usage: { prompt: number; completion: number } }> {
		const response = this.#responses.get(stage);
		if (!response) {
			throw new Error(`No mock response set for stage: ${stage}`);
		}

		return {
			text: JSON.stringify(response),
			usage: { prompt: 100, completion: 50 },
		};
	}

	getModelForStage(stage: string): string {
		return "mock-model";
	}
}

// Test configuration
function createTestConfig(baseDir: string): Config {
	return {
		agents: {
			"agent-1": {
				id: "agent-1",
				name: "Test Agent",
				capabilities: [
					"research",
					"writing",
					"test",
					"code",
					"design",
					"review",
				],
				teams: ["team-1"],
				maxParallelTasks: 3,
				isActive: true,
			},
		},
		teams: {
			"team-1": {
				id: "team-1",
				name: "Test Team",
				agents: ["agent-1"],
				goalsDir: "team-1",
			},
		},
		models: {
			"kimi-k2": {
				provider: "moonshot",
				package: "@ai-sdk/moonshot",
				modelId: "kimi-k2.5",
				baseUrl: "https://api.kimi.com/coding",
				apiKeyEnv: "MOONSHOT_API_KEY",
				pricing: { inputPer1k: 0.005, outputPer1k: 0.015 },
			},
			minimax: {
				provider: "minimax",
				package: "@ai-sdk/minimax",
				modelId: "MiniMax-M2.5",
				apiKeyEnv: "MINIMAX_API_KEY",
				pricing: { inputPer1k: 0.0015, outputPer1k: 0.006 },
			},
			"glm-47": {
				provider: "zhipu",
				package: "@ai-sdk/zhipu",
				modelId: "glm-4.7",
				apiKeyEnv: "ZHIPU_API_KEY",
				pricing: { inputPer1k: 0.003, outputPer1k: 0.009 },
			},
		},
		pipeline: {
			parse: {
				primary: "minimax",
				fallback: "glm-47",
				timeoutMs: 10000,
				maxRetries: 2,
			},
			decompose: {
				primary: "kimi-k2",
				fallback: "glm-47",
				timeoutMs: 30000,
				maxRetries: 2,
			},
			clarify: {
				primary: "kimi-k2",
				fallback: "minimax",
				timeoutMs: 20000,
				maxRetries: 2,
			},
			execute: {
				default: "kimi-k2",
				byType: { code: "kimi-k2", research: "minimax", write: "glm-47" },
				fallback: "glm-47",
				timeoutMs: 60000,
				maxRetries: 2,
			},
		},
		costTracking: {
			enabled: true,
			monthlyBudget: 100,
			currency: "USD",
			alertAtPercent: 80,
			webhookUrl: "",
		},
		adapters: {
			filesystem: {
				enabled: true,
				baseDir,
			},
		},
		pollingIntervalMs: 60000,
	};
}

describe("AgentOS E2E", () => {
	let tempDir: string;
	let goalsDir: string;
	let adapter: FileSystemAdapter;
	let mockLLM: MockLLMClient;
	let pipeline: Pipeline;

	beforeEach(async () => {
		tempDir = mkdtempSync(join(tmpdir(), "agentos-test-"));
		goalsDir = join(tempDir, "team-1");
		mkdirSync(goalsDir, { recursive: true });

		const config = createTestConfig(tempDir);

		adapter = new FileSystemAdapter({ baseDir: tempDir });
		adapter.setConfig(config);
		await adapter.initialize();

		mockLLM = new MockLLMClient();
		pipeline = new Pipeline(config, adapter, mockLLM as any);
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	test("parses and executes a simple goal", async () => {
		const goalContent = `---
id: test
team: team-1
status: pending
---
# Write a blog post about AI agents

Write a 1000-word technical blog post explaining AI agents to developers.
Target audience: senior engineers
Tone: technical but accessible`;

		writeFileSync(join(goalsDir, "test.goal.md"), goalContent);

		mockLLM.setResponse("parse", {
			description: "Write a technical blog post about AI agents",
			successCriteria: [
				"1000 word blog post",
				"technical accuracy",
				"developer-focused",
			],
			context: "Target: senior engineers, Tone: technical but accessible",
			priority: "medium",
		});

		mockLLM.setResponse("clarify", {
			isClearEnough: true,
			confidence: 85,
			questions: [],
		});

		mockLLM.setResponse("decompose", {
			tasks: [
				{
					description: "Research AI agent concepts and current landscape",
					type: "research",
					requiredCapabilities: ["research"],
					estimatedEffort: "2 hours",
					dependencies: [],
				},
				{
					description: "Write blog post draft",
					type: "write",
					requiredCapabilities: ["writing"],
					estimatedEffort: "4 hours",
					dependencies: [0],
				},
			],
			strategy: "Research first, then write",
		});

		mockLLM.setResponse("execute", {
			summary:
				"Researched AI agents. Found: LLM-based autonomous agents are trending.",
			artifacts: [],
		});

		await pipeline.runCycle();

		// Verify goal was processed - check status update
		const goalPath = join(goalsDir, "test.goal.md");
		const updatedContent = readFileSync(goalPath, "utf-8");
		expect(updatedContent).toContain("status: completed");
	});

	test("asks for clarification when goal is unclear", async () => {
		const goalContent = `---
id: vague
team: team-1
status: pending
---
# Do something with AI

Make it good.`;

		writeFileSync(join(goalsDir, "vague.goal.md"), goalContent);

		mockLLM.setResponse("parse", {
			description: "Do something with AI",
			successCriteria: [],
			priority: "low",
		});

		mockLLM.setResponse("clarify", {
			isClearEnough: false,
			confidence: 30,
			questions: [
				{
					question: "What specific AI task do you want to accomplish?",
					blocking: true,
					urgency: "high",
					why: "Too vague to execute",
					assumptionIfUnanswered: "Cannot proceed",
				},
			],
		});

		await pipeline.runCycle();

		// Verify clarification file was created
		const files = readdirSync(goalsDir);
		const clarificationFiles = files.filter((f) =>
			f.endsWith(".clarification.md"),
		);
		expect(clarificationFiles.length).toBeGreaterThan(0);

		// Verify clarification content
		const clarContent = readFileSync(
			join(goalsDir, clarificationFiles[0]),
			"utf-8",
		);
		expect(clarContent).toContain("Clarification Request");
		expect(clarContent).toContain("What specific AI task");
	});

	test("handles multiple goals in one cycle", async () => {
		for (let i = 0; i < 3; i++) {
			const goalContent = `---
id: goal-${i}
team: team-1
status: pending
---
# Goal ${i + 1}

Test goal ${i + 1} description.`;
			writeFileSync(join(goalsDir, `goal-${i}.goal.md`), goalContent);
		}

		mockLLM.setResponse("parse", {
			description: "Test goal",
			successCriteria: ["Complete test"],
			priority: "low",
		});

		mockLLM.setResponse("clarify", {
			isClearEnough: true,
			confidence: 90,
			questions: [],
		});

		mockLLM.setResponse("decompose", {
			tasks: [
				{
					description: "Complete test task",
					type: "research",
					requiredCapabilities: ["test"],
					estimatedEffort: "1 hour",
					dependencies: [],
				},
			],
			strategy: "Simple test",
		});

		mockLLM.setResponse("execute", {
			summary: "Test completed",
			artifacts: [],
		});

		await pipeline.runCycle();

		// Verify all goals were processed
		for (let i = 0; i < 3; i++) {
			const goalPath = join(goalsDir, `goal-${i}.goal.md`);
			const content = readFileSync(goalPath, "utf-8");
			expect(content).toContain("status: completed");
		}
	});
});
