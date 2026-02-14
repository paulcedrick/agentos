/**
 * Pipeline - Multi-Team Support with Agent Routing
 */

import type { Config, Goal, Task, Adapter, AgentConfig } from '../types/index.ts';
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

  async runCycle(teamId?: string): Promise<void> {
    // Fetch goals for specific team or all teams
    const goals = await this.adapter.pollGoals(teamId);
    
    this.logger.info(`Processing ${goals.length} goals${teamId ? ` for team ${teamId}` : ''}`);
    
    for (const goal of goals) {
      await this.processGoal(goal);
    }
  }

  private async processGoal(goal: Goal): Promise<void> {
    this.logger.info(`[${goal.id}] Processing goal for team ${goal.teamId}`);
    
    try {
      // STAGE 1: PARSE
      this.logger.info(`[${goal.id}] Parsing...`);
      const parsedGoal = await this.parseStage.run(goal.description, goal.id);
      // Preserve teamId from original goal
      parsedGoal.teamId = goal.teamId;
      
      // STAGE 2: CLARIFY
      this.logger.info(`[${goal.id}] Checking clarifications...`);
      const clarification = await this.clarifyStage.shouldAsk(parsedGoal);
      
      if (clarification.blocking) {
        this.logger.info(`[${goal.id}] Blocking clarification needed`);
        await this.requestClarification(goal, clarification.questions);
        return;
      }
      
      // STAGE 3: DECOMPOSE
      this.logger.info(`[${goal.id}] Decomposing...`);
      const tasks = await this.decomposeStage.run(parsedGoal);
      
      // Assign teamId to each task
      for (const task of tasks) {
        task.teamId = goal.teamId;
      }
      
      this.logger.info(`[${goal.id}] Created ${tasks.length} tasks`);
      
      // STAGE 4: EXECUTE tasks (with agent matching)
      for (const task of tasks) {
        await this.executeTaskWithAgentMatching(task, parsedGoal);
      }
      
      this.logger.info(`[${goal.id}] Completed`);
      await this.adapter.report(goal.id, 'completed', 'All tasks completed');
      
    } catch (error) {
      this.logger.error(`[${goal.id}] Failed`, error);
      await this.adapter.report(goal.id, 'failed', String(error));
    }
  }

  private async executeTaskWithAgentMatching(task: Task, goal: Goal): Promise<void> {
    // Find best agent for this task based on capabilities
    const agent = this.findBestAgent(task, goal.teamId);
    
    if (!agent) {
      this.logger.warn(`[${task.id}] No agent found with capabilities: ${task.requiredCapabilities.join(', ')}`);
      await this.adapter.report(task.id, 'blocked', `No agent available for capabilities: ${task.requiredCapabilities.join(', ')}`);
      return;
    }
    
    this.logger.info(`[${task.id}] Assigning to agent: ${agent.name}`);
    
    // Check for task-level clarifications
    const taskClarification = await this.clarifyStage.shouldAskForTask(task, goal);
    if (taskClarification.blocking) {
      await this.adapter.report(task.id, 'blocked', 'Needs clarification');
      return;
    }
    
    // Claim task for this agent
    const claimed = await this.adapter.claim(task.id, agent.id);
    if (!claimed) {
      this.logger.info(`[${task.id}] Already claimed`);
      return;
    }
    
    // Execute
    this.stateMachine.transition(task, 'in_progress');
    await this.adapter.report(task.id, 'in_progress', `Assigned to ${agent.name}`);
    
    try {
      const result = await this.executeStage.run(task, goal);
      
      this.stateMachine.transition(task, 'completed');
      await this.adapter.report(task.id, 'completed', result.summary);
      
    } catch (error) {
      this.logger.error(`[${task.id}] Execution failed`, error);
      this.stateMachine.transition(task, 'failed');
      await this.adapter.report(task.id, 'failed', String(error));
    }
  }

  private findBestAgent(task: Task, teamId: string): AgentConfig | null {
    // Get agents for this team
    const team = this.config.teams[teamId];
    if (!team) return null;
    
    const teamAgents = team.agents
      .map(id => this.config.agents[id])
      .filter(a => a?.isActive);
    
    // Find agent with matching capabilities
    for (const agent of teamAgents) {
      const hasCapabilities = task.requiredCapabilities.every(cap => 
        agent.capabilities.includes(cap)
      );
      if (hasCapabilities) {
        return agent;
      }
    }
    
    // Fallback: return first agent if no exact match
    return teamAgents[0] || null;
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
}
