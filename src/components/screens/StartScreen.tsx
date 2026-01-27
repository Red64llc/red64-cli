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
import type { FlowState, ExtendedFlowPhase, WorkflowMode, PhaseMetric, CodingAgent } from '../../types/index.js';
import {
  createStateStore,
  createAgentInvoker,
  createExtendedFlowMachine,
  createWorktreeService,
  createCommitService,
  createTaskParser,
  createSpecInitService,
  createClaudeHealthCheck,
  createGitStatusChecker,
  createConfigService,
  sanitizeFeatureName,
  type Task,
  type ClaudeError,
  type GitStatus
} from '../../services/index.js';
import { FeatureSidebar } from '../ui/index.js';
import { join } from 'node:path';
import { appendFile, mkdir } from 'node:fs/promises';

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

/**
 * Options when existing flow is detected
 */
const EXISTING_FLOW_OPTIONS = [
  { value: 'resume', label: 'Resume from where you left off' },
  { value: 'restart', label: 'Start fresh (discard previous progress)' },
  { value: 'abort', label: 'Cancel' }
];

/**
 * Options when uncommitted changes are detected
 */
const UNCOMMITTED_CHANGES_OPTIONS = [
  { value: 'commit', label: 'Commit changes (WIP) and continue' },
  { value: 'discard', label: 'Discard changes and continue' },
  { value: 'abort', label: 'Cancel' }
];

/**
 * Human-readable labels for Claude error codes
 */
function getClaudeErrorLabel(code: string): string {
  const labels: Record<string, string> = {
    CREDIT_EXHAUSTED: 'Insufficient Credits',
    RATE_LIMITED: 'Rate Limited',
    AUTH_FAILED: 'Authentication Failed',
    MODEL_UNAVAILABLE: 'Service Unavailable',
    CONTEXT_EXCEEDED: 'Context Too Large',
    NETWORK_ERROR: 'Network Error',
    PERMISSION_DENIED: 'Request Blocked',
    UNKNOWN: 'Unknown Error'
  };
  return labels[code] ?? code;
}

/**
 * Pre-start check step for existing flow detection
 */
type PreStartStep =
  | { type: 'checking' }  // Checking for existing flow
  | { type: 'existing-flow-detected'; existingState: FlowState; gitStatus: GitStatus }
  | { type: 'uncommitted-changes'; existingState: FlowState; gitStatus: GitStatus }
  | { type: 'ready' }  // Ready to start/resume
  | { type: 'resuming'; fromPhase: string };  // Resuming from existing state

interface FlowScreenState {
  phase: ExtendedFlowPhase;
  output: string[];
  error: string | null;
  claudeError: ClaudeError | null;  // Specific Claude API error details
  isExecuting: boolean;
  isHealthChecking: boolean;  // Health check in progress
  preStartStep: PreStartStep;  // Pre-start check state
  worktreePath: string | null;
  currentTask: number;
  totalTasks: number;
  tasks: readonly Task[];
  resolvedFeatureName: string | null; // The actual feature name after spec-init
  existingFlowState: FlowState | null;  // Existing flow state if detected
  completedTasks: string[];  // Orchestrator-tracked completed task IDs
  phaseMetrics: Record<string, PhaseMetric>;  // Phase timing metrics
  commitCount: number;  // Number of commits for this feature
  agent: CodingAgent;  // Coding agent from config
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
  const verbose = flags.verbose ?? false;
  const repoPath = process.cwd();

  // Initialize services
  const servicesRef = useRef<{
    stateStore: ReturnType<typeof createStateStore>;
    agentInvoker: ReturnType<typeof createAgentInvoker>;
    flowMachine: ReturnType<typeof createExtendedFlowMachine>;
    worktreeService: ReturnType<typeof createWorktreeService>;
    commitService: ReturnType<typeof createCommitService>;
    taskParser: ReturnType<typeof createTaskParser>;
    specInitService: ReturnType<typeof createSpecInitService>;
    healthCheck: ReturnType<typeof createClaudeHealthCheck>;
    gitStatusChecker: ReturnType<typeof createGitStatusChecker>;
    configService: ReturnType<typeof createConfigService>;
  } | null>(null);

  if (!servicesRef.current) {
    const stateStore = createStateStore(repoPath);
    const agentInvoker = createAgentInvoker();
    const flowMachine = createExtendedFlowMachine();
    const worktreeService = createWorktreeService();
    const commitService = createCommitService();
    const taskParser = createTaskParser();
    const specInitService = createSpecInitService();
    const healthCheck = createClaudeHealthCheck();
    const gitStatusChecker = createGitStatusChecker();
    const configService = createConfigService();

    servicesRef.current = {
      stateStore,
      agentInvoker,
      flowMachine,
      worktreeService,
      commitService,
      taskParser,
      specInitService,
      healthCheck,
      gitStatusChecker,
      configService
    };
  }

  const services = servicesRef.current;

  // Log file path
  const logFileRef = useRef<string | null>(null);

  // Initialize log file
  const initLogFile = useCallback(async (workDir: string) => {
    const logDir = join(workDir, '.red64', 'flows', sanitizeFeatureName(featureName));
    await mkdir(logDir, { recursive: true });
    const logPath = join(logDir, 'flow.log');
    logFileRef.current = logPath;

    // Write header
    const header = `\n${'='.repeat(60)}\nFlow started: ${new Date().toISOString()}\nFeature: ${featureName}\nMode: ${mode}\n${'='.repeat(60)}\n\n`;
    await appendFile(logPath, header);

    return logPath;
  }, [featureName, mode]);

