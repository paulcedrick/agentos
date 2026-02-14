/**
 * FileSystem Adapter
 * Reads goals from .md files in a directory
 */

import { readdir, readFile, writeFile, mkdir, rename } from 'fs/promises';
import { join } from 'path';
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
    this.doneDir = config.doneDir || join(config.goalsDir, 'done');
  }

  private async ensureDirs() {
    try {
      await mkdir(this.goalsDir, { recursive: true });
      await mkdir(this.doneDir, { recursive: true });
    } catch {}
  }

  async pollGoals(): Promise<Goal[]> {
    await this.ensureDirs();
    const files = await readdir(this.goalsDir);
    const goalFiles = files.filter((f) => f.endsWith('.goal.md'));
    const goals: Goal[] = [];

    for (const file of goalFiles) {
      const path = join(this.goalsDir, file);
      const parsed = await this.parseGoalFile(path);

      if (parsed.frontmatter.status !== 'pending') continue;

      goals.push({
        id: file.replace('.goal.md', ''),
        source: 'filesystem',
        sourceId: file,
        description: parsed.body,
        successCriteria: parsed.frontmatter.successCriteria || [],
        context: parsed.frontmatter.context,
        priority: parsed.frontmatter.priority || 'medium',
        status: 'pending',
        createdBy: parsed.frontmatter.createdBy || 'unknown',
        createdAt: parsed.frontmatter.createdAt || new Date().toISOString(),
        metadata: { file: path },
      });
    }
    return goals;
  }

  private async parseGoalFile(path: string) {
    const content = await readFile(path, 'utf-8');
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { frontmatter: {}, body: content };

    const [, fmStr, body] = match;
    const frontmatter: Record<string, any> = {};
    for (const line of fmStr.split('\n')) {
      const idx = line.indexOf(':');
      if (idx > 0) {
        frontmatter[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      }
    }
    return { frontmatter, body: body.trim() };
  }

  async claimTask(taskId: string, agentId: string): Promise<boolean> {
    const lockFile = join(this.goalsDir, `${taskId}.lock`);
    try {
      await writeFile(lockFile, agentId, { flag: 'wx' });
      return true;
    } catch {
      return false;
    }
  }

  async updateGoal(goalId: string, status: string, message?: string): Promise<void> {
    const goalFile = `${goalId}.goal.md`;
    const path = join(this.goalsDir, goalFile);
    try {
      const content = await readFile(path, 'utf-8');
      const parsed = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (!parsed) return;

      const fm: Record<string, any> = {};
      for (const line of parsed[1].split('\n')) {
        const idx = line.indexOf(':');
        if (idx > 0) fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      }
      fm.status = status;
      if (message) fm.lastMessage = message;

      const fmLines = Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join('\n');
      const newContent = `---\n${fmLines}\n---\n${parsed[2]}`;

      if (status === 'completed' || status === 'done') {
        await writeFile(join(this.doneDir, goalFile), newContent);
      } else {
        await writeFile(path, newContent);
      }
    } catch (e) {
      console.error(`Failed to update goal ${goalId}:`, e);
    }
  }

  async updateTask(taskId: string, status: string, message?: string): Promise<void> {
    console.log(`[filesystem] Task ${taskId}: ${status} ${message || ''}`);
  }

  async requestClarification(goalId: string, question: string): Promise<void> {
    const clarFile = join(this.goalsDir, `${goalId}.clarification.md`);
    await writeFile(clarFile, `# Clarification Request\n\n## Question\n${question}\n\n## Status\nAwaiting answer...\n`);
  }

  async notify(recipients: string[], message: string): Promise<void> {
    console.log(`[NOTIFY] ${recipients.join(', ')}: ${message}`);
  }
}
