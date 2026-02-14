/**
 * Cost Tracker Interface
 * Tracks LLM usage and costs for budget management
 */

export interface CostRecord {
  id?: number;
  timestamp: string;
  stage: string;
  modelAlias: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export interface CostTracker {
  /**
   * Log an LLM API call with usage metrics
   */
  logCall(
    stage: string,
    modelAlias: string,
    inputTokens: number,
    outputTokens: number,
    pricing: { inputPer1k: number; outputPer1k: number }
  ): Promise<void>;

  /**
   * Get total spend for the current month
   */
  getCurrentMonthSpend(): Promise<number>;

  /**
   * Get daily spending report
   */
  getDailyReport(days: number): Promise<CostRecord[]>;

  /**
   * Get aggregated stats
   */
  getStats(): Promise<{
    totalCalls: number;
    totalCost: number;
    byStage: Record<string, number>;
    byModel: Record<string, number>;
  }>;

  /**
   * Check if budget is exceeded
   */
  isOverBudget(monthlyBudget: number): Promise<boolean>;
}

export function createCostTracker(dbPath?: string): CostTracker {
  throw new Error('Not implemented - cost tracker needs implementation');
}
