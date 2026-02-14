/**
 * Decompose Stage
 * 
 * Breaks Goal into executable Tasks using LLM.
 * Uses: config.pipeline.decompose (Kimi K2 primary, GLM fallback)
 */

import { Goal, Task } from '../types';

export interface DecomposeStage {
  run(goal: Goal): Promise<Task[]>;
}

// Implementation will use LLMClient
// export class LLMDecomposeStage implements DecomposeStage { ... }
