/**
 * LLM Client - Config-driven OpenAI-Compatible Provider Implementation
 * Providers are initialized from model configs (any OpenAI-compatible API)
 */

import { generateText, generateObject, NoObjectGeneratedError } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type {
	ModelConfig,
	PipelineConfig,
	LLMClient,
	LLMResponse,
	StageName,
} from "../types/index.ts";
import { Logger } from "../utils/logger.ts";

type OpenAICompatible = ReturnType<typeof createOpenAICompatible>;

/** Recursively convert snake_case keys to camelCase */
function camelCaseKeys(obj: unknown): unknown {
	if (Array.isArray(obj)) return obj.map(camelCaseKeys);
	if (obj !== null && typeof obj === "object") {
		const result: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
			const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
			result[camel] = camelCaseKeys(value);
		}
		return result;
	}
	return obj;
}

export class MultiProviderLLMClient implements LLMClient {
	#providers: Map<string, OpenAICompatible> = new Map();
	#models: Record<string, ModelConfig>;
	#pipeline: PipelineConfig;

	#logger = new Logger("LLM");

	constructor(models: Record<string, ModelConfig>, pipeline: PipelineConfig) {
		this.#models = models;
		this.#pipeline = pipeline;
		this.#initializeProviders();
	}

	#initializeProviders() {
		const missing: string[] = [];

		// Collect unique providers from model configs
		const seen = new Set<string>();
		for (const [alias, model] of Object.entries(this.#models)) {
			if (seen.has(model.provider)) continue;
			seen.add(model.provider);

			const apiKey =
				model.apiKey ??
				(model.apiKeyEnv ? process.env[model.apiKeyEnv] : undefined);
			if (!apiKey) {
				missing.push(
					`${model.provider} (model "${alias}"): set apiKey in config or ${model.apiKeyEnv ?? "apiKeyEnv"} env var`,
				);
				continue;
			}

			// Use custom fetch to force exact headers (e.g. User-Agent)
			// since the SDK's withUserAgentSuffix appends to User-Agent,
			// which breaks strict header checks like Kimi's coding agent gate.
			const customFetch = model.headers
				? (url: string | URL | Request, init?: RequestInit) => {
						const merged: Record<string, string> = {};
						new Headers(init?.headers).forEach((value, key) => {
							merged[key] = value;
						});
						// Normalize config header keys to lowercase to match Headers API output
						for (const [key, value] of Object.entries(model.headers!)) {
							merged[key.toLowerCase()] = value;
						}
						return fetch(url, { ...init, headers: merged });
					}
				: undefined;

			this.#providers.set(
				model.provider,
				createOpenAICompatible({
					name: model.provider,
					baseURL: model.baseUrl,
					apiKey,
					fetch: customFetch as typeof fetch,
				}),
			);
		}

		if (missing.length > 0) {
			throw new Error(
				`Missing API keys for providers:\n  - ${missing.join("\n  - ")}`,
			);
		}

		const available = [...this.#providers.keys()];
		this.#logger.info(`Providers initialized: [${available.join(", ")}]`);
	}

