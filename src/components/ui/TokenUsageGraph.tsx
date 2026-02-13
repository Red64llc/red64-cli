/**
 * Token Usage Graph Component
 * Displays a time-series visualization of token/context usage across tasks
 * Uses Unicode block characters for CLI-friendly rendering
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { TaskEntry, PhaseMetric } from '../../types/index.js';

interface TokenUsageGraphProps {
  /** Task entries with token/context usage data */
  readonly taskEntries: readonly TaskEntry[];
  /** Phase metrics with cost data */
  readonly phaseMetrics?: Record<string, PhaseMetric>;
  /** Width of the graph area (default: 60) */
  readonly width?: number;
}

// Unicode block characters for different heights (8 levels)
const BLOCKS = [' ', '\u2581', '\u2582', '\u2583', '\u2584', '\u2585', '\u2586', '\u2587', '\u2588'];

/**
 * Format token count for display (e.g., 1234567 -> "1.2M")
 */
function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return `${tokens}`;
}

/**
 * Format cost for display (e.g., 0.0475 -> "$0.05")
 */
function formatCost(cost: number): string {
  if (cost >= 1) {
    return `$${cost.toFixed(2)}`;
  }
  if (cost >= 0.01) {
    return `$${cost.toFixed(2)}`;
  }
  if (cost >= 0.001) {
    return `$${cost.toFixed(3)}`;
  }
  return `$${cost.toFixed(4)}`;
}

/**
 * Phase display labels for readable output
 */
const PHASE_LABELS: Record<string, string> = {
  'requirements-generating': 'Requirements',
  'gap-analysis': 'Gap Analysis',
  'design-generating': 'Design',
  'design-validation': 'Design Validation',
  'tasks-generating': 'Tasks',
  'implementing': 'Implementation'
};

/**
 * Generate a utilization bar (e.g., [████████░░░░░░░░░░░░] 35.2%)
 */
function generateUtilizationBar(percent: number, width: number): string {
  const clampedPercent = Math.min(100, Math.max(0, percent));
  const filled = Math.round((clampedPercent / 100) * width);
  const empty = width - filled;
  return '[' + '\u2588'.repeat(filled) + '\u2591'.repeat(empty) + ']';
}

/**
 * Get color for utilization level
 */
function getUtilizationColor(percent: number): string {
  if (percent > 85) return 'red';
  if (percent > 70) return 'yellow';
  return 'green';
}

/**
 * TokenUsageGraph Component
 * Renders a time-series graph of token usage per task with cumulative context utilization
 */
export const TokenUsageGraph: React.FC<TokenUsageGraphProps> = ({
  taskEntries,
  phaseMetrics,
  width = 60,
}) => {
  // Filter to completed tasks with context usage data
  const completedTasks = taskEntries.filter(
    t => t.status === 'completed' && (t.contextUsage || t.tokenUsage)
  );

  // Calculate total cost from phase metrics
  const phaseCosts = phaseMetrics
    ? Object.entries(phaseMetrics)
        .filter(([_, m]) => m.costUsd !== undefined && m.costUsd > 0)
        .map(([phase, m]) => ({
          phase,
          label: PHASE_LABELS[phase] ?? phase,
          cost: m.costUsd ?? 0,
          tokens: (m.inputTokens ?? 0) + (m.outputTokens ?? 0)
        }))
        .sort((a, b) => b.cost - a.cost)
    : [];

  const totalCost = phaseCosts.reduce((sum, p) => sum + p.cost, 0);

  // Empty state - show if no tasks AND no phase costs
  if (completedTasks.length === 0 && phaseCosts.length === 0) {
    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
      >
        <Text bold dimColor>{'\u2500'} Token Usage {'\u2500'}</Text>
        <Text dimColor>No usage data yet</Text>
      </Box>
    );
  }

  // Calculate max input tokens for scaling
  const maxInput = Math.max(
    ...completedTasks.map(t => t.contextUsage?.inputTokens ?? t.tokenUsage?.inputTokens ?? 0)
  );

  // Generate sparkline for input tokens per task
  const inputBars = completedTasks.map(t => {
    const value = t.contextUsage?.inputTokens ?? t.tokenUsage?.inputTokens ?? 0;
    const normalized = maxInput > 0 ? value / maxInput : 0;
    const blockIndex = Math.min(
      Math.floor(normalized * (BLOCKS.length - 1)),
      BLOCKS.length - 1
    );
    return BLOCKS[blockIndex];
  });

  // Calculate totals
  const totalInput = completedTasks.reduce(
    (sum, t) => sum + (t.tokenUsage?.inputTokens ?? 0),
    0
  );
  const totalOutput = completedTasks.reduce(
    (sum, t) => sum + (t.tokenUsage?.outputTokens ?? 0),
    0
  );

  // Get cumulative utilization from last task (if available)
  const lastTask = completedTasks[completedTasks.length - 1];
  const lastUtilization = lastTask?.contextUsage?.cumulativeUtilization ?? 0;
  const contextWindow = lastTask?.contextUsage?.contextWindowSize ?? 200000;
  const modelFamily = lastTask?.contextUsage?.modelFamily ?? 'unknown';

  // Calculate bar width based on available space
  // Account for: "Context: " (9) + bar (variable) + " XX.X% of XXXK" (~15)
  const barWidth = Math.max(10, Math.min(30, width - 30));

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
    >
      <Text bold dimColor>{'\u2500'} Token Usage ({modelFamily}) {'\u2500'}</Text>

      {/* Input tokens sparkline */}
      <Box marginTop={1}>
        <Text dimColor>Input:   </Text>
        <Text color="cyan">{inputBars.join('')}</Text>
        <Text dimColor> {formatTokens(totalInput)} total</Text>
      </Box>

      {/* Output tokens summary */}
      <Box>
        <Text dimColor>Output:  </Text>
        <Text color="magenta">{formatTokens(totalOutput)} total</Text>
      </Box>

      {/* Cumulative context utilization bar */}
      {lastUtilization > 0 && (
        <Box marginTop={1}>
          <Text dimColor>Context: </Text>
          <Text color={getUtilizationColor(lastUtilization)}>
            {generateUtilizationBar(lastUtilization, barWidth)}
          </Text>
          <Text dimColor> {lastUtilization.toFixed(1)}% of {formatTokens(contextWindow)}</Text>
        </Box>
      )}

      {/* Cost breakdown by phase */}
      {phaseCosts.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold dimColor>{'\u2500'} Cost by Phase {'\u2500'}</Text>
          {phaseCosts.map(({ label, cost, tokens }) => (
            <Box key={label}>
              <Text dimColor>{label.padEnd(18)}</Text>
              <Text color="yellow">{formatCost(cost).padStart(8)}</Text>
              <Text dimColor> ({formatTokens(tokens)} tokens)</Text>
            </Box>
          ))}
          <Box marginTop={1}>
            <Text bold>{'Total Cost:'.padEnd(18)}</Text>
            <Text bold color="yellow">{formatCost(totalCost).padStart(8)}</Text>
          </Box>
        </Box>
      )}

      {/* Summary stats */}
      <Box marginTop={1}>
        <Text dimColor>
          Tasks: {completedTasks.length} | Total: {formatTokens(totalInput + totalOutput)} tokens
        </Text>
      </Box>
    </Box>
  );
};
