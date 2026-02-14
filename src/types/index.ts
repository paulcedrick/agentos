/**
 * AgentOS Core Types with Multi-Team Support
 */

// Goal: The top-level objective
export interface Goal {
	id: string;
	source: string;
	sourceId: string;
	teamId: string; // NEW: Which team this goal belongs to
	description: string;
	successCriteria: string[];
	context?: string;
	priority: "low" | "medium" | "high" | "urgent";
	status: GoalStatus;
	createdBy: string;
	createdAt: string;
	updatedAt?: string;
	metadata?: Record<string, unknown>;
}

export type GoalStatus =
	| "pending"
	| "decomposing"
	| "in_progress"
	| "blocked"
	| "review"
	| "completed"
	| "failed";

// Task: Decomposed work unit
export interface Task {
	id: string;
	goalId: string;
	teamId: string; // NEW: Inherited from goal
	description: string;
	type: TaskType;
	status: TaskStatus;
	requiredCapabilities: string[];
	assignedTo?: string; // Agent ID
	claimedAt?: string;
	completedAt?: string;
	result?: TaskResult;
	clarifications?: Clarification[];
	parentId?: string;
	order: number;
	dependencies: string[];
}

export type TaskType =
	| "research"
	| "code"
	| "write"
	| "review"
	| "email"
	| "admin"
	| "test"
	| "design";
export type TaskStatus =
	| "pending"
	| "claimed"
	| "in_progress"
	| "blocked"
	| "review"
	| "completed"
	| "failed";

export interface TaskResult {
	summary: string;
	artifacts?: Artifact[];
	errors?: string[];
	durationMs?: number;
	metrics?: {
		durationMinutes: number;
		tokensUsed: number;
	};
}

export interface Artifact {
	type: "file" | "url" | "document" | "code";
	name: string;
	location: string;
	metadata?: Record<string, unknown>;
}

export interface Clarification {
	id: string;
	question: string;
	answer?: string;
	answeredBy?: string;
	answeredAt?: string;
	isBlocking: boolean;
}

// NEW: Agent Definition
export interface AgentConfig {
	id: string;
	name: string;
	capabilities: string[];
	discordId?: string;
	teams: string[]; // Which teams this agent belongs to
	maxParallelTasks: number;
	isActive: boolean;
}

// NEW: Team Definition
export interface TeamConfig {
	id: string;
	name: string;
	agents: string[]; // Agent IDs belonging to this team
	goalsDir: string; // Where this team's goals are stored
	channels?: string[]; // Discord channels for this team
}

// Model Configuration
export interface ModelConfig {
	provider: "moonshot" | "minimax" | "zhipu";
	package: string;
	modelId: string;
	baseUrl?: string;
	apiKeyEnv: string;
	pricing: {
		inputPer1k: number;
		outputPer1k: number;
	};
}

export interface PipelineStageConfig {
	primary: string;
	fallback?: string;
	timeoutMs?: number;
	maxRetries?: number;
}

export interface PipelineConfig {
	parse: PipelineStageConfig;
	decompose: PipelineStageConfig;
	clarify: PipelineStageConfig;
	execute: PipelineStageConfig & {
		default: string;
		byType?: Record<string, string>;
	};
}

export interface CostTrackingConfig {
	enabled: boolean;
	monthlyBudget: number;
	currency: string;
	alertAtPercent: number;
	webhookUrl?: string;
}

export interface FileSystemAdapterConfig {
	enabled: boolean;
	baseDir: string; // Base directory, teams will be subdirectories
}

export interface DiscordAdapterConfig {
  enabled: boolean;
  botToken: string;
  taskChannelId: string;
  guildId?: string;
}

export interface Config {
  // NEW: Agent and Team definitions
  agents: Record<string, AgentConfig>;
  teams: Record<string, TeamConfig>;
  
  // Existing configs
  models: Record<string, ModelConfig>;
  pipeline: PipelineConfig;
  costTracking: CostTrackingConfig;
  adapters: {
    filesystem: FileSystemAdapterConfig;
    discord?: DiscordAdapterConfig;
  };
  pollingIntervalMs: number;
}

// Adapter Interface
export interface Adapter {
	name: string;
	initialize(): Promise<void>;
	fetchInputs(teamId?: string): Promise<string[]>;
	claim(inputId: string, agentId: string): Promise<boolean>;
	report(inputId: string, status: string, message: string): Promise<void>;
	notify(message: string): Promise<void>;
	getGoalsDir(teamId: string): string;
	pollGoals(teamId?: string): Promise<Goal[]>;
	requestClarification(goalId: string, question: string): Promise<void>;
	setConfig(config: Config): void;
}

// LLM Types
export interface LLMUsage {
	prompt: number;
	completion: number;
}

export interface LLMResponse {
	text: string;
	usage: LLMUsage;
}

export interface LLMClient {
	generate(
		stage: string,
		prompt: string,
		options?: {
			schema?: object;
			modelAlias?: string;
		},
	): Promise<LLMResponse>;
	getModelForStage(stage: string): string;
}

// Cost Tracking Types
export interface CostRecord {
	date: string;
	stage: string;
	modelAlias: string;
	inputTokens: number;
	outputTokens: number;
	cost: number;
}

export interface CostTracker {
	logCall(
		stage: string,
		modelAlias: string,
		inputTokens: number,
		outputTokens: number,
		pricing: { inputPer1k: number; outputPer1k: number },
	): Promise<void>;
	getCurrentMonthSpend(): Promise<number>;
	getDailyReport(days?: number): Promise<CostRecord[]>;
	getStats(): Promise<{
		totalCalls: number;
		totalCost: number;
		byStage: Record<string, number>;
		byModel: Record<string, number>;
	}>;
	isOverBudget(monthlyBudget: number): Promise<boolean>;
}