	async generate(
		stage: StageName,
		prompt: string,
		options?: {
			schema?: unknown;
			modelAlias?: string;
		},
	): Promise<LLMResponse> {
		const stageConfig = this.#getStageConfig(stage);
		const primaryModel = options?.modelAlias || this.getModelForStage(stage);
		const modelAliases = [primaryModel];
		if (stageConfig.fallback && stageConfig.fallback !== primaryModel) {
			modelAliases.push(stageConfig.fallback);
		}

		const maxRetries = Math.max(0, stageConfig.maxRetries ?? 0);
		let lastError: unknown = new Error("Unknown LLM execution error");

		for (const modelAlias of modelAliases) {
			for (let attempt = 0; attempt <= maxRetries; attempt++) {
				try {
					return await this.#generateOnce(stage, prompt, modelAlias, {
						schema: options?.schema,
						timeoutMs: stageConfig.timeoutMs,
					});
				} catch (error) {
					lastError = error;
					const attemptLabel = `${attempt + 1}/${maxRetries + 1}`;
					this.#logger.warn(
						`${stage} failed on model=${modelAlias}, attempt=${attemptLabel}`,
						{ error: String(error) },
					);
				}
			}
		}

		throw lastError;
	}

	getModelForStage(stage: StageName): string {
		const fallback = Object.keys(this.#models)[0];
		if (stage === "execute") {
			return this.#pipeline.execute.default || fallback;
		}

		const pipelineStage = this.#pipeline[stage];
		return pipelineStage?.primary || fallback;
	}

	async #generateOnce(
		stage: StageName,
		prompt: string,
		modelAlias: string,
		options?: { schema?: unknown; timeoutMs?: number },
	): Promise<LLMResponse> {
		const modelConfig = this.#models[modelAlias];
		if (!modelConfig) {
			throw new Error(`No model config for alias: ${modelAlias}`);
		}

		const provider = this.#providers.get(modelConfig.provider);
		if (!provider) {
			throw new Error(
				`Provider not initialized: ${modelConfig.provider}. ` +
					`Check apiKey in config or ${modelConfig.apiKeyEnv ?? "apiKeyEnv"} env var`,
			);
		}

		const model = provider(modelConfig.modelId);
		const runGeneration = async () => {
			if (options?.schema) {
				try {
					const objResult = await generateObject({
						model,
						prompt,
						schema: options.schema as any,
					});
					return {
						text: JSON.stringify(objResult.object),
						usage: {
							promptTokens: objResult.usage.inputTokens ?? 0,
							completionTokens: objResult.usage.outputTokens ?? 0,
						},
					};
				} catch (error) {
					const objectError = error as NoObjectGeneratedError;
					if (
						NoObjectGeneratedError.isInstance(error) &&
						objectError.text
					) {
						this.#logger.warn(
							`Schema validation failed for ${stage}, attempting camelCase key normalization`,
						);
						const raw = JSON.parse(objectError.text);
						const normalized = camelCaseKeys(raw);
						return {
							text: JSON.stringify(normalized),
							usage: {
								promptTokens: objectError.usage?.inputTokens ?? 0,
								completionTokens: objectError.usage?.outputTokens ?? 0,
							},
						};
					}
					throw error;
				}
			}

			const textResult = await generateText({ model, prompt });
			return {
				text: textResult.text,
				usage: {
					promptTokens: textResult.usage.inputTokens ?? 0,
					completionTokens: textResult.usage.outputTokens ?? 0,
				},
			};
		};

		const result = await this.#withTimeout(
			runGeneration(),
			options?.timeoutMs,
			`${stage}:${modelAlias}`,
		);

		const inputCost =
			(result.usage.promptTokens / 1000) * modelConfig.pricing.inputPer1k;
		const outputCost =
			(result.usage.completionTokens / 1000) * modelConfig.pricing.outputPer1k;
		const totalCost = inputCost + outputCost;

		this.#logger.info(
			`${stage} -> ${modelAlias}: ` +
				`$${totalCost.toFixed(4)} (${result.usage.promptTokens}p/${result.usage.completionTokens}c)`,
		);

		return {
			text: result.text,
			usage: {
				prompt: result.usage.promptTokens,
				completion: result.usage.completionTokens,
			},
		};
	}

	#withTimeout<T>(
		promise: Promise<T>,
		timeoutMs: number | undefined,
		context: string,
	): Promise<T> {
		if (!timeoutMs || timeoutMs <= 0) {
			return promise;
		}

		return Promise.race([
			promise,
			new Promise<T>((_, reject) =>
				setTimeout(
					() =>
						reject(new Error(`LLM timeout after ${timeoutMs}ms (${context})`)),
					timeoutMs,
				),
			),
		]);
	}

	#getStageConfig(stage: StageName): {
		fallback?: string;
		timeoutMs?: number;
		maxRetries?: number;
	} {
		if (stage === "execute") {
			return this.#pipeline.execute;
		}
		return this.#pipeline[stage];
	}
}

export function createLLMClient(
	models: Record<string, ModelConfig>,
	pipeline: PipelineConfig,
): LLMClient {
	return new MultiProviderLLMClient(models, pipeline);
}
