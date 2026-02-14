/**
 * FileSystem Adapter
 * Reads goals from .md files in a directory
 */

import type { Goal, AgentOSAdapter } from '../types/index.ts';

export interface FileSystemAdapterConfig {
  goalsDir: string;
  doneDir?: string;
}

export class FileSystemAdapter implements AgentOSAdapter {
  name = 'filesystem';
  
  private goalsDir: string;
  private doneDir: string;
  
  constructor(config: FileSystemAdapterConfig) {
    this.goalsDir = config.goalsDir;
    this.doneDir = config.doneDir || `${goalsDir}/done`;
  }

  async pollGoals(): Promise<Goal[]> {
    // TODO: Read .goal.md files from goalsDir
    // Parse frontmatter + content
    // Return Goal[]
    throw new Error('Not implemented');
  }

  async claimTask(taskId: string, agentId: string): Promise<boolean> {
    // TODO: Create .lock file
    throw new Error('Not implemented');
  }

  async updateGoal(goalId: string, status: string, message?: string): Promise<void> {
    // TODO: Update goal file status
    throw new Error('Not implemented');
  }

  async updateTask(taskId: string, status: string, message?: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async requestClarification(goalId: string, question: string): Promise<void> {
    // TODO: Create clarification file or add to goal
    throw new Error('Not implemented');
  }

  async notify(recipients: string[], message: string): Promise<void> {
    // TODO: Log to console for now
    console.log(`[NOTIFY] ${recipients.join(', ')}: ${message}`);
  }
}
