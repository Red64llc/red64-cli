/**
 * SteeringStep component
 * Task 5.4: Offer steering enhancement options
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { Select } from '@inkjs/ui';
import type { BaseStepProps } from './types.js';

export interface SteeringStepProps extends BaseStepProps {
  readonly steeringFiles: readonly string[];
  readonly noSteering?: boolean;
}

type SteeringAction = 'enhance' | 'custom' | 'done';

const STEERING_OPTIONS: { value: SteeringAction; label: string }[] = [
  { value: 'enhance', label: 'Enhance steering docs with AI (/red64:steering)' },
  { value: 'custom', label: 'Generate custom steering docs (/red64:steering-custom)' },
  { value: 'done', label: 'Continue without enhancement' }
];

export const SteeringStep: React.FC<SteeringStepProps> = ({
  steeringFiles,
  noSteering,
  onNext
}) => {
  const [showingOptions, setShowingOptions] = useState(true);

  // Skip steering step if --no-steering flag is set
  React.useEffect(() => {
    if (noSteering) {
      onNext();
    }
  }, [noSteering, onNext]);

  const handleAction = (value: string) => {
    const action = value as SteeringAction;
    if (action === 'done') {
      onNext();
    } else {
      // For enhance/custom, show message and return to options
      // In real implementation, this would trigger Claude commands
      setShowingOptions(true);
    }
  };

  if (noSteering) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text dimColor>Skipping steering enhancement...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Steering Enhancement</Text>
      </Box>

      <Box marginBottom={1} flexDirection="column">
        <Text>Applied steering templates:</Text>
        {steeringFiles.map((file, index) => (
          <Text key={index} dimColor>  - {file}</Text>
        ))}
      </Box>

      {showingOptions && (
        <Box flexDirection="column" marginTop={1}>
          <Box marginBottom={1}>
            <Text>Would you like to enhance your steering documents?</Text>
          </Box>
          <Select
            options={STEERING_OPTIONS}
            onChange={handleAction}
          />
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          Tip: You can run steering commands later with /red64:steering
        </Text>
      </Box>
    </Box>
  );
};
