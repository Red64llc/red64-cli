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
import { Box, Text, useApp, useInput } from 'ink';
import { Spinner, Select } from '@inkjs/ui';
import type { ScreenProps } from './ScreenProps.js';
import type { FlowState, ExtendedFlowPhase, WorkflowMode, PhaseMetric, CodingAgent, HistoryEntry, GroupedTaskProgress, FlowPhase, TaskEntry, TokenUsage } from '../../types/index.js';
import { CURRENT_STATE_VERSION } from '../../types/index.js';
import {
  createStateStore,
  createTaskEntry,
  markTaskStarted,
  markTaskCompleted,
  markTaskFailed,
  getResumeTask,
  startPhaseMetric,
  completePhaseMetric,
  accumulatePhaseMetric,
  createAgentInvoker,
  createExtendedFlowMachine,
  createWorktreeService,
  createCommitService,
  createTaskParser,
  createSpecInitService,
  createClaudeHealthCheck,
  getAgentSetupInstructions,
  createGitStatusChecker,
  createConfigService,
  createProjectDetector,
  createTestRunner,
  sanitizeFeatureName,
  createContextUsageCalculator,
  isCriticalError,
  isCriticalErrorMessage,
  type Task,
  type ClaudeError,
  type GitStatus
} from '../../services/index.js';
import { PreviewService } from '../../services/PreviewService.js';
import { ContentCache } from '../../services/ContentCache.js';
import { PreviewHTMLGenerator } from '../../services/PreviewHTMLGenerator.js';
import { PreviewHTTPServer } from '../../services/PreviewHTTPServer.js';
import { FeatureSidebar, ArtifactsSidebar, TokenUsageGraph } from '../ui/index.js';
import type { Artifact } from '../../types/index.js';
import { join } from 'node:path';
import { access, appendFile, mkdir, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';

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
 * Map approval phases to the specific file(s) to review
 */
const PHASE_REVIEW_FILES: Record<string, string> = {
  'requirements-approval': 'requirements.md',
  'gap-review': 'gap-analysis.md',
  'design-approval': 'design.md',
  'design-validation-review': 'design.md',
  'tasks-approval': 'tasks.md',
  'merge-decision': ''
};

/**
 * Maximum number of attempts to fix failing tests before giving up
 */
const MAX_FIX_TESTS_ATTEMPTS = 2;

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
 * Options when completed/aborted flow is detected
 */
const COMPLETED_FLOW_OPTIONS = [
  { value: 'restart', label: 'Start fresh (archive previous state)' },
  { value: 'abort', label: 'Cancel' }
];

/**
 * Options for next steps after successful completion
 */
const COMPLETION_NEXT_STEPS_OPTIONS = [
  { value: 'push', label: 'Push branch to origin' },
  { value: 'exit', label: 'Exit' }
];

/**
 * Human-readable labels for Claude error codes
 */
function getClaudeErrorLabel(code: string): string {
  const labels: Record<string, string> = {
    CREDIT_EXHAUSTED: 'Insufficient Credits',
    RATE_LIMITED: 'Rate Limited',
    AUTH_FAILED: 'Authentication Failed',
    CLI_NOT_FOUND: 'CLI Not Found',
    MODEL_UNAVAILABLE: 'Service Unavailable',
    MODEL_CRASHED: 'Model Crashed',
    CONTEXT_EXCEEDED: 'Context Too Large',
    NETWORK_ERROR: 'Network Error',
    PERMISSION_DENIED: 'Request Blocked',
    UNKNOWN: 'Unknown Error'
  };
  return labels[code] ?? code;
}

/**
 * Push branch to origin
 */
function pushBranch(
  branchName: string,
  cwd: string
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn('git', ['push', '-u', 'origin', branchName], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stderr = '';

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: stderr || 'Failed to push branch' });
      }
    });

    proc.on('error', (error) => {
      resolve({ success: false, error: error.message });
    });
  });
}

/**
 * Pre-start check step for existing flow detection
 */