  // Log to file
  const logToFile = useCallback(async (message: string) => {
    if (logFileRef.current) {
      const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
      await appendFile(logFileRef.current, `[${timestamp}] ${message}\n`).catch(() => {});
    }
  }, []);

  // Flow state
  const [flowState, setFlowState] = useState<FlowScreenState>({
    phase: { type: 'idle' },
    output: [],
    error: null,
    claudeError: null,
    isExecuting: false,
    isHealthChecking: false,
    preStartStep: { type: 'checking' },  // Start by checking for existing flow
    worktreePath: null,
    currentTask: 0,
    totalTasks: 0,
    tasks: [],
    resolvedFeatureName: null,
    existingFlowState: null,
    completedTasks: [],  // Orchestrator-tracked completed task IDs
    phaseMetrics: {},  // Phase timing metrics
    commitCount: 0,  // Number of commits for this feature
    agent: 'claude'  // Default, will be loaded from config
  });

  // Track if flow has been started
  const flowStartedRef = useRef(false);

  // Add output line (to screen and log file)
  const addOutput = useCallback((line: string) => {
    setFlowState(prev => ({
      ...prev,
      output: [...prev.output.slice(-50), line]
    }));
    // Also log to file
    logToFile(line);
  }, [logToFile]);

  // Get working directory (worktree or repo)
  const getWorkingDir = useCallback(() => {
    return flowState.worktreePath ?? repoPath;
  }, [flowState.worktreePath, repoPath]);

