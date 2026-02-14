#!/usr/bin/env bun
/**
 * AgentOS - Entry Point
 * 
 * Agent Operating System for autonomous AI agents.
 */

import { ConfigLoader } from './config/config.ts';
import { FileSystemAdapter } from './adapters/filesystem.ts';
import { createLLMClient } from './llm/client.ts';
import { Pipeline } from './core/pipeline.ts';
import { Logger } from './utils/logger.ts';

const logger = new Logger('AgentOS');

async function main() {
  logger.info('AgentOS Starting...');
  
  try {
    // Load configuration
    const configPath = process.env.AGENTOS_CONFIG || 'config/agentos.json';
    const config = await ConfigLoader.load(configPath);
    
    logger.info('Configuration loaded', {
      models: Object.keys(config.models),
      stages: Object.keys(config.pipeline)
    });
    
    // Initialize adapter (filesystem for now)
    const adapter = new FileSystemAdapter({
      goalsDir: config.adapters.filesystem.goalsDir
    });
    await adapter.initialize();
    
    // Initialize LLM client
    const llm = createLLMClient(config.models, config.pipeline);
    
    // Initialize pipeline
    const pipeline = new Pipeline(config, adapter, llm);
    
    logger.info('AgentOS initialized');
    logger.info('Starting main loop...');
    
    // Main loop
    while (true) {
      try {
        await pipeline.runCycle();
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
