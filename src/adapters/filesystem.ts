/**
 * FileSystem Adapter - Implementation
 * Reads goals from .md files in a directory
 */

import { readdir, readFile, writeFile, mkdir, rename } from 'fs/promises';
import { join, basename } from 'path';
import type { Goal, AgentOSAdapter } from '../types/index.ts';

export interface FileSystemAdapterConfig {
  goalsDir: string;
  doneDir?: string;
}

interface GoalFile {
  path: string;
  content: string;
  frontmatter: Record<string, any>;
  body: string;
}

export class FileSystemAdapter implements AgentOSAdapter {
  name = 'filesystem';

  private goalsDir: string;
  private doneDir: string;

  constructor(config: FileSystemAdapterConfig) {
    this.goalsDir = config.goalsDir;
    this.doneDir = config.doneDir || join(config.goalsDir, 'done');
  }

  async ensureDirs(): Promise<void> {
    try {
      await mkdir(this.goalsDir, { recursive: true });
      await mkdir(this.doneDir, { recursive: true });
    } catch (e dirs) {
      // may already exist
    }
  }

  async pollGoals(): Promise<Goal[]> {
    await this.ensureDirs();

    const files = await readdir(this.goalsDir);
    const goalFiles = files.filter((f) => f.endsWith('.goal.md'));

    const goals: Goal[] = [];

    for (const file of goalFiles) {
      const path = join(this.goalsDir, file);
      const parsed = await this.parseGoalFile(path);

      if (parsed.frontmatter.status !== 'pending') {
        continue; // Skip non-pending goals
      }

      goals.push({
        id: this.fileToGoalId(file),
        source: 'filesystem',
        sourceId: file,
        description: parsed.body,
        successCriteria: parsed.frontmatter.successCriteria || [],
        context: parsed.frontmatter.context,
        priority: parsed.frontmatter.priority || 'medium',
        status: 'pending',
        createdBy: parsed.frontmatter.createdBy || 'unknown',
        createdAt: parsed.frontmatter.createdAt || new Date().toISOString(),
        metadata: {
          file: path,
        },
      });
    }

    return goals;
  }

  private async parseGoalFile(path: string): Promise<GoalFile> {
    const content = await readFile(path, 'utf-8');
    return this.parseContent(content);
  }

  private parseContent(content: string): GoalFile {
    // Simple frontmatter parser (--- delimited)
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    if (!match) {
      return {
        path: '',
        content,
        frontmatter: {},
        body: content,
      };
    }

    const [, fmStr, body] = match;
    const frontmatter: Record<string, any> = {};

    // Parse simple key: value pairs
    for (const line of fmStr.split('\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();
        frontmatter[key] = value;
      }
    }

    return {
      path: '',
      content,
      frontmatter,
      body: body.trim(),
    };
  }

  private fileToGoalId(filename: string): string {
    return filename.replace('.goal.md', '');
  }

  async claimTask(taskId: string, agentId: string): Promise<boolean> {
    // For filesystem, we don't have tasks - just goals
    // Claiming means creating a lock file
    const lockFile = join(this.goalsDir, `${taskId}.lock`);

    try {
      await writeFile(lockFile, agentId, { flag: 'wx' });
      return true;
    } catch {
      return false; // Already claimed
    }
  }

  async updateGoal(goalId: string, status: string, message?: string): Promise<void> {
    const goalFile = `${goalId}.goal.md`;
    const path = join(this.goalsDir, goalFile);

    try {
      const content = await readFile(path, 'utf-8');
      const parsed = this.parseContent(content);

      // Update frontmatter
      parsed.frontmatter.status = status;
      if (message) {
        parsed.frontmatter.lastMessage = message;
      }

      // Rebuild file
      const fmLines = Object.entries(parsed.frontmatter)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');

      const newContent = `---\n${fmLines}\n---\n${parsed.body}`;

      if (status === 'completed' || status === 'done') {
        // Move to done dir
        const donePath = join(this.doneDir, goalFile);
        await writeFile(donePath, newContent);
        await rename(path, donePath + '.bak'); // archive original
      } else {
        await writeFile(path, newContent);
      }
    } catch (e) {
      console.error(`Failed to update goal ${goalId}:`, e);
    }
  }

  async updateTask(taskId: string, status: string, message?: string): Promise<void> {
    // Tasks are not first-class in filesystem adapter
    console.log(`[filesystem] Task ${taskId}: ${status} ${message || ''}`);
  }

  async requestClarification(goalId: string, question: string): Promise<void> {
    // Create clarification file
    const clarFile = join(this.goalsDir, `${goalId}.clarification.md`);
    await writeFile(
      clarFile,
      `# Clarification Request\n\n## Question\n${question}\n\n## Status\nAwaiting answer...\n`
    );
    console.log(`[filesystem] Clarification requested for ${goalId}: ${question}`);
  }

  async notify(recipients: string[], message: string): Promise<void> {
    console.log(`[NOTIFY] ${recipients.join(', ')}: ${message}`);
  }
}
