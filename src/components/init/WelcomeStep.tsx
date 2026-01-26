/**
 * WelcomeStep component
 * Task 5.1: Display welcome message and check for existing directory
 */

import React, { useEffect, useState, useRef } from 'react';
import { Box, Text, useApp } from 'ink';
import { Spinner, Select } from '@inkjs/ui';
import type { BaseStepProps, ConflictResolution } from './types.js';

export interface WelcomeStepProps extends BaseStepProps {
  readonly directoryExists: boolean;
  readonly onConflictResolution?: (resolution: ConflictResolution) => void;
}

const CONFLICT_OPTIONS: { value: ConflictResolution; label: string }[] = [
  { value: 'overwrite', label: 'Overwrite - Replace existing configuration' },
  { value: 'merge', label: 'Merge - Keep existing files, add missing ones' },
  { value: 'abort', label: 'Abort - Cancel initialization' }
];

export const WelcomeStep: React.FC<WelcomeStepProps> = ({
  directoryExists,
  onNext,
  onError: _onError,
  onConflictResolution
}) => {
  const { exit } = useApp();
  const [checking, setChecking] = useState(true);

  // Use ref to stabilize callback
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;

  const onConflictResolutionRef = useRef(onConflictResolution);
  onConflictResolutionRef.current = onConflictResolution;

  const hasTransitionedRef = useRef(false);

  useEffect(() => {
    // Simulate a brief check delay for UX
    const timer = setTimeout(() => {
      setChecking(false);
      if (!directoryExists && !hasTransitionedRef.current) {
        hasTransitionedRef.current = true;
        onNextRef.current();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [directoryExists]);

  const handleConflictSelect = (value: string) => {
    const resolution = value as ConflictResolution;
    if (resolution === 'abort') {
      exit();
      return;
    }
    // Call resolution handler and proceed
    onConflictResolutionRef.current?.(resolution);
    onNextRef.current();
  };

  if (checking) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">Welcome to red64 init</Text>
        </Box>
        <Box>
          <Spinner label="Checking project directory..." />
        </Box>
      </Box>
    );
  }

  if (directoryExists) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="yellow">Existing .red64/ directory found</Text>
        </Box>
        <Text>A red64 configuration already exists in this project.</Text>
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Select an action:</Text>
          <Box marginTop={1}>
            <Select
              options={CONFLICT_OPTIONS}
              onChange={handleConflictSelect}
            />
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Welcome to red64 init</Text>
      </Box>
      <Text>Preparing to initialize your project for red64 flows...</Text>
    </Box>
  );
};
