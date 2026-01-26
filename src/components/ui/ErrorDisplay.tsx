/**
 * ErrorDisplay Component
 * Task 2.3: Create error display component
 * Requirements: 5.6
 */

import React from 'react';
import { Box, Text } from 'ink';

/**
 * Props for ErrorDisplay component
 */
export interface ErrorDisplayProps {
  readonly error: Error;
  readonly suggestion: string;
}

/**
 * ErrorDisplay Component
 * Renders actionable error messages with suggested fixes
 * Requirements: 5.6 - Display actionable error messages with suggested fixes
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  suggestion
}) => {
  const errorMessage = error.message || 'An unknown error occurred';

  return (
    <Box flexDirection="column" paddingY={1}>
      {/* Error message */}
      <Box>
        <Text color="red" bold>Error: </Text>
        <Text color="red">{errorMessage}</Text>
      </Box>

      {/* Suggestion */}
      {suggestion && (
        <Box marginTop={1}>
          <Text color="yellow" bold>Suggestion: </Text>
          <Text color="yellow">{suggestion}</Text>
        </Box>
      )}
    </Box>
  );
};
