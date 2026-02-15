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
  /** Peak context utilization percent ever reached (for max marker) */
  readonly maxContextPercent?: number;
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
 * Generate a utilization bar with optional max marker
 * Shows current usage as filled bar, with a vertical line at max position
 * e.g., [████████░░░░░░│░░░░░░] where │ marks peak usage
 */
function generateUtilizationBar(
  percent: number,
  width: number,
  maxPercent?: number
): { bar: string; maxPosition?: number; maxColor?: string } {
  const clampedPercent = Math.min(100, Math.max(0, percent));
  const filled = Math.round((clampedPercent / 100) * width);

  // If no max or max equals current, just render simple bar
  if (maxPercent === undefined || maxPercent <= clampedPercent) {
    const empty = width - filled;
    return { bar: '[' + '\u2588'.repeat(filled) + '\u2591'.repeat(empty) + ']' };
  }

  // Calculate max marker position
  const clampedMax = Math.min(100, Math.max(0, maxPercent));
  const maxPos = Math.round((clampedMax / 100) * width);
  const maxColor = getUtilizationColor(clampedMax);

  // Build bar: [filled░░░│░░░] where │ is at maxPos
  const afterFilled = maxPos - filled - 1; // -1 for the marker itself
  const afterMarker = width - maxPos;

  if (afterFilled < 0) {
    // Max is within filled area - just show filled bar
    const empty = width - filled;
    return { bar: '[' + '\u2588'.repeat(filled) + '\u2591'.repeat(empty) + ']' };
  }

  const bar = '[' +
    '\u2588'.repeat(filled) +
    '\u2591'.repeat(afterFilled) +
    '\u2502' + // vertical line marker │
    '\u2591'.repeat(afterMarker) +
    ']';

  return { bar, maxPosition: maxPos, maxColor };
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
 * ContextBar Component
 * Renders the context utilization bar with current usage and max marker
 */
interface ContextBarProps {
  current: number;
  max?: number;
  width: number;
  contextWindow: number;
}

const ContextBar: React.FC<ContextBarProps> = ({ current, max, width, contextWindow }) => {
  const { bar, maxColor } = generateUtilizationBar(current, width, max);
  const currentColor = getUtilizationColor(current);

  // If there's a max marker, we need to render the bar in segments with different colors
  if (max !== undefined && max > current) {
    // Split the bar into: [ + filled (green) + empty before marker + marker (maxColor) + empty after + ]
    const clampedCurrent = Math.min(100, Math.max(0, current));
    const clampedMax = Math.min(100, Math.max(0, max));
    const filledPos = Math.round((clampedCurrent / 100) * width);
    const maxPos = Math.round((clampedMax / 100) * width);

    const filled = '\u2588'.repeat(filledPos);
    const beforeMarker = '\u2591'.repeat(Math.max(0, maxPos - filledPos - 1));
    const afterMarker = '\u2591'.repeat(Math.max(0, width - maxPos));

    return (
      <>
        <Text dimColor>[</Text>
        <Text color={currentColor}>{filled}</Text>
        <Text dimColor>{beforeMarker}</Text>
        <Text color={maxColor}>{'\u2502'}</Text>
        <Text dimColor>{afterMarker}</Text>
        <Text dimColor>]</Text>
        <Text dimColor> {current.toFixed(1)}% of {formatTokens(contextWindow)}</Text>
      </>
    );
  }

  // Simple bar without max marker
  return (
    <>
      <Text color={currentColor}>{bar}</Text>
      <Text dimColor> {current.toFixed(1)}% of {formatTokens(contextWindow)}</Text>
    </>
  );
};

/**
 * TokenUsageGraph Component
 * Renders a time-series graph of token usage per task with context utilization
 */
export const TokenUsageGraph: React.FC<TokenUsageGraphProps> = ({
  taskEntries,
  phaseMetrics,
  width = 60,
  maxContextPercent,
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

  // Calculate totals from task entries
  const taskInput = completedTasks.reduce(
    (sum, t) => sum + (t.tokenUsage?.inputTokens ?? 0),
    0
  );
  const taskOutput = completedTasks.reduce(
    (sum, t) => sum + (t.tokenUsage?.outputTokens ?? 0),
    0
  );

  // Calculate totals from phase metrics (for non-implementation phases)
  const phaseInput = phaseMetrics
    ? Object.values(phaseMetrics).reduce((sum, m) => sum + (m.inputTokens ?? 0), 0)
    : 0;
  const phaseOutput = phaseMetrics
    ? Object.values(phaseMetrics).reduce((sum, m) => sum + (m.outputTokens ?? 0), 0)
    : 0;

  // Use the larger of the two sources (phase metrics include all phases, task entries only for impl)
  const totalInput = Math.max(taskInput, phaseInput);
  const totalOutput = Math.max(taskOutput, phaseOutput);

  // Get current task's context utilization (not cumulative - single task peak is what matters)
  const lastTask = completedTasks[completedTasks.length - 1];
  const currentUtilization = lastTask?.contextUsage?.utilizationPercent ?? 0;
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

      {/* Context utilization bar with max marker */}
      {(currentUtilization > 0 || maxContextPercent) && (
        <Box marginTop={1}>
          <Text dimColor>Context: </Text>
          <ContextBar
            current={currentUtilization}
            max={maxContextPercent}
            width={barWidth}
            contextWindow={contextWindow}
          />
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
