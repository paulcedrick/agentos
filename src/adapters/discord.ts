/**
 * Discord Adapter - Post tasks to Discord and poll for responses
 */

import { Client, GatewayIntentBits, TextChannel, ThreadChannel } from 'discord.js';
import type { Goal, Task, Adapter, Config } from '../types/index.ts';

export interface DiscordAdapterConfig {
  botToken: string;
  taskChannelId: string;
  guildId?: string;
}

export class DiscordAdapter implements Adapter {
  name = 'discord';
  private client: Client;
  private config: DiscordAdapterConfig;
  private configData?: Config;
  private isReady = false;

  constructor(config: DiscordAdapterConfig) {
    this.config = config;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
  }

  setConfig(config: Config): void {
    this.configData = config;
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.once('ready', () => {
        console.log(`[Discord] Bot logged in as ${this.client.user?.tag}`);
        this.isReady = true;
        resolve();
      });

      this.client.on('error', (error) => {
        console.error('[Discord] Client error:', error);
        reject(error);
      });

      this.client.login(this.config.botToken).catch(reject);
    });
  }

  async fetchInputs(teamId?: string): Promise<string[]> {
    // Discord adapter doesn't fetch from files
    // In future: could poll pinned messages or specific channel
    return [];
  }

  getGoalsDir(teamId: string): string {
    // Discord doesn't use file system
    return '';
  }

  async claim(inputId: string, agentId: string): Promise<boolean> {
    // Find agent's Discord ID
    const agent = this.configData?.agents[agentId];
    if (!agent?.discordId) {
      console.warn(`[Discord] No Discord ID for agent: ${agentId}`);
      return false;
    }

    // In Discord, claiming means posting to the channel
    // The agent responds to claim it
    return true;
  }

  async report(id: string, status: string, message?: string): Promise<void> {
    // Update thread with status
    try {
      const channel = await this.client.channels.fetch(this.config.taskChannelId);
      if (!channel?.isTextBased()) return;

      // Find or create thread for this task
      const threadName = `task-${id}`;
      let thread = (channel as TextChannel).threads.cache.find(t => t.name === threadName);
      
      if (thread) {
        await thread.send(`**Status Update**: ${status}\n${message || ''}`);
      }
    } catch (error) {
      console.error('[Discord] Failed to report:', error);
    }
  }

  async notify(message: string): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(this.config.taskChannelId);
      if (channel?.isTextBased()) {
        await (channel as TextChannel).send(message);
      }
    } catch (error) {
      console.error('[Discord] Failed to notify:', error);
    }
  }

  async assignTask(task: Task, goal: Goal): Promise<void> {
    const agent = this.findAgentForTask(task);
    if (!agent?.discordId) {
      console.warn(`[Discord] Could not find agent for task: ${task.id}`);
      return;
    }

    try {
      const channel = await this.client.channels.fetch(this.config.taskChannelId);
      if (!channel?.isTextBased()) {
        console.error('[Discord] Task channel not found or not text-based');
        return;
      }

      const textChannel = channel as TextChannel;

      // Create message with mention
      const mention = `<@${agent.discordId}>`;
      const message = await textChannel.send(
        `${mention} **New Task Assigned**\n\n` +
        `**Goal**: ${goal.description.slice(0, 100)}...\n` +
        `**Task**: ${task.description}\n` +
        `**Type**: ${task.type}\n` +
        `**Estimated**: ${task.estimatedEffort}\n\n` +
        `Reply in this thread to claim and work on this task.`
      );

      // Create thread for this task
      const thread = await message.startThread({
        name: `task-${task.id}`,
        autoArchiveDuration: 1440, // 24 hours
      });

      await thread.send(
        `Task details:\n` +
        `- ID: ${task.id}\n` +
        `- Required skills: ${task.requiredCapabilities.join(', ')}\n` +
        `- Dependencies: ${task.dependencies.length > 0 ? task.dependencies.join(', ') : 'None'}\n\n` +
        `Reply with **"claim"** to start working on this task.`
      );

      console.log(`[Discord] Task ${task.id} assigned to ${agent.name} in thread ${thread.name}`);

    } catch (error) {
      console.error('[Discord] Failed to assign task:', error);
    }
  }

  async requestClarification(goalId: string, question: string): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(this.config.taskChannelId);
      if (!channel?.isTextBased()) return;

      await (channel as TextChannel).send(
        `<@112414355445833728> **Clarification Needed**\n\n` +
        `Goal: ${goalId}\n\n` +
        `${question}`
      );
    } catch (error) {
      console.error('[Discord] Failed to request clarification:', error);
    }
  }

  async checkForTaskCompletion(taskId: string): Promise<string | null> {
    // Poll thread for completion messages
    try {
      const channel = await this.client.channels.fetch(this.config.taskChannelId);
      if (!channel?.isTextBased()) return null;

      const thread = (channel as TextChannel).threads.cache.find(
        t => t.name === `task-${taskId}`
      );

      if (!thread) return null;

      // Fetch recent messages
      const messages = await thread.messages.fetch({ limit: 10 });
      
      // Look for completion indicators
      for (const [, msg] of messages) {
        const content = msg.content.toLowerCase();
        if (content.includes('done') || content.includes('complete') || content.includes('✅')) {
          return msg.content;
        }
      }

      return null;
    } catch (error) {
      console.error('[Discord] Failed to check completion:', error);
      return null;
    }
  }

  private findAgentForTask(task: Task) {
    if (!this.configData) return undefined;

    // Get team for this task
    const team = this.configData.teams[task.teamId];
    if (!team) return undefined;

    // Find agent with matching capabilities
    for (const agentId of team.agents) {
      const agent = this.configData.agents[agentId];
      if (!agent?.isActive) continue;

      const hasCapabilities = task.requiredCapabilities.every(cap =>
        agent.capabilities.includes(cap)
      );

      if (hasCapabilities) {
        return agent;
      }
    }

    // Fallback to first available agent
    return team.agents
      .map(id => this.configData?.agents[id])
      .find(a => a?.isActive);
  }

  // Cleanup
  async destroy(): Promise<void> {
    await this.client.destroy();
  }
}
