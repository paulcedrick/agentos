/**
 * Clarify Stage - Detect unclear goals/tasks and ask questions
 */

import { z } from 'zod';
import type { Goal, Task } from '../types/index.ts';
import type { LLMClient } from '../llm/client.ts';

const ClarificationSchema = z.object({
  isClearEnough: z.boolean(),
  confidence: z.number().min(0).max(100),
  questions: z.array(z.object({
    question: z.string(),
    blocking: z.boolean(),
    urgency: z.enum(['low', 'medium', 'high']),
    why: z.string(),
    assumptionIfUnanswered: z.string(),
  })),
});

export interface ClarificationResult {
  shouldAsk: boolean;
  blocking: boolean;
  questions: Array<{
    question: string;
    blocking: boolean;
    urgency: 'low' | 'medium' | 'high';
    why: string;
  }>;
}

export interface ClarifyStage {
  shouldAsk(goal: Goal): Promise<ClarificationResult>;
  shouldAskForTask(task: Task, goal: Goal): Promise<ClarificationResult>;
}

export class LLMClarifyStage implements ClarifyStage {
  constructor(private llm: LLMClient) {}

  async shouldAsk(goal: Goal): Promise<ClarificationResult> {
    const prompt = `Analyze this goal for clarity.

Goal: ${goal.description}
Success Criteria: ${goal.successCriteria.join(', ') || 'Not specified'}
Context: ${goal.context || 'None provided'}

Identify:
1. Missing critical information
2. Ambiguous terms
3. Implicit assumptions
4. Anything that could lead to wrong outcomes

For each issue, determine if it's blocking (can't proceed without answer) or non-blocking (can make reasonable assumption).`;

    const result = await this.llm.generate('clarify', prompt, {
      schema: ClarificationSchema
    });

    const parsed = JSON.parse(result.text);
    const validated = ClarificationSchema.parse(parsed);

    const hasBlocking = validated.questions.some(q => q.blocking);
    const blocking = !validated.isClearEnough || validated.confidence < 60 || hasBlocking;

    return {
      shouldAsk: validated.questions.length > 0,
      blocking,
      questions: validated.questions.map(q => ({
        question: q.question,
        blocking: q.blocking,
        urgency: q.urgency,
        why: q.why
      }))
    };
  }

  async shouldAskForTask(task: Task, goal: Goal): Promise<ClarificationResult> {
    const prompt = `Analyze this task for clarity.

Task: ${task.description}
Type: ${task.type}

Goal Context: ${goal.description}
${goal.context ? `Additional Context: ${goal.context}` : ''}

Is this task clear enough to execute? What, if anything, is missing or ambiguous?`;

    const result = await this.llm.generate('clarify', prompt, {
      schema: ClarificationSchema
    });

    const parsed = JSON.parse(result.text);
    const validated = ClarificationSchema.parse(parsed);

    const hasBlocking = validated.questions.some(q => q.blocking);
    const blocking = !validated.isClearEnough || validated.confidence < 60 || hasBlocking;

    return {
      shouldAsk: validated.questions.length > 0,
      blocking,
      questions: validated.questions.map(q => ({
        question: q.question,
        blocking: q.blocking,
        urgency: q.urgency,
        why: q.why
      }))
    };
  }
}
