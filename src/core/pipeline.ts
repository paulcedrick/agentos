import { Config, Goal, Task, Adapter } from '../types';
import { StateMachine } from './state-machine';
import { Logger } from '../utils/logger';

export class Pipeline {
  private stateMachine: StateMachine;
  private logger: Logger;

  constructor(
    private config: Config,
    private adapter: Adapter
  ) {
    this.stateMachine = new StateMachine();
    this.logger = new Logger('Pipeline');
  }

  async runCycle(): Promise<void> {
    const inputs = await this.adapter.fetchInputs();
    
    for (const input of inputs) {
      await this.processInput(input);
    }
  }

  private async processInput(input: string): Promise<void> {
    const goalId = this.generateId();
    this.logger.info(`Processing goal ${goalId}`);
    
    try {
      // Stage 1: Parse (will use LLMClient from Mori)
      const goal = await this.parseGoal(input, goalId);
      
      // Stage 2: Check for clarifications
      const needsClarification = await this.checkClarifications(goal);
      if (needsClarification.blocking) {
        await this.adapter.notify(`Goal ${goalId} needs clarification`);
        return;
      }
      
      // Stage 3: Decompose
      const tasks = await this.decomposeGoal(goal);
      
      // Stage 4: Execute tasks
      for (const task of tasks) {
        await this.executeTask(task, goal);
      }
      
    } catch (error) {
      this.logger.error(`Failed goal ${goalId}`, error);
      await this.adapter.report(goalId, 'failed', String(error));
    }
  }

  private async parseGoal(input: string, goalId: string): Promise<Goal> {
    // TODO: Integrate with LLMClient from Mori
    this.logger.debug('Parsing goal', { goalId });
    
    // Placeholder - will call parse stage
    return {
      id: goalId,
      source: 'filesystem',
      sourceId: goalId,
      description: input.slice(0, 100),
      successCriteria: [],
      priority: 'medium',
      constraints: [],
      context: '',
      outputFormat: '',
      rawInput: input,
      metadata: { parsedAt: new Date().toISOString() }
    };
  }

  private async checkClarifications(goal: Goal): Promise<{ blocking: boolean }> {
    // TODO: Integrate with clarify stage
    return { blocking: false };
  }

  private async decomposeGoal(goal: Goal): Promise<Task[]> {
    // TODO: Integrate with decompose stage
    this.logger.debug('Decomposing goal', { goalId: goal.id });
    return [];
  }

  private async executeTask(task: Task, goal: Goal): Promise<void> {
    const claimed = await this.adapter.claim(task.id, 'agentos');
    if (!claimed) {
      this.logger.info(`Task ${task.id} already claimed`);
      return;
    }

    this.stateMachine.transition(task, 'in_progress');
    await this.adapter.report(task.id, 'in_progress', 'Starting execution');

    try {
      // TODO: Actual execution via execute stage
      this.stateMachine.transition(task, 'complete');
      await this.adapter.report(task.id, 'complete', 'Task completed');
    } catch (error) {
      this.stateMachine.transition(task, 'failed');
      await this.adapter.report(task.id, 'failed', String(error));
    }
  }

  private generateId(): string {
    return `goal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
}
