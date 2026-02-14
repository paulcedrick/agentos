import { Task, TaskStatus } from '../types';

export class StateMachine {
  private transitions: Map<TaskStatus, TaskStatus[]> = new Map([
    ['pending', ['claimed']],
    ['claimed', ['in_progress', 'failed']],
    ['in_progress', ['blocked', 'complete', 'failed']],
    ['blocked', ['in_progress', 'failed']],
    ['complete', []],
    ['failed', ['pending']]  // Can retry
  ]);

  canTransition(from: TaskStatus, to: TaskStatus): boolean {
    const allowed = this.transitions.get(from);
    return allowed ? allowed.includes(to) : false;
  }

  transition(task: Task, newStatus: TaskStatus): Result {
    if (!this.canTransition(task.status, newStatus)) {
      return {
        success: false,
        error: `Cannot transition ${task.status} → ${newStatus}`
      };
    }

    const oldStatus = task.status;
    task.status = newStatus;
    task.metadata.lastTransitionAt = new Date().toISOString();
    task.metadata.transitionHistory = task.metadata.transitionHistory || [];
    task.metadata.transitionHistory.push({
      from: oldStatus,
      to: newStatus,
      at: new Date().toISOString()
    });

    if (newStatus === 'claimed') {
      task.claimedAt = new Date();
    }
    if (newStatus === 'complete' || newStatus === 'failed') {
      task.completedAt = new Date();
    }

    return { success: true };
  }

  getAllowedTransitions(status: TaskStatus): TaskStatus[] {
    return this.transitions.get(status) || [];
  }
}

interface Result {
  success: boolean;
  error?: string;
}
