/**
 * SetupStep component
 * Task 5.3: Guided configuration for project setup
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { Select, TextInput } from '@inkjs/ui';
import type { BaseStepProps, SetupData } from './types.js';
import type { ProjectType } from '../../services/ConfigService.js';

export interface SetupStepProps extends BaseStepProps {
  readonly availableStacks: readonly string[];
  readonly defaultStack?: string;
  readonly skipGuided?: boolean;
  readonly onComplete: (data: SetupData) => void;
}

type SetupPhase = 'project-type' | 'stack' | 'name' | 'description' | 'complete';

const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: 'web-app', label: 'Web Application' },
  { value: 'cli-tool', label: 'CLI Tool' },
  { value: 'library', label: 'Library / Package' },
  { value: 'api', label: 'API / Backend Service' },
  { value: 'other', label: 'Other' }
];

export const SetupStep: React.FC<SetupStepProps> = ({
  availableStacks,
  defaultStack,
  skipGuided,
  onNext,
  onComplete
}) => {
  const [phase, setPhase] = useState<SetupPhase>('project-type');
  const [projectType, setProjectType] = useState<ProjectType>('web-app');
  const [stack, setStack] = useState(defaultStack ?? 'generic');
  const [projectName, setProjectName] = useState('');
  const [, setDescription] = useState('');

  // Handle skip-guided mode
  React.useEffect(() => {
    if (skipGuided) {
      const data: SetupData = {
        projectType: 'other',
        stack: defaultStack ?? 'generic',
        projectName: 'my-project',
        description: '',
        customValues: {}
      };
      onComplete(data);
      onNext();
    }
  }, [skipGuided, defaultStack, onComplete, onNext]);

  const handleProjectTypeSelect = (value: string) => {
    setProjectType(value as ProjectType);
    setPhase('stack');
  };

  const handleStackSelect = (value: string) => {
    setStack(value);
    setPhase('name');
  };

  const handleNameSubmit = (value: string) => {
    setProjectName(value);
    setPhase('description');
  };

  const handleDescriptionSubmit = (value: string) => {
    setDescription(value);
    const data: SetupData = {
      projectType,
      stack,
      projectName: projectName || 'my-project',
      description: value,
      customValues: {}
    };
    onComplete(data);
    onNext();
  };

  if (skipGuided) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text dimColor>Skipping guided setup...</Text>
      </Box>
    );
  }

  const stackOptions = [
    ...availableStacks.map(s => ({ value: s, label: s })),
    { value: 'generic', label: 'Generic (no framework-specific templates)' }
  ];

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Project Setup</Text>
      </Box>

      {phase === 'project-type' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>What type of project is this?</Text>
          </Box>
          <Select
            options={PROJECT_TYPES}
            onChange={handleProjectTypeSelect}
          />
        </Box>
      )}

      {phase === 'stack' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>Select your technology stack:</Text>
          </Box>
          <Select
            options={stackOptions}
            onChange={handleStackSelect}
          />
        </Box>
      )}

      {phase === 'name' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>Project name:</Text>
          </Box>
          <TextInput
            placeholder="my-project"
            onSubmit={handleNameSubmit}
          />
        </Box>
      )}

      {phase === 'description' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>Brief project description (optional):</Text>
          </Box>
          <TextInput
            placeholder="A brief description of your project"
            onSubmit={handleDescriptionSubmit}
          />
        </Box>
      )}
    </Box>
  );
};
