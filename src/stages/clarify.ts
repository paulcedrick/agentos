/**
 * Clarify Stage
 * 
 * Detects when goal/task is unclear and asks for clarification.
 * Uses: config.pipeline.clarify (Kimi K2 primary, MiniMax fallback)
 */

import { Goal, Task } from '../types';

export interface ClarificationResult {
  shouldAsk: boolean;
  blocking: boolean;
  questions: Array<{
    question: string;
    blocking: boolean;
    urgency: 'low' | 'medium' | 'high';
  }>;
}

export interface ClarifyStage {
  shouldAsk(goal: Goal): Promise<ClarificationResult>;
  ask(goal: Goal, questions: any[]): Promise<void>;
}

// Implementation will use LLMClient
// export class LLMClarifyStage implements ClarifyStage { ... }
