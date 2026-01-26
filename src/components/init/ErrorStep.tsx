/**
 * ErrorStep component
 * Display error with recovery suggestions
 */

import React from 'react';
import { Box, Text } from 'ink';
import { Select } from '@inkjs/ui';
import type { InitError } from './types.js';

export interface ErrorStepProps {
  readonly error: InitError;
  readonly onRetry?: () => void;
  readonly onUseCache?: () => void;
  readonly onAbort?: () => void;
}

type ErrorAction = 'retry' | 'use-cache' | 'abort';

export const ErrorStep: React.FC<ErrorStepProps> = ({
  error,
  onRetry,
  onUseCache,
  onAbort
}) => {
  const { code, message, recoverable, suggestion } = error;

  const getOptions = () => {
    const options: { value: ErrorAction; label: string }[] = [];

    if (recoverable && onRetry) {
      options.push({ value: 'retry', label: 'Retry' });
    }

    if (code === 'NETWORK_ERROR' && onUseCache) {
      options.push({ value: 'use-cache', label: 'Use cached version (if available)' });
    }

    if (onAbort) {
      options.push({ value: 'abort', label: 'Abort initialization' });
    }

    return options;
  };

  const handleAction = (value: string) => {
    const action = value as ErrorAction;
    switch (action) {
      case 'retry':
        onRetry?.();
        break;
      case 'use-cache':
        onUseCache?.();
        break;
      case 'abort':
        onAbort?.();
        break;
    }
  };

  const options = getOptions();

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="red">Error: {code}</Text>
      </Box>

      <Box marginBottom={1}>
        <Text>{message}</Text>
      </Box>

      {suggestion && (
        <Box marginBottom={1}>
          <Text dimColor>Suggestion: {suggestion}</Text>
        </Box>
      )}

      {options.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Box marginBottom={1}>
            <Text>What would you like to do?</Text>
          </Box>
          <Select
            options={options}
            onChange={handleAction}
          />
        </Box>
      )}

      {options.length === 0 && (
        <Box marginTop={1}>
          <Text dimColor>Initialization cannot continue. Please resolve the issue and try again.</Text>
        </Box>
      )}
    </Box>
  );
};
