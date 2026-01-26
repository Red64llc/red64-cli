/**
 * ErrorRecoveryPrompt Component
 * Task 2.4: Create error recovery prompt component
 * Requirements: 5.1, 5.2, 5.3
 */

import React from 'react';
import { Box, Text } from 'ink';
import { Select } from '@inkjs/ui';

/**
 * Recovery option types
 * Requirements: 5.1, 5.2, 5.3 - Different options per error type
 */
export type RecoveryOption = 'retry' | 'skip' | 'save-and-exit' | 'abort';

/**
 * Error type categories
 */
export type ErrorType = 'git' | 'agent' | 'network';

/**
 * Props for ErrorRecoveryPrompt
 */
export interface ErrorRecoveryPromptProps {
  readonly error: Error;
  readonly errorType: ErrorType;
  readonly onSelect: (option: RecoveryOption) => void;
}

/**
 * Get recovery options based on error type
 * Requirements:
 * 5.1 - Git errors: retry/skip/abort
 * 5.2 - Agent errors: retry/continue/abort
 * 5.3 - Network errors: retry/save-and-exit/abort
 */
function getRecoveryOptions(errorType: ErrorType): Array<{ label: string; value: RecoveryOption }> {
  switch (errorType) {
    case 'git':
      return [
        { label: 'Retry operation', value: 'retry' },
        { label: 'Skip and continue', value: 'skip' },
        { label: 'Abort flow', value: 'abort' }
      ];
    case 'agent':
      return [
        { label: 'Retry invocation', value: 'retry' },
        { label: 'Continue without result', value: 'skip' }, // displayed as "Continue"
        { label: 'Abort flow', value: 'abort' }
      ];
    case 'network':
      return [
        { label: 'Retry request', value: 'retry' },
        { label: 'Save state and exit', value: 'save-and-exit' },
        { label: 'Abort flow', value: 'abort' }
      ];
    default:
      return [
        { label: 'Retry', value: 'retry' },
        { label: 'Abort', value: 'abort' }
      ];
  }
}

/**
 * Get error type description
 */
function getErrorTypeDescription(errorType: ErrorType): string {
  switch (errorType) {
    case 'git':
      return 'Git operation failed';
    case 'agent':
      return 'Agent invocation failed';
    case 'network':
      return 'Network operation failed';
    default:
      return 'Operation failed';
  }
}

/**
 * ErrorRecoveryPrompt Component
 * Prompts user for error recovery action
 * Requirements: 5.1-5.3 - Recovery options for different error types
 */
export const ErrorRecoveryPrompt: React.FC<ErrorRecoveryPromptProps> = ({
  error,
  errorType,
  onSelect
}) => {
  const options = getRecoveryOptions(errorType);
  const typeDescription = getErrorTypeDescription(errorType);

  const handleChange = (value: string) => {
    onSelect(value as RecoveryOption);
  };

  return (
    <Box flexDirection="column" paddingY={1}>
      {/* Error header */}
      <Box>
        <Text color="red" bold>{typeDescription}</Text>
      </Box>

      {/* Error message */}
      <Box marginTop={1}>
        <Text color="red">{error.message || 'Unknown error'}</Text>
      </Box>

      {/* Recovery options */}
      <Box marginTop={1} flexDirection="column">
        <Text bold>What would you like to do?</Text>
        <Box marginTop={1}>
          <Select
            options={options.map(opt => ({ label: opt.label, value: opt.value }))}
            onChange={handleChange}
          />
        </Box>
      </Box>
    </Box>
  );
};
