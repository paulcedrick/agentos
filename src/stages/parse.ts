/**
 * Parse Stage
 * 
 * Extracts structured Goal from raw input using LLM.
 * Uses: config.pipeline.parse (MiniMax primary, GLM fallback)
 */

import { Goal } from '../types';

export interface ParseStage {
  run(input: string, goalId: string): Promise<Goal>;
}

// Implementation will use LLMClient
// export class LLMParseStage implements ParseStage { ... }
