/**
 * LLM Client Interface
 * Provides a unified interface for LLM generation across multiple providers
 */

import type { ModelConfig, PipelineConfig } from '../types/index.ts';

export interface LLMUsage {
  prompt: number;
  completion: number;
}

export interface LLMResponse {
  text: string;
  usage: LLMUsage;
}

export interface LLMClient {
  /**
   * Generate text using the configured model for a given stage
   * @param stage - The pipeline stage (parse, decompose, clarify, execute)
   * @param prompt - The prompt to send
   * @param options - Optional parameters (schema for structured output, model override)
   */
  generate(
    stage: string,
    prompt: string,
    options?: {
      schema?: object;
      modelAlias?: string;
    }
  ): Promise<LLMResponse>;

  /**
   * Get the model alias being used for a specific stage
   */
  getModelForStage(stage: string): string;
}

/**
 * Factory function to create an LLM client
 */
export function createLLMClient(
  models: ModelConfig,
  pipeline: PipelineConfig
): LLMClient {
  // Implementation will be added in a separate file
  // This interface is for Margo to build against
  throw new Error('Not implemented - LLM client needs implementation');
}
