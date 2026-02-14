/**
 * LLM Client - OpenAI-Compatible Provider Implementation
 * Supports: Moonshot (Kimi), MiniMax, Zhipu (GLM) via OpenAI-compatible APIs
 */

import { generateText, generateObject } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { ModelConfig, PipelineConfig } from '../types/index.ts';
import type { LLMClient, LLMResponse, LLMUsage } from './client.ts';

type OpenAICompatible = ReturnType<typeof createOpenAICompatible>;

export class MultiProviderLLMClient implements LLMClient {
  private providers: Map<string, OpenAICompatible> = new Map();
  private models: ModelConfig;
  private pipeline: PipelineConfig;

  constructor(models: ModelConfig, pipeline: PipelineConfig) {
    this.models = models;
    this.pipeline = pipeline;
    this.initializeProviders();
  }

  private initializeProviders() {
    // Moonshot (Kimi) - uses OpenAI-compatible API
    const moonshotKey = process.env.MOONSHOT_API_KEY;
    if (moonshotKey) {
      this.providers.set('moonshot', createOpenAICompatible({
        name: 'moonshot',
        baseURL: 'https://api.moonshot.cn/v1',
        apiKey: moonshotKey,
      }));
    }

    // MiniMax - uses OpenAI-compatible API
    const minimaxKey = process.env.MINIMAX_API_KEY;
    if (minimaxKey) {
      this.providers.set('minimax', createOpenAICompatible({
        name: 'minimax',
        baseURL: 'https://api.minimax.chat/v1',
        apiKey: minimaxKey,
      }));
    }

    // Zhipu (GLM) - uses OpenAI-compatible API
    const zhipuKey = process.env.ZHIPU_API_KEY;
    if (zhipuKey) {
      this.providers.set('zhipu', createOpenAICompatible({
        name: 'zhipu',
        baseURL: 'https://open.bigmodel.cn/api/paas/v4',
        apiKey: zhipuKey,
      }));
    }
  }

  async generate(
    stage: string,
    prompt: string,
    options?: {
      schema?: object;
      modelAlias?: string;
    }
  ): Promise<LLMResponse> {
    const modelAlias = options?.modelAlias || this.getModelForStage(stage);
    const modelConfig = this.models[modelAlias];

    if (!modelConfig) {
      throw new Error(`No model config for alias: ${modelAlias}`);
    }

    const provider = this.providers.get(modelConfig.provider);
    if (!provider) {
      throw new Error(
        `Provider not initialized: ${modelConfig.provider}. ` +
        `Check API key env var (MOONSHOT_API_KEY, MINIMAX_API_KEY, ZHIPU_API_KEY)`
      );
    }

    const model = provider(modelConfig.modelId);

    let result: { text: string; usage: { promptTokens: number; completionTokens: number } };

    try {
      if (options?.schema) {
        const objResult = await generateObject({
          model,
          prompt,
          schema: options.schema,
        });
        result = {
          text: JSON.stringify(objResult.object),
          usage: {
            promptTokens: objResult.usage.promptTokens,
            completionTokens: objResult.usage.completionTokens,
          },
        };
      } else {
        const textResult = await generateText({ model, prompt });
        result = {
          text: textResult.text,
          usage: {
            promptTokens: textResult.usage.promptTokens,
            completionTokens: textResult.usage.completionTokens,
          },
        };
      }
    } catch (error) {
      console.error(`[LLM] Error calling ${modelConfig.provider}:`, error);
      throw error;
    }

    // Calculate cost
    const inputCost = (result.usage.promptTokens / 1000) * modelConfig.pricing.inputPer1k;
    const outputCost = (result.usage.completionTokens / 1000) * modelConfig.pricing.outputPer1k;
    const totalCost = inputCost + outputCost;

    console.log(
      `[LLM] ${stage} -> ${modelAlias}: ` +
      `$${totalCost.toFixed(4)} (${result.usage.promptTokens}p/${result.usage.completionTokens}c)`
    );

    return {
      text: result.text,
      usage: {
        prompt: result.usage.promptTokens,
        completion: result.usage.completionTokens,
      },
    };
  }

  getModelForStage(stage: string): string {
    const pipelineStage = this.pipeline[stage];
    if (!pipelineStage) {
      return Object.keys(this.models)[0];
    }
    return pipelineStage.primary;
  }
}

export function createLLMClient(models: ModelConfig, pipeline: PipelineConfig): LLMClient {
  return new MultiProviderLLMClient(models, pipeline);
}
