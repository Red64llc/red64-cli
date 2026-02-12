/**
 * Context Usage Calculator Service
 * Calculates context-aware metrics for smart session management
 * Tracks cumulative usage across tasks to simulate shared session behavior
 */

import type { TokenUsage, TaskEntry, ContextUsage } from '../types/index.js';
import { getModelConfig } from './ModelConfig.js';

/**
 * Context usage calculator service interface
 */
export interface ContextUsageCalculatorService {
  /**
   * Calculate context usage metrics for a completed task
   *
   * @param tokenUsage - Raw token usage from agent invocation
   * @param model - Model used for the task (for context window lookup)
   * @param previousTasks - Completed tasks for cumulative calculation
   * @returns ContextUsage with full metrics
   */
  calculate(
    tokenUsage: TokenUsage,
    model: string | undefined,
    previousTasks: readonly TaskEntry[]
  ): ContextUsage;
}

/**
 * Create context usage calculator service
 *
 * @returns ContextUsageCalculatorService instance
 */
export function createContextUsageCalculator(): ContextUsageCalculatorService {
  return {
    calculate(
      tokenUsage: TokenUsage,
      model: string | undefined,
      previousTasks: readonly TaskEntry[]
    ): ContextUsage {
      // Get model configuration (context window size, family)
      const modelConfig = getModelConfig(model ?? tokenUsage.model);

      // Sum input tokens from all previously completed tasks
      // This simulates what context would look like if tasks shared a session
      const previousInputTokens = previousTasks
        .filter(t => t.status === 'completed' && t.tokenUsage)
        .reduce((sum, t) => sum + (t.tokenUsage?.inputTokens ?? 0), 0);

      // Calculate cumulative input tokens (previous + current)
      const cumulativeInputTokens = previousInputTokens + tokenUsage.inputTokens;

      // Calculate utilization percentages
      const utilizationPercent = (tokenUsage.inputTokens / modelConfig.contextWindow) * 100;
      const cumulativeUtilization = (cumulativeInputTokens / modelConfig.contextWindow) * 100;

      return {
        // Spread original token usage
        ...tokenUsage,

        // Add context-aware metrics
        contextWindowSize: modelConfig.contextWindow,
        utilizationPercent,
        cumulativeInputTokens,
        cumulativeUtilization,
        modelFamily: modelConfig.modelFamily,
      };
    },
  };
}
