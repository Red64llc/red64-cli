/**
 * Approval Screen Component
 * Task 7.1: Create approval screen component for phase gates
 * Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 */

import React from 'react';
import { Box, Text, useInput } from 'ink';
import type { ExtendedFlowPhase } from '../../types/extended-flow.js';
import { basename } from 'node:path';

/**
 * Approval screen props
 * Requirements: 3.2 - Render approval UI
 */
export interface ApprovalScreenProps {
  readonly phase: ExtendedFlowPhase;
  readonly artifactPath: string;
  readonly onApprove: () => void;
  readonly onReject: () => void;
  readonly onAbort: () => void;
}

/**
 * Get phase display name
 */
function getPhaseDisplayName(phase: ExtendedFlowPhase): string {
  switch (phase.type) {
    case 'requirements-approval':
      return 'requirements';
    case 'design-approval':
      return 'design';
    case 'tasks-approval':
      return 'tasks';
    case 'gap-review':
      return 'gap analysis';
    case 'design-validation-review':
      return 'design validation';
    default:
      return phase.type;
  }
}

/**
 * Get feature from phase
 */
function getFeature(phase: ExtendedFlowPhase): string {
  if (phase.type === 'idle') {
    return '';
  }
  return phase.feature;
}

/**
 * Approval screen component
 * Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 */
export const ApprovalScreen: React.FC<ApprovalScreenProps> = ({
  phase,
  artifactPath,
  onApprove,
  onReject,
  onAbort
}) => {
  const [selectedOption, setSelectedOption] = React.useState(0);
  const options = ['Approve', 'Request Changes', 'Abort'];

  const phaseName = getPhaseDisplayName(phase);
  const feature = getFeature(phase);
  const artifactName = basename(artifactPath);

  // Handle keyboard input
  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedOption(prev => (prev > 0 ? prev - 1 : options.length - 1));
    }
    if (key.downArrow) {
      setSelectedOption(prev => (prev < options.length - 1 ? prev + 1 : 0));
    }
    if (key.return) {
      switch (selectedOption) {
        case 0:
          onApprove();
          break;
        case 1:
          onReject();
          break;
        case 2:
          onAbort();
          break;
      }
    }
    // Keyboard shortcuts
    if (input === 'a') {
      onApprove();
    }
    if (input === 'r') {
      onReject();
    }
    if (input === 'q') {
      onAbort();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Approval Gate: {phaseName}
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>Feature: </Text>
        <Text color="yellow">{feature}</Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>Artifact: {artifactName}</Text>
      </Box>

      <Box marginBottom={1} borderStyle="single" paddingX={1}>
        <Text>Review the generated {phaseName} and choose an action:</Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {options.map((option, index) => (
          <Box key={option}>
            <Text
              color={selectedOption === index ? 'green' : undefined}
              bold={selectedOption === index}
            >
              {selectedOption === index ? '> ' : '  '}
              {option}
            </Text>
            <Text dimColor>
              {' '}
              {index === 0 && '(a)'}
              {index === 1 && '(r)'}
              {index === 2 && '(q)'}
            </Text>
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Use arrows to navigate, Enter to select, or press shortcut key</Text>
      </Box>
    </Box>
  );
};
