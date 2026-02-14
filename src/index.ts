#!/usr/bin/env bun
/**
 * AgentOS - Entry Point with Multi-Team Support
 */

import { ConfigLoader } from './config/config.ts';
import { FileSystemAdapter } from './adapters/filesystem.ts';
import { createLLMClient } from './llm/client.ts';
import { Pipeline } from './core/pipeline.ts';
import { Logger } from './utils/logger.ts';

const logger = new Logger('AgentOS');

async function main() {
  // Get team from environment or process all teams
  const teamId = process.env.AGENTOS_TEAM;
  
  logger.info('AgentOS Starting...', teamId ? { team: teamId } : { mode: 'all-teams' });
  
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
      throw new Error(`Unknown team: ${teamId}. Available: ${Object.keys(config.teams).join(', ')}`);
    }
    
    // Initialize adapter with config
    const adapter = new FileSystemAdapter({
      baseDir: config.adapters.filesystem.baseDir
    });
    adapter.setConfig(config);
    await adapter.initialize();
    
    logger.info('Adapter initialized', { 
      baseDir: config.adapters.filesystem.baseDir,
      teams: Object.entries(config.teams).map(([id, t]) => ({ id, dir: t.goalsDir }))
    });
    
    // Initialize LLM client
    const llm = createLLMClient(config.models, config.pipeline);
    
    // Initialize pipeline
    const pipeline = new Pipeline(config, adapter, llm);
    
    logger.info('AgentOS initialized successfully');
    logger.info(teamId ? `Processing team: ${teamId}` : 'Processing all teams');
    
    // Main loop
    while (true) {
      try {
        await pipeline.runCycle(teamId);
      } catch (error) {
        logger.error('Pipeline cycle error', error);
      }
      
      // Wait before next poll
      const interval = config.pollingIntervalMs || 60000;
      logger.debug(`Waiting ${interval}ms before next cycle`);
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