type PreStartStep =
  | { type: 'checking' }  // Checking for existing flow
  | { type: 'existing-flow-detected'; existingState: FlowState; gitStatus: GitStatus }
  | { type: 'uncommitted-changes'; existingState: FlowState; gitStatus: GitStatus }
  | { type: 'completed-flow-detected'; existingState: FlowState }  // Flow already complete
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
  taskEntries: readonly TaskEntry[];  // Full task entries with usage metrics
  phaseMetrics: Record<string, PhaseMetric>;  // Phase timing metrics
  commitCount: number;  // Number of commits for this feature
  agent: CodingAgent;  // Coding agent from config
  artifacts: Artifact[];  // Generated artifacts for display
  history: HistoryEntry[];  // Phase history for UI display
  maxContextPercent: number;  // Peak context utilization (single task, not cumulative)
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
    projectDetector: ReturnType<typeof createProjectDetector>;
    testRunner: ReturnType<typeof createTestRunner>;
    previewService: PreviewService;
    contextUsageCalculator: ReturnType<typeof createContextUsageCalculator>;
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
    const projectDetector = createProjectDetector();
    const testRunner = createTestRunner();
    const contextUsageCalculator = createContextUsageCalculator();

    // Initialize preview service with dependencies
    const contentCache = new ContentCache();
    const htmlGenerator = new PreviewHTMLGenerator();
    const httpServer = new PreviewHTTPServer();
    const previewService = new PreviewService(contentCache, htmlGenerator, httpServer);

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
      configService,
      projectDetector,
      testRunner,
      previewService,
      contextUsageCalculator
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

  /**
   * Attempt to fix failing regression tests using the fix-tests agent.
   * Returns true if tests pass after fix attempts, false otherwise.
   */
  const attemptFixTests = useCallback(async (
    testOutput: string,
    workDir: string,
    testCommand: string,
    setupCommand: string | undefined,
    addOutputFn: (line: string) => void,
    logToFileFn: (message: string) => Promise<void>
  ): Promise<{ success: boolean; finalOutput: string }> => {
    const agentInvoker = servicesRef.current?.agentInvoker;
    const testRunner = servicesRef.current?.testRunner;

    if (!agentInvoker || !testRunner) {
      return { success: false, finalOutput: testOutput };
    }

    let lastTestOutput = testOutput;

    for (let attempt = 1; attempt <= MAX_FIX_TESTS_ATTEMPTS; attempt++) {
      addOutputFn('');
      addOutputFn(`🔧 Attempting to fix tests (attempt ${attempt}/${MAX_FIX_TESTS_ATTEMPTS})...`);
      await logToFileFn(`Invoking fix-tests agent (attempt ${attempt})`);

      // Invoke the fix-tests agent with the test output
      const fixPrompt = `/red64:fix-tests`;
      const fixResult = await agentInvoker.invoke({
        prompt: fixPrompt,
        workingDirectory: workDir,
        skipPermissions: flags.skipPermissions ?? false,
        tier: flags.tier,
        agent: agentRef.current,
        timeout: 600000  // 10 minutes for complex test fixes
      });

      if (!fixResult.success) {
        addOutputFn(`⚠️ Fix-tests agent failed: ${fixResult.stderr || 'Unknown error'}`);
        await logToFileFn(`Fix-tests agent failed: ${fixResult.stderr}`);
        continue;  // Try again
      }

      addOutputFn('Fix-tests agent completed, verifying tests...');

      // Re-run tests to verify fix
      const fullCommand = setupCommand ? `${setupCommand} && ${testCommand}` : testCommand;
      addOutputFn(`Running: ${fullCommand}`);
      const retestResult = await testRunner.run({
        setupCommand,
        testCommand,
        workingDir: workDir,
        timeoutMs: 300000
      });

      lastTestOutput = retestResult.stderr || retestResult.stdout || '';

      if (retestResult.success) {
        addOutputFn(`✅ Tests now passing after fix (${(retestResult.durationMs / 1000).toFixed(1)}s)`);
        await logToFileFn(`Tests fixed successfully on attempt ${attempt}`);
        return { success: true, finalOutput: lastTestOutput };
      }

      addOutputFn(`❌ Tests still failing after attempt ${attempt}`);
      await logToFileFn(`Tests still failing after fix attempt ${attempt}`);
    }

    return { success: false, finalOutput: lastTestOutput };
  }, [flags.skipPermissions, flags.tier]);

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
    taskEntries: [],  // Full task entries with token/context usage
    phaseMetrics: {},  // Phase timing metrics
    commitCount: 0,  // Number of commits for this feature
    agent: 'claude',  // Default, will be loaded from config
    artifacts: [],  // Generated artifacts
    history: [],  // Phase history for sidebar display
    maxContextPercent: 0  // Peak context utilization across all tasks
  });

  // Track if sidebar is focused (for keyboard navigation)
  const [sidebarFocused, setSidebarFocused] = useState(false);

  // Track if flow has been started
  const flowStartedRef = useRef(false);

  // Ref to hold existingFlowState for resumeExistingFlow (avoids stale closure)
  const existingFlowStateRef = useRef<FlowState | null>(null);

  // Ref to hold agent for use in callbacks (avoids stale closure from React state)
  const agentRef = useRef<CodingAgent>(flowState.agent as CodingAgent);
  const sandboxImageRef = useRef<string | undefined>(undefined);
  const uiConfigRef = useRef<{ leftSidebarWidth?: number; rightSidebarWidth?: number }>({});

  // Keep refs in sync with state
  existingFlowStateRef.current = flowState.existingFlowState;
  agentRef.current = flowState.agent as CodingAgent;

  // Add output line (to screen and log file)
  const addOutput = useCallback((line: string) => {
    setFlowState(prev => ({
      ...prev,
      output: [...prev.output.slice(-50), line]
    }));
    // Also log to file
    logToFile(line);
  }, [logToFile]);

  // Add artifact to the list
  const addArtifact = useCallback((artifact: Artifact) => {
    setFlowState(prev => {
      // Avoid duplicates
      if (prev.artifacts.some(a => a.path === artifact.path)) {
        return prev;
      }
      return {
        ...prev,
        artifacts: [...prev.artifacts, artifact]
      };
    });
  }, []);

  // Artifact filenames for generating phases only (not validation phases)
  const PHASE_ARTIFACTS: Record<string, string> = {
    'requirements-generating': 'requirements.md',
    'gap-analysis': 'gap-analysis.md',
    'design-generating': 'design.md',
    'tasks-generating': 'tasks.md'
  };

  // Phase order for brownfield and greenfield workflows
  const BROWNFIELD_PHASE_ORDER = [
    'initializing', 'requirements-generating', 'requirements-approval',
    'gap-analysis', 'gap-review',
    'design-generating', 'design-approval',
    'design-validation', 'design-validation-review',
    'tasks-generating', 'tasks-approval',
    'implementing', 'complete'
  ];
  const GREENFIELD_PHASE_ORDER = [
    'initializing', 'requirements-generating', 'requirements-approval',
    'design-generating', 'design-approval',
    'tasks-generating', 'tasks-approval',
    'implementing', 'complete'
  ];

  // Check if a phase has an existing artifact that can be reused
  const hasExistingArtifact = useCallback(async (phase: string, workDir: string, effectiveName: string): Promise<boolean> => {
    const artifactFile = PHASE_ARTIFACTS[phase];
    if (!artifactFile) return false;

    const artifactPath = join(workDir, '.red64', 'specs', effectiveName, artifactFile);
    try {
      await access(artifactPath);
      return true;
    } catch {
      return false;
    }
  }, []);

  // Check if a phase was completed in history
  const wasPhaseCompletedInHistory = useCallback((phase: string): boolean => {
    const history = flowState.history;
    if (!history || history.length === 0) return false;

    const phaseOrder = mode === 'brownfield' ? BROWNFIELD_PHASE_ORDER : GREENFIELD_PHASE_ORDER;
    const phaseIndex = phaseOrder.indexOf(phase);
    if (phaseIndex === -1) return false;

    // Check if any phase AFTER this one appears in history
    for (const entry of history) {
      const entryIndex = phaseOrder.indexOf(entry.phase.type);
      if (entryIndex > phaseIndex) {
        return true;
      }
    }
    return false;
  }, [flowState.history, mode]);

  // Check if phase can be skipped based on:
  // 1. For generating phases: artifact exists AND phase was completed in history
  // 2. For validation/approval phases: the NEXT generating phase's artifact exists
  const canSkipPhase = useCallback(async (phase: string, workDir: string, effectiveName: string): Promise<boolean> => {
    // For generating phases, check if artifact exists
    if (PHASE_ARTIFACTS[phase]) {
      const hasArtifact = await hasExistingArtifact(phase, workDir, effectiveName);
      const wasCompleted = wasPhaseCompletedInHistory(phase);
      return hasArtifact && wasCompleted;
    }

    // For validation phases (design-validation), check if the NEXT artifact (tasks.md) exists
    // This allows skipping validation when we've already progressed past it
    if (phase === 'design-validation') {
      const hasTasksArtifact = await hasExistingArtifact('tasks-generating', workDir, effectiveName);
      const tasksWasCompleted = wasPhaseCompletedInHistory('tasks-generating');
      return hasTasksArtifact && tasksWasCompleted;
    }

    return false;
  }, [hasExistingArtifact, wasPhaseCompletedInHistory]);

  // Determine the appropriate phase based on existing artifacts (for recovery when state is corrupted)
  const determinePhaseFromArtifacts = useCallback(async (workDir: string, effectiveName: string): Promise<string> => {
    const specDir = join(workDir, '.red64', 'specs', effectiveName);
    const phaseOrder = mode === 'brownfield' ? BROWNFIELD_PHASE_ORDER : GREENFIELD_PHASE_ORDER;

    // Check artifacts in reverse order (most complete first)
    // For each artifact found, return the phase that comes AFTER it
    const artifactChecks: Array<{ artifact: string; completedPhase: string }> = [
      { artifact: 'tasks.md', completedPhase: 'tasks-approval' },
      { artifact: 'design.md', completedPhase: 'design-approval' },
      { artifact: 'gap-analysis.md', completedPhase: 'gap-review' },
      { artifact: 'requirements.md', completedPhase: 'requirements-approval' },
      { artifact: 'spec.json', completedPhase: 'initializing' },
    ];

    for (const { artifact, completedPhase } of artifactChecks) {
      try {
        await access(join(specDir, artifact));
        // Artifact exists - find the NEXT phase after the completed one
        const completedIdx = phaseOrder.indexOf(completedPhase);
        if (completedIdx >= 0 && completedIdx + 1 < phaseOrder.length) {
          const nextPhase = phaseOrder[completedIdx + 1];
          // If tasks.md exists and we're past tasks-approval, go to implementing
          if (artifact === 'tasks.md') {
            return 'implementing';
          }
          return nextPhase;
        }
        return completedPhase;
      } catch {
        continue;
      }
    }

    // No artifacts found - start fresh from initializing
    return 'initializing';
  }, [mode]);

  // Find the furthest phase we can skip to based on existing artifacts and history
  // Returns the phase we should resume at (either an approval phase or implementing)
  const findResumePhase = useCallback(async (currentPhase: string, workDir: string, effectiveName: string): Promise<string> => {
    const phaseOrder = mode === 'brownfield' ? BROWNFIELD_PHASE_ORDER : GREENFIELD_PHASE_ORDER;
    const currentIndex = phaseOrder.indexOf(currentPhase);
    if (currentIndex === -1) return currentPhase;

    let targetPhase = currentPhase;

    // Walk forward through phases, checking what can be skipped
    for (let i = currentIndex; i < phaseOrder.length; i++) {
      const phase = phaseOrder[i];

      // Stop at implementing - that's our target
      if (phase === 'implementing') {
        // Check if tasks.md exists and tasks-approval was completed
        const hasTasksArtifact = await hasExistingArtifact('tasks-generating', workDir, effectiveName);
        const tasksApprovalCompleted = wasPhaseCompletedInHistory('tasks-approval');
        if (hasTasksArtifact && tasksApprovalCompleted) {
          targetPhase = 'implementing';
        }
        break;
      }

      // Stop at complete
      if (phase === 'complete') {
        break;
      }

      // For generating phases, check if we can skip
      if (PHASE_ARTIFACTS[phase]) {
        const canSkip = await canSkipPhase(phase, workDir, effectiveName);
        if (canSkip) {
          // Find the next approval phase after this generating phase
          const nextPhaseIndex = i + 1;
          if (nextPhaseIndex < phaseOrder.length) {
            targetPhase = phaseOrder[nextPhaseIndex];
          }
        } else {
          // Can't skip this generating phase, stop here
          break;
        }
      }
      // For approval phases, check if the next generating phase can be skipped
      else if (phase.endsWith('-approval') || phase.endsWith('-review')) {
        const nextPhaseIndex = i + 1;
        if (nextPhaseIndex < phaseOrder.length) {
          const nextPhase = phaseOrder[nextPhaseIndex];
          // Check if the next phase (generating or validation) can be skipped
          if (PHASE_ARTIFACTS[nextPhase]) {
            const canSkipNext = await canSkipPhase(nextPhase, workDir, effectiveName);
            if (canSkipNext) {
              // Skip to the approval after the next generating phase
              targetPhase = phaseOrder[nextPhaseIndex + 1] ?? nextPhase;
            } else {
              // Can't skip the next generating phase, stay at this approval
              targetPhase = phase;
              break;
            }
          } else if (nextPhase === 'design-validation') {
            // Check if we can skip design-validation by looking at tasks.md
            const canSkipValidation = await canSkipPhase('design-validation', workDir, effectiveName);
            if (canSkipValidation) {
              // Skip design-validation and design-validation-review, go to tasks-approval
              const tasksApprovalIndex = phaseOrder.indexOf('tasks-approval');
              if (tasksApprovalIndex !== -1) {
                targetPhase = 'tasks-approval';
                i = tasksApprovalIndex - 1; // Continue from tasks-approval
              }
            } else {
              // Can't skip design-validation
              targetPhase = phase;
              break;
            }
          } else if (nextPhase === 'implementing') {
            // At tasks-approval, next is implementing
            targetPhase = phase;
            break;
          }
        }
      }
      // For validation phases (design-validation), check if we can skip
      else if (phase === 'design-validation') {
        const canSkip = await canSkipPhase(phase, workDir, effectiveName);
        if (canSkip) {
          // Skip to tasks-approval (skipping design-validation-review too)
          targetPhase = 'tasks-approval';
          const tasksApprovalIndex = phaseOrder.indexOf('tasks-approval');
          i = tasksApprovalIndex - 1;
        } else {
          targetPhase = phase;
          break;
        }
      }
    }

    return targetPhase;
  }, [mode, hasExistingArtifact, wasPhaseCompletedInHistory, canSkipPhase]);

  // Get working directory (worktree or repo)
  const getWorkingDir = useCallback(() => {
    return flowState.worktreePath ?? repoPath;
  }, [flowState.worktreePath, repoPath]);

  // Execute a Claude command
  const executeCommand = useCallback(async (prompt: string, workDir?: string): Promise<{ success: boolean; output: string; error?: string; claudeError?: ClaudeError; tokenUsage?: TokenUsage }> => {
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
      agent: agentRef.current,
      model: flags.model,
      sandbox: flags.sandbox ?? false,
      sandboxImage: sandboxImageRef.current,
      ollama: flags.ollama ?? false,
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

    if (!result) {
      const errorMsg = 'Command returned no result';
      await logToFile(errorMsg);
      setFlowState(prev => ({ ...prev, error: errorMsg }));
      return { success: false, output: '', error: errorMsg };
    }

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
        return { success: false, output: result.stdout, error: errorMsg, claudeError: result.claudeError, tokenUsage: result.tokenUsage };
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
      return { success: false, output: result.stdout, error: errorMsg, tokenUsage: result.tokenUsage };
    }

    return { success: true, output: result.stdout, tokenUsage: result.tokenUsage };
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

  // Save flow state with task progress, phase metrics, and fine-grained history
  const saveFlowState = useCallback(async (
    phase: ExtendedFlowPhase,
    workDir?: string,
    options?: {
      completedTasksOverride?: string[];
      taskEntries?: readonly TaskEntry[];     // Individual task tracking with timestamps
      currentTaskId?: string | null;          // Currently executing task
      event?: string;      // Event that triggered this save (e.g., 'APPROVE', 'PHASE_COMPLETE')
      subStep?: string;    // Sub-step within the phase (e.g., 'generating-started')
    }
  ) => {
    const dir = workDir ?? getWorkingDir();
    const stateStore = createStateStore(dir);

    // Load existing state to preserve createdAt and merge data
    const existingState = await stateStore.load(featureName);

    // Use override if provided, otherwise use current state, otherwise preserve existing
    const completedTasks = options?.completedTasksOverride ?? flowState.completedTasks;

    // Use dir (resolved workDir) as worktreePath if it's different from repoPath
    // This fixes the race condition where flowState.worktreePath is still null due to async setFlowState
    // Also preserve worktreePath from existing state on resume to prevent losing it
    const effectiveWorktreePath = dir !== repoPath ? dir : (flowState.worktreePath ?? existingState?.metadata.worktreePath ?? undefined);

    // Build history entry for this save (fine-grained tracking)
    const historyEntry: HistoryEntry = {
      phase: phase as unknown as FlowPhase,  // Safe cast - types are now structurally equivalent
      timestamp: new Date().toISOString(),
      event: options?.event,
      subStep: options?.subStep
    };

    // Append to history (not replace) - only add if phase is different from last entry
    // or if event/subStep is provided (indicating a meaningful state change)
    const existingHistory = existingState?.history ?? [];
    const lastEntry = existingHistory[existingHistory.length - 1];
    const shouldAddToHistory = !lastEntry ||
      lastEntry.phase.type !== phase.type ||
      options?.event ||
      options?.subStep;

    const history: readonly HistoryEntry[] = shouldAddToHistory
      ? [...existingHistory, historyEntry]
      : existingHistory;

    // Convert completedTasks to GroupedTaskProgress
    let taskProgress: GroupedTaskProgress | undefined;
    if (completedTasks.length > 0 || flowState.totalTasks > 0) {
      // Infer completed groups from sub-task IDs
      const completedGroups = [...new Set(
        completedTasks
          .map(id => parseInt(id.split('.')[0], 10))
          .filter(g => !isNaN(g))
      )].sort((a, b) => a - b);

      // Estimate total groups from flowState.tasks or existing
      const allGroupIds = flowState.tasks.length > 0
        ? [...new Set(flowState.tasks.map(t => parseInt(t.id.split('.')[0], 10)))]
        : [];
      const totalGroups = Math.max(
        ...completedGroups,
        ...allGroupIds,
        existingState?.taskProgress?.totalGroups ?? 0,
        1
      );

      // Find current group (first incomplete group)
      const currentGroup = allGroupIds.find(g => !completedGroups.includes(g));

      // Track sub-tasks in current group
      let subTasksInCurrentGroup: { completed: readonly string[]; total: number } | undefined;
      if (currentGroup !== undefined) {
        const tasksInGroup = flowState.tasks.filter(t => parseInt(t.id.split('.')[0], 10) === currentGroup);
        const completedInGroup = completedTasks.filter(id => parseInt(id.split('.')[0], 10) === currentGroup);
        subTasksInCurrentGroup = {
          completed: completedInGroup,
          total: tasksInGroup.length
        };
      }

      taskProgress = {
        completedGroups,
        totalGroups,
        currentGroup,
        subTasksInCurrentGroup,
        // Include task entries with timestamps if provided
        taskEntries: options?.taskEntries ?? existingState?.taskProgress?.taskEntries,
        currentTaskId: options?.currentTaskId ?? existingState?.taskProgress?.currentTaskId
      };
    } else if (existingState?.taskProgress) {
      // Preserve existing task progress if no new data
      taskProgress = {
        ...existingState.taskProgress,
        // Allow overriding taskEntries and currentTaskId even without other changes
        taskEntries: options?.taskEntries ?? existingState.taskProgress.taskEntries,
        currentTaskId: options?.currentTaskId ?? existingState.taskProgress.currentTaskId
      };
    }

    const state: FlowState = {
      feature: featureName,
      phase: phase as unknown as FlowPhase,  // Safe cast - types are now structurally equivalent
      createdAt: existingState?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history,
      metadata: {
        description,
        mode,
        tier: flags.tier,
        worktreePath: effectiveWorktreePath,
        resolvedFeatureName: flowState.resolvedFeatureName ?? undefined
      },
      taskProgress,
      // Phase timing metrics
      phaseMetrics: Object.keys(flowState.phaseMetrics).length > 0
        ? { ...existingState?.phaseMetrics, ...flowState.phaseMetrics }
        : existingState?.phaseMetrics,
      // Persist artifacts to disk so they survive resume
      artifacts: flowState.artifacts.length > 0
        ? flowState.artifacts
        : existingState?.artifacts,
      // Peak context utilization (persisted for tracking across sessions)
      maxContextPercent: Math.max(flowState.maxContextPercent, existingState?.maxContextPercent ?? 0),
      // Schema version for migrations
      version: CURRENT_STATE_VERSION
    };

    await stateStore.save(state);
  }, [featureName, description, mode, flags.tier, flowState.worktreePath, flowState.resolvedFeatureName, flowState.completedTasks, flowState.totalTasks, flowState.tasks, flowState.phaseMetrics, flowState.artifacts, flowState.maxContextPercent, getWorkingDir, repoPath]);

  // Transition to next phase
  const transitionPhase = useCallback((event: Parameters<typeof services.flowMachine.send>[0]) => {
    const nextPhase = services.flowMachine.send(event);
    setFlowState(prev => ({ ...prev, phase: nextPhase }));
    return nextPhase;
  }, [services.flowMachine]);

  // Clean up PreviewService on unmount
  useEffect(() => {
    return () => {
      // Cleanup preview service when component unmounts
      services.previewService.shutdownAll().catch(error => {
        console.warn('Error shutting down preview service:', error);
      });
    };
  }, [services.previewService]);

  // Check for existing flow on mount
  useEffect(() => {
    if (flowStartedRef.current) return;
    flowStartedRef.current = true;

    const checkExistingFlow = async () => {
      // Load config to get the agent setting
      const config = await services.configService.load(repoPath);
      if (config?.agent) {
        agentRef.current = config.agent as CodingAgent;
        setFlowState(prev => ({ ...prev, agent: config.agent }));
      }
      if (config?.sandboxImage) {
        sandboxImageRef.current = config.sandboxImage;
      }
      if (config?.ui) {
        uiConfigRef.current = config.ui;
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

      if (existingState) {
        // Found an existing flow state
        const worktreePath = existingState.metadata.worktreePath ?? repoPath;
        const gitStatus = await services.gitStatusChecker.check(worktreePath);

        // Load task progress from state (source of truth)
        // Handle both old TaskProgress and new GroupedTaskProgress formats
        // Prefer taskEntries if available (most accurate)
        const taskProgress = existingState.taskProgress;
        const completedTasks: string[] = [];
        let totalTasks = 0;
        if (taskProgress) {
          // New v2 format: taskEntries with individual tracking
          if (taskProgress.taskEntries && taskProgress.taskEntries.length > 0) {
            // Extract completed tasks from taskEntries (most accurate source)
            for (const entry of taskProgress.taskEntries) {
              if (entry.status === 'completed') {
                completedTasks.push(entry.id);
              }
            }
            totalTasks = taskProgress.taskEntries.length;
          } else if ('completedGroups' in taskProgress) {
            // v1 format: GroupedTaskProgress without taskEntries
            // We'll load actual task completion from tasks.md file later
            // For now just estimate count from groups
            totalTasks = taskProgress.totalGroups;
            // Can't derive individual task IDs from groups - will be loaded from tasks.md
          } else if ('completedTasks' in taskProgress) {
            // Legacy format: TaskProgress (pre-migration)
            const legacyProgress = taskProgress as unknown as { completedTasks: string[]; totalTasks: number };
            completedTasks.push(...legacyProgress.completedTasks);
            totalTasks = legacyProgress.totalTasks;
          }
        }

        // Always load artifacts and history from existing state for UI display
        const existingArtifacts = existingState.artifacts ? [...existingState.artifacts] : [];
        const existingHistory = existingState.history ? [...existingState.history] : [];

        // Check if flow is complete or aborted
        if (existingState.phase.type === 'complete' || existingState.phase.type === 'aborted') {
          // For "complete" flows, verify tasks are actually done by checking tasks.md
          if (existingState.phase.type === 'complete') {
            const effectiveName = existingState.metadata.resolvedFeatureName ?? sanitizeFeatureName(featureName);
            const specDir = join(worktreePath, '.red64', 'specs', effectiveName);
            const tasks = await services.taskParser.parse(specDir);
            const pendingTasks = services.taskParser.getPendingTasks(tasks);

            // If there are pending tasks, the flow is NOT actually complete
            // Resume at implementing phase instead
            if (pendingTasks.length > 0) {
              addOutput(`Found ${tasks.length} tasks, ${pendingTasks.length} pending - resuming implementation`);

              // Update the saved state to reflect actual status (implementing, not complete)
              const correctedPhase: FlowPhase = {
                type: 'implementing',
                feature: existingState.feature,
                currentTask: tasks.length - pendingTasks.length + 1,
                totalTasks: tasks.length
              };
              const correctedState: FlowState = {
                ...existingState,
                phase: correctedPhase
              };

              // Save the corrected state
              await services.stateStore.save(correctedState);

              // Treat as in-progress flow at implementing phase
              setFlowState(prev => ({
                ...prev,
                preStartStep: { type: 'existing-flow-detected', existingState: correctedState, gitStatus },
                existingFlowState: correctedState,
                worktreePath: existingState.metadata.worktreePath ?? null,
                resolvedFeatureName: effectiveName,
                artifacts: existingArtifacts.length > 0 ? existingArtifacts : prev.artifacts,
                history: existingHistory.length > 0 ? existingHistory : prev.history,
                tasks,
                totalTasks: tasks.length,
                currentTask: tasks.length - pendingTasks.length,
                maxContextPercent: correctedState.maxContextPercent ?? prev.maxContextPercent
              }));
              return;
            }
          }

          // Truly completed/aborted flow - prompt for action
          setFlowState(prev => ({
            ...prev,
            preStartStep: { type: 'completed-flow-detected', existingState },
            existingFlowState: existingState,
            worktreePath: existingState.metadata.worktreePath ?? null,
            resolvedFeatureName: existingState.metadata.resolvedFeatureName ?? null,
            artifacts: existingArtifacts.length > 0 ? existingArtifacts : prev.artifacts,
            history: existingHistory.length > 0 ? existingHistory : prev.history,
            completedTasks: [...completedTasks],
            totalTasks,
            maxContextPercent: existingState.maxContextPercent ?? prev.maxContextPercent
          }));
          addOutput(`Found ${existingState.phase.type} flow for ${featureName}`);
          return;
        }

        // In-progress flow
        if (gitStatus.hasChanges) {
          // Has uncommitted changes - prompt user first
          setFlowState(prev => ({
            ...prev,
            preStartStep: { type: 'uncommitted-changes', existingState, gitStatus },
            existingFlowState: existingState,
            worktreePath: existingState.metadata.worktreePath ?? null,
            resolvedFeatureName: existingState.metadata.resolvedFeatureName ?? null,
            artifacts: existingArtifacts.length > 0 ? existingArtifacts : prev.artifacts,
            history: existingHistory.length > 0 ? existingHistory : prev.history,
            completedTasks: [...completedTasks],
            totalTasks,
            maxContextPercent: existingState.maxContextPercent ?? prev.maxContextPercent
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
          artifacts: existingArtifacts.length > 0 ? existingArtifacts : prev.artifacts,
          history: existingHistory.length > 0 ? existingHistory : prev.history,
          completedTasks: [...completedTasks],
          totalTasks,
          maxContextPercent: existingState.maxContextPercent ?? prev.maxContextPercent
        }));
        addOutput(`Found existing flow at phase: ${existingState.phase.type}`);
        if (completedTasks.length > 0) {
          addOutput(`Completed tasks: ${completedTasks.join(', ')}`);
        }
        return;
      }

      // No existing flow - proceed with fresh start
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

  // Handle completed/aborted flow decision (restart vs cancel)
  const handleCompletedFlowDecision = useCallback(async (decision: string) => {
    if (decision === 'restart') {
      // Archive the existing state and start fresh
      const effectiveName = flowState.resolvedFeatureName ?? sanitizeFeatureName(featureName);
      await services.stateStore.archive(effectiveName);
      setFlowState(prev => ({
        ...prev,
        preStartStep: { type: 'ready' },
        existingFlowState: null,
        artifacts: [],
        history: []
      }));
      addOutput('Previous state archived. Starting fresh flow...');
      await startFreshFlow();
    } else if (decision === 'abort') {
      exit();
    }
  }, [exit, flowState.resolvedFeatureName, featureName]);

  // Handle completion next step (push or exit)
  const handleCompletionNextStep = useCallback(async (step: string) => {
    if (step === 'push') {
      const branchName = `feature/${sanitizeFeatureName(featureName)}`;
      const workDir = flowState.worktreePath ?? repoPath;
      addOutput(`Pushing ${branchName} to origin...`);

      const result = await pushBranch(branchName, workDir);
      if (result.success) {
        addOutput('Branch pushed successfully!');
        addOutput('');
        addOutput('Next steps:');
        addOutput('  1. Create a Pull Request on GitHub');
        addOutput('  2. Review and merge the PR');
        addOutput('  3. Pull changes back to main');
      } else {
        addOutput(`Push failed: ${result.error}`);
      }
    } else if (step === 'exit') {
      exit();
    }
  }, [exit, featureName, flowState.worktreePath, repoPath, addOutput]);

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
    // Read from ref to avoid stale closure issue
    const existingState = existingFlowStateRef.current;
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
    const agentName = agentRef.current === 'gemini' ? 'Gemini' : agentRef.current === 'codex' ? 'Codex' : 'Claude';
    addOutput(`Checking ${agentName} API status...`);
    const healthResult = await services.healthCheck.check({
      tier: flags.tier,
      sandbox: flags.sandbox,
      timeoutMs: 30000,
      agent: agentRef.current,
      ollama: flags.ollama,
      model: flags.model,
      sandboxImage: sandboxImageRef.current
    });

    setFlowState(prev => ({ ...prev, isHealthChecking: false }));

    // Guard against undefined result (can happen if component unmounts during check)
    if (!healthResult) {
      return;
    }

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

    // Run project tests (unless skipped)
    if (!flags['skip-tests']) {
      addOutput('');
      addOutput('Checking project tests...');

      // Load config to get test command
      const config = await services.configService.load(workDir);
      let setupCommand = config?.setupCommand;
      let testCommand = config?.testCommand;

      // If no stored command, try to detect
      if (!testCommand) {
        const detection = await services.projectDetector.detect(workDir);
        setupCommand = detection.setupCommand ?? undefined;
        testCommand = detection.testCommand ?? undefined;
      }

      if (testCommand) {
        const fullCommand = setupCommand ? `${setupCommand} && ${testCommand}` : testCommand;
        addOutput(`Running: ${fullCommand}`);
        const testResult = await services.testRunner.run({
          setupCommand,
          testCommand,
          workingDir: workDir,
          timeoutMs: 300000
        });

        if (!testResult.success) {
          const initialErrorMsg = testResult.timedOut
            ? 'Tests timed out'
            : `Tests failed (exit code: ${testResult.exitCode})`;
          await logToFile(`Test check failed: ${initialErrorMsg}`);

          // Log test output to help diagnose failures
          if (testResult.stdout) {
            await logToFile('--- stdout ---');
            await logToFile(testResult.stdout);
          }
          if (testResult.stderr) {
            await logToFile('--- stderr ---');
            await logToFile(testResult.stderr);
          }

          // Show error preview in terminal (last few meaningful lines)
          const initialErrorOutput = testResult.stderr || testResult.stdout || '';
          const errorLines = initialErrorOutput.split('\n').filter((line: string) => line.trim()).slice(-5);
          if (errorLines.length > 0) {
            addOutput('');
            addOutput('Error output (last 5 lines):');
            for (const line of errorLines) {
              addOutput(`  ${line}`);
            }
          }

          // Attempt to fix tests automatically using fix-tests agent
          const fixResult = await attemptFixTests(
            initialErrorOutput,
            workDir,
            testCommand,
            setupCommand,
            addOutput,
            logToFile
          );

          if (!fixResult.success) {
            // Tests still failing after all fix attempts
            const errorMsg = `Tests failed and could not be automatically fixed`;
            setFlowState(prev => ({
              ...prev,
              error: errorMsg,
              phase: { type: 'error', feature: featureName, error: `${errorMsg}. Check the log file for details, or use --skip-tests to bypass.` }
            }));
            return;
          }
          // Tests fixed successfully, continue with flow
        } else {
          addOutput(`Tests passed (${(testResult.durationMs / 1000).toFixed(1)}s)`);
        }
      } else {
        addOutput('No test command configured, skipping tests');
      }
    }

    // Set up flow machine to the current phase
    const effectiveName = existingState.metadata.resolvedFeatureName ?? sanitizeFeatureName(featureName);
    const savedMode = existingState.metadata.mode;

    // Re-create flow machine initialized at the saved phase and mode
    // This eliminates the need to replay transitions to catch up
    const savedPhase = existingState.phase as unknown as ExtendedFlowPhase;
    servicesRef.current!.flowMachine = createExtendedFlowMachine(savedPhase, savedMode);

    // Update state with existing flow info, restoring persisted artifacts and history
    setFlowState(prev => ({
      ...prev,
      phase: savedPhase,  // Set local state to match saved phase
      worktreePath: existingState.metadata.worktreePath ?? null,
      resolvedFeatureName: effectiveName,
      artifacts: existingState.artifacts ? [...existingState.artifacts] : prev.artifacts,
      history: existingState.history ? [...existingState.history] : prev.history
    }));

    // Resume based on current phase - no need to replay transitions
    await resumeFromPhase(existingState.phase.type, workDir, effectiveName);
  }, [services.healthCheck, services.configService, services.projectDetector, services.testRunner, services.commitService, flags, featureName, repoPath, initLogFile, addOutput]);

  // Resume from a specific phase
  // NOTE: State machine is already initialized at the correct phase by resumeExistingFlow
  // Uses findResumePhase to skip ahead to the furthest phase based on existing artifacts
  const resumeFromPhase = async (phaseType: string, workDir: string, effectiveName: string) => {
    const phaseOrder = mode === 'brownfield' ? BROWNFIELD_PHASE_ORDER : GREENFIELD_PHASE_ORDER;

    // Validate phase - if invalid or 'idle', recover from artifacts
    let needsRecovery = phaseType === 'idle' || !phaseOrder.includes(phaseType);
    let recoveryReason = '';

    if (phaseType === 'idle') {
      needsRecovery = true;
      recoveryReason = 'State corrupted (idle phase)';
    } else if (!phaseOrder.includes(phaseType)) {
      needsRecovery = true;
      recoveryReason = `Unknown phase '${phaseType}'`;
    } else {
      // Phase is valid, but check if artifacts indicate we're further along
      // This catches cases where state was corrupted by stale closure bug
      const artifactPhase = await determinePhaseFromArtifacts(workDir, effectiveName);
      const savedPhaseIdx = phaseOrder.indexOf(phaseType);
      const artifactPhaseIdx = phaseOrder.indexOf(artifactPhase);

      if (artifactPhaseIdx > savedPhaseIdx) {
        needsRecovery = true;
        recoveryReason = `State outdated (saved: ${phaseType}, artifacts indicate: ${artifactPhase})`;
      }
    }

    if (needsRecovery) {
      addOutput(`${recoveryReason}, recovering from artifacts...`);

      // Use artifact-based recovery
      phaseType = await determinePhaseFromArtifacts(workDir, effectiveName);
      addOutput(`Recovered phase: ${phaseType}`);

      // Reinitialize flow machine at the recovered phase
      const recoveredPhase = { type: phaseType } as ExtendedFlowPhase;
      servicesRef.current!.flowMachine = createExtendedFlowMachine(recoveredPhase, mode);

      // Update React state so UI reflects the recovered phase
      setFlowState(prev => ({ ...prev, phase: recoveredPhase }));
    }

    // Find the furthest phase we can skip to based on existing artifacts
    const targetPhase = await findResumePhase(phaseType, workDir, effectiveName);

    // If we can skip ahead, transition to the target phase
    if (targetPhase !== phaseType) {
      addOutput(`Skipping to ${targetPhase} - artifacts already exist`);

      // Load all skipped artifacts for display
      const phaseOrder = mode === 'brownfield' ? BROWNFIELD_PHASE_ORDER : GREENFIELD_PHASE_ORDER;
      const startIdx = phaseOrder.indexOf(phaseType);
      const endIdx = phaseOrder.indexOf(targetPhase);

      for (let i = startIdx; i < endIdx; i++) {
        const phase = phaseOrder[i];
        const artifactFile = PHASE_ARTIFACTS[phase];
        if (artifactFile) {
          addArtifact({
            name: artifactFile.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            filename: artifactFile,
            path: `.red64/specs/${effectiveName}/${artifactFile}`,
            phase,
            createdAt: new Date().toISOString()
          });
        }
      }

      // Transition through phases to reach target
      let currentPhase = services.flowMachine.getPhase();
      while (currentPhase.type !== targetPhase && currentPhase.type !== 'complete' && currentPhase.type !== 'error') {
        currentPhase = transitionPhase({ type: 'PHASE_COMPLETE' });
      }
      await saveFlowState(currentPhase, workDir, { event: 'SKIP_TO_PHASE', subStep: `skipped-to-${targetPhase}` });
    } else {
      addOutput(`Continuing from ${phaseType}...`);
    }

    // Now handle the target phase
    switch (targetPhase) {
      // === APPROVAL PHASES ===
      // State machine at correct phase, UI will show approval controls
      case 'requirements-approval':
      case 'gap-review':
      case 'design-approval':
      case 'design-validation-review':
        // Nothing to do - UI will show approval controls
        break;

      case 'tasks-approval':
        // Load tasks for display
        {
          const specDir = join(workDir, '.red64', 'specs', effectiveName);
          const tasks = await services.taskParser.parse(specDir);
          setFlowState(prev => ({
            ...prev,
            tasks,
            totalTasks: tasks.length
          }));
        }
        break;

      // === GENERATING PHASES ===
      case 'requirements-generating':
        await runRequirementsPhase(workDir, effectiveName);
        break;

      case 'gap-analysis':
        // Run gap analysis
        {
          addOutput('Running gap analysis...');
          const gapPhaseMetric = startPhaseMetric('gap-analysis');
          const gapResult = await executeCommand(`/red64:validate-gap ${effectiveName} -y`, workDir);
          const completedGapMetric = completePhaseMetric(gapPhaseMetric, gapResult.tokenUsage);
          setFlowState(prev => ({
            ...prev,
            phaseMetrics: { ...prev.phaseMetrics, 'gap-analysis': completedGapMetric }
          }));
          if (gapResult.success) {
            await commitChanges(`gap analysis`, workDir);
            addArtifact({
              name: 'Gap Analysis',
              filename: 'gap-analysis.md',
              path: `.red64/specs/${effectiveName}/gap-analysis.md`,
              phase: 'gap-analysis',
              createdAt: new Date().toISOString()
            });
          }
          const gapCompletePhase = transitionPhase({ type: 'PHASE_COMPLETE' });
          await saveFlowState(gapCompletePhase, workDir, { event: 'PHASE_COMPLETE', subStep: 'gap-analysis-completed' });
        }
        break;

      case 'design-generating':
        await runDesignPhase(workDir);
        break;

      case 'design-validation':
        // Run design validation
        {
          addOutput('Validating design...');
          const valPhaseMetric = startPhaseMetric('design-validation');
          const valResult = await executeCommand(`/red64:validate-design ${effectiveName} -y`, workDir);
          const completedValMetric = completePhaseMetric(valPhaseMetric, valResult.tokenUsage);
          setFlowState(prev => ({
            ...prev,
            phaseMetrics: { ...prev.phaseMetrics, 'design-validation': completedValMetric }
          }));
          if (valResult.success) {
            await commitChanges(`design validation`, workDir);
          }
          const validationCompletePhase = transitionPhase({ type: 'PHASE_COMPLETE' });
          await saveFlowState(validationCompletePhase, workDir, { event: 'PHASE_COMPLETE', subStep: 'design-validation-completed' });
        }
        break;

      case 'tasks-generating':
        await runTasksPhase(workDir);
        break;

      // === IMPLEMENTATION PHASE ===
      case 'implementing':
        // Resume implementation - use state.json.completedTasks as source of truth
        {
          const implSpecDir = join(workDir, '.red64', 'specs', effectiveName);
          const implTasks = await services.taskParser.parse(implSpecDir);

          // Use state.json.completedTasks as source of truth (already loaded by resumeExistingFlow)
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

      // === LEGACY PHASE NAMES ===
      // Handle old state.json files that might have legacy names (before migration)
      case 'requirements-review':
        // Legacy name for requirements-approval
        break;

      case 'design-review':
        // Legacy name for design-approval
        break;

      case 'tasks-review':
        // Legacy name for tasks-approval - load tasks
        {
          const specDir = join(workDir, '.red64', 'specs', effectiveName);
          const tasks = await services.taskParser.parse(specDir);
          setFlowState(prev => ({
            ...prev,
            tasks,
            totalTasks: tasks.length
          }));
        }
        break;

      default:
        // For other phases (complete, error, etc.), log and do nothing
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
    const agentName = agentRef.current === 'gemini' ? 'Gemini' : agentRef.current === 'codex' ? 'Codex' : 'Claude';
    addOutput(`Checking ${agentName} API status...`);
    setFlowState(prev => ({ ...prev, isHealthChecking: true }));

    const healthResult = await services.healthCheck.check({
      tier: flags.tier,
      sandbox: flags.sandbox,
      timeoutMs: 30000,
      agent: agentRef.current,
      ollama: flags.ollama,
      model: flags.model,
      sandboxImage: sandboxImageRef.current
    });

    setFlowState(prev => ({ ...prev, isHealthChecking: false }));

    // Guard against undefined result (can happen if component unmounts during check)
    if (!healthResult) {
      return;
    }

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

    // Run project tests (unless skipped)
    if (!flags['skip-tests']) {
      addOutput('');
      addOutput('Checking project tests...');

      // Load config to get test command
      const config = await services.configService.load(repoPath);
      let setupCommand = config?.setupCommand;
      let testCommand = config?.testCommand;

      // If no stored command, try to detect
      if (!testCommand) {
        const detection = await services.projectDetector.detect(repoPath);
        setupCommand = detection.setupCommand ?? undefined;
        testCommand = detection.testCommand ?? undefined;
      }

      if (testCommand) {
        const fullCommand = setupCommand ? `${setupCommand} && ${testCommand}` : testCommand;
        addOutput(`Running: ${fullCommand}`);
        const testResult = await services.testRunner.run({
          setupCommand,
          testCommand,
          workingDir: repoPath,
          timeoutMs: 300000
        });

        if (!testResult.success) {
          const initialErrorMsg = testResult.timedOut
            ? 'Tests timed out'
            : `Tests failed (exit code: ${testResult.exitCode})`;
          await logToFile(`Test check failed: ${initialErrorMsg}`);

          // Log test output to help diagnose failures
          if (testResult.stdout) {
            await logToFile('--- stdout ---');
            await logToFile(testResult.stdout);
          }
          if (testResult.stderr) {
            await logToFile('--- stderr ---');
            await logToFile(testResult.stderr);
          }

          // Show error preview in terminal (last few meaningful lines)
          const initialErrorOutput = testResult.stderr || testResult.stdout || '';
          const errorLines = initialErrorOutput.split('\n').filter((line: string) => line.trim()).slice(-5);
          if (errorLines.length > 0) {
            addOutput('');
            addOutput('Error output (last 5 lines):');
            for (const line of errorLines) {
              addOutput(`  ${line}`);
            }
          }

          // Attempt to fix tests automatically using fix-tests agent
          const fixResult = await attemptFixTests(
            initialErrorOutput,
            repoPath,
            testCommand,
            setupCommand,
            addOutput,
            logToFile
          );

          if (!fixResult.success) {
            // Tests still failing after all fix attempts
            const errorMsg = `Tests failed and could not be automatically fixed`;
            setFlowState(prev => ({
              ...prev,
              error: errorMsg,
              phase: { type: 'error', feature: featureName, error: `${errorMsg}. Check the log file for details, or use --skip-tests to bypass.` }
            }));
            return;
          }
          // Tests fixed successfully, continue with flow
        } else {
          addOutput(`Tests passed (${(testResult.durationMs / 1000).toFixed(1)}s)`);
        }
      } else {
        addOutput('No test command configured, skipping tests');
      }
    }

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

    // Track spec.json artifact
    addArtifact({
      name: 'Spec Config',
      filename: 'spec.json',
      path: `.red64/specs/${initResult.featureName}/spec.json`,
      phase: 'initializing',
      createdAt: new Date().toISOString()
    });

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

    // Start tracking phase metrics
    const phaseMetric = startPhaseMetric('requirements-generating');

    const result = await executeCommand(`/red64:spec-requirements ${effectiveName} -y`, workDir);

    // Complete phase metric with cost data
    const completedMetric = completePhaseMetric(phaseMetric, result.tokenUsage);
    setFlowState(prev => ({
      ...prev,
      phaseMetrics: { ...prev.phaseMetrics, 'requirements-generating': completedMetric }
    }));

    if (!result.success) {
      transitionPhase({ type: 'ERROR', error: result.error ?? 'Requirements generation failed' });
      return;
    }

    // Validate that requirements were actually written (not just template)
    const reqPath = join(workDir, `.red64/specs/${effectiveName}/requirements.md`);
    try {
      const reqStat = await stat(reqPath);
      if (reqStat.size < 500) {
        // Template is ~160 bytes; real requirements are much larger
        transitionPhase({ type: 'ERROR', error: 'Requirements agent did not generate content. Ensure a project description is provided.' });
        return;
      }
    } catch {
      transitionPhase({ type: 'ERROR', error: 'Requirements file was not created by agent.' });
      return;
    }

    // Commit requirements
    await commitChanges(`generate requirements`, workDir);

    // Track requirements artifact
    addArtifact({
      name: 'Requirements',
      filename: 'requirements.md',
      path: `.red64/specs/${effectiveName}/requirements.md`,
      phase: 'requirements-generating',
      createdAt: new Date().toISOString()
    });

    // Transition to approval
    const approvalPhase = transitionPhase({ type: 'PHASE_COMPLETE' });
    await saveFlowState(approvalPhase, workDir);
  };

  // Run design phase
  const runDesignPhase = async (workDir: string) => {
    const effectiveName = flowState.resolvedFeatureName ?? sanitizeFeatureName(featureName);

    addOutput('');
    addOutput('Generating technical design...');

    // Start tracking phase metrics
    const phaseMetric = startPhaseMetric('design-generating');

    const result = await executeCommand(`/red64:spec-design ${effectiveName} -y`, workDir);

    // Complete phase metric with cost data
    const completedMetric = completePhaseMetric(phaseMetric, result.tokenUsage);
    setFlowState(prev => ({
      ...prev,
      phaseMetrics: { ...prev.phaseMetrics, 'design-generating': completedMetric }
    }));

    if (!result.success) {
      transitionPhase({ type: 'ERROR', error: result.error ?? 'Design generation failed' });
      return;
    }

    // Validate that design.md was actually created
    const designPath = join(workDir, `.red64/specs/${effectiveName}/design.md`);
    try {
      await stat(designPath);
    } catch {
      transitionPhase({ type: 'ERROR', error: 'Design file was not created by agent. Check that requirements were properly generated.' });
      return;
    }

    // Commit design
    await commitChanges(`generate technical design`, workDir);

    // Track design artifact
    addArtifact({
      name: 'Design',
      filename: 'design.md',
      path: `.red64/specs/${effectiveName}/design.md`,
      phase: 'design-generating',
      createdAt: new Date().toISOString()
    });

    // Transition to approval
    const approvalPhase = transitionPhase({ type: 'PHASE_COMPLETE' });
    await saveFlowState(approvalPhase, workDir);
  };

  // Run tasks phase
  const runTasksPhase = async (workDir: string) => {
    const effectiveName = flowState.resolvedFeatureName ?? sanitizeFeatureName(featureName);

    addOutput('');
    addOutput('Generating implementation tasks...');

    // Start tracking phase metrics
    const phaseMetric = startPhaseMetric('tasks-generating');

    const result = await executeCommand(`/red64:spec-tasks ${effectiveName} -y`, workDir);

    // Complete phase metric with cost data
    const completedMetric = completePhaseMetric(phaseMetric, result.tokenUsage);
    setFlowState(prev => ({
      ...prev,
      phaseMetrics: { ...prev.phaseMetrics, 'tasks-generating': completedMetric }
    }));

    if (!result.success) {
      transitionPhase({ type: 'ERROR', error: result.error ?? 'Tasks generation failed' });
      return;
    }

    // Validate that tasks.md was actually created
    const tasksPath = join(workDir, `.red64/specs/${effectiveName}/tasks.md`);
    try {
      await stat(tasksPath);
    } catch {
      transitionPhase({ type: 'ERROR', error: 'Tasks file was not created by agent. Check that design was properly generated.' });
      return;
    }

    // Commit tasks
    await commitChanges(`generate implementation tasks`, workDir);

    // Track tasks artifact
    addArtifact({
      name: 'Tasks',
      filename: 'tasks.md',
      path: `.red64/specs/${effectiveName}/tasks.md`,
      phase: 'tasks-generating',
      createdAt: new Date().toISOString()
    });

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
  // Uses taskEntries for robust tracking with start/complete timestamps
  const runImplementation = async (workDir: string) => {
    const effectiveName = flowState.resolvedFeatureName ?? sanitizeFeatureName(featureName);
    const specDir = join(workDir, '.red64', 'specs', effectiveName);

    // Parse tasks directly from file - don't rely on flowState.tasks which may be stale
    // due to React's async state batching
    const tasks = await services.taskParser.parse(specDir);

    // Load existing state to get taskEntries if resuming
    const stateStore = createStateStore(workDir);
    const existingState = await stateStore.load(featureName);
    const existingTaskEntries = existingState?.taskProgress?.taskEntries;

    // Start tracking implementation phase metrics (or resume from existing)
    let implPhaseMetric = existingState?.phaseMetrics?.['implementing']
      ?? startPhaseMetric('implementing');

    // Initialize or resume taskEntries
    // If we have existing entries, use them (for resume)
    // Otherwise, create new entries from parsed tasks
    let taskEntries: TaskEntry[] = existingTaskEntries
      ? [...existingTaskEntries]
      : tasks.map(t => createTaskEntry(t.id, t.title));

    // Merge any new tasks that weren't in existing entries (edge case: tasks added after resume)
    const existingIds = new Set(taskEntries.map(e => e.id));
    for (const task of tasks) {
      if (!existingIds.has(task.id)) {
        taskEntries.push(createTaskEntry(task.id, task.title));
      }
    }

    // Update state with fresh tasks (for UI display), restore maxContextPercent from existing state
    setFlowState(prev => ({
      ...prev,
      tasks,
      totalTasks: tasks.length,
      maxContextPercent: Math.max(prev.maxContextPercent, existingState?.maxContextPercent ?? 0)
    }));

    // Find the task to resume: either in_progress (interrupted) or first pending
    const resumeTask = getResumeTask(taskEntries);

    if (!resumeTask) {
      addOutput('No tasks to implement');
      transitionPhase({ type: 'PHASE_COMPLETE' });
      await completeFlow(workDir);
      return;
    }

    // Count completed and pending
    const completedCount = taskEntries.filter(e => e.status === 'completed').length;
    const pendingCount = taskEntries.filter(e => e.status === 'pending' || e.status === 'in_progress').length;

    addOutput('');
    addOutput('Starting implementation...');
    addOutput(`Total tasks: ${tasks.length}, Pending: ${pendingCount}`);
    if (completedCount > 0) {
      const completedIds = taskEntries.filter(e => e.status === 'completed').map(e => e.id);
      addOutput(`Already completed: ${completedIds.join(', ')}`);
    }

    // Check if resuming an in_progress task
    if (resumeTask.status === 'in_progress') {
      addOutput(`Resuming interrupted task: ${resumeTask.id}`);
    }
    addOutput('');

    // Execute tasks - either grouped by task-level or individually
    if (flags['task-level']) {
      // GROUPED EXECUTION MODE: Execute all sub-tasks in a task group together
      const taskGroups = services.taskParser.groupTasks(tasks);
      let groupsProcessed = 0;

      for (const group of taskGroups) {
        // Get pending/in_progress entries for this group's sub-tasks
        const pendingInGroup = taskEntries.filter(e =>
          group.tasks.some(t => t.id === e.id) &&
          (e.status === 'pending' || e.status === 'in_progress')
        );

        // Skip fully completed groups
        if (pendingInGroup.length === 0) {
          groupsProcessed++;
          continue;
        }

        // Mark all pending as in_progress BEFORE execution
        for (const entry of pendingInGroup) {
          const idx = taskEntries.findIndex(e => e.id === entry.id);
          if (taskEntries[idx].status !== 'in_progress') {
            taskEntries[idx] = markTaskStarted(taskEntries[idx]);
          }
        }
        await saveFlowState(services.flowMachine.getPhase(), workDir, {
          taskEntries,
          currentTaskId: pendingInGroup[0].id,
          event: 'TASK_START',
          subStep: `group-${group.groupId}-started`
        });

        const taskIds = pendingInGroup.map(e => e.id).join(',');
        addOutput(`[Group ${group.groupId}/${taskGroups.length}] ${group.title} (${pendingInGroup.length} sub-tasks: ${taskIds})`);

        // Execute spec-impl with comma-separated IDs
        const result = await executeCommand(
          `/red64:spec-impl ${effectiveName} ${taskIds} -y`,
          workDir
        );

        if (!result.success) {
          addOutput(`Task group ${group.groupId} failed: ${result.error}`);
          // Mark all as failed
          for (const entry of pendingInGroup) {
            const idx = taskEntries.findIndex(e => e.id === entry.id);
            taskEntries[idx] = markTaskFailed(taskEntries[idx]);
          }
          await saveFlowState(services.flowMachine.getPhase(), workDir, {
            taskEntries,
            currentTaskId: null,
            event: 'TASK_FAILED',
            subStep: `group-${group.groupId}-failed`
          });

          // Check for critical infrastructure errors
          if (isCriticalError(result.claudeError) || isCriticalErrorMessage(result.error)) {
            addOutput('');
            addOutput('Critical error detected - aborting flow');
            const errorMsg = result.claudeError?.suggestion ?? result.error ?? 'Infrastructure error';
            setFlowState(prev => ({ ...prev, error: errorMsg }));
            return;
          }
          continue;
        }

        // Mark all tasks in group complete in tasks.md
        for (const entry of pendingInGroup) {
          const markResult = await services.taskParser.markTaskComplete(specDir, entry.id);
          if (!markResult.success) {
            addOutput(`Warning: Failed to mark task ${entry.id} in tasks.md: ${markResult.error}`);
          }
        }

        // Calculate context usage (attribute to first task in group)
        const contextUsage = result.tokenUsage
          ? services.contextUsageCalculator.calculate(
              result.tokenUsage,
              flags.model,
              taskEntries.filter(e => e.status === 'completed')
            )
          : undefined;

        // Mark all TaskEntries as completed (first gets usage, rest get none)
        for (let j = 0; j < pendingInGroup.length; j++) {
          const entry = pendingInGroup[j];
          const idx = taskEntries.findIndex(e => e.id === entry.id);
          if (j === 0) {
            taskEntries[idx] = markTaskCompleted(taskEntries[idx], result.tokenUsage, contextUsage);
          } else {
            taskEntries[idx] = markTaskCompleted(taskEntries[idx]);
          }
        }

        // Accumulate implementation phase costs
        implPhaseMetric = accumulatePhaseMetric(implPhaseMetric, result.tokenUsage);

        // Update React state for UI
        const completedTaskIds = taskEntries.filter(e => e.status === 'completed').map(e => e.id);
        const currentUtilization = contextUsage?.utilizationPercent ?? 0;
        setFlowState(prev => ({
          ...prev,
          completedTasks: completedTaskIds,
          taskEntries: [...taskEntries],
          phaseMetrics: { ...prev.phaseMetrics, 'implementing': implPhaseMetric },
          maxContextPercent: Math.max(prev.maxContextPercent, currentUtilization)
        }));

        // Save state immediately
        await saveFlowState(services.flowMachine.getPhase(), workDir, {
          completedTasksOverride: completedTaskIds,
          taskEntries,
          currentTaskId: null,
          event: 'TASK_COMPLETE',
          subStep: `group-${group.groupId}-completed`
        });

        // One commit per group
        await commitChanges(
          services.commitService.formatGroupCommitMessage(effectiveName, group.groupId, group.title),
          workDir
        );

        addOutput(`Task group ${group.groupId} completed`);
        addOutput('');
        groupsProcessed++;
      }
    } else {
      // INDIVIDUAL EXECUTION MODE: Execute each task separately (default)
      const resumeIndex = taskEntries.findIndex(e => e.id === resumeTask.id);
      for (let i = resumeIndex; i < taskEntries.length; i++) {
        const entry = taskEntries[i];

        // Skip already completed tasks
        if (entry.status === 'completed') {
          continue;
        }

        const task = tasks.find(t => t.id === entry.id);
        if (!task) {
          addOutput(`Warning: Task ${entry.id} not found in tasks.md, skipping`);
          continue;
        }

        const overallIndex = tasks.findIndex(t => t.id === task.id);
        const taskNum = overallIndex + 1;

        setFlowState(prev => ({ ...prev, currentTask: taskNum }));

        // 1. Mark task as in_progress BEFORE execution (for crash recovery)
        if (entry.status !== 'in_progress') {
          taskEntries[i] = markTaskStarted(entry);
          await saveFlowState(services.flowMachine.getPhase(), workDir, {
            taskEntries,
            currentTaskId: task.id,
            event: 'TASK_START',
            subStep: `task-${task.id}-started`
          });
        }

        addOutput(`[${completedCount + (i - resumeIndex) + 1}/${tasks.length}] Task ${task.id}: ${task.title}`);

        // 2. Run spec-impl for this specific task
        const result = await executeCommand(
          `/red64:spec-impl ${effectiveName} ${task.id} -y`,
          workDir
        );

        if (!result.success) {
          addOutput(`Task ${task.id} failed: ${result.error}`);
          // Mark as failed and save progress
          taskEntries[i] = markTaskFailed(taskEntries[i]);
          await saveFlowState(services.flowMachine.getPhase(), workDir, {
            taskEntries,
            currentTaskId: null,
            event: 'TASK_FAILED',
            subStep: `task-${task.id}-failed`
          });

          // Check for critical infrastructure errors that should abort the flow
          if (isCriticalError(result.claudeError) || isCriticalErrorMessage(result.error)) {
            addOutput('');
            addOutput('Critical error detected - aborting flow');
            const errorMsg = result.claudeError?.suggestion ?? result.error ?? 'Infrastructure error';
            setFlowState(prev => ({ ...prev, error: errorMsg }));
            return; // Abort the entire task loop
          }

          // Continue to next task for non-critical failures
          continue;
        }

        // 3. Mark task complete in tasks.md
        const markResult = await services.taskParser.markTaskComplete(specDir, task.id);
        if (!markResult.success) {
          addOutput(`Warning: Failed to mark task ${task.id} in tasks.md: ${markResult.error}`);
        }

        // 4. Calculate context usage if token usage is available
        const contextUsage = result.tokenUsage
          ? services.contextUsageCalculator.calculate(
              result.tokenUsage,
              flags.model,
              taskEntries.filter(e => e.status === 'completed')
            )
          : undefined;

        // 5. Mark task as completed with timestamp and usage metrics
        taskEntries[i] = markTaskCompleted(taskEntries[i], result.tokenUsage, contextUsage);

        // 5b. Accumulate implementation phase costs
        implPhaseMetric = accumulatePhaseMetric(implPhaseMetric, result.tokenUsage);

        // 6. Update React state for UI (including taskEntries for usage graph)
        const completedTaskIds = taskEntries.filter(e => e.status === 'completed').map(e => e.id);
        const currentUtilization = contextUsage?.utilizationPercent ?? 0;
        setFlowState(prev => ({
          ...prev,
          completedTasks: completedTaskIds,
          taskEntries: [...taskEntries],
          phaseMetrics: { ...prev.phaseMetrics, 'implementing': implPhaseMetric },
          maxContextPercent: Math.max(prev.maxContextPercent, currentUtilization)
        }));

        // 7. Save state immediately (before commit, for crash recovery)
        await saveFlowState(services.flowMachine.getPhase(), workDir, {
          completedTasksOverride: completedTaskIds,
          taskEntries,
          currentTaskId: null,
          event: 'TASK_COMPLETE',
          subStep: `task-${task.id}-completed`
        });

        // 8. Commit both tasks.md and state.json together
        await commitChanges(
          services.commitService.formatTaskCommitMessage(effectiveName, taskNum, task.title),
          workDir
        );

        addOutput(`Task ${task.id} completed`);
        addOutput('');
      }
    }

    // All tasks iterated - finalize implementation phase metrics
    const completedImplMetric = completePhaseMetric(implPhaseMetric, undefined);
    setFlowState(prev => ({
      ...prev,
      phaseMetrics: { ...prev.phaseMetrics, 'implementing': completedImplMetric }
    }));

    // Check if any tasks failed
    const failedTasks = taskEntries.filter(e => e.status === 'failed');
    const completedTasks = taskEntries.filter(e => e.status === 'completed');

    if (failedTasks.length > 0) {
      addOutput('');
      addOutput(`Flow finished with errors: ${failedTasks.length} task(s) failed, ${completedTasks.length} completed`);
      addOutput(`Worktree: ${flowState.worktreePath ?? 'none'}`);
      addOutput(`Branch: feature/${sanitizeFeatureName(featureName)}`);
      addOutput('');
      addOutput('Failed tasks:');
      for (const entry of failedTasks) {
        const task = tasks.find(t => t.id === entry.id);
        addOutput(`  - ${entry.id}: ${task?.title ?? 'Unknown task'}`);
      }
      addOutput('');
      addOutput('Run "red64 start" to resume from the first failed task');
      return;
    }

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

  // Handle artifact preview
  const handleArtifactPreview = useCallback(async (artifact: Artifact) => {
    addOutput(`Opening preview: ${artifact.name}...`);

    // Resolve relative artifact path to absolute path using worktree
    const workDir = getWorkingDir();
    const resolvedArtifact: Artifact = {
      ...artifact,
      path: artifact.path.startsWith('/') ? artifact.path : join(workDir, artifact.path)
    };

    const result = await services.previewService.previewArtifact(resolvedArtifact);

    if (result.success) {
      addOutput(`Preview opened at: ${result.url}`);
    } else {
      // Display error based on error code
      const { error } = result;
      switch (error.code) {
        case 'FILE_NOT_FOUND':
          addOutput(`Error: Artifact not found: ${artifact.path}`);
          break;
        case 'FILE_READ_ERROR':
          addOutput(`Error: Cannot read artifact: ${artifact.path}. Check permissions.`);
          break;
        case 'PORT_UNAVAILABLE':
          addOutput('Error: Cannot start preview server. All ports busy.');
          break;
        case 'BROWSER_LAUNCH_ERROR':
          addOutput(`Error: Cannot open browser. Preview available at: ${error.details ?? ''}`);
          break;
        default:
          addOutput(`Error: ${error.message}`);
      }
    }
  }, [services.previewService, addOutput, getWorkingDir]);

  // Handle approval decision
  const handleApproval = useCallback(async (decision: string) => {
    const workDir = getWorkingDir();
    const effectiveName = flowState.resolvedFeatureName ?? sanitizeFeatureName(featureName);

    if (decision === 'approve') {
      let nextPhase = transitionPhase({ type: 'APPROVE' });
      await saveFlowState(nextPhase, workDir);

      // Find the furthest phase we can skip to based on existing artifacts
      const targetPhase = await findResumePhase(nextPhase.type, workDir, effectiveName);

      // If we can skip ahead, transition to the target phase
      if (targetPhase !== nextPhase.type) {
        addOutput(`Skipping to ${targetPhase} - artifacts already exist`);

        // Load all skipped artifacts for display
        const phaseOrder = mode === 'brownfield' ? BROWNFIELD_PHASE_ORDER : GREENFIELD_PHASE_ORDER;
        const startIdx = phaseOrder.indexOf(nextPhase.type);
        const endIdx = phaseOrder.indexOf(targetPhase);

        for (let i = startIdx; i < endIdx; i++) {
          const phase = phaseOrder[i];
          const artifactFile = PHASE_ARTIFACTS[phase];
          if (artifactFile) {
            addArtifact({
              name: artifactFile.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
              filename: artifactFile,
              path: `.red64/specs/${effectiveName}/${artifactFile}`,
              phase,
              createdAt: new Date().toISOString()
            });
          }
        }

        // Transition through phases to reach target
        while (nextPhase.type !== targetPhase && nextPhase.type !== 'complete' && nextPhase.type !== 'error') {
          nextPhase = transitionPhase({ type: 'PHASE_COMPLETE' });
        }
        await saveFlowState(nextPhase, workDir);
      }

      // Now handle the target phase
      switch (nextPhase.type) {
        case 'design-generating':
          await runDesignPhase(workDir);
          break;
        case 'tasks-generating':
          await runTasksPhase(workDir);
          break;
        case 'tasks-approval':
          // Load tasks for display when skipping to tasks-approval
          {
            const specDir = join(workDir, '.red64', 'specs', effectiveName);
            const tasks = await services.taskParser.parse(specDir);
            setFlowState(prev => ({ ...prev, tasks, totalTasks: tasks.length }));
          }
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
          {
            addOutput('Running gap analysis...');
            const gapPhaseMetric2 = startPhaseMetric('gap-analysis');
            const gapResult2 = await executeCommand(`/red64:validate-gap ${effectiveName} -y`, workDir);
            const completedGapMetric2 = completePhaseMetric(gapPhaseMetric2, gapResult2.tokenUsage);
            setFlowState(prev => ({
              ...prev,
              phaseMetrics: { ...prev.phaseMetrics, 'gap-analysis': completedGapMetric2 }
            }));
            if (gapResult2.success) {
              await commitChanges(`gap analysis`, workDir);
              addArtifact({
                name: 'Gap Analysis',
                filename: 'gap-analysis.md',
                path: `.red64/specs/${effectiveName}/gap-analysis.md`,
                phase: 'gap-analysis',
                createdAt: new Date().toISOString()
              });
            }
            transitionPhase({ type: 'PHASE_COMPLETE' });
          }
          break;
        case 'design-validation':
          // Brownfield: run design validation
          {
            addOutput('Validating design...');
            const valPhaseMetric2 = startPhaseMetric('design-validation');
            const valResult2 = await executeCommand(`/red64:validate-design ${effectiveName} -y`, workDir);
            const completedValMetric2 = completePhaseMetric(valPhaseMetric2, valResult2.tokenUsage);
            setFlowState(prev => ({
              ...prev,
              phaseMetrics: { ...prev.phaseMetrics, 'design-validation': completedValMetric2 }
            }));
            if (valResult2.success) {
              await commitChanges(`design validation`, workDir);
            }
            transitionPhase({ type: 'PHASE_COMPLETE' });
          }
          break;
        case 'complete':
          await completeFlow(workDir);
          break;
        // Approval phases - UI will show approval controls, nothing to do
        case 'gap-review':
        case 'design-approval':
        case 'design-validation-review':
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

  // Handle Tab key to toggle focus between main panel and sidebar
  useInput((_input, key) => {
    if (key.tab) {
      setSidebarFocused(prev => !prev);
    }
  });

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
          <Box marginTop={1} flexDirection="column">
            <Text bold>Next steps:</Text>
            <Text dimColor>  1. Push the feature branch to origin</Text>
            <Text dimColor>  2. Create a Pull Request on GitHub</Text>
            <Text dimColor>  3. Review, merge, and pull changes to main</Text>
          </Box>
          <Box marginTop={1}>
            <Select
              options={COMPLETION_NEXT_STEPS_OPTIONS}
              onChange={handleCompletionNextStep}
            />
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
              <Box marginTop={1} flexDirection="column">
                <Text color="red" dimColor>This error requires manual intervention before retrying.</Text>
                <Box marginTop={1} flexDirection="column">
                  <Text bold color="cyan">Setup instructions:</Text>
                  {getAgentSetupInstructions(agentRef.current).map((line, i) => (
                    <Text key={i} color="white">{line}</Text>
                  ))}
                </Box>
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
      {/* Left sidebar - Feature status */}
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
          history={flowState.history}
          width={uiConfigRef.current.leftSidebarWidth}
        />
      )}

      {/* Main content area */}
      <Box flexDirection="column" flexGrow={1} marginLeft={showSidebar ? 1 : 0}>
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
            <Spinner label={`Checking ${agentRef.current === 'gemini' ? 'Gemini' : agentRef.current === 'codex' ? 'Codex' : 'Claude'} API status...`} />
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
          <Box flexDirection="column" borderStyle="single" borderColor={sidebarFocused ? 'gray' : 'yellow'} paddingX={1}>
            <Text bold color="yellow">Existing Flow Detected</Text>
            <Text dimColor>Phase: {flowState.preStartStep.existingState.phase.type}</Text>
            <Box marginTop={1}>
              <Select
                options={EXISTING_FLOW_OPTIONS}
                onChange={handleExistingFlowDecision}
                isDisabled={sidebarFocused}
              />
            </Box>
          </Box>
        )}

        {/* Uncommitted changes - prompt commit/discard/abort */}
        {flowState.preStartStep.type === 'uncommitted-changes' && (
          <Box flexDirection="column" borderStyle="single" borderColor={sidebarFocused ? 'gray' : 'yellow'} paddingX={1}>
            <Text bold color="yellow">Uncommitted Changes Detected</Text>
            <Text dimColor>
              {flowState.preStartStep.gitStatus.staged} staged, {flowState.preStartStep.gitStatus.unstaged} unstaged, {flowState.preStartStep.gitStatus.untracked} untracked
            </Text>
            <Box marginTop={1}>
              <Select
                options={UNCOMMITTED_CHANGES_OPTIONS}
                onChange={handleUncommittedChangesDecision}
                isDisabled={sidebarFocused}
              />
            </Box>
          </Box>
        )}

        {/* Completed/aborted flow detected - prompt restart vs cancel */}
        {flowState.preStartStep.type === 'completed-flow-detected' && (
          <Box flexDirection="column" borderStyle="single" borderColor="green" paddingX={1}>
            <Text bold color="green">
              {flowState.preStartStep.existingState.phase.type === 'complete'
                ? 'Flow Already Complete'
                : 'Flow Was Aborted'}
            </Text>
            <Text dimColor>
              Feature: {flowState.preStartStep.existingState.feature}
            </Text>
            <Text dimColor>
              {flowState.preStartStep.existingState.phase.type === 'complete'
                ? 'This feature has been fully implemented.'
                : `Aborted: ${(flowState.preStartStep.existingState.phase as { reason?: string }).reason ?? 'Unknown reason'}`}
            </Text>
            <Box marginTop={1}>
              <Select
                options={COMPLETED_FLOW_OPTIONS}
                onChange={handleCompletedFlowDecision}
              />
            </Box>
          </Box>
        )}

        {/* Approval UI */}
        {isApprovalPhase && !flowState.isExecuting && (
          <Box flexDirection="column" borderStyle="single" borderColor={sidebarFocused ? 'gray' : 'cyan'} paddingX={1}>
            <Text bold>Review Required</Text>
            <Text dimColor>
              Review output in .red64/specs/{flowState.resolvedFeatureName ?? sanitizeFeatureName(featureName)}/
              {PHASE_REVIEW_FILES[flowState.phase.type] ?? ''}
            </Text>
            <Box marginTop={1}>
              <Select
                options={APPROVAL_OPTIONS}
                onChange={handleApproval}
                isDisabled={sidebarFocused}
              />
            </Box>
          </Box>
        )}

        {/* Token/Context usage graph - shown when we have usage data */}
        {(flowState.taskEntries.length > 0 || Object.keys(flowState.phaseMetrics).length > 0) && (
          <TokenUsageGraph
            taskEntries={flowState.taskEntries}
            phaseMetrics={flowState.phaseMetrics}
            maxContextPercent={flowState.maxContextPercent}
          />
        )}
      </Box>

      {/* Right sidebar - Artifacts */}
      {showSidebar && (
        <ArtifactsSidebar
          artifacts={flowState.artifacts}
          worktreePath={flowState.worktreePath}
          onPreview={handleArtifactPreview}
          isActive={sidebarFocused}
          width={uiConfigRef.current.rightSidebarWidth}
        />
      )}
    </Box>
  );
};

