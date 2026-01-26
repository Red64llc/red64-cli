/**
 * FlowTable Component
 * Task 2.2: Create flow listing table component
 * Requirements: 3.3, 3.4
 */

import React from 'react';
import { Box, Text } from 'ink';
import { formatDistanceToNow } from 'date-fns';
import type { FlowState, ExtendedFlowPhase } from '../../types/index.js';

/**
 * Props for FlowTable component
 */
export interface FlowTableProps {
  readonly flows: readonly FlowState[];
}

/**
 * Column widths (characters)
 */
const COLUMN_WIDTHS = {
  feature: 20,
  phase: 18,
  branch: 20,
  updated: 15
} as const;

/**
 * Truncate string to max length with ellipsis
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) {
    return str.padEnd(maxLen);
  }
  return str.slice(0, maxLen - 1) + '\u2026';
}

/**
 * Get display name for a phase
 */
function getPhaseDisplayName(phaseType: string): string {
  const names: Record<string, string> = {
    'idle': 'Ready',
    'initializing': 'Initializing',
    'requirements-generating': 'Requirements',
    'requirements-approval': 'Requirements Review',
    'gap-analysis': 'Gap Analysis',
    'gap-review': 'Gap Review',
    'design-generating': 'Design',
    'design-approval': 'Design Review',
    'design-validation': 'Design Validation',
    'design-validation-review': 'Validation Review',
    'tasks-generating': 'Tasks',
    'tasks-approval': 'Tasks Review',
    'implementing': 'Implementing',
    'paused': 'Paused',
    'validation': 'Validation',
    'pr': 'PR',
    'merge-decision': 'Merge Decision',
    'complete': 'Complete',
    'aborted': 'Aborted',
    'error': 'Error'
  };
  return names[phaseType] ?? phaseType;
}

/**
 * Get branch name from flow state
 * Extracts branch name from worktreePath or generates from feature
 */
function getBranchName(flow: FlowState): string {
  if (flow.metadata.worktreePath) {
    // Extract feature from path like /repo/worktrees/my-feature
    const parts = flow.metadata.worktreePath.split('/');
    const feature = parts[parts.length - 1];
    return `feature/${feature}`;
  }
  return `feature/${flow.feature}`;
}

/**
 * Format relative time
 */
function formatRelativeTime(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return 'unknown';
  }
}

/**
 * Sort flows by updatedAt descending (most recent first)
 */
function sortFlows(flows: readonly FlowState[]): FlowState[] {
  return [...flows].sort((a, b) => {
    const dateA = new Date(a.updatedAt).getTime();
    const dateB = new Date(b.updatedAt).getTime();
    return dateB - dateA;
  });
}

/**
 * Table header component
 */
const TableHeader: React.FC = () => (
  <Box>
    <Text bold color="cyan">
      {truncate('Feature', COLUMN_WIDTHS.feature)}
    </Text>
    <Text> </Text>
    <Text bold color="cyan">
      {truncate('Phase', COLUMN_WIDTHS.phase)}
    </Text>
    <Text> </Text>
    <Text bold color="cyan">
      {truncate('Branch', COLUMN_WIDTHS.branch)}
    </Text>
    <Text> </Text>
    <Text bold color="cyan">
      {truncate('Updated', COLUMN_WIDTHS.updated)}
    </Text>
  </Box>
);

/**
 * Table row component
 */
interface TableRowProps {
  readonly flow: FlowState;
}

const TableRow: React.FC<TableRowProps> = ({ flow }) => {
  const feature = truncate(flow.feature, COLUMN_WIDTHS.feature);
  const phase = truncate(getPhaseDisplayName(flow.phase.type), COLUMN_WIDTHS.phase);
  const branch = truncate(getBranchName(flow), COLUMN_WIDTHS.branch);
  const updated = truncate(formatRelativeTime(flow.updatedAt), COLUMN_WIDTHS.updated);

  return (
    <Box>
      <Text>{feature}</Text>
      <Text> </Text>
      <Text color="yellow">{phase}</Text>
      <Text> </Text>
      <Text dimColor>{branch}</Text>
      <Text> </Text>
      <Text dimColor>{updated}</Text>
    </Box>
  );
};

/**
 * FlowTable Component
 * Displays active flows in a table format
 * Requirements: 3.3 - Display table with Feature, Phase, Branch, Updated columns
 * Requirements: 3.4 - Display relative timestamps
 */
export const FlowTable: React.FC<FlowTableProps> = ({ flows }) => {
  const sortedFlows = sortFlows(flows);

  return (
    <Box flexDirection="column">
      <TableHeader />
      <Box>
        <Text dimColor>
          {''.padEnd(COLUMN_WIDTHS.feature + COLUMN_WIDTHS.phase + COLUMN_WIDTHS.branch + COLUMN_WIDTHS.updated + 3, '-')}
        </Text>
      </Box>
      {sortedFlows.map((flow) => (
        <TableRow key={flow.feature} flow={flow} />
      ))}
    </Box>
  );
};
