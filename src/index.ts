#!/usr/bin/env bun
/**
 * AgentOS - Entry Point
 * 
 * Agent Operating System for autonomous AI agents.
 */

import { ConfigLoader } from './config/config';
import { Logger } from './utils/logger';

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
    
    // TODO: Initialize adapter
    // TODO: Initialize pipeline
    // TODO: Start main loop
    
    logger.info('AgentOS initialized successfully');
    logger.info('Main loop not yet implemented - scaffold only');
    
  } catch (error) {
    logger.error('Failed to start AgentOS', error);
    process.exit(1);
  }
}

main();
