#!/usr/bin/env bun
/**
 * AgentOS - Entry Point with Multi-Team and Discord Support
 */

import { ConfigLoader } from './config/config.ts';
import { FileSystemAdapter } from './adapters/filesystem.ts';
import { DiscordAdapter } from './adapters/discord.ts';
import { createLLMClient } from './llm/client.ts';
import { Pipeline } from './core/pipeline.ts';
import { Logger } from './utils/logger.ts';

const logger = new Logger('AgentOS');

async function main() {
  // Get configuration
  const teamId = process.env.AGENTOS_TEAM;
  const useDiscord = process.env.AGENTOS_ADAPTER === 'discord';
  
  logger.info('AgentOS Starting...', { 
    team: teamId || 'all',
    adapter: useDiscord ? 'discord' : 'filesystem'
  });
  
  try {
    // Load configuration
    const configPath = process.env.AGENTOS_CONFIG || 'config/agentos.json';
    const config = await ConfigLoader.load(configPath);
    
    logger.info('Configuration loaded', {
      agents: Object.keys(config.agents),
      teams: Object.keys(config.teams),
      models: Object.keys(config.models)
    });
    
    // Validate team if specified
    if (teamId && !config.teams[teamId]) {
      throw new Error(`Unknown team: ${teamId}`);
    }
    
    // Initialize adapter
    let adapter;
    
    if (useDiscord && config.adapters.discord?.enabled) {
      logger.info('Using Discord adapter');
      adapter = new DiscordAdapter({
        botToken: config.adapters.discord.botToken,
        taskChannelId: config.adapters.discord.taskChannelId,
        guildId: config.adapters.discord.guildId
      });
    } else {
      logger.info('Using FileSystem adapter');
      adapter = new FileSystemAdapter({
        baseDir: config.adapters.filesystem.baseDir
      });
    }
    
    adapter.setConfig(config);
    await adapter.initialize();
    
    logger.info('Adapter initialized');
    
    // Initialize LLM client
    const llm = createLLMClient(config.models, config.pipeline);
    
    // Initialize pipeline
    const pipeline = new Pipeline(config, adapter, llm);
    
    logger.info('AgentOS ready');
    
    // Main loop
    while (true) {
      try {
        await pipeline.runCycle(teamId);
      } catch (error) {
        logger.error('Pipeline cycle error', error);
      }
      
      // Wait before next poll
      const interval = config.pollingIntervalMs || 60000;
      await sleep(interval);
    }
    
  } catch (error) {
    logger.error('Failed to start AgentOS', error);
    process.exit(1);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main();
