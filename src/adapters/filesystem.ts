/**
 * FileSystem Adapter - Multi-Team Support
 * Reads goals from team-specific subdirectories
 */

import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { Goal, Adapter, Config } from '../types/index.ts';

export interface FileSystemAdapterConfig {
  baseDir: string;
}

export class FileSystemAdapter implements Adapter {
  name = 'filesystem';
  private baseDir: string;
  private config?: Config;

  constructor(config: FileSystemAdapterConfig) {
    this.baseDir = config.baseDir.replace('~', process.env.HOME || '');
  }

  setConfig(config: Config): void {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Create base directory
    await mkdir(this.baseDir, { recursive: true });
    
    // Create team subdirectories
    if (this.config) {
      for (const [teamId, team] of Object.entries(this.config.teams)) {
        const teamDir = join(this.baseDir, team.goalsDir);
        await mkdir(teamDir, { recursive: true });
        
        // Create done subdirectory for each team
        await mkdir(join(teamDir, 'done'), { recursive: true });
      }
    }
  }

  getGoalsDir(teamId: string): string {
    if (!this.config) {
      throw new Error('Config not set');
    }
    const team = this.config.teams[teamId];
    if (!team) {
      throw new Error(`Team not found: ${teamId}`);
    }
    return join(this.baseDir, team.goalsDir);
  }

  async fetchInputs(teamId?: string): Promise<string[]> {
    if (teamId) {
      // Fetch from specific team
      const teamDir = this.getGoalsDir(teamId);
      return this.fetchFromDirectory(teamDir);
    }
    
    // Fetch from all teams
    const allInputs: string[] = [];
    for (const teamId of Object.keys(this.config?.teams || {})) {
      const teamDir = this.getGoalsDir(teamId);
      const inputs = await this.fetchFromDirectory(teamDir);
      allInputs.push(...inputs);
    }
    return allInputs;
  }

  private async fetchFromDirectory(dir: string): Promise<string[]> {
    try {
      const files = await readdir(dir);
      const goalFiles = files.filter(f => f.endsWith('.goal.md'));
      
      const inputs: string[] = [];
      for (const file of goalFiles) {
        const content = await readFile(join(dir, file), 'utf-8');
        inputs.push(content);
      }
      return inputs;
    } catch {
      return [];
    }
  }

  async pollGoals(teamId?: string): Promise<Goal[]> {
    const inputs = await this.fetchInputs(teamId);
    const goals: Goal[] = [];
    
    for (const input of inputs) {
      const goal = await this.parseGoalFile(input);
      if (goal.status === 'pending') {
        goals.push(goal);
      }
    }
    
    return goals;
  }

  private async parseGoalFile(content: string): Promise<Goal> {
    // Extract team from frontmatter or parse it
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    
    let frontmatter: Record<string, any> = {};
    let body = content;
    
    if (match) {
      const [, fmStr, bodyStr] = match;
      body = bodyStr.trim();
      
      for (const line of fmStr.split('\n')) {
        const idx = line.indexOf(':');
        if (idx > 0) {
          frontmatter[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }
      }
    }
    
    return {
      id: frontmatter.id || `goal-${Date.now()}`,
      source: 'filesystem',
      sourceId: frontmatter.id || 'unknown',
      teamId: frontmatter.team || 'unknown',
      description: body,
      successCriteria: frontmatter.successCriteria?.split(',') || [],
      priority: frontmatter.priority || 'medium',
      status: frontmatter.status || 'pending',
      createdBy: frontmatter.createdBy || 'unknown',
      createdAt: frontmatter.createdAt || new Date().toISOString(),
      metadata: { frontmatter }
    };
  }

  async claim(inputId: string, agentId: string): Promise<boolean> {
    // Find the goal file and create a lock
    for (const teamId of Object.keys(this.config?.teams || {})) {
      const teamDir = this.getGoalsDir(teamId);
      const lockFile = join(teamDir, `${inputId}.lock`);
      
      try {
        await writeFile(lockFile, agentId, { flag: 'wx' });
        return true;
      } catch {
        // Lock exists, try next team or return false
      }
    }
    return false;
  }

  async report(inputId: string, status: string, message?: string): Promise<void> {
    // Update the goal file with new status
    for (const teamId of Object.keys(this.config?.teams || {})) {
      const teamDir = this.getGoalsDir(teamId);
      const goalFile = join(teamDir, `${inputId}.goal.md`);
      
      try {
        const content = await readFile(goalFile, 'utf-8');
        const updated = content.replace(
          /status:.*$/m,
          `status: ${status}`
        );
        await writeFile(goalFile, updated);
        return;
      } catch {
        // File not in this team, continue
      }
    }
  }

  async notify(message: string): Promise<void> {
    console.log(`[NOTIFY] ${message}`);
  }

  // Legacy method for compatibility
  async claimTask(taskId: string, agentId: string): Promise<boolean> {
    return this.claim(taskId, agentId);
  }

  async updateGoal(goalId: string, status: string, message?: string): Promise<void> {
    await this.report(goalId, status, message);
  }

  async requestClarification(goalId: string, question: string): Promise<void> {
    for (const teamId of Object.keys(this.config?.teams || {})) {
      const teamDir = this.getGoalsDir(teamId);
      const clarFile = join(teamDir, `${goalId}.clarification.md`);
      
      try {
        await writeFile(clarFile, `# Clarification Request\n\n${question}\n`);
        return;
      } catch {
        // Continue to next team
      }
    }
  }
}
