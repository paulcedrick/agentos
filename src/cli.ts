#!/usr/bin/env bun
/**
 * AgentOS CLI
 */

import { parseArgs } from 'util';
import { readFile } from 'fs/promises';
import { join } from 'path';

const VERSION = '0.1.0';

interface CLIOptions {
  help: boolean;
  version: boolean;
  config?: string;
  adapter?: string;
}

async function loadConfig(configPath?: string): Promise<any> {
  const path = configPath || join(process.cwd(), 'config', 'agentos.json');
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    console.error(`Failed to load config from ${path}`);
    process.exit(1);
  }
}

async function cmdServe(args: CLIOptions) {
  const config = await loadConfig(args.config);
  console.log('Starting AgentOS...');
  console.log('Config:', JSON.stringify(config, null, 2));
}

async function cmdStatus(args: CLIOptions) {
  console.log('AgentOS Status');
  console.log(`Version: ${VERSION}`);
}

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
      config: { type: 'string', short: 'c' },
      adapter: { type: 'string', short: 'a' },
    },
    strict: false,
  });

  const args = values as CLIOptions;
  const command = positionals[0];

  if (args.version) {
    console.log(`agentos v${VERSION}`);
    process.exit(0);
  }

  if (args.help || !command) {
    console.log(`
AgentOS CLI v${VERSION}

Usage: agentos <command> [options>

Commands:
  serve     Start the agent loop service
  status    Show system status

Options:
  -c, --config <path>  Config file path
  -a, --adapter <name>  Specific adapter to use
  -v, --version         Show version
  -h, --help            Show help

Examples:
  agentos serve -c ./config/agentos.json
  agentos status
`);
    process.exit(0);
  }

  switch (command) {
    case 'serve': await cmdServe(args); break;
    case 'status': await cmdStatus(args); break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main().catch(console.error);
