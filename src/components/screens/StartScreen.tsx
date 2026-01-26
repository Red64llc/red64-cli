/**
 * Start screen component - orchestrates the spec-driven development flow
 * Requirements: 4.2
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useApp } from 'ink';
import { Spinner, Select } from '@inkjs/ui';
import type { ScreenProps } from './ScreenProps.js';
import type { FlowState, GlobalFlags, ExtendedFlowPhase, WorkflowMode } from '../../types/index.js';
import {
  createStateStore,
  createAgentInvoker,
  createPhaseExecutor,
  createExtendedFlowMachine,
  type PhaseExecutionResult
} from '../../services/index.js';

/**
 * Phase display information
 */
const PHASE_LABELS: Record<string, { label: string; description: string }> = {
  'idle': { label: 'Idle', description: 'Ready to start' },
  'initializing': { label: 'Initializing', description: 'Setting up spec directory' },
  'requirements-generating': { label: 'Requirements', description: 'Generating requirements' },
  'requirements-approval': { label: 'Requirements Review', description: 'Review and approve requirements' },
  'gap-analysis': { label: 'Gap Analysis', description: 'Analyzing existing codebase' },
  'gap-review': { label: 'Gap Review', description: 'Review gap analysis' },
  'design-generating': { label: 'Design', description: 'Generating technical design' },
  'design-approval': { label: 'Design Review', description: 'Review and approve design' },
  'design-validation': { label: 'Design Validation', description: 'Validating design' },
  'design-validation-review': { label: 'Validation Review', description: 'Review design validation' },
  'tasks-generating': { label: 'Tasks', description: 'Generating implementation tasks' },
  'tasks-approval': { label: 'Tasks Review', description: 'Review and approve tasks' },
  'implementing': { label: 'Implementing', description: 'Executing implementation tasks' },
  'paused': { label: 'Paused', description: 'Flow paused' },
  'validation': { label: 'Validation', description: 'Validating implementation' },
  'pr': { label: 'Pull Request', description: 'Creating pull request' },
  'merge-decision': { label: 'Merge Decision', description: 'Decide whether to merge' },
  'complete': { label: 'Complete', description: 'Flow completed successfully' },
  'aborted': { label: 'Aborted', description: 'Flow was aborted' },
  'error': { label: 'Error', description: 'An error occurred' }
};

/**
 * Approval options for review phases
 */
const APPROVAL_OPTIONS = [
  { value: 'approve', label: 'Approve and continue' },
  { value: 'reject', label: 'Reject and regenerate' },
  { value: 'pause', label: 'Pause flow' }
];

interface FlowScreenState {
  phase: ExtendedFlowPhase;
  output: string[];
  error: string | null;
  isExecuting: boolean;
}

/**
 * Start screen - orchestrates the spec-driven development flow
 * Requirements: 4.2 - Start new feature flow
 */
