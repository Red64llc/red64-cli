/**
 * Start screen component - orchestrates the spec-driven development flow
 * Requirements: 4.2
 *
 * Flow:
 * 1. Create git worktree for isolation
 * 2. Initialize spec directory → commit
 * 3. Generate requirements → commit
 * 4. Approval gate
 * 5. Generate design → commit
 * 6. Approval gate
 * 7. Generate tasks → commit
 * 8. Approval gate
 * 9. For each task: run spec-impl {task} → commit
 * 10. Complete
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useApp } from 'ink';
import { Spinner, Select } from '@inkjs/ui';
import type { ScreenProps } from './ScreenProps.js';
import type { FlowState, ExtendedFlowPhase, WorkflowMode } from '../../types/index.js';
import {
  createStateStore,
  createAgentInvoker,
  createExtendedFlowMachine,
  createWorktreeService,
  createCommitService,
  createTaskParser,
  type Task
} from '../../services/index.js';
import { join } from 'node:path';

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
  worktreePath: string | null;
  currentTask: number;
  totalTasks: number;
  tasks: readonly Task[];
}

/**
 * Start screen - orchestrates the spec-driven development flow with:
 * - Git worktree isolation
 * - Commits after each phase
 * - Task-by-task implementation with commits
 */
export const StartScreen: React.FC<ScreenProps> = ({ args, flags }) => {
  const { exit } = useApp();
  const featureName = args[0] ?? 'unnamed';
  const description = args[1] ?? 'No description provided';
  const mode: WorkflowMode = flags.brownfield ? 'brownfield' : 'greenfield';
  const repoPath = process.cwd();

  // Initialize services
  const servicesRef = useRef<{
    stateStore: ReturnType<typeof createStateStore>;
    agentInvoker: ReturnType<typeof createAgentInvoker>;
    flowMachine: ReturnType<typeof createExtendedFlowMachine>;
    worktreeService: ReturnType<typeof createWorktreeService>;
    commitService: ReturnType<typeof createCommitService>;
    taskParser: ReturnType<typeof createTaskParser>;
  } | null>(null);

  if (!servicesRef.current) {
    const stateStore = createStateStore(repoPath);
    const agentInvoker = createAgentInvoker();
    const flowMachine = createExtendedFlowMachine();
    const worktreeService = createWorktreeService();
    const commitService = createCommitService();
    const taskParser = createTaskParser();

    servicesRef.current = {
      stateStore,
      agentInvoker,
      flowMachine,
      worktreeService,
      commitService,
      taskParser
    };
  }

  const services = servicesRef.current;

  // Flow state
  const [flowState, setFlowState] = useState<FlowScreenState>({
    phase: { type: 'idle' },
    output: [],
    error: null,
    isExecuting: false,
    worktreePath: null,
    currentTask: 0,
    totalTasks: 0,
    tasks: []
  });

  // Track if flow has been started
  const flowStartedRef = useRef(false);

  // Add output line
  const addOutput = useCallback((line: string) => {
    setFlowState(prev => ({
      ...prev,
      output: [...prev.output.slice(-50), line]
    }));
  }, []);

  // Get working directory (worktree or repo)
  const getWorkingDir = useCallback(() => {
    return flowState.worktreePath ?? repoPath;
  }, [flowState.worktreePath, repoPath]);

  // Execute a Claude command
  const executeCommand = useCallback(async (prompt: string, workDir?: string): Promise<{ success: boolean; output: string; error?: string }> => {
    setFlowState(prev => ({ ...prev, isExecuting: true, error: null }));

    const result = await services.agentInvoker.invoke({
      prompt,
      workingDirectory: workDir ?? getWorkingDir(),
      skipPermissions: flags.skipPermissions ?? false,
      tier: flags.tier,
      onOutput: (chunk) => {
        // Stream output in real-time
        const lines = chunk.split('\n').filter(l => l.trim());
        lines.forEach(line => addOutput(line));
      }
    });

    setFlowState(prev => ({ ...prev, isExecuting: false }));

    if (!result.success) {
      const errorMsg = result.stderr || 'Command failed';
      setFlowState(prev => ({ ...prev, error: errorMsg }));
      return { success: false, output: result.stdout, error: errorMsg };
    }

    return { success: true, output: result.stdout };
  }, [services.agentInvoker, flags, getWorkingDir, addOutput]);

  // Commit changes with formatted message
  const commitChanges = useCallback(async (message: string, workDir?: string): Promise<boolean> => {
    const dir = workDir ?? getWorkingDir();
    addOutput(`Committing: ${message.split('\n')[0]}...`);

    const result = await services.commitService.stageAndCommit(dir, message);

    if (!result.success) {
      addOutput(`Commit warning: ${result.error ?? 'No changes to commit'}`);
      return true; // Continue even if nothing to commit
    }

    if (result.commitHash) {
      addOutput(`Committed: ${result.commitHash.substring(0, 7)}`);
    }

    return true;
  }, [services.commitService, getWorkingDir, addOutput]);

  // Save flow state
  const saveFlowState = useCallback(async (phase: ExtendedFlowPhase, workDir?: string) => {
    const state: FlowState = {
      feature: featureName,
      phase: convertToFlowPhase(phase),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [],
      metadata: {
        description,
        mode,
        tier: flags.tier,
        worktreePath: flowState.worktreePath ?? undefined
      }
    };

    // Save to worktree if available
    const stateStore = createStateStore(workDir ?? getWorkingDir());
    await stateStore.save(state);
  }, [featureName, description, mode, flags.tier, flowState.worktreePath, getWorkingDir]);

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

      // Step 1: Create git worktree for isolation
      addOutput('Creating git worktree for feature isolation...');
      const worktreeResult = await services.worktreeService.create(repoPath, featureName);

      if (!worktreeResult.success) {
        addOutput(`Worktree error: ${worktreeResult.error}`);
        addOutput('Continuing without worktree isolation...');
        // Continue without worktree
      } else {
        const wtPath = worktreeResult.path!;
        setFlowState(prev => ({ ...prev, worktreePath: wtPath }));
        addOutput(`Worktree created: ${wtPath}`);
        addOutput(`Branch: feature/${featureName}`);
      }

      // Use worktree path if available
      const workDir = worktreeResult.path ?? repoPath;

      // Step 2: Transition to initializing
      const initPhase = transitionPhase({
        type: 'START',
        feature: featureName,
        description,
        mode
      });

      await saveFlowState(initPhase, workDir);

      // Execute spec-init
      addOutput('');
      addOutput('Initializing spec directory...');
      const initResult = await executeCommand(
        `/red64:spec-init "${featureName}" "${description}"`,
        workDir
      );

      if (!initResult.success) {
        transitionPhase({ type: 'ERROR', error: initResult.error ?? 'Initialization failed' });
        return;
      }

      // Commit init
      await commitChanges(
        `chore(${featureName}): initialize spec directory\n\nCreated .red64/specs/${featureName}/`,
        workDir
      );

      // Step 3: Generate requirements
      const reqPhase = transitionPhase({ type: 'PHASE_COMPLETE' });
      await saveFlowState(reqPhase, workDir);
      await runRequirementsPhase(workDir);
    };

    startFlow();
  }, []);

  // Run requirements phase
  const runRequirementsPhase = async (workDir: string) => {
    addOutput('');
    addOutput('Generating requirements...');

    const result = await executeCommand(`/red64:spec-requirements ${featureName}`, workDir);

    if (!result.success) {
      transitionPhase({ type: 'ERROR', error: result.error ?? 'Requirements generation failed' });
      return;
    }

    // Commit requirements
    await commitChanges(
      `docs(${featureName}): generate requirements\n\nEARS-format requirements in .red64/specs/${featureName}/requirements.md`,
      workDir
    );

    // Transition to approval
    const approvalPhase = transitionPhase({ type: 'PHASE_COMPLETE' });
    await saveFlowState(approvalPhase, workDir);
  };

  // Run design phase
  const runDesignPhase = async (workDir: string) => {
    addOutput('');
    addOutput('Generating technical design...');

    const result = await executeCommand(`/red64:spec-design ${featureName}`, workDir);

    if (!result.success) {
      transitionPhase({ type: 'ERROR', error: result.error ?? 'Design generation failed' });
      return;
    }

    // Commit design
    await commitChanges(
      `docs(${featureName}): generate technical design\n\nDesign document in .red64/specs/${featureName}/design.md`,
      workDir
    );

    // Transition to approval
    const approvalPhase = transitionPhase({ type: 'PHASE_COMPLETE' });
    await saveFlowState(approvalPhase, workDir);
  };

  // Run tasks phase
  const runTasksPhase = async (workDir: string) => {
    addOutput('');
    addOutput('Generating implementation tasks...');

    const result = await executeCommand(`/red64:spec-tasks ${featureName}`, workDir);

    if (!result.success) {
      transitionPhase({ type: 'ERROR', error: result.error ?? 'Tasks generation failed' });
      return;
    }

    // Commit tasks
    await commitChanges(
      `docs(${featureName}): generate implementation tasks\n\nTask list in .red64/specs/${featureName}/tasks.md`,
      workDir
    );

    // Parse tasks for implementation phase
    const specDir = join(workDir, '.red64', 'specs', featureName);
    const tasks = await services.taskParser.parse(specDir);
    const pendingTasks = services.taskParser.getPendingTasks(tasks);

    setFlowState(prev => ({
      ...prev,
      tasks: pendingTasks,
      totalTasks: pendingTasks.length
    }));

    addOutput(`Found ${pendingTasks.length} tasks to implement`);

    // Transition to approval
    const approvalPhase = transitionPhase({ type: 'PHASE_COMPLETE' });
    await saveFlowState(approvalPhase, workDir);
  };

  // Run implementation - one task at a time with commits
  const runImplementation = async (workDir: string) => {
    const { tasks } = flowState;

    if (tasks.length === 0) {
      addOutput('No tasks to implement');
      transitionPhase({ type: 'PHASE_COMPLETE' });
      await completeFlow(workDir);
      return;
    }

    addOutput('');
    addOutput('Starting implementation...');
    addOutput(`Total tasks: ${tasks.length}`);
    addOutput('');

    // Execute each task one at a time
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const taskNum = i + 1;

      setFlowState(prev => ({ ...prev, currentTask: taskNum }));

      addOutput(`[${taskNum}/${tasks.length}] Task ${task.id}: ${task.title}`);

      // Run spec-impl for this specific task
      const result = await executeCommand(
        `/red64:spec-impl ${featureName} ${task.id}`,
        workDir
      );

      if (!result.success) {
        addOutput(`Task ${task.id} failed: ${result.error}`);
        // Continue to next task instead of failing entirely
        continue;
      }

      // Commit after each task
      await commitChanges(
        services.commitService.formatTaskCommitMessage(featureName, taskNum, task.title),
        workDir
      );

      addOutput(`Task ${task.id} completed`);
      addOutput('');
    }

    // All tasks complete
    addOutput('All tasks completed!');
    await completeFlow(workDir);
  };

  // Complete the flow
  const completeFlow = async (workDir: string) => {
    const completePhase: ExtendedFlowPhase = { type: 'complete', feature: featureName };
    transitionPhase({ type: 'PHASE_COMPLETE' });
    await saveFlowState(completePhase, workDir);

    addOutput('');
    addOutput('Flow completed successfully!');
    addOutput(`Worktree: ${flowState.worktreePath ?? 'none'}`);
    addOutput(`Branch: feature/${featureName}`);
  };

  // Handle approval decision
  const handleApproval = useCallback(async (decision: string) => {
    const workDir = getWorkingDir();

    if (decision === 'approve') {
      const nextPhase = transitionPhase({ type: 'APPROVE' });
      await saveFlowState(nextPhase, workDir);

      // Route to appropriate next phase
      switch (nextPhase.type) {
        case 'design-generating':
          await runDesignPhase(workDir);
          break;
        case 'tasks-generating':
          await runTasksPhase(workDir);
          break;
        case 'implementing':
          await runImplementation(workDir);
          break;
        case 'gap-analysis':
          // Brownfield: run gap analysis
          addOutput('Running gap analysis...');
          const gapResult = await executeCommand(`/red64:validate-gap ${featureName}`, workDir);
          if (gapResult.success) {
            await commitChanges(`docs(${featureName}): gap analysis`, workDir);
          }
          transitionPhase({ type: 'PHASE_COMPLETE' });
          break;
        case 'design-validation':
          // Brownfield: run design validation
          addOutput('Validating design...');
          const valResult = await executeCommand(`/red64:validate-design ${featureName}`, workDir);
          if (valResult.success) {
            await commitChanges(`docs(${featureName}): design validation`, workDir);
          }
          transitionPhase({ type: 'PHASE_COMPLETE' });
          break;
        case 'complete':
          await completeFlow(workDir);
          break;
        default:
          addOutput(`Unexpected phase: ${nextPhase.type}`);
      }
    } else if (decision === 'reject') {
      const prevPhase = transitionPhase({ type: 'REJECT' });
      await saveFlowState(prevPhase, workDir);
      addOutput('Regenerating...');

      // Re-run the appropriate generation phase
      switch (prevPhase.type) {
        case 'requirements-generating':
          await runRequirementsPhase(workDir);
          break;
        case 'design-generating':
          await runDesignPhase(workDir);
          break;
        case 'tasks-generating':
          await runTasksPhase(workDir);
          break;
      }
    } else if (decision === 'pause') {
      addOutput('Flow paused. Use "red64 resume" to continue.');
      addOutput(`Worktree: ${flowState.worktreePath ?? repoPath}`);
      exit();
    }
  }, [flowState, transitionPhase, saveFlowState, getWorkingDir, exit]);

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
        {flowState.currentTask > 0 && flowState.totalTasks > 0 && (
          <Text dimColor> [{flowState.currentTask}/{flowState.totalTasks}]</Text>
        )}
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
          <Text dimColor>Spec: .red64/specs/{featureName}/</Text>
          <Text dimColor>Branch: feature/{featureName}</Text>
          {flowState.worktreePath && (
            <Text dimColor>Worktree: {flowState.worktreePath}</Text>
          )}
          <Box marginTop={1}>
            <Text>Next: Review changes and create a PR</Text>
          </Box>
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

      {/* Worktree info */}
      {flowState.worktreePath && (
        <Box marginBottom={1}>
          <Text dimColor>Worktree: {flowState.worktreePath}</Text>
        </Box>
      )}

      {/* Phase indicator */}
      {renderPhaseIndicator()}

      {/* Output log */}
      <Box flexDirection="column" marginBottom={1}>
        {flowState.output.slice(-10).map((line, i) => (
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
      {flowState.error && !flowState.isExecuting && (
        <Box marginBottom={1}>
          <Text color="red">{flowState.error}</Text>
        </Box>
      )}

      {/* Approval UI */}
      {isApprovalPhase && !flowState.isExecuting && (
        <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
          <Text bold>Review Required</Text>
          <Text dimColor>Review output in .red64/specs/{featureName}/</Text>
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
 * Convert ExtendedFlowPhase to FlowPhase for state persistence
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
      if ('feature' in phase) {
        return { type: 'idle' };
      }
      return { type: 'idle' };
  }
}
