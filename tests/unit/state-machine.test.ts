import { describe, test, expect } from "bun:test";
import { StateMachine } from "../../src/core/state-machine.ts";

describe("StateMachine", () => {
	const sm = new StateMachine();

	test("allows valid transitions", () => {
		expect(sm.canTransition("pending", "claimed")).toBe(true);
		expect(sm.canTransition("claimed", "in_progress")).toBe(true);
		expect(sm.canTransition("in_progress", "completed")).toBe(true);
		expect(sm.canTransition("in_progress", "failed")).toBe(true);
		expect(sm.canTransition("in_progress", "blocked")).toBe(true);
		expect(sm.canTransition("failed", "pending")).toBe(true);
	});

	test("rejects invalid transitions", () => {
		expect(sm.canTransition("pending", "completed")).toBe(false);
		expect(sm.canTransition("pending", "in_progress")).toBe(false);
		expect(sm.canTransition("completed", "pending")).toBe(false);
		expect(sm.canTransition("completed", "failed")).toBe(false);
	});

	test("transition mutates task status", () => {
		const task = {
			id: "test-1",
			goalId: "g1",
			teamId: "t1",
			description: "test",
			type: "code" as const,
			status: "pending" as const,
			requiredCapabilities: [],
			order: 0,
			dependencies: [],
			metadata: {} as Record<string, any>,
		};

		const result = sm.transition(task as any, "claimed");
		expect(result.success).toBe(true);
		expect(task.status).toBe("claimed");
		expect(task.claimedAt).toBeDefined();
	});

	test("transition returns error for invalid transition", () => {
		const task = {
			id: "test-2",
			goalId: "g1",
			teamId: "t1",
			description: "test",
			type: "code" as const,
			status: "pending" as const,
			requiredCapabilities: [],
			order: 0,
			dependencies: [],
			metadata: {} as Record<string, any>,
		};

		const result = sm.transition(task as any, "completed");
		expect(result.success).toBe(false);
		expect(result.error).toContain("Cannot transition");
		expect(task.status).toBe("pending");
	});

	test("getAllowedTransitions returns correct states", () => {
		expect(sm.getAllowedTransitions("pending")).toEqual(["claimed"]);
		expect(sm.getAllowedTransitions("in_progress")).toContain("completed");
		expect(sm.getAllowedTransitions("completed")).toEqual([]);
	});
});
