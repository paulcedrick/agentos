/**
 * AgentOS Core Types
 * Adapter-agnostic type definitions for the Agent Operating System
 */

// Goal: The top-level objective
export interface Goal {
  id: string;
  source: string;
  sourceId: string;
  description: string;
  successCriteria: string[];
  context?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: GoalStatus;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

export type GoalStatus = 
  | 'pending' | 'decomposing' | 'in_progress' | 'blocked' 
  | 'review' | 'completed' | 'failed';

export interface Task {
  id: string;
  goalId: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  requiredCapabilities: string[];
  assignedTo?: string;
  claimedAt?: string;
  completedAt?: string;
  result?: TaskResult;
  clarifications?: Clarification[];
  parentId?: string;
  order: number;
}

export type TaskType = 'research' | 'code' | 'write' | 'review' | 'email' | 'admin' | 'test';
export type TaskStatus = 'pending' | 'claimed' | 'in_progress' | 'blocked' | 'review' | 'completed' | 'failed';

export interface TaskResult {
  summary: string;
  artifacts?: Artifact[];
  errors?: string[];
  durationMs?: number;
}

export interface Artifact {
  type: 'file' | 'url' | 'pr' | 'email' | 'data';
  name: string;
  location: string;
  mimeType?: string;
}

export interface Clarification {
  id: string;
  taskId: string;
  question: string;
  answer?: string;
  askedBy: string;
  askedAt: string;
  answeredBy?: string;
  answeredAt?: string;
}

export interface Agent {
  id: string;
  name: string;
  capabilities: string[];
  tools: string[];
  maxParallel: number;
  execute: ExecuteFn;
}

export type ExecuteFn = (task: Task, context: ExecutionContext) => Promise<TaskResult>;

export interface ExecutionContext {
  goal: Goal;
  onProgress: (message: string) => void;
  onBlock: (question: string) => Promise<string>;
  onComplete: (result: TaskResult) => void;
  onError: (error: Error) => void;
}

export interface AgentOSAdapter {
  name: string;
  pollGoals(): Promise<Goal[]>;
  claimTask(taskId: string, agentId: string): Promise<boolean>;
  updateGoal(goalId: string, status: GoalStatus, message?: string): Promise<void>;
  updateTask(taskId: string, status: TaskStatus, message?: string): Promise<void>;
  requestClarification(goalId: string, question: string): Promise<void>;
  notify(recipients: string[], message: string): Promise<void>;
}

export interface AgentOSConfig {
  models: ModelConfig;
  pipeline: PipelineConfig;
  costTracking: CostTrackingConfig;
  adapters: Record<string, AdapterConfig>;
  pollingIntervalMs: number;
}

export interface ModelConfig {
  [alias: string]: {
    provider: string;
    modelId: string;
    baseUrl?: string;
    apiKeyEnv: string;
    pricing: { inputPer1k: number; outputPer1k: number };
  };
}

export interface PipelineConfig {
  [stage: string]: {
    primary: string;
    fallback?: string;
    timeoutMs: number;
    maxRetries: number;
  };
}

export interface CostTrackingConfig {
  enabled: boolean;
  monthlyBudget: number;
  currency: string;
  alertAtPercent: number;
  webhookUrl?: string;
}

export interface AdapterConfig {
  enabled: boolean;
  [key: string]: unknown;
}
