/**
 * FeatureSidebar Component
 * Right-side info panel showing feature status at a glance
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { ExtendedFlowPhase, WorkflowMode, CodingAgent, HistoryEntry } from '../../types/index.js';
import { GREENFIELD_PHASES, BROWNFIELD_PHASES } from '../../types/index.js';

export type { CodingAgent };

/**
 * Agent display info
 */
interface AgentInfo {
  readonly icon: string;
  readonly name: string;
  readonly color: string;
}

/**
 * Agent icons and names
 */
const AGENT_INFO: Record<CodingAgent, AgentInfo> = {
  claude: { icon: '\uD83E\uDD16', name: 'Claude', color: '#D97706' },    // 🤖
  gemini: { icon: '\u2728', name: 'Gemini', color: '#4285F4' },          // ✨
  codex: { icon: '\uD83D\uDFE2', name: 'Codex', color: '#10A37F' },      // 🟢
};

/**
 * Props for FeatureSidebar
 */
export interface FeatureSidebarProps {
  readonly featureName: string;
  readonly sandboxMode: boolean;
  readonly currentPhase: ExtendedFlowPhase['type'];
  readonly mode: WorkflowMode;
  readonly currentTask: number;
  readonly totalTasks: number;
  readonly commitCount: number;
  readonly agent?: CodingAgent;
  readonly model?: string;
  readonly history?: readonly HistoryEntry[];  // History for determining phase completion
}

/**
 * Phase status type
 */
type PhaseStatus = 'completed' | 'current' | 'pending';

/**
 * Simplified phase display names (short for sidebar)
 */
function getShortPhaseName(phase: ExtendedFlowPhase['type']): string {
  const names: Partial<Record<ExtendedFlowPhase['type'], string>> = {
    'initializing': 'Init',
    'requirements-generating': 'Require',
    'requirements-approval': 'Review',
    'gap-analysis': 'Gap',
    'gap-review': 'Review',
    'design-generating': 'Design',
    'design-approval': 'Review',
    'tasks-generating': 'Tasks',
    'tasks-approval': 'Review',
    'implementing': 'Impl',
    'complete': 'Done',
  };
  return names[phase] ?? phase.slice(0, 8);
}

/**
 * Get status indicator symbol
 */
function getStatusIndicator(status: PhaseStatus): string {
  switch (status) {
    case 'completed':
      return '\u2713'; // checkmark ✓
    case 'current':
      return '\u25CF'; // filled circle ●
    case 'pending':
      return '\u25CB'; // empty circle ○
  }
}

/**
 * Get status color
 */
function getStatusColor(status: PhaseStatus): string {
  switch (status) {
    case 'completed':
      return 'green';
    case 'current':
      return 'yellow';
    case 'pending':
      return 'gray';
  }
}

/**
 * Check if a phase was completed in history
 * A phase is considered completed if a LATER phase appears in history
 */
function wasPhaseCompletedInHistory(
  phase: ExtendedFlowPhase['type'],
  history: readonly HistoryEntry[] | undefined,
  phases: readonly ExtendedFlowPhase['type'][]
): boolean {
  if (!history || history.length === 0) return false;

  const phaseIndex = phases.indexOf(phase);
  if (phaseIndex === -1) return false;

  // Check if any phase AFTER this one appears in history
  // This means this phase was completed
  for (const entry of history) {
    const entryPhaseType = entry.phase.type;
    const entryIndex = phases.indexOf(entryPhaseType);
    if (entryIndex > phaseIndex) {
      return true;
    }
    // Also check if this exact phase appears in history (means it was at least entered)
    // And a later phase exists
    if (entryPhaseType === phase) {
      // Check if there's a later entry with a later phase
      const laterEntries = history.filter(h => {
        const laterIdx = phases.indexOf(h.phase.type);
        return laterIdx > phaseIndex;
      });
      if (laterEntries.length > 0) return true;
    }
  }

  return false;
}

/**
 * Determine phase status relative to current phase AND history
 */
