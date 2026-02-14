/**
 * Pipeline - Main orchestration for AgentOS
 * Coordinates: Parse → Clarify → Decompose → Execute
 */

import type { Config, Goal, Task, Adapter } from '../types/index.ts';
import type { LLMClient } from '../llm/client.ts';
import { StateMachine } from './state-machine.ts';
import { LLMParseStage } from '../stages/parse.ts';
import { LLMDecomposeStage } from '../stages/decompose.ts';
import { LLMClarifyStage } from '../stages/clarify.ts';
import { LLMExecuteStage } from '../stages/execute.ts';
import { Logger } from '../utils/logger.ts';

export class Pipeline {
  private stateMachine: StateMachine;
  private parseStage: LLMParseStage;
  private decomposeStage: LLMDecomposeStage;
  private clarifyStage: LLMClarifyStage;
  private executeStage: LLMExecuteStage;
  private logger: Logger;

  constructor(
    private config: Config,
    private adapter: Adapter,
    private llm: LLMClient
  ) {
    this.stateMachine = new StateMachine();
    this.parseStage = new LLMParseStage(llm);
    this.decomposeStage = new LLMDecomposeStage(llm);
    this.clarifyStage = new LLMClarifyStage(llm);
    this.executeStage = new LLMExecuteStage(llm);
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
      // STAGE 1: PARSE
      this.logger.info(`[${goalId}] Parsing goal...`);
      const goal = await this.parseStage.run(input, goalId);
      await this.adapter.report(goalId, 'pending', `Parsed: ${goal.description.slice(0, 60)}...`);
      
      // STAGE 2: CLARIFY
      this.logger.info(`[${goalId}] Checking for clarifications...`);
      const clarification = await this.clarifyStage.shouldAsk(goal);
      
      if (clarification.blocking) {
        this.logger.info(`[${goalId}] Blocking clarification needed`);
        await this.requestClarification(goal, clarification.questions);
        return;
      }
      
      if (clarification.shouldAsk) {
        this.logger.info(`[${goalId}] Non-blocking questions logged`);
        // Log but continue
      }
      
      // STAGE 3: DECOMPOSE
      this.logger.info(`[${goalId}] Decomposing into tasks...`);
      const tasks = await this.decomposeStage.run(goal);
      this.logger.info(`[${goalId}] Created ${tasks.length} tasks`);
      
      // STAGE 4: EXECUTE tasks
      for (const task of tasks) {
        await this.executeTask(task, goal);
      }
      
      this.logger.info(`[${goalId}] All tasks completed`);
      await this.adapter.report(goalId, 'completed', 'All tasks completed successfully');
      
    } catch (error) {
      this.logger.error(`[${goalId}] Failed`, error);
      await this.adapter.report(goalId, 'failed', String(error));
    }
  }

  private async executeTask(task: Task, goal: Goal): Promise<void> {
    // Check if task needs clarification
    const taskClarification = await this.clarifyStage.shouldAskForTask(task, goal);
    if (taskClarification.blocking) {
      this.logger.info(`[${task.id}] Task blocked - needs clarification`);
      await this.adapter.report(task.id, 'blocked', 'Needs clarification');
      return;
    }
    
    // Claim task
    const claimed = await this.adapter.claimTask(task.id, 'agentos');
    if (!claimed) {
      this.logger.info(`[${task.id}] Already claimed`);
      return;
    }
    
    this.stateMachine.transition(task, 'in_progress');
    await this.adapter.report(task.id, 'in_progress', 'Starting execution');
    
    try {
      this.logger.info(`[${task.id}] Executing...`);
      const result = await this.executeStage.run(task, goal);
      
      this.stateMachine.transition(task, 'complete');
      await this.adapter.report(task.id, 'complete', result.summary);
      
    } catch (error) {
      this.logger.error(`[${task.id}] Failed`, error);
      this.stateMachine.transition(task, 'failed');
      await this.adapter.report(task.id, 'failed', String(error));
    }
  }

  private async requestClarification(
    goal: Goal, 
    questions: Array<{ question: string; blocking: boolean; urgency: string }>
  ): Promise<void> {
    const message = questions.map((q, i) => 
      `${i + 1}. [${q.blocking ? 'BLOCKING' : 'Non-blocking'}] ${q.question}`
    ).join('\n');
    
    await this.adapter.requestClarification(goal.id, message);
  }

  private generateId(): string {
    return `goal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
}