export const StartScreen: React.FC<ScreenProps> = ({ args, flags }) => {
  const { exit } = useApp();
  const featureName = args[0] ?? 'unnamed';
  const description = args[1] ?? 'No description provided';
  const mode: WorkflowMode = flags.brownfield ? 'brownfield' : 'greenfield';

  // Initialize services
  const servicesRef = useRef<{
    stateStore: ReturnType<typeof createStateStore>;
    agentInvoker: ReturnType<typeof createAgentInvoker>;
    phaseExecutor: ReturnType<typeof createPhaseExecutor>;
    flowMachine: ReturnType<typeof createExtendedFlowMachine>;
  } | null>(null);

  if (!servicesRef.current) {
    const stateStore = createStateStore(process.cwd());
    const agentInvoker = createAgentInvoker();
    const phaseExecutor = createPhaseExecutor(agentInvoker, stateStore);
    const flowMachine = createExtendedFlowMachine();

    servicesRef.current = { stateStore, agentInvoker, phaseExecutor, flowMachine };
  }

  const services = servicesRef.current;

  // Flow state
  const [flowState, setFlowState] = useState<FlowScreenState>({
    phase: { type: 'idle' },
    output: [],
    error: null,
    isExecuting: false
  });

  // Track if flow has been started
  const flowStartedRef = useRef(false);

  // Add output line
  const addOutput = useCallback((line: string) => {
    setFlowState(prev => ({
      ...prev,
      output: [...prev.output.slice(-50), line] // Keep last 50 lines
    }));
  }, []);

  // Execute a generation phase
  const executePhase = useCallback(async (phase: ExtendedFlowPhase): Promise<PhaseExecutionResult> => {
    setFlowState(prev => ({ ...prev, isExecuting: true, error: null }));

    // Convert ExtendedFlowPhase to FlowPhase for executor
    const flowPhase = convertToFlowPhase(phase);

    const result = await services.phaseExecutor.execute(
      flowPhase,
      flags as GlobalFlags,
      process.cwd()
    );

    setFlowState(prev => ({ ...prev, isExecuting: false }));

    if (!result.success && result.error) {
      setFlowState(prev => ({ ...prev, error: result.error ?? null }));
    }

    return result;
  }, [services.phaseExecutor, flags]);

  // Save flow state
  const saveFlowState = useCallback(async (phase: ExtendedFlowPhase) => {
    const state: FlowState = {
      feature: featureName,
      phase: convertToFlowPhase(phase),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [],
      metadata: {
        description,
        mode,
        tier: flags.tier
      }
    };

    await services.stateStore.save(state);
  }, [featureName, description, mode, flags.tier, services.stateStore]);

  // Transition to next phase
  const transitionPhase = useCallback((event: Parameters<typeof services.flowMachine.send>[0]) => {
    const nextPhase = services.flowMachine.send(event);
    setFlowState(prev => ({ ...prev, phase: nextPhase }));
    return nextPhase;
  }, [services.flowMachine]);

  // Start flow
  useEffect(() => {
    if (flowStartedRef.current) return;
    flowStartedRef.current = true;

    const startFlow = async () => {
      addOutput(`Starting flow: ${featureName}`);
      addOutput(`Mode: ${mode}`);
      addOutput('');

      // Transition to initializing
      const initPhase = transitionPhase({
        type: 'START',
        feature: featureName,
        description,
        mode
      });

      await saveFlowState(initPhase);

      // Execute initializing phase
      addOutput('Initializing spec directory...');
      const initResult = await executePhase(initPhase);

      if (!initResult.success) {
        transitionPhase({ type: 'ERROR', error: initResult.error ?? 'Initialization failed' });
        return;
      }

      // Transition to requirements generation
      const reqPhase = transitionPhase({ type: 'PHASE_COMPLETE' });
      await saveFlowState(reqPhase);
      await runGenerationPhase(reqPhase);
    };

    startFlow();
  }, []);

  // Run a generation phase and transition to approval
  const runGenerationPhase = async (phase: ExtendedFlowPhase) => {
    const phaseInfo = PHASE_LABELS[phase.type] ?? { label: phase.type, description: '' };
    addOutput(`${phaseInfo.description}...`);

    const result = await executePhase(phase);

    if (!result.success) {
      transitionPhase({ type: 'ERROR', error: result.error ?? 'Phase failed' });
      return;
    }

    // Transition to approval phase
    const approvalPhase = transitionPhase({ type: 'PHASE_COMPLETE' });
    await saveFlowState(approvalPhase);
  };

  // Handle approval decision
  const handleApproval = useCallback(async (decision: string) => {
    const currentPhase = flowState.phase;

    if (decision === 'approve') {
      const nextPhase = transitionPhase({ type: 'APPROVE' });
      await saveFlowState(nextPhase);

      // Check if next phase is a terminal phase
      if (nextPhase.type === 'complete') {
        addOutput('');
        addOutput('Flow completed successfully!');
        return;
      }

      // Check if it's an implementing phase
      if (nextPhase.type === 'implementing') {
        addOutput('Starting implementation...');
        await runImplementation(nextPhase);
        return;
      }

      // Run the next generation phase
      await runGenerationPhase(nextPhase);
    } else if (decision === 'reject') {
      const prevPhase = transitionPhase({ type: 'REJECT' });
      await saveFlowState(prevPhase);
      addOutput('Regenerating...');
      await runGenerationPhase(prevPhase);
    } else if (decision === 'pause') {
      if (currentPhase.type === 'implementing' && 'currentTask' in currentPhase) {
        transitionPhase({ type: 'PAUSE' });
      }
      addOutput('Flow paused. Use "red64 resume" to continue.');
      exit();
    }
  }, [flowState.phase, transitionPhase, saveFlowState, addOutput, exit]);

  // Run implementation phase
  const runImplementation = async (phase: ExtendedFlowPhase) => {
    addOutput('Executing implementation tasks...');

    const result = await executePhase(phase);

    if (!result.success) {
      transitionPhase({ type: 'ERROR', error: result.error ?? 'Implementation failed' });
      return;
    }

    // Transition to validation
    const validationPhase = transitionPhase({ type: 'PHASE_COMPLETE' });
    await saveFlowState(validationPhase);

    addOutput('Running validation...');
    const validationResult = await executePhase(validationPhase);

    if (!validationResult.success) {
      addOutput('Validation completed with warnings.');
    }

    // Transition to PR creation
    const prPhase = transitionPhase({ type: 'PHASE_COMPLETE' });
    await saveFlowState(prPhase);

    addOutput('Creating pull request...');
    const prResult = await executePhase(prPhase);

    if (prResult.success) {
      const prUrl = extractPRUrl(prResult.output ?? '');
      if (prUrl) {
        transitionPhase({ type: 'PR_CREATED', prUrl });
        addOutput(`Pull request created: ${prUrl}`);
      } else {
        transitionPhase({ type: 'PHASE_COMPLETE' });
      }
    }

    // Complete the flow
    transitionPhase({ type: 'SKIP_MERGE' });
    await saveFlowState({ type: 'complete', feature: featureName });
    addOutput('');
    addOutput('Flow completed successfully!');
  };

  // Check if current phase is an approval phase
  const isApprovalPhase = [
    'requirements-approval',
    'design-approval',
    'tasks-approval',
    'gap-review',
    'design-validation-review',
    'merge-decision'
  ].includes(flowState.phase.type);

  // Render phase indicator
  const renderPhaseIndicator = () => {
    const phaseInfo = PHASE_LABELS[flowState.phase.type] ?? { label: flowState.phase.type, description: '' };

    return (
      <Box marginBottom={1}>
        <Text bold color="cyan">{phaseInfo.label}</Text>
        <Text dimColor> - {phaseInfo.description}</Text>
      </Box>
    );
  };

  // Render terminal phases
  if (flowState.phase.type === 'complete') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="green">Flow Complete</Text>
        </Box>
        <Text>Feature "{featureName}" has been implemented.</Text>
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Spec directory: .red64/specs/{featureName}/</Text>
          <Text dimColor>Run "red64 status" to view flow status.</Text>
        </Box>
      </Box>
    );
  }

  if (flowState.phase.type === 'error') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="red">Flow Error</Text>
        </Box>
        <Text color="red">{flowState.error ?? 'An unknown error occurred'}</Text>
        <Box marginTop={1}>
          <Text dimColor>Run "red64 resume {featureName}" to retry.</Text>
        </Box>
      </Box>
    );
  }

  if (flowState.phase.type === 'aborted') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="yellow">Flow Aborted</Text>
        </Box>
        <Text>Feature flow "{featureName}" was aborted.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">red64 start</Text>
        <Text dimColor> - {featureName}</Text>
      </Box>

      {/* Phase indicator */}
      {renderPhaseIndicator()}

      {/* Output log */}
      <Box flexDirection="column" marginBottom={1}>
        {flowState.output.slice(-8).map((line, i) => (
          <Text key={i} dimColor={i < flowState.output.length - 1}>{line}</Text>
        ))}
      </Box>

      {/* Executing spinner */}
      {flowState.isExecuting && (
        <Box marginBottom={1}>
          <Spinner label="Processing..." />
        </Box>
      )}

      {/* Error display */}
      {flowState.error && (
        <Box marginBottom={1}>
          <Text color="red">{flowState.error}</Text>
        </Box>
      )}

      {/* Approval UI */}
      {isApprovalPhase && !flowState.isExecuting && (
        <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
          <Text bold>Review Required</Text>
          <Text dimColor>Please review the generated output in .red64/specs/{featureName}/</Text>
          <Box marginTop={1}>
            <Select
              options={APPROVAL_OPTIONS}
              onChange={handleApproval}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
};

/**
 * Convert ExtendedFlowPhase to FlowPhase for executor compatibility
 */
function convertToFlowPhase(phase: ExtendedFlowPhase): import('../../types/index.js').FlowPhase {
  switch (phase.type) {
    case 'idle':
      return { type: 'idle' };
    case 'initializing':
      return { type: 'initializing', feature: phase.feature, description: phase.description };
    case 'requirements-generating':
      return { type: 'requirements-generating', feature: phase.feature };
    case 'requirements-approval':
      return { type: 'requirements-review', feature: phase.feature };
    case 'design-generating':
      return { type: 'design-generating', feature: phase.feature };
    case 'design-approval':
      return { type: 'design-review', feature: phase.feature };
    case 'tasks-generating':
      return { type: 'tasks-generating', feature: phase.feature };
    case 'tasks-approval':
      return { type: 'tasks-review', feature: phase.feature };
    case 'implementing':
      return {
        type: 'implementing',
        feature: phase.feature,
        currentTask: phase.currentTask,
        totalTasks: phase.totalTasks
      };
    case 'complete':
      return { type: 'complete', feature: phase.feature };
    case 'aborted':
      return { type: 'aborted', feature: phase.feature, reason: phase.reason };
    case 'error':
      return { type: 'error', feature: phase.feature, error: phase.error };
    default:
      // For brownfield-specific phases, map to closest equivalent
      if ('feature' in phase) {
        return { type: 'idle' };
      }
      return { type: 'idle' };
  }
}

/**
 * Extract PR URL from command output
 */
function extractPRUrl(output: string): string | null {
  const match = output.match(/https:\/\/github\.com\/[^\s]+\/pull\/\d+/);
  return match ? match[0] : null;
}
