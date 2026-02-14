/**
 * Execute Stage
 * 
 * Executes a Task and produces results.
 * Uses: config.pipeline.execute (varies by task type)
 */

import { Goal, Task, TaskResult } from '../types';

export interface ExecuteStage {
  run(task: Task, goal: Goal): Promise<TaskResult>;
}

// Implementation will use LLMClient
// export class LLMExecuteStage implements ExecuteStage { ... }
