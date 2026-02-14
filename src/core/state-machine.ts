import type { Task, TaskStatus } from "../types/index.ts";

export class StateMachine {
	#transitions: Map<TaskStatus, TaskStatus[]> = new Map([
		["pending", ["claimed"]],
		["claimed", ["in_progress", "failed"]],
		["in_progress", ["blocked", "completed", "failed"]],
		["blocked", ["in_progress", "failed"]],
		["completed", []],
		["failed", ["pending"]], // Can retry
	]);

	canTransition(from: TaskStatus, to: TaskStatus): boolean {
		const allowed = this.#transitions.get(from);
		return allowed ? allowed.includes(to) : false;
	}

	transition(task: Task, newStatus: TaskStatus): Result {
		if (!this.canTransition(task.status, newStatus)) {
			return {
				success: false,
				error: `Cannot transition ${task.status} → ${newStatus}`,
			};
		}

		task.status = newStatus;

		if (newStatus === "claimed") {
			task.claimedAt = new Date().toISOString();
		}
		if (newStatus === "completed" || newStatus === "failed") {
			task.completedAt = new Date().toISOString();
		}

		return { success: true };
	}

	getAllowedTransitions(status: TaskStatus): TaskStatus[] {
		return this.#transitions.get(status) || [];
	}
}

interface Result {
	success: boolean;
	error?: string;
}