  // Execute a Claude command
  const executeCommand = useCallback(async (prompt: string, workDir?: string): Promise<{ success: boolean; output: string; error?: string; claudeError?: ClaudeError }> => {
    const dir = workDir ?? getWorkingDir();

    // Build tier config dir path
    const tierConfigDir = flags.tier
      ? `${process.env.HOME ?? '~'}/.claude-${flags.tier}`
      : null;

    // Always log command to file
    await logToFile(`--- Executing command ---`);
    await logToFile(`Command: claude -p "${prompt}"`);
    await logToFile(`Working dir: ${dir}`);
    if (flags.skipPermissions) {
      await logToFile(`Flags: --dangerously-skip-permissions`);
    }
    if (tierConfigDir) {
      await logToFile(`CLAUDE_CONFIG_DIR: ${tierConfigDir}`);
    }
    if (flags.sandbox) {
      await logToFile(`Sandbox: Docker isolated mode`);
    }
    if (flags.model) {
      await logToFile(`Model: ${flags.model}`);
    }

    // Verbose mode: also show on screen
    if (verbose) {
      addOutput(`[verbose] Command: claude -p "${prompt}"`);
      addOutput(`[verbose] Working dir: ${dir}`);
      if (flags.skipPermissions) {
        addOutput(`[verbose] Flags: --dangerously-skip-permissions`);
      }
      if (tierConfigDir) {
        addOutput(`[verbose] CLAUDE_CONFIG_DIR: ${tierConfigDir}`);
      }
      if (flags.sandbox) {
        addOutput(`[verbose] Sandbox: Docker isolated mode`);
      }
      if (flags.model) {
        addOutput(`[verbose] Model: ${flags.model}`);
      }
    }

    setFlowState(prev => ({ ...prev, isExecuting: true, error: null, claudeError: null }));

    const result = await services.agentInvoker.invoke({
      prompt,
      workingDirectory: dir,
      skipPermissions: flags.skipPermissions ?? false,
      tier: flags.tier,
      model: flags.model,
      sandbox: flags.sandbox ?? false,
      onOutput: (chunk) => {
        // Stream output in real-time
        const lines = chunk.split('\n').filter(l => l.trim());
        lines.forEach(line => addOutput(line));
      },
      onError: (chunk) => {
        // Stream stderr in verbose mode
        if (verbose) {
          const lines = chunk.split('\n').filter(l => l.trim());
          lines.forEach(line => addOutput(`[stderr] ${line}`));
        }
      }
    });

    setFlowState(prev => ({ ...prev, isExecuting: false }));

    // Always log result to file
    await logToFile(`Exit code: ${result.exitCode}`);
    await logToFile(`Success: ${result.success}`);
    if (result.timedOut) {
      await logToFile(`Timed out: true`);
    }
    if (result.claudeError) {
      await logToFile(`Claude Error: ${result.claudeError.code} - ${result.claudeError.message}`);
      await logToFile(`Suggestion: ${result.claudeError.suggestion}`);
    }
    if (result.stdout) {
      await logToFile(`--- stdout ---`);
      await logToFile(result.stdout);
    }
    if (result.stderr) {
      await logToFile(`--- stderr ---`);
      await logToFile(result.stderr);
    }
    await logToFile(`--- end command ---\n`);

    // Verbose mode: show result on screen
    if (verbose) {
      addOutput(`[verbose] Exit code: ${result.exitCode}`);
      addOutput(`[verbose] Success: ${result.success}`);
      if (result.timedOut) {
        addOutput(`[verbose] Timed out: true`);
      }
      if (result.claudeError) {
        addOutput(`[verbose] Claude Error: ${result.claudeError.code}`);
      }
    }

    if (!result.success) {
      // Use Claude error if detected, otherwise build generic error message
      if (result.claudeError) {
        const errorMsg = `${getClaudeErrorLabel(result.claudeError.code)}: ${result.claudeError.suggestion}`;
        setFlowState(prev => ({ ...prev, error: errorMsg, claudeError: result.claudeError ?? null }));
        return { success: false, output: result.stdout, error: errorMsg, claudeError: result.claudeError };
      }

      // Build generic error message
      let errorMsg = 'Command failed';
      if (result.timedOut) {
        errorMsg = 'Command timed out (10 min limit)';
      } else if (result.stderr) {
        errorMsg = result.stderr.trim().split('\n')[0]; // First line of stderr
      } else if (result.exitCode !== 0) {
        errorMsg = `Command exited with code ${result.exitCode}`;
      }

      // In verbose mode, show full stderr on screen
      if (verbose && result.stderr) {
        addOutput(`[verbose] Full stderr:`);
        result.stderr.split('\n').forEach(line => {
          if (line.trim()) addOutput(`  ${line}`);
        });
      }

      setFlowState(prev => ({ ...prev, error: errorMsg }));
      return { success: false, output: result.stdout, error: errorMsg };
    }

    return { success: true, output: result.stdout };
  }, [services.agentInvoker, flags, verbose, getWorkingDir, addOutput, logToFile]);

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
      // Increment commit count
      setFlowState(prev => ({ ...prev, commitCount: prev.commitCount + 1 }));
    }

    return true;
  }, [services.commitService, getWorkingDir, addOutput]);

  // Save flow state with task progress and phase metrics
  const saveFlowState = useCallback(async (
    phase: ExtendedFlowPhase,
    workDir?: string,
    completedTasksOverride?: string[]
  ) => {
    const dir = workDir ?? getWorkingDir();
    const stateStore = createStateStore(dir);

    // Load existing state to preserve createdAt and merge data
    const existingState = await stateStore.load(featureName);

    // Use override if provided, otherwise use current state, otherwise preserve existing
    const completedTasks = completedTasksOverride ?? flowState.completedTasks;

    const state: FlowState = {
      feature: featureName,
      phase: convertToFlowPhase(phase),
      createdAt: existingState?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: existingState?.history ?? [],
      metadata: {
        description,
        mode,
        tier: flags.tier,
        worktreePath: flowState.worktreePath ?? undefined,
        resolvedFeatureName: flowState.resolvedFeatureName ?? undefined
      },
      // Orchestrator-controlled task progress
      taskProgress: completedTasks.length > 0 || flowState.totalTasks > 0 ? {
        completedTasks,
        totalTasks: flowState.totalTasks
      } : existingState?.taskProgress,
      // Phase timing metrics
      phaseMetrics: Object.keys(flowState.phaseMetrics).length > 0
        ? { ...existingState?.phaseMetrics, ...flowState.phaseMetrics }
        : existingState?.phaseMetrics
    };

    await stateStore.save(state);
  }, [featureName, description, mode, flags.tier, flowState.worktreePath, flowState.resolvedFeatureName, flowState.completedTasks, flowState.totalTasks, flowState.phaseMetrics, getWorkingDir]);

  // Transition to next phase
  const transitionPhase = useCallback((event: Parameters<typeof services.flowMachine.send>[0]) => {
    const nextPhase = services.flowMachine.send(event);
    setFlowState(prev => ({ ...prev, phase: nextPhase }));
    return nextPhase;
  }, [services.flowMachine]);

  // Check for existing flow on mount
  useEffect(() => {
    if (flowStartedRef.current) return;
    flowStartedRef.current = true;

    const checkExistingFlow = async () => {
      // Load config to get the agent setting
      const config = await services.configService.load(repoPath);
      if (config?.agent) {
        setFlowState(prev => ({ ...prev, agent: config.agent }));
      }

      addOutput('Checking for existing flow...');

      // Check if there's an existing flow state for this feature
      // First check main repo, then check worktree if exists
      let existingState = await services.stateStore.load(featureName);

      // If not found in main repo, check if worktree exists and has state
      if (!existingState) {
        const worktreeCheck = await services.worktreeService.check(repoPath, featureName);
        if (worktreeCheck.exists && worktreeCheck.path) {
          const worktreeStateStore = createStateStore(worktreeCheck.path);
          existingState = await worktreeStateStore.load(featureName);
          if (existingState) {
            addOutput(`Found state in worktree: ${worktreeCheck.path}`);
          }
        }
      }

      if (existingState && existingState.phase.type !== 'complete' && existingState.phase.type !== 'aborted') {
        // Found an in-progress flow - check for uncommitted changes
        const worktreePath = existingState.metadata.worktreePath ?? repoPath;
        const gitStatus = await services.gitStatusChecker.check(worktreePath);

        // Load task progress from state (source of truth)
        const completedTasks = existingState.taskProgress?.completedTasks ?? [];
        const totalTasks = existingState.taskProgress?.totalTasks ?? 0;

        if (gitStatus.hasChanges) {
          // Has uncommitted changes - prompt user first
          setFlowState(prev => ({
            ...prev,
            preStartStep: { type: 'uncommitted-changes', existingState, gitStatus },
            existingFlowState: existingState,
            worktreePath: existingState.metadata.worktreePath ?? null,
            resolvedFeatureName: existingState.metadata.resolvedFeatureName ?? null,
            completedTasks: [...completedTasks],
            totalTasks
          }));
          addOutput(`Found existing flow at phase: ${existingState.phase.type}`);
          if (completedTasks.length > 0) {
            addOutput(`Completed tasks: ${completedTasks.join(', ')}`);
          }
          addOutput(`Uncommitted changes detected: ${gitStatus.staged} staged, ${gitStatus.unstaged} unstaged, ${gitStatus.untracked} untracked`);
          return;
        }

        // No uncommitted changes - prompt resume vs restart
        setFlowState(prev => ({
          ...prev,
          preStartStep: { type: 'existing-flow-detected', existingState, gitStatus },
          existingFlowState: existingState,
          worktreePath: existingState.metadata.worktreePath ?? null,
          resolvedFeatureName: existingState.metadata.resolvedFeatureName ?? null,
          completedTasks: [...completedTasks],
          totalTasks
        }));
        addOutput(`Found existing flow at phase: ${existingState.phase.type}`);
        if (completedTasks.length > 0) {
          addOutput(`Completed tasks: ${completedTasks.join(', ')}`);
        }
        return;
      }

      // No existing flow or flow is complete/aborted - proceed with fresh start
      setFlowState(prev => ({ ...prev, preStartStep: { type: 'ready' } }));
      await startFreshFlow();
    };

    checkExistingFlow();
  }, []);

  // Handle existing flow decision (resume vs restart)
  const handleExistingFlowDecision = useCallback(async (decision: string) => {
    if (decision === 'resume') {
      await resumeExistingFlow();
    } else if (decision === 'restart') {
      setFlowState(prev => ({ ...prev, preStartStep: { type: 'ready' }, existingFlowState: null }));
      addOutput('Starting fresh flow...');
      await startFreshFlow();
    } else if (decision === 'abort') {
      exit();
    }
  }, [exit]);

  // Handle uncommitted changes decision
  const handleUncommittedChangesDecision = useCallback(async (decision: string) => {
    const existingState = flowState.existingFlowState;
    if (!existingState) return;

    const worktreePath = existingState.metadata.worktreePath ?? repoPath;

    if (decision === 'commit') {
      // Commit changes with WIP message
      addOutput('Committing changes...');
      const commitResult = await services.commitService.stageAndCommit(
        worktreePath,
        `WIP: ${featureName} - auto-commit before resume`
      );
      if (commitResult.success) {
        addOutput(`Committed: ${commitResult.commitHash?.substring(0, 7) ?? 'done'}`);
      } else {
        addOutput(`Commit warning: ${commitResult.error ?? 'No changes to commit'}`);
      }
      // Now show resume vs restart choice
      const gitStatus = await services.gitStatusChecker.check(worktreePath);
      setFlowState(prev => ({
        ...prev,
        preStartStep: { type: 'existing-flow-detected', existingState, gitStatus }
      }));
    } else if (decision === 'discard') {
      // Discard changes using git checkout
      addOutput('Discarding changes...');
      const { spawn } = await import('node:child_process');
      await new Promise<void>((resolve) => {
        const proc = spawn('git', ['checkout', '--', '.'], { cwd: worktreePath });
        proc.on('close', () => {
          // Also clean untracked files
          const cleanProc = spawn('git', ['clean', '-fd'], { cwd: worktreePath });
          cleanProc.on('close', () => resolve());
        });
      });
      addOutput('Changes discarded');
      // Now show resume vs restart choice
      const gitStatus = await services.gitStatusChecker.check(worktreePath);
      setFlowState(prev => ({
        ...prev,
        preStartStep: { type: 'existing-flow-detected', existingState, gitStatus }
      }));
    } else if (decision === 'abort') {
      exit();
    }
  }, [flowState.existingFlowState, services.commitService, services.gitStatusChecker, featureName, repoPath, exit, addOutput]);

  // Resume from existing flow state
  const resumeExistingFlow = useCallback(async () => {
    const existingState = flowState.existingFlowState;
    if (!existingState) {
      addOutput('Error: No existing flow state to resume');
      return;
    }

    const phaseType = existingState.phase.type;
    addOutput(`Resuming from phase: ${phaseType}`);

    // Initialize log file
    const workDir = existingState.metadata.worktreePath ?? repoPath;

    // Load initial commit count
    const initialCommitCount = await services.commitService.countFeatureCommits(workDir);

    setFlowState(prev => ({
      ...prev,
      preStartStep: { type: 'resuming', fromPhase: phaseType },
      isHealthChecking: true,
      commitCount: initialCommitCount
    }));

    await initLogFile(workDir);

    // Run health check
    addOutput('Checking Claude API status...');
    const healthResult = await services.healthCheck.check({
      tier: flags.tier,
      sandbox: flags.sandbox,
      timeoutMs: 30000
    });

    setFlowState(prev => ({ ...prev, isHealthChecking: false }));

    if (!healthResult.healthy) {
      const errorMsg = healthResult.error
        ? `${getClaudeErrorLabel(healthResult.error.code)}: ${healthResult.error.suggestion}`
        : healthResult.message;
      setFlowState(prev => ({
        ...prev,
        error: errorMsg,
        claudeError: healthResult.error ?? null,
        phase: { type: 'error', feature: featureName, error: errorMsg }
      }));
      return;
    }

    addOutput(`API ready (${healthResult.durationMs}ms)`);

    // Set up flow machine to the current phase
    const effectiveName = existingState.metadata.resolvedFeatureName ?? sanitizeFeatureName(featureName);

    // Update state with existing flow info
    setFlowState(prev => ({
      ...prev,
      worktreePath: existingState.metadata.worktreePath ?? null,
      resolvedFeatureName: effectiveName
    }));

    // Resume based on current phase
    await resumeFromPhase(existingState.phase.type, workDir, effectiveName);
  }, [flowState.existingFlowState, services.healthCheck, flags, featureName, repoPath, initLogFile, addOutput]);

  // Resume from a specific phase
  const resumeFromPhase = async (phaseType: string, workDir: string, effectiveName: string) => {
    addOutput(`Continuing from ${phaseType}...`);

    switch (phaseType) {
      case 'requirements-review':
      case 'requirements-approval':
        // Waiting for approval - show approval UI
        transitionPhase({ type: 'START', feature: featureName, description, mode });
        transitionPhase({ type: 'PHASE_COMPLETE' }); // to requirements-generating
        transitionPhase({ type: 'PHASE_COMPLETE' }); // to requirements-approval
        break;

      case 'design-generating':
        // Resume design generation
        transitionPhase({ type: 'START', feature: featureName, description, mode });
        transitionPhase({ type: 'PHASE_COMPLETE' });
        transitionPhase({ type: 'PHASE_COMPLETE' });
        transitionPhase({ type: 'APPROVE' });
        await runDesignPhase(workDir);
        break;

      case 'design-review':
      case 'design-approval':
        // Waiting for design approval
        transitionPhase({ type: 'START', feature: featureName, description, mode });
        transitionPhase({ type: 'PHASE_COMPLETE' });
        transitionPhase({ type: 'PHASE_COMPLETE' });
        transitionPhase({ type: 'APPROVE' });
        transitionPhase({ type: 'PHASE_COMPLETE' });
        break;

      case 'tasks-generating':
        // Resume tasks generation
        transitionPhase({ type: 'START', feature: featureName, description, mode });
        transitionPhase({ type: 'PHASE_COMPLETE' });
        transitionPhase({ type: 'PHASE_COMPLETE' });
        transitionPhase({ type: 'APPROVE' });
        transitionPhase({ type: 'PHASE_COMPLETE' });
        transitionPhase({ type: 'APPROVE' });
        await runTasksPhase(workDir);
        break;

      case 'tasks-review':
      case 'tasks-approval':
        // Waiting for tasks approval - load ALL tasks
        transitionPhase({ type: 'START', feature: featureName, description, mode });
        transitionPhase({ type: 'PHASE_COMPLETE' });
        transitionPhase({ type: 'PHASE_COMPLETE' });
        transitionPhase({ type: 'APPROVE' });
        transitionPhase({ type: 'PHASE_COMPLETE' });
        transitionPhase({ type: 'APPROVE' });
        transitionPhase({ type: 'PHASE_COMPLETE' });
        {
          // Load ALL tasks (not just pending by file checkbox)
          const specDir = join(workDir, '.red64', 'specs', effectiveName);
          const tasks = await services.taskParser.parse(specDir);
          setFlowState(prev => ({
            ...prev,
            tasks,
            totalTasks: tasks.length
          }));
        }
        break;

      case 'implementing':
        // Resume implementation - use state.json.completedTasks as source of truth
        transitionPhase({ type: 'START', feature: featureName, description, mode });
        transitionPhase({ type: 'PHASE_COMPLETE' });
        transitionPhase({ type: 'PHASE_COMPLETE' });
        transitionPhase({ type: 'APPROVE' });
        transitionPhase({ type: 'PHASE_COMPLETE' });
        transitionPhase({ type: 'APPROVE' });
        transitionPhase({ type: 'PHASE_COMPLETE' });
        transitionPhase({ type: 'APPROVE' });
        {
          // Load ALL tasks from file
          const implSpecDir = join(workDir, '.red64', 'specs', effectiveName);
          const implTasks = await services.taskParser.parse(implSpecDir);

          // Use state.json.completedTasks as source of truth (already loaded)
          const completedTaskIds = flowState.completedTasks;

          // Sync tasks.md checkboxes if out of sync with state.json
          for (const taskId of completedTaskIds) {
            const task = implTasks.find(t => t.id === taskId);
            if (task && !task.completed) {
              addOutput(`Syncing task ${taskId} checkbox in tasks.md`);
              await services.taskParser.markTaskComplete(implSpecDir, taskId);
            }
          }

          // Filter pending using state.json (source of truth)
          const implPendingTasks = implTasks.filter(t => !completedTaskIds.includes(t.id));

          setFlowState(prev => ({
            ...prev,
            tasks: implTasks,
            totalTasks: implTasks.length
          }));

          if (implPendingTasks.length > 0) {
            addOutput(`Resuming implementation: ${completedTaskIds.length} completed, ${implPendingTasks.length} pending`);
            await runImplementation(workDir);
          } else {
            addOutput('All tasks already completed!');
            await completeFlow(workDir);
          }
        }
        break;

      default:
        // For other phases, start fresh
        addOutput(`Cannot resume from phase ${phaseType}, starting fresh...`);
        await startFreshFlow();
    }
  };

  // Start a fresh flow (original startFlow logic)
  const startFreshFlow = async () => {
    // Initialize log file first (in repo, will move to worktree if created)
    const logPath = await initLogFile(repoPath);
    addOutput(`Log file: ${logPath}`);
    addOutput('');

    // Run health check before starting
    addOutput('Checking Claude API status...');
    setFlowState(prev => ({ ...prev, isHealthChecking: true }));

    const healthResult = await services.healthCheck.check({
      tier: flags.tier,
      sandbox: flags.sandbox,
      timeoutMs: 30000
    });

    setFlowState(prev => ({ ...prev, isHealthChecking: false }));

    if (!healthResult.healthy) {
      await logToFile(`Health check failed: ${healthResult.message}`);
      if (healthResult.error) {
        await logToFile(`Error code: ${healthResult.error.code}`);
        await logToFile(`Suggestion: ${healthResult.error.suggestion}`);
      }

      // Set error state with Claude error details
      const errorMsg = healthResult.error
        ? `${getClaudeErrorLabel(healthResult.error.code)}: ${healthResult.error.suggestion}`
        : healthResult.message;

      setFlowState(prev => ({
        ...prev,
        error: errorMsg,
        claudeError: healthResult.error ?? null,
        phase: { type: 'error', feature: featureName, error: errorMsg }
      }));
      return;
    }

    addOutput(`API ready (${healthResult.durationMs}ms)`);
    addOutput('');
    addOutput(`Starting flow: ${featureName}`);
    addOutput(`Mode: ${mode}`);
    addOutput('');

    // Step 1: Create or reuse git worktree for isolation
    addOutput('Setting up git worktree for feature isolation...');

    // Check if worktree already exists
    const existingWorktree = await services.worktreeService.check(repoPath, featureName);
    let workDir = repoPath;

    if (existingWorktree.exists) {
      // Reuse existing worktree
      workDir = existingWorktree.path;
      setFlowState(prev => ({ ...prev, worktreePath: existingWorktree.path }));
      addOutput(`Using existing worktree: ${existingWorktree.path}`);
      addOutput(`Branch: ${existingWorktree.branch}`);
    } else {
      // Create new worktree
      const worktreeResult = await services.worktreeService.create(repoPath, featureName);

      if (!worktreeResult.success) {
        addOutput(`Worktree error: ${worktreeResult.error}`);
        addOutput('Continuing without worktree isolation...');
        // Continue without worktree
      } else {
        workDir = worktreeResult.path!;
        setFlowState(prev => ({ ...prev, worktreePath: worktreeResult.path! }));
        addOutput(`Worktree created: ${worktreeResult.path}`);
        addOutput(`Branch: feature/${sanitizeFeatureName(featureName)}`);
      }
    }

    // Step 2: Transition to initializing
    const initPhase = transitionPhase({
      type: 'START',
      feature: featureName,
      description,
      mode
    });

    await saveFlowState(initPhase, workDir);

    // Initialize spec directory directly (no agent call needed)
    addOutput('');
    addOutput('Initializing spec directory...');
    addOutput(`Working directory: ${workDir}`);
    const initResult = await services.specInitService.init(workDir, featureName, description);

    if (!initResult.success) {
      transitionPhase({ type: 'ERROR', error: initResult.error ?? 'Initialization failed' });
      return;
    }

    // IMPORTANT: Update the resolved feature name from spec-init result
    // This ensures all subsequent commands use the correct feature name
    setFlowState(prev => ({ ...prev, resolvedFeatureName: initResult.featureName }));
    addOutput(`Spec directory: ${initResult.specDir}`);
    addOutput(`Feature name: ${initResult.featureName}`);

    // Commit init
    await commitChanges(`initialize spec directory`, workDir);

    // Step 3: Generate requirements - pass the resolved feature name
    const reqPhase = transitionPhase({ type: 'PHASE_COMPLETE' });
    await saveFlowState(reqPhase, workDir);
    await runRequirementsPhase(workDir, initResult.featureName);
  };

  // Run requirements phase
  const runRequirementsPhase = async (workDir: string, resolvedName?: string) => {
    // Use resolved name if provided, otherwise get from state or sanitize original
    const effectiveName = resolvedName ?? flowState.resolvedFeatureName ?? sanitizeFeatureName(featureName);

    addOutput('');
    addOutput('Generating requirements...');

    const result = await executeCommand(`/red64:spec-requirements ${effectiveName} -y`, workDir);

    if (!result.success) {
      transitionPhase({ type: 'ERROR', error: result.error ?? 'Requirements generation failed' });
      return;
    }

    // Commit requirements
    await commitChanges(`generate requirements`, workDir);

    // Transition to approval
    const approvalPhase = transitionPhase({ type: 'PHASE_COMPLETE' });
    await saveFlowState(approvalPhase, workDir);
  };

  // Run design phase
  const runDesignPhase = async (workDir: string) => {
    const effectiveName = flowState.resolvedFeatureName ?? sanitizeFeatureName(featureName);

    addOutput('');
    addOutput('Generating technical design...');

    const result = await executeCommand(`/red64:spec-design ${effectiveName} -y`, workDir);

    if (!result.success) {
      transitionPhase({ type: 'ERROR', error: result.error ?? 'Design generation failed' });
      return;
    }

    // Commit design
    await commitChanges(`generate technical design`, workDir);

    // Transition to approval
    const approvalPhase = transitionPhase({ type: 'PHASE_COMPLETE' });
    await saveFlowState(approvalPhase, workDir);
  };

  // Run tasks phase
  const runTasksPhase = async (workDir: string) => {
    const effectiveName = flowState.resolvedFeatureName ?? sanitizeFeatureName(featureName);

    addOutput('');
    addOutput('Generating implementation tasks...');

    const result = await executeCommand(`/red64:spec-tasks ${effectiveName} -y`, workDir);

    if (!result.success) {
      transitionPhase({ type: 'ERROR', error: result.error ?? 'Tasks generation failed' });
      return;
    }

    // Commit tasks
    await commitChanges(`generate implementation tasks`, workDir);

    // Parse tasks for implementation phase - use effective name for spec directory
    const specDir = join(workDir, '.red64', 'specs', effectiveName);
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
  // ORCHESTRATOR-CONTROLLED: Marks tasks complete in both tasks.md and state.json
  const runImplementation = async (workDir: string) => {
    const { tasks, completedTasks: alreadyCompleted } = flowState;
    const effectiveName = flowState.resolvedFeatureName ?? sanitizeFeatureName(featureName);
    const specDir = join(workDir, '.red64', 'specs', effectiveName);

    // Filter out already completed tasks (from state.json, source of truth)
    const pendingTasks = tasks.filter(t => !alreadyCompleted.includes(t.id));

    if (pendingTasks.length === 0) {
      addOutput('No tasks to implement');
      transitionPhase({ type: 'PHASE_COMPLETE' });
      await completeFlow(workDir);
      return;
    }

    addOutput('');
    addOutput('Starting implementation...');
    addOutput(`Total tasks: ${tasks.length}, Pending: ${pendingTasks.length}`);
    if (alreadyCompleted.length > 0) {
      addOutput(`Already completed: ${alreadyCompleted.join(', ')}`);
    }
    addOutput('');

    // Track completed tasks in this run
    let currentCompleted = [...alreadyCompleted];

    // Execute each pending task one at a time
    for (let i = 0; i < pendingTasks.length; i++) {
      const task = pendingTasks[i];
      const overallIndex = tasks.findIndex(t => t.id === task.id);
      const taskNum = overallIndex + 1;

      setFlowState(prev => ({ ...prev, currentTask: taskNum }));

      addOutput(`[${currentCompleted.length + 1}/${tasks.length}] Task ${task.id}: ${task.title}`);

      // Run spec-impl for this specific task - use effective name
      const result = await executeCommand(
        `/red64:spec-impl ${effectiveName} ${task.id} -y`,
        workDir
      );

      if (!result.success) {
        addOutput(`Task ${task.id} failed: ${result.error}`);
        // Save progress so far before continuing
        await saveFlowState(flowState.phase, workDir, currentCompleted);
        // Continue to next task instead of failing entirely
        continue;
      }

      // ORCHESTRATOR-CONTROLLED TASK COMPLETION:
      // 1. Mark task complete in tasks.md
      const markResult = await services.taskParser.markTaskComplete(specDir, task.id);
      if (!markResult.success) {
        addOutput(`Warning: Failed to mark task ${task.id} in tasks.md: ${markResult.error}`);
      }

      // 2. Update state with completed task
      currentCompleted = [...currentCompleted, task.id];
      setFlowState(prev => ({ ...prev, completedTasks: currentCompleted }));

      // 3. Save state immediately (before commit, for crash recovery)
      await saveFlowState(flowState.phase, workDir, currentCompleted);

      // 4. Commit both tasks.md and state.json together
      await commitChanges(
        services.commitService.formatTaskCommitMessage(effectiveName, taskNum, task.title),
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
    const effectiveName = flowState.resolvedFeatureName ?? sanitizeFeatureName(featureName);
    const completePhase: ExtendedFlowPhase = { type: 'complete', feature: effectiveName };
    transitionPhase({ type: 'PHASE_COMPLETE' });
    await saveFlowState(completePhase, workDir);

    addOutput('');
    addOutput('Flow completed successfully!');
    addOutput(`Worktree: ${flowState.worktreePath ?? 'none'}`);
    addOutput(`Branch: feature/${sanitizeFeatureName(featureName)}`);
  };

  // Handle approval decision
  const handleApproval = useCallback(async (decision: string) => {
    const workDir = getWorkingDir();
    const effectiveName = flowState.resolvedFeatureName ?? sanitizeFeatureName(featureName);

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
          // Update spec.json to mark tasks as approved before implementation
          addOutput('Marking tasks as approved...');
          const approvalResult = await services.specInitService.updateTaskApproval(workDir, effectiveName);
          if (!approvalResult.success) {
            addOutput(`Warning: Failed to update spec.json: ${approvalResult.error}`);
          }
          await runImplementation(workDir);
          break;
        case 'gap-analysis':
          // Brownfield: run gap analysis
          addOutput('Running gap analysis...');
          const gapResult = await executeCommand(`/red64:validate-gap ${effectiveName} -y`, workDir);
          if (gapResult.success) {
            await commitChanges(`gap analysis`, workDir);
          }
          transitionPhase({ type: 'PHASE_COMPLETE' });
          break;
        case 'design-validation':
          // Brownfield: run design validation
          addOutput('Validating design...');
          const valResult = await executeCommand(`/red64:validate-design ${effectiveName} -y`, workDir);
          if (valResult.success) {
            await commitChanges(`design validation`, workDir);
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
      addOutput('Flow paused. Run the same start command to resume.');
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
      <Box flexDirection="column" paddingX={1}>
        <Box>
          <Text bold color="green">Flow Complete</Text>
        </Box>
        <Text>Feature "{featureName}" has been implemented.</Text>
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Spec: .red64/specs/{sanitizeFeatureName(featureName)}/</Text>
          <Text dimColor>Branch: feature/{sanitizeFeatureName(featureName)}</Text>
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
    const logPath = logFileRef.current ?? join(repoPath, '.red64', 'flows', sanitizeFeatureName(featureName), 'flow.log');
    const claudeError = flowState.claudeError;

    return (
      <Box flexDirection="column" paddingX={1}>
        <Box>
          <Text bold color="red">
            {claudeError ? `API Error: ${getClaudeErrorLabel(claudeError.code)}` : 'Flow Error'}
          </Text>
        </Box>

        {/* Claude-specific error display */}
        {claudeError ? (
          <Box flexDirection="column" marginBottom={1}>
            <Text color="red">{claudeError.message}</Text>
            <Box marginTop={1}>
              <Text color="yellow" bold>Suggestion: </Text>
              <Text color="yellow">{claudeError.suggestion}</Text>
            </Box>
            {!claudeError.recoverable && (
              <Box marginTop={1}>
                <Text color="red" dimColor>This error requires manual intervention before retrying.</Text>
              </Box>
            )}
          </Box>
        ) : (
          <Text color="red">{flowState.error ?? 'An unknown error occurred'}</Text>
        )}

        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Feature: {featureName}</Text>
          {flowState.worktreePath && (
            <Text dimColor>Worktree: {flowState.worktreePath}</Text>
          )}
          {!claudeError && (
            <Text dimColor>Phase: {flowState.phase.type}</Text>
          )}
          <Box marginTop={1} flexDirection="column">
            <Text bold>Log file:</Text>
            <Text color="yellow">{logPath}</Text>
          </Box>
          {claudeError?.recoverable && (
            <Box marginTop={1}>
              <Text dimColor>Run "red64 start {sanitizeFeatureName(featureName)}" to retry.</Text>
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  if (flowState.phase.type === 'aborted') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box>
          <Text bold color="yellow">Flow Aborted</Text>
        </Box>
        <Text>Feature flow "{featureName}" was aborted.</Text>
      </Box>
    );
  }

  // Should sidebar be shown?
  const showSidebar = flowState.worktreePath !== null || flowState.phase.type !== 'idle';

  return (
    <Box flexDirection="row" paddingX={1}>
      {/* Main content area */}
      <Box flexDirection="column" flexGrow={1}>
        {/* Header */}
        <Box>
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

        {/* Health check spinner */}
        {flowState.isHealthChecking && (
          <Box marginBottom={1}>
            <Spinner label="Checking Claude API status..." />
          </Box>
        )}

        {/* Executing spinner */}
        {flowState.isExecuting && !flowState.isHealthChecking && (
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

        {/* Existing flow detected - prompt resume vs restart */}
        {flowState.preStartStep.type === 'existing-flow-detected' && (
          <Box flexDirection="column" borderStyle="single" borderColor="yellow" paddingX={1}>
            <Text bold color="yellow">Existing Flow Detected</Text>
            <Text dimColor>Phase: {flowState.preStartStep.existingState.phase.type}</Text>
            <Box marginTop={1}>
              <Select
                options={EXISTING_FLOW_OPTIONS}
                onChange={handleExistingFlowDecision}
              />
            </Box>
          </Box>
        )}

        {/* Uncommitted changes - prompt commit/discard/abort */}
        {flowState.preStartStep.type === 'uncommitted-changes' && (
          <Box flexDirection="column" borderStyle="single" borderColor="yellow" paddingX={1}>
            <Text bold color="yellow">Uncommitted Changes Detected</Text>
            <Text dimColor>
              {flowState.preStartStep.gitStatus.staged} staged, {flowState.preStartStep.gitStatus.unstaged} unstaged, {flowState.preStartStep.gitStatus.untracked} untracked
            </Text>
            <Box marginTop={1}>
              <Select
                options={UNCOMMITTED_CHANGES_OPTIONS}
                onChange={handleUncommittedChangesDecision}
              />
            </Box>
          </Box>
        )}

        {/* Approval UI */}
        {isApprovalPhase && !flowState.isExecuting && (
          <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
            <Text bold>Review Required</Text>
            <Text dimColor>Review output in .red64/specs/{sanitizeFeatureName(featureName)}/</Text>
            <Box marginTop={1}>
              <Select
                options={APPROVAL_OPTIONS}
                onChange={handleApproval}
              />
            </Box>
          </Box>
        )}
      </Box>

      {/* Feature info sidebar */}
      {showSidebar && (
        <FeatureSidebar
          featureName={flowState.resolvedFeatureName ?? sanitizeFeatureName(featureName)}
          sandboxMode={flags.sandbox ?? false}
          currentPhase={flowState.phase.type}
          mode={mode}
          currentTask={flowState.currentTask}
          totalTasks={flowState.totalTasks}
          commitCount={flowState.commitCount}
          agent={flowState.agent}
          model={flags.model}
        />
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
