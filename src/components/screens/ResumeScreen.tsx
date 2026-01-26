/**
 * Resume screen component
 * Task 3: Resume Screen Implementation
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 5.4
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import type { ScreenProps } from './ScreenProps.js';
import type { FlowState, GitStatus, ExtendedFlowPhase, WorkflowMode } from '../../types/index.js';
import { getPhaseSequence } from '../../types/index.js';
import { createStateStore, type StateStoreService } from '../../services/StateStore.js';
import { createGitStatusChecker, type GitStatusCheckerService } from '../../services/GitStatusChecker.js';
import { Spinner, PhaseProgressView, ErrorDisplay, SelectMenu, type SelectMenuItem } from '../ui/index.js';

/**
 * Resume screen state
 * Requirements: 1.1-1.6 - Flow through states for resume
 */
type ResumeScreenState =
  | { step: 'loading' }
  | { step: 'not-found'; feature: string }
  | { step: 'uncommitted-changes'; flowState: FlowState; gitStatus: GitStatus }
  | { step: 'resuming'; flowState: FlowState }
  | { step: 'resumed'; flowState: FlowState }
  | { step: 'error'; error: string };

/**
 * Uncommitted changes action options
 */
type UncommittedAction = 'commit' | 'discard' | 'abort';

const uncommittedOptions: SelectMenuItem<UncommittedAction>[] = [
  { label: 'Commit changes (WIP)', value: 'commit' },
  { label: 'Discard changes', value: 'discard' },
  { label: 'Abort resume', value: 'abort' }
];

/**
 * Get base directory from environment or default
 */
function getBaseDir(): string {
  return process.cwd();
}

/**
 * ResumeScreen Component
 * Resumes an interrupted flow from persisted state
 * Requirements: 1.1-1.6 - Resume command implementation
 */
export const ResumeScreen: React.FC<ScreenProps> = ({ args }) => {
  const { exit } = useApp();
  const featureName = args[0];

  const [state, setState] = useState<ResumeScreenState>({ step: 'loading' });
  const [stateStore] = useState<StateStoreService>(() => createStateStore(getBaseDir()));
  const [gitChecker] = useState<GitStatusCheckerService>(() => createGitStatusChecker());

  // Load flow state on mount
  useEffect(() => {
    if (!featureName) {
      setState({ step: 'error', error: 'Feature name is required. Usage: red64 resume <feature>' });
      return;
    }

    const loadState = async () => {
      try {
        // Requirements 1.1, 1.2 - Load persisted state
        const flowState = await stateStore.load(featureName);

        if (!flowState) {
          // Requirements 1.6 - Handle missing state
          setState({ step: 'not-found', feature: featureName });
          return;
        }

        // Requirements 1.3 - Check for uncommitted changes
        const worktreePath = flowState.metadata.worktreePath ?? getBaseDir();
        const gitStatus = await gitChecker.check(worktreePath);

        if (gitStatus.hasChanges) {
          setState({ step: 'uncommitted-changes', flowState, gitStatus });
          return;
        }

        // No uncommitted changes - ready to resume
        setState({ step: 'resuming', flowState });
      } catch (error) {
        setState({
          step: 'error',
          error: error instanceof Error ? error.message : 'Failed to load flow state'
        });
      }
    };

    loadState();
  }, [featureName, stateStore, gitChecker]);

  // Handle uncommitted changes action selection
  const handleUncommittedAction = (item: SelectMenuItem<UncommittedAction>) => {
    if (state.step !== 'uncommitted-changes') return;

    switch (item.value) {
      case 'commit':
        // TODO: Execute git add -A && git commit -m "WIP: <feature>"
        setState({ step: 'resuming', flowState: state.flowState });
        break;
      case 'discard':
        // TODO: Execute git checkout -- .
        setState({ step: 'resuming', flowState: state.flowState });
        break;
      case 'abort':
        exit();
        break;
    }
  };

  // Get workflow mode from flow state
  const getMode = (flowState: FlowState): WorkflowMode => {
    return flowState.metadata.mode ?? 'greenfield';
  };

  // Render based on state
  switch (state.step) {
    case 'loading':
      return (
        <Box flexDirection="column" padding={1}>
          <Box>
            <Text bold color="cyan">resume</Text>
          </Box>
          <Box marginTop={1}>
            <Spinner label={`Loading flow state for ${featureName ?? 'feature'}...`} />
          </Box>
        </Box>
      );

    case 'not-found':
      return (
        <Box flexDirection="column" padding={1}>
          <Box>
            <Text bold color="cyan">resume</Text>
          </Box>
          <Box marginTop={1}>
            <ErrorDisplay
              error={new Error(`No flow found for feature: ${state.feature}`)}
              suggestion={'Start a new flow with: red64 start <feature> "description"'}
            />
          </Box>
        </Box>
      );

    case 'uncommitted-changes':
      return (
        <Box flexDirection="column" padding={1}>
          <Box>
            <Text bold color="cyan">resume</Text>
            <Text> - {featureName}</Text>
          </Box>

          <Box marginTop={1}>
            <Text color="yellow">Uncommitted changes detected:</Text>
          </Box>
          <Box>
            <Text dimColor>
              {state.gitStatus.staged} staged, {state.gitStatus.unstaged} unstaged, {state.gitStatus.untracked} untracked
            </Text>
          </Box>

          <Box marginTop={1} flexDirection="column">
            <Text>What would you like to do?</Text>
            <Box marginTop={1}>
              <SelectMenu items={uncommittedOptions} onSelect={handleUncommittedAction} />
            </Box>
          </Box>
        </Box>
      );

    case 'resuming':
    case 'resumed':
      const mode = getMode(state.flowState);
      const phases = getPhaseSequence(mode);

      return (
        <Box flexDirection="column" padding={1}>
          <Box>
            <Text bold color="cyan">resume</Text>
            <Text> - {featureName}</Text>
          </Box>

          {/* Requirements 1.4 - Display completed phases with checkmarks */}
          <Box marginTop={1} flexDirection="column">
            <Text bold>Phase Progress:</Text>
            <Box marginTop={1}>
              <PhaseProgressView
                phases={phases}
                currentPhase={state.flowState.phase.type as ExtendedFlowPhase['type']}
                mode={mode}
              />
            </Box>
          </Box>

          {/* Current phase info */}
          <Box marginTop={1}>
            <Text color="green">
              Resuming at: {state.flowState.phase.type}
            </Text>
          </Box>

          {/* Implementation progress if in implementing phase */}
          {state.flowState.phase.type === 'implementing' && 'currentTask' in state.flowState.phase && (
            <Box marginTop={1}>
              <Text dimColor>
                Task {(state.flowState.phase as { currentTask: number }).currentTask} of {(state.flowState.phase as { totalTasks: number }).totalTasks}
              </Text>
            </Box>
          )}
        </Box>
      );

    case 'error':
      return (
        <Box flexDirection="column" padding={1}>
          <Box>
            <Text bold color="cyan">resume</Text>
          </Box>
          <Box marginTop={1}>
            <ErrorDisplay
              error={new Error(state.error)}
              suggestion="Check the feature name and try again."
            />
          </Box>
        </Box>
      );
  }
};
