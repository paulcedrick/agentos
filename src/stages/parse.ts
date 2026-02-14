/**
 * Parse Stage - Extract structured Goal from raw input using LLM
 */

import { z } from 'zod';
import type { Goal } from '../types/index.ts';
import type { LLMClient } from '../llm/client.ts';

const GoalParseSchema = z.object({
  description: z.string().describe('Clear, concise description of the goal'),
  successCriteria: z.array(z.string()).describe('Specific, measurable outcomes'),
  context: z.string().optional().describe('Background information and constraints'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).describe('Priority level'),
});

export interface ParseStage {
  run(input: string, goalId: string): Promise<Goal>;
}

export class LLMParseStage implements ParseStage {
  constructor(private llm: LLMClient) {}

  async run(input: string, goalId: string): Promise<Goal> {
    const prompt = `Analyze this goal description and extract structured information.

Input:
"""
${input}
"""

Extract:
1. A clear, concise description of what needs to be done
2. Specific, measurable success criteria (how will we know it's done?)
3. Any background context or constraints
4. Priority level (low, medium, high, urgent)

Respond with structured data.`;

    const result = await this.llm.generate('parse', prompt, {
      schema: GoalParseSchema
    });

    const parsed = JSON.parse(result.text);
    const validated = GoalParseSchema.parse(parsed);

    return {
      id: goalId,
      source: 'filesystem',
      sourceId: goalId,
      description: validated.description,
      successCriteria: validated.successCriteria,
      context: validated.context,
      priority: validated.priority,
      status: 'pending',
      createdBy: 'agentos',
      createdAt: new Date().toISOString(),
      metadata: {
        parsedAt: new Date().toISOString(),
        inputLength: input.length
      }
    };
  }
}