function getPhaseStatus(
  phase: ExtendedFlowPhase['type'],
  currentPhase: ExtendedFlowPhase['type'],
  phases: readonly ExtendedFlowPhase['type'][],
  history?: readonly HistoryEntry[]
): PhaseStatus {
  // Handle terminal phases
  if (currentPhase === 'complete') {
    return 'completed';
  }
  if (currentPhase === 'aborted' || currentPhase === 'error') {
    if (phase === currentPhase) return 'current';
    const currentIndex = phases.indexOf(currentPhase);
    const phaseIndex = phases.indexOf(phase);
    return phaseIndex < currentIndex ? 'completed' : 'pending';
  }

  // Handle idle - nothing is completed yet
  if (currentPhase === 'idle') {
    return 'pending';
  }

  const currentIndex = phases.indexOf(currentPhase);
  const phaseIndex = phases.indexOf(phase);

  if (currentIndex === -1 || phaseIndex === -1) {
    return 'pending';
  }

  // Check if this is the current phase
  if (phaseIndex === currentIndex) {
    return 'current';
  }

  // Check if phase is before current phase in sequence
  if (phaseIndex < currentIndex) {
    return 'completed';
  }

  // Phase is after current in sequence - but check history!
  // If this phase was completed in a previous run (appears in history
  // with a later phase following), mark it as completed
  if (wasPhaseCompletedInHistory(phase, history, phases)) {
    return 'completed';
  }

  return 'pending';
}

/**
 * Get display phases for sidebar (simplified list)
 */
function getSidebarPhases(mode: WorkflowMode): ExtendedFlowPhase['type'][] {
  const phases = mode === 'greenfield' ? GREENFIELD_PHASES : BROWNFIELD_PHASES;

  // Show only main phases (not approval/review phases)
  return phases.filter(phase =>
    phase === 'initializing' ||
    phase === 'requirements-generating' ||
    phase === 'gap-analysis' ||
    phase === 'design-generating' ||
    phase === 'tasks-generating' ||
    phase === 'implementing' ||
    phase === 'complete'
  );
}

/**
 * Truncate string with ellipsis
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

/**
 * Get short model name for display
 */
function getShortModelName(model: string): string {
  // Extract key part of model name
  if (model.includes('haiku')) return 'haiku';
  if (model.includes('sonnet')) return 'sonnet';
  if (model.includes('opus')) return 'opus';
  if (model.includes('flash-lite')) return 'flash-lite';
  if (model.includes('flash')) return 'flash';
  if (model.includes('pro')) return 'pro';
  if (model.includes('o3-mini')) return 'o3-mini';
  if (model.includes('o1-mini')) return 'o1-mini';
  if (model.includes('4o-mini')) return '4o-mini';
  if (model.includes('4o')) return '4o';
  if (model.includes('o1')) return 'o1';
  return truncate(model, 10);
}

/**
 * FeatureSidebar Component
 * Displays feature info in a compact right-side panel
 */
export const FeatureSidebar: React.FC<FeatureSidebarProps> = ({
  featureName,
  sandboxMode,
  currentPhase,
  mode,
  currentTask,
  totalTasks,
  commitCount,
  agent = 'claude',
  model,
  history,
}) => {
  const displayName = truncate(featureName, 10);
  const allPhases = mode === 'greenfield' ? GREENFIELD_PHASES : BROWNFIELD_PHASES;
  const sidebarPhases = getSidebarPhases(mode);
  const agentInfo = AGENT_INFO[agent];
  // Extract short model name (e.g., "claude-3-5-haiku-latest" -> "haiku")
  const shortModel = model ? getShortModelName(model) : undefined;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      width={16}
    >
      {/* Feature name header */}
      <Text bold color="cyan">{displayName}</Text>

      {/* Mode indicators */}
      <Box flexDirection="column" marginTop={1}>
        {sandboxMode && (
          <Text color="blue">{'\uD83D\uDC33'} sandbox</Text>
        )}
        <Text>{agentInfo.icon} {agentInfo.name}</Text>
        {shortModel && (
          <Text dimColor>  └ {shortModel}</Text>
        )}
      </Box>

      {/* Phase checklist */}
      <Box flexDirection="column" marginTop={1}>
        <Text dimColor>─ Phases ─</Text>
        {sidebarPhases.map((phase) => {
          const status = getPhaseStatus(phase, currentPhase, allPhases, history);
          const indicator = getStatusIndicator(status);
          const color = getStatusColor(status);
          const name = getShortPhaseName(phase);

          // Show task progress for implementing phase
          const isImplementing = phase === 'implementing';
          const progress = isImplementing && totalTasks > 0
            ? ` ${currentTask}/${totalTasks}`
            : '';

          return (
            <Box key={phase}>
              <Text color={color}>
                {indicator} {name}{progress}
              </Text>
            </Box>
          );
        })}
      </Box>

      {/* Commit count */}
      <Box flexDirection="column" marginTop={1}>
        <Text dimColor>─ Commits ─</Text>
        <Text>{commitCount} commit{commitCount !== 1 ? 's' : ''}</Text>
      </Box>
    </Box>
  );
};
