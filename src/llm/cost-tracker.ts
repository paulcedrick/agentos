/**
 * Cost Tracker - Implementation
 * Tracks LLM usage and costs using SQLite
 */

import { Database } from 'bun:sqlite';
import type { CostRecord, CostTracker } from './cost-tracker.ts';

export class SQLiteCostTracker implements CostTracker {
  private db: Database;

  constructor(dbPath: string = './data/costs.db') {
    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS costs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        stage TEXT NOT NULL,
        model_alias TEXT NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        cost REAL NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_costs_timestamp ON costs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_costs_stage ON costs(stage);
      CREATE INDEX IF NOT EXISTS idx_costs_model ON costs(model_alias);
    `);
  }

  async logCall(
    stage: string,
    modelAlias: string,
    inputTokens: number,
    outputTokens: number,
    pricing: { inputPer1k: number; outputPer1k: number }
  ): Promise<void> {
    const cost =
      (inputTokens / 1000) * pricing.inputPer1k +
      (outputTokens / 1000) * pricing.outputPer1k;

    this.db.query(
      `INSERT INTO costs (stage, model_alias, input_tokens, output_tokens, cost)
       VALUES (?, ?, ?, ?, ?)`
    ).run(stage, modelAlias, inputTokens, outputTokens, cost);
  }

  async getCurrentMonthSpend(): Promise<number> {
    const result = this.db.query(`
      SELECT COALESCE(SUM(cost), 0) as total
      FROM costs
      WHERE timestamp >= date('now', 'start of month')
    `).get() as { total: number };
    return result.total;
  }

  async getDailyReport(days: number = 7): Promise<CostRecord[]> {
    return this.db.query(`
      SELECT 
        date(timestamp) as date,
        stage,
        model_alias as modelAlias,
        SUM(input_tokens) as inputTokens,
        SUM(output_tokens) as outputTokens,
        SUM(cost) as cost
      FROM costs
      WHERE timestamp >= date('now', '-${days} days')
      GROUP BY date(timestamp), stage, model_alias
      ORDER BY date DESC
    `).all() as CostRecord[];
  }

  async getStats(): Promise<{
    totalCalls: number;
    totalCost: number;
    byStage: Record<string, number>;
    byModel: Record<string, number>;
  }> {
    const total = this.db.query(`
      SELECT COUNT(*) as count, COALESCE(SUM(cost), 0) as total FROM costs
    `).get() as { count: number; total: number };

    const byStage = this.db.query(`
      SELECT stage, SUM(cost) as cost FROM costs GROUP BY stage
    `).all() as { stage: string; cost: number }[];

    const byModel = this.db.query(`
      SELECT model_alias, SUM(cost) as cost FROM costs GROUP BY model_alias
    `).all() as { model_alias: string; cost: number }[];

    return {
      totalCalls: total.count,
      totalCost: total.total,
      byStage: Object.fromEntries(byStage.map((r) => [r.stage, r.cost])),
      byModel: Object.fromEntries(byModel.map((r) => [r.model_alias, r.cost])),
    };
  }

  async isOverBudget(monthlyBudget: number): Promise<boolean> {
    const spend = await this.getCurrentMonthSpend();
    return spend >= monthlyBudget;
  }
}

export function createCostTracker(dbPath?: string): CostTracker {
  return new SQLiteCostTracker(dbPath);
}
