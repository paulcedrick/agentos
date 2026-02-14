/**
 * Decompose Stage - Break Goal into executable Tasks using LLM
 */

import { z } from 'zod';
import type { Goal, Task } from '../types/index.ts';
import type { LLMClient } from '../llm/client.ts';

const TaskSchema = z.object({
  description: z.string().describe('Specific, actionable task description'),
  type: z.enum(['research', 'write', 'code', 'design', 'review', 'analysis', 'test', 'implement']),
  requiredCapabilities: z.array(z.string()).describe('Skills needed (e.g., ["research", "writing"])'),
  estimatedEffort: z.string().describe('Time estimate (e.g., "2 hours", "1 day")'),
  dependencies: z.array(z.number()).optional().describe('Indices of tasks this depends on'),
});

const DecompositionSchema = z.object({
  tasks: z.array(TaskSchema).min(1).max(10),
  strategy: z.string().describe('Brief explanation of the decomposition approach'),
});

export interface DecomposeStage {
  run(goal: Goal): Promise<Task[]>;
}

export class LLMDecomposeStage implements DecomposeStage {
  constructor(private llm: LLMClient) {}

  async run(goal: Goal): Promise<Task[]> {
    const prompt = `Decompose this goal into executable tasks.

Goal: ${goal.description}

Success Criteria:
${goal.successCriteria.map(c => `- ${c}`).join('\n')}

${goal.context ? `Context:\n${goal.context}\n` : ''}

Break this down into 2-7 specific, actionable tasks. Each task should:
- Be concrete and completable
- Specify required capabilities (skills needed)
- Have a realistic time estimate
- Note any dependencies on other tasks

Strategy: Start with research/planning tasks, then implementation, then review.`;

    const result = await this.llm.generate('decompose', prompt, {
      schema: DecompositionSchema
    });

    const parsed = JSON.parse(result.text);
    const validated = DecompositionSchema.parse(parsed);

    // Convert to Task objects with IDs
    const tasks: Task[] = validated.tasks.map((t, index) => ({
      id: `${goal.id}-task-${index + 1}`,
      goalId: goal.id,
      description: t.description,
      type: t.type,
      requiredCapabilities: t.requiredCapabilities,
      estimatedEffort: t.estimatedEffort,
      status: 'pending',
      dependencies: t.dependencies?.map(d => `${goal.id}-task-${d + 1}`) || [],
      metadata: {
        rationale: validated.strategy,
        order: index
      }
    }));

    return tasks;
  }
}
