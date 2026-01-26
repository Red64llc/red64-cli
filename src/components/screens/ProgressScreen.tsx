/**
 * Progress Screen Component
 * Task 8.1: Create progress screen with task tracking display
 * Requirements: 5.4, 5.5
 */

import React from 'react';
import { Box, Text, useInput } from 'ink';

/**
 * Progress screen props
 * Requirements: 5.4, 5.5
 */
export interface ProgressScreenProps {
  readonly currentTask: number;
  readonly totalTasks: number;
  readonly taskTitle: string;
  readonly isCheckpoint: boolean;
  readonly onContinue: () => void;
  readonly onPause: () => void;
  readonly onAbort: () => void;
}

/**
 * Generate progress bar string
 */
function generateProgressBar(current: number, total: number, width: number = 30): string {
  const percentage = total > 0 ? current / total : 0;
  const filled = Math.round(percentage * width);
  const empty = width - filled;
  return '[' + '='.repeat(filled) + ' '.repeat(empty) + ']';
}

/**
 * Progress screen component
 * Requirements: 5.4 - Display progress showing completed and remaining tasks
 * Requirements: 5.5 - Checkpoint prompt as SelectMenu
 */
export const ProgressScreen: React.FC<ProgressScreenProps> = ({
  currentTask,
  totalTasks,
  taskTitle,
  isCheckpoint,
  onContinue,
  onPause,
  onAbort
}) => {
  const [selectedOption, setSelectedOption] = React.useState(0);
  const options = ['Continue', 'Pause', 'Abort'];

  const progressBar = generateProgressBar(currentTask, totalTasks);
  const percentage = totalTasks > 0 ? Math.round((currentTask / totalTasks) * 100) : 0;

  // Handle keyboard input for checkpoint menu
  useInput((input, key) => {
    if (!isCheckpoint) return;

    if (key.upArrow) {
      setSelectedOption(prev => (prev > 0 ? prev - 1 : options.length - 1));
    }
    if (key.downArrow) {
      setSelectedOption(prev => (prev < options.length - 1 ? prev + 1 : 0));
    }
    if (key.return) {
      switch (selectedOption) {
        case 0:
          onContinue();
          break;
        case 1:
          onPause();
          break;
        case 2:
          onAbort();
          break;
      }
    }
    // Keyboard shortcuts
    if (input === 'c') {
      onContinue();
    }
    if (input === 'p') {
      onPause();
    }
    if (input === 'q') {
      onAbort();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Implementation Progress
        </Text>
      </Box>

      {/* Progress bar */}
      <Box marginBottom={1}>
        <Text>
          {progressBar} {percentage}%
        </Text>
      </Box>

      {/* Task counter */}
      <Box marginBottom={1}>
        <Text>
          Task <Text color="green">{currentTask}</Text> of <Text color="yellow">{totalTasks}</Text>
        </Text>
      </Box>

      {/* Current task title */}
      <Box marginBottom={1}>
        <Text>
          Current: <Text color="white">{taskTitle}</Text>
        </Text>
      </Box>

      {/* Checkpoint prompt or running indicator */}
      {isCheckpoint ? (
        <Box flexDirection="column" marginTop={1}>
          <Box marginBottom={1} borderStyle="single" paddingX={1}>
            <Text color="yellow">Checkpoint reached. Choose an action:</Text>
          </Box>

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
                {index === 0 && '(c)'}
                {index === 1 && '(p)'}
                {index === 2 && '(q)'}
              </Text>
            </Box>
          ))}

          <Box marginTop={1}>
            <Text dimColor>Use arrows to navigate, Enter to select</Text>
          </Box>
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text color="blue">Running...</Text>
        </Box>
      )}
    </Box>
  );
};
