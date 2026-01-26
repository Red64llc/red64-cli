/**
 * PhaseProgressView Component
 * Task 2.1: Create phase progress visualization component
 * Requirements: 1.4, 2.1, 2.2
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { ExtendedFlowPhase, WorkflowMode } from '../../types/index.js';

/**
 * Props for PhaseProgressView
 */
export interface PhaseProgressViewProps {
  readonly phases: readonly ExtendedFlowPhase['type'][];
  readonly currentPhase: ExtendedFlowPhase['type'];
  readonly mode: WorkflowMode;
}

/**
 * Phase status type
 */
type PhaseStatus = 'completed' | 'current' | 'pending';

/**
 * Get human-readable name for a phase
 */
function getPhaseDisplayName(phase: ExtendedFlowPhase['type']): string {
  const names: Record<ExtendedFlowPhase['type'], string> = {
    'idle': 'Ready',
    'initializing': 'Initialize',
    'requirements-generating': 'Requirements',
    'requirements-approval': 'Review Requirements',
    'gap-analysis': 'Gap Analysis',
    'gap-review': 'Review Gaps',
    'design-generating': 'Design',
    'design-approval': 'Review Design',
    'design-validation': 'Validate Design',
    'design-validation-review': 'Review Validation',
    'tasks-generating': 'Tasks',
    'tasks-approval': 'Review Tasks',
    'implementing': 'Implementation',
    'paused': 'Paused',
    'validation': 'Validation',
    'pr': 'Pull Request',
    'merge-decision': 'Merge Decision',
    'complete': 'Complete',
    'aborted': 'Aborted',
    'error': 'Error'
  };
  return names[phase] ?? phase;
}

/**
 * Get status indicator symbol
 */
function getStatusIndicator(status: PhaseStatus): string {
  switch (status) {
    case 'completed':
      return '\u2713'; // checkmark
    case 'current':
      return '\u25CF'; // filled circle
    case 'pending':
      return '\u25CB'; // empty circle
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
  if (currentPhase === 'complete' || currentPhase === 'aborted' || currentPhase === 'error') {
    if (phase === currentPhase) return 'current';
    // All other phases are completed for complete, or we consider the path leading to abort/error
    return 'completed';
  }

  // Handle idle - nothing is completed yet
  if (currentPhase === 'idle') {
    return 'pending';
  }

  const currentIndex = phases.indexOf(currentPhase);
  const phaseIndex = phases.indexOf(phase);

  // If current phase not in the list, treat as pending
  if (currentIndex === -1) {
    return 'pending';
  }

  // Phase not in list
  if (phaseIndex === -1) {
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
 * Filter phases for display (skip terminal and special phases)
 */
function getDisplayPhases(phases: readonly ExtendedFlowPhase['type'][]): ExtendedFlowPhase['type'][] {
  return phases.filter(phase =>
    phase !== 'idle' &&
    phase !== 'paused' &&
    phase !== 'aborted' &&
    phase !== 'error'
  );
}

/**
 * PhaseProgressView Component
 * Displays workflow phases with visual status indicators
 * Requirements: 1.4 - Display completed phases with checkmarks
 * Requirements: 2.1, 2.2 - Visual status indicators for phase progress
 */
export const PhaseProgressView: React.FC<PhaseProgressViewProps> = ({
  phases,
  currentPhase,
  mode: _mode
}) => {
  const displayPhases = getDisplayPhases(phases);

  return (
    <Box flexDirection="column">
      {displayPhases.map((phase) => {
        const status = getPhaseStatus(phase, currentPhase, phases);
        const indicator = getStatusIndicator(status);
        const color = getStatusColor(status);
        const name = getPhaseDisplayName(phase);

        return (
          <Box key={phase}>
            <Text color={color}>
              {indicator} {name}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};
