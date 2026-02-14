#!/usr/bin/env bun
/**
 * Manual E2E Test for AgentOS
 * 
 * Quick test with mocked LLM - no API keys needed.
 */

import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock LLM Client
class MockLLMClient {
  async generate(stage: string, prompt: string, options?: any) {
    console.log(`[MockLLM] ${stage}: ${prompt.slice(0, 60)}...`);

    switch (stage) {
      case 'parse':
        return {
          text: JSON.stringify({
            description: 'Write a blog post about AI agents',
            successCriteria: ['1000 word post', 'technical accuracy'],
            context: 'For developers',
            priority: 'medium'
          }),
          usage: { prompt: 50, completion: 30 }
        };

      case 'clarify':
        return {
          text: JSON.stringify({
            isClearEnough: true,
            confidence: 85,
            questions: []
          }),
          usage: { prompt: 40, completion: 20 }
        };

      case 'decompose':
        return {
          text: JSON.stringify({
            tasks: [
              {
                description: 'Research AI agent concepts',
                type: 'research',
                requiredCapabilities: ['research'],
                estimatedEffort: '2 hours'
              },
              {
                description: 'Write blog post',
                type: 'write',
                requiredCapabilities: ['writing'],
                estimatedEffort: '4 hours',
                dependencies: [0]
              }
            ],
            strategy: 'Research then write'
          }),
          usage: { prompt: 60, completion: 80 }
        };

      case 'execute':
        return {
          text: 'Research completed. Found: AI agents use LLMs for reasoning.',
          usage: { prompt: 30, completion: 40 }
        };

      default:
        return { text: 'Mock response', usage: { prompt: 10, completion: 10 } };
    }
  }
}

async function main() {
  console.log('🧪 AgentOS Manual E2E Test\n');

  // Create temp directory
  const tempDir = mkdtempSync(join(tmpdir(), 'agentos-manual-test-'));
  const goalsDir = join(tempDir, 'goals');
  mkdirSync(goalsDir, { recursive: true });

  console.log(`📁 Temp directory: ${tempDir}\n`);

  // Create a test goal
  const goalContent = `---
status: pending
---
# Write a blog post about AI agents

Write a technical blog post explaining AI agents to developers.
Target: senior engineers`;

  writeFileSync(join(goalsDir, 'test.goal.md'), goalContent);
  console.log('📝 Created test goal file\n');

  // Import and test (dynamically to avoid TypeScript issues)
  const { FileSystemAdapter } = await import('../src/adapters/filesystem.ts');
  const { Pipeline } = await import('../src/core/pipeline.ts');

  const config = {
    models: {
      'kimi-k2': { provider: 'moonshot', pricing: { inputPer1k: 0.005, outputPer1k: 0.015 } },
      minimax: { provider: 'minimax', pricing: { inputPer1k: 0.0015, outputPer1k: 0.006 } },
      'glm-47': { provider: 'zhipu', pricing: { inputPer1k: 0.003, outputPer1k: 0.009 } }
    },
    pipeline: {
      parse: { primary: 'minimax' },
      decompose: { primary: 'kimi-k2' },
      clarify: { primary: 'kimi-k2' },
      execute: { default: 'kimi-k2' }
    }
  };

  const adapter = new FileSystemAdapter({ goalsDir });
  await adapter.initialize();

  const mockLLM = new MockLLMClient();
  const pipeline = new Pipeline(config as any, adapter, mockLLM as any);

  console.log('🚀 Running pipeline...\n');

  // Run one cycle
  await pipeline.runCycle();

  console.log('\n✅ Test completed!');
  console.log(`🧹 Cleaning up: ${tempDir}`);
  rmSync(tempDir, { recursive: true, force: true });
}

main().catch(console.error);
