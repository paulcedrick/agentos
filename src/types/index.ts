// Core types for AgentOS

export interface Goal {
  id: string;
  source: string;
  sourceId: string;
  description: string;
  successCriteria: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  deadline?: Date;
  constraints: string[];
  context: string;
  outputFormat: string;
  rawInput: string;
  metadata: {
    parsedAt: string;
    [key: string]: any;
  };
}

export interface Task {
  id: string;
  goalId: string;
  description: string;
  type: 'research' | 'write' | 'code' | 'design' | 'review' | 'analysis' | 'test';
  requiredCapabilities: string[];
  estimatedEffort: string;
  status: TaskStatus;
  claimedBy?: string;
  claimedAt?: Date;
  completedAt?: Date;
  clarifications: Clarification[];
  result?: TaskResult;
  metadata: {
    rationale: string;
    strategy?: string;
    [key: string]: any;
  };
}

export type TaskStatus = 
  | 'pending' 
  | 'claimed' 
  | 'in_progress' 
  | 'blocked' 
  | 'complete' 
  | 'failed';

export interface Clarification {
  id: string;
  question: string;
  answer?: string;
  answeredBy?: string;
  answeredAt?: Date;
  isBlocking: boolean;
}

export interface TaskResult {
  summary: string;
  artifacts: Artifact[];
  metrics?: {
    durationMinutes: number;
    tokensUsed?: number;
  };
}

export interface Artifact {
  type: 'file' | 'url' | 'document' | 'code' | 'email_sent' | 'comment';
  name: string;
  location: string;
  metadata?: Record<string, any>;
}

// Configuration types

export interface ModelConfig {
  provider: 'moonshot' | 'minimax' | 'zhipu';
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
  goalsDir: string;
}

export interface AdaptersConfig {
  filesystem: FileSystemAdapterConfig;
}

export interface Config {
  models: Record<string, ModelConfig>;
  pipeline: PipelineConfig;
  costTracking: CostTrackingConfig;
  adapters: AdaptersConfig;
  pollingIntervalMs: number;
}

// Adapter interface

export interface Adapter {
  name: string;
  initialize(): Promise<void>;
  fetchInputs(): Promise<string[]>;
  claim(inputId: string, agentId: string): Promise<boolean>;
  report(inputId: string, status: string, message: string): Promise<void>;
  notify(message: string): Promise<void>;
}
