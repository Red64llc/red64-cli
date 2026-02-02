/**
 * SetupStep component
 * Task 5.3: Guided configuration for project setup
 */

import React, { useState, useRef, useEffect } from 'react';
import { Box, Text } from 'ink';
import { TextInput } from '@inkjs/ui';
import type { BaseStepProps, SetupData } from './types.js';
import { GroupedSelect, type OptionGroup } from './GroupedSelect.js';

export interface SetupStepProps extends BaseStepProps {
  readonly availableStacks: readonly string[];
  readonly defaultStack?: string;
  readonly skipGuided?: boolean;
  readonly onComplete: (data: SetupData) => void;
}

type SetupPhase = 'stack' | 'name' | 'description' | 'complete';

const LANGUAGE_LABELS: Record<string, string> = {
  c: 'C',
  cpp: 'C++',
  java: 'Java',
  javascript: 'JavaScript',
  php: 'PHP',
  python: 'Python',
  rust: 'Rust',
};

const FRAMEWORK_META: Record<string, { label: string; hint: string }> = {
  laravel: { label: 'Laravel', hint: 'PHP' },
  loco: { label: 'Loco', hint: 'Rust' },
  nextjs: { label: 'Next.js', hint: 'JavaScript' },
  rails: { label: 'Rails', hint: 'Ruby' },
  react: { label: 'React', hint: 'JavaScript' },
};

const LANGUAGES = new Set(Object.keys(LANGUAGE_LABELS));

function categorizeStacks(stacks: readonly string[]): readonly OptionGroup[] {
  const filtered = stacks.filter(s => s !== 'generic');

  const langGroup = filtered
    .filter(s => LANGUAGES.has(s))
    .map(s => ({ value: s, label: LANGUAGE_LABELS[s] ?? s }));

  const fwGroup = filtered
    .filter(s => s in FRAMEWORK_META)
    .map(s => ({
      value: s,
      label: FRAMEWORK_META[s]!.label,
      hint: FRAMEWORK_META[s]!.hint,
    }));

  // Any stack not recognized as language or framework
  const knownKeys = new Set([...LANGUAGES, ...Object.keys(FRAMEWORK_META), 'generic']);
  const unknownGroup = filtered
    .filter(s => !knownKeys.has(s))
    .map(s => ({ value: s, label: s }));

  const groups: OptionGroup[] = [];
  if (langGroup.length > 0) groups.push({ label: 'Languages', options: langGroup });
  if (fwGroup.length > 0) groups.push({ label: 'Frameworks', options: fwGroup });
  if (unknownGroup.length > 0) groups.push({ label: 'Other', options: unknownGroup });
  groups.push({
    label: unknownGroup.length > 0 ? '' : 'Other',
    options: [{ value: 'generic', label: 'Generic', hint: 'no framework-specific templates' }],
  });

  return groups;
}

export const SetupStep: React.FC<SetupStepProps> = ({
  availableStacks,
  defaultStack,
  skipGuided,
  onNext,
  onComplete
}) => {
  const [phase, setPhase] = useState<SetupPhase>('stack');
  const [stack, setStack] = useState(defaultStack ?? 'generic');
  const [projectName, setProjectName] = useState('');
  const [, setDescription] = useState('');

  // Use refs to stabilize callbacks
  const onCompleteRef = useRef(onComplete);
  const onNextRef = useRef(onNext);
  onCompleteRef.current = onComplete;
  onNextRef.current = onNext;

  const skipHandledRef = useRef(false);

  // Handle skip-guided mode
  useEffect(() => {
    if (skipGuided && !skipHandledRef.current) {
      skipHandledRef.current = true;
      const data: SetupData = {
        projectType: 'other',
        stack: defaultStack ?? 'generic',
        projectName: 'my-project',
        description: '',
        customValues: {}
      };
      onCompleteRef.current(data);
      onNextRef.current();
    }
  }, [skipGuided, defaultStack]);

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
      projectType: 'other',
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

  const stackGroups = categorizeStacks(availableStacks);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Project Setup</Text>
      </Box>

      {phase === 'stack' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>Select your technology stack:</Text>
          </Box>
          <GroupedSelect
            groups={stackGroups}
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
