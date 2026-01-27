/**
 * FeatureSidebar Component
 * Right-side info panel showing feature status at a glance
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { ExtendedFlowPhase, WorkflowMode, CodingAgent } from '../../types/index.js';
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
 * Determine phase status relative to current phase
 */
function getPhaseStatus(
  phase: ExtendedFlowPhase['type'],
  currentPhase: ExtendedFlowPhase['type'],
  phases: readonly ExtendedFlowPhase['type'][]
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

  if (phaseIndex < currentIndex) {
    return 'completed';
  } else if (phaseIndex === currentIndex) {
    return 'current';
  } else {
    return 'pending';
  }
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
}) => {
  const displayName = truncate(featureName, 10);
  const allPhases = mode === 'greenfield' ? GREENFIELD_PHASES : BROWNFIELD_PHASES;
  const sidebarPhases = getSidebarPhases(mode);
  const agentInfo = AGENT_INFO[agent];

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      marginLeft={1}
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
      </Box>

      {/* Phase checklist */}
      <Box flexDirection="column" marginTop={1}>
        <Text dimColor>─ Phases ─</Text>
        {sidebarPhases.map((phase) => {
          const status = getPhaseStatus(phase, currentPhase, allPhases);
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
