/**
 * InitScreen - Init command wizard orchestrator
 * Requirements: 1.1-1.7, 4.1-4.9, 5.1-5.7
 * Tasks: 6.1, 6.2, 6.3
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useApp } from 'ink';
import { Spinner } from '@inkjs/ui';
import type { ScreenProps } from './ScreenProps.js';
import {
  WelcomeStep,
  FetchStep,
  SetupStep,
  SteeringStep,
  CompleteStep,
  ErrorStep,
  type InitStep,
  type SetupData,
  type InitSummary,
  type InitError,
  type InitFlags
} from '../init/index.js';
import {
  createCacheService,
  createGitHubService,
  createTemplateService,
  createConfigService,
  createCommitService,
  type FetchProgress,
  GitHubFetchError
} from '../../services/index.js';
import { spawn } from 'node:child_process';

const DEFAULT_REPO = 'Red64llc/red64-cli';
const DEFAULT_VERSION = 'main';

// Skip fetch mode - use bundled framework templates for development
// Set to false to download from GitHub
const SKIP_FETCH_MODE = true;

// Get the bundled framework path (for SKIP_FETCH_MODE)
function getBundledFrameworkPath(): string {
  // When running from source: /path/to/red64-cli/framework
  // When running from installed package: /path/to/node_modules/red64-cli/framework
  const modulePath = new URL(import.meta.url).pathname;
  const rootDir = modulePath.includes('/dist/')
    ? modulePath.split('/dist/')[0]
    : modulePath.split('/src/')[0];
  return `${rootDir}/framework`;
}

// Check if directory is a git repository
async function isGitRepo(dir: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('git', ['rev-parse', '--git-dir'], { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] });
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

// Initialize git repository
async function gitInit(dir: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('git', ['init'], { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] });
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

/**
 * InitScreen - Orchestrates the init command multi-step wizard
 * Task 6.1: State management
 * Task 6.2: Service coordination
 * Task 6.3: Step rendering
 */
export const InitScreen: React.FC<ScreenProps> = ({ flags }) => {
  const { exit } = useApp();
  const [step, setStep] = useState<InitStep>({ type: 'welcome' });
  const [setupData, setSetupData] = useState<Partial<SetupData>>({});
  const [availableStacks, setAvailableStacks] = useState<readonly string[]>([]);
  const [steeringFiles, setSteeringFiles] = useState<readonly string[]>([]);
  const [directoryExists, setDirectoryExists] = useState(false);
  const [gitInitialized, setGitInitialized] = useState(false);
  const [gitCommitted, setGitCommitted] = useState(false);
  const [conflictResolution, setConflictResolution] = useState<'overwrite' | 'merge' | null>(null);

  // Extract init-specific flags
  const initFlags: InitFlags = {
    repo: flags.repo,
    version: undefined, // Version flag conflicts with CLI --version
    stack: flags.stack,
    'skip-guided': flags['skip-guided'],
    'no-steering': flags['no-steering'],
    'no-cache': flags['no-cache'],
    agent: flags.agent
  };

  // Services (created once)
  const [services] = useState(() => {
    const cacheService = createCacheService();
    const githubService = createGitHubService({
      defaultRepo: initFlags.repo ?? DEFAULT_REPO,
      defaultVersion: initFlags.version ?? DEFAULT_VERSION,
      cacheService
    });
    const templateService = createTemplateService();
    const configService = createConfigService();
    const commitService = createCommitService();

    return { cacheService, githubService, templateService, configService, commitService };
  });

  // Check for existing directory
  useEffect(() => {
    const checkExisting = async () => {
      const isInitialized = await services.configService.isInitialized(process.cwd());
      setDirectoryExists(isInitialized);
    };
    checkExisting();
  }, [services.configService]);

  // Handle step transitions
  const handleNext = useCallback(() => {
    switch (step.type) {
      case 'welcome':
        setStep({
          type: 'fetching',
          progress: { phase: 'connecting' }
        });
        break;
      case 'fetching':
        setStep({ type: 'extracting' });
        break;
      case 'extracting':
        setStep({
          type: 'guided-setup',
          data: setupData
        });
        break;
      case 'guided-setup':
        setStep({ type: 'applying-templates' });
        break;
      case 'applying-templates':
        if (initFlags['no-steering']) {
          // Skip to complete
          setStep({
            type: 'complete',
            summary: createSummary()
          });
        } else {
          setStep({ type: 'steering-prompt' });
        }
        break;
      case 'steering-prompt':
        setStep({
          type: 'complete',
          summary: createSummary()
        });
        break;
      case 'complete':
        exit();
        break;
    }
  }, [step.type, setupData, initFlags, exit]);

  const handleError = useCallback((error: InitError) => {
    setStep({ type: 'error', error });
  }, []);

  const handleSetupComplete = useCallback((data: SetupData) => {
    setSetupData(data);
  }, []);

  const handleConflictResolution = useCallback((resolution: 'overwrite' | 'merge' | 'abort') => {
    if (resolution !== 'abort') {
      setConflictResolution(resolution);
    }
  }, []);

  // Create summary for complete step
  const createSummary = useCallback((): InitSummary => {
    return {
      createdDirs: [
        '.claude',
        '.red64',
        '.red64/steering',
        '.red64/specs',
        '.red64/settings'
      ],
      appliedStack: setupData.stack ?? 'generic',
      configPath: '.red64/config.json',
      steeringFiles,
      gitInitialized,
      gitCommitted
    };
  }, [setupData.stack, steeringFiles, gitInitialized, gitCommitted]);

  // Use refs to avoid callback dependency issues
  const stepRef = useRef(step);
  stepRef.current = step;

  const setupDataRef = useRef(setupData);
  setupDataRef.current = setupData;

  // Track if fetch has been attempted to prevent re-runs
  const fetchAttemptedRef = useRef(false);
  const extractAttemptedRef = useRef(false);
  const templateAttemptedRef = useRef(false);

  // Fetch framework files when in fetching state
  useEffect(() => {
    if (step.type !== 'fetching') return;
    if (fetchAttemptedRef.current) return;
    fetchAttemptedRef.current = true;

    const fetchFramework = async () => {
      // Skip fetch mode - use bundled framework templates
      if (SKIP_FETCH_MODE) {
        const frameworkPath = getBundledFrameworkPath();
        const stacks = await services.templateService.listStacks(frameworkPath);
        setAvailableStacks(stacks.length > 0 ? stacks : ['generic', 'react', 'node', 'python']);
        setStep({ type: 'extracting' });
        return;
      }

      try {
        const result = await services.githubService.fetchTarball({
          repo: initFlags.repo,
          version: initFlags.version,
          noCache: initFlags['no-cache'],
          onProgress: (progress: FetchProgress) => {
            setStep({ type: 'fetching', progress });
          }
        });

        // List available stacks
        const stacks = await services.templateService.listStacks(result.tarballPath);
        setAvailableStacks(stacks);

        // Transition to next step
        setStep({ type: 'extracting' });
      } catch (error) {
        if (error instanceof GitHubFetchError) {
          setStep({
            type: 'error',
            error: {
              code: 'NETWORK_ERROR',
              message: error.message,
              recoverable: true,
              suggestion: 'Check your network connection or try using cached files.'
            }
          });
        } else {
          setStep({
            type: 'error',
            error: {
              code: 'NETWORK_ERROR',
              message: error instanceof Error ? error.message : 'Unknown error',
              recoverable: false
            }
          });
        }
      }
    };

    fetchFramework();
  }, [step.type, services.githubService, services.templateService, initFlags]);

  // Extract/install framework when in extracting state
  useEffect(() => {
    if (step.type !== 'extracting') return;
    if (extractAttemptedRef.current) return;
    extractAttemptedRef.current = true;

    const installFramework = async () => {
      try {
        const cwd = process.cwd();

        // If overwrite mode, remove existing directories first
        if (conflictResolution === 'overwrite') {
          const { rm } = await import('node:fs/promises');
          try {
            await rm(`${cwd}/.red64`, { recursive: true, force: true });
            await rm(`${cwd}/.claude`, { recursive: true, force: true });
            await rm(`${cwd}/CLAUDE.md`, { force: true });
          } catch {
            // Ignore errors if files don't exist
          }
        }

        // Use bundled framework path in SKIP_FETCH_MODE
        const frameworkPath = SKIP_FETCH_MODE
          ? getBundledFrameworkPath()
          : ''; // TODO: Use extracted tarball location when implemented

        await services.templateService.installFramework({
          sourceDir: frameworkPath,
          targetDir: cwd,
          variables: {}
        });

        setStep({
          type: 'guided-setup',
          data: setupDataRef.current
        });
      } catch (error) {
        setStep({
          type: 'error',
          error: {
            code: 'EXTRACTION_ERROR',
            message: error instanceof Error ? error.message : 'Failed to install framework',
            recoverable: false
          }
        });
      }
    };

    installFramework();
  }, [step.type, services.templateService, conflictResolution]);

  // Apply templates when in applying-templates state
  useEffect(() => {
    if (step.type !== 'applying-templates') return;
    if (templateAttemptedRef.current) return;
    templateAttemptedRef.current = true;

    const applyTemplates = async () => {
      try {
        const currentSetupData = setupDataRef.current;

        // Use bundled framework path in SKIP_FETCH_MODE, otherwise use extracted tarball
        const sourceDir = SKIP_FETCH_MODE
          ? getBundledFrameworkPath()
          : ''; // TODO: Use extracted tarball location when implemented

        const files = await services.templateService.applyStackTemplates({
          sourceDir,
          targetDir: process.cwd(),
          stack: currentSetupData.stack ?? 'generic',
          variables: {
            projectName: currentSetupData.projectName ?? 'my-project',
            description: currentSetupData.description ?? ''
          }
        });

        setSteeringFiles(files);

        // Save configuration
        await services.configService.save(process.cwd(), {
          version: initFlags.version ?? DEFAULT_VERSION,
          repo: initFlags.repo ?? DEFAULT_REPO,
          stack: currentSetupData.stack ?? 'generic',
          projectType: currentSetupData.projectType ?? 'other',
          projectName: currentSetupData.projectName ?? 'my-project',
          description: currentSetupData.description ?? '',
          initializedAt: new Date().toISOString(),
          customValues: currentSetupData.customValues ?? {},
          agent: initFlags.agent ?? 'claude'
        });

        // Transition to git setup
        setStep({ type: 'git-setup' });
      } catch (error) {
        setStep({
          type: 'error',
          error: {
            code: 'EXTRACTION_ERROR',
            message: error instanceof Error ? error.message : 'Failed to apply templates',
            recoverable: false
          }
        });
      }
    };

    applyTemplates();
  }, [step.type, services, initFlags]);

  // Git setup ref
  const gitSetupAttemptedRef = useRef(false);

  // Setup git when in git-setup state
  useEffect(() => {
    if (step.type !== 'git-setup') return;
    if (gitSetupAttemptedRef.current) return;
    gitSetupAttemptedRef.current = true;

    const setupGit = async () => {
      const cwd = process.cwd();
      let initialized = false;
      let committed = false;

      try {
        // Check if already a git repo
        const isRepo = await isGitRepo(cwd);

        if (!isRepo) {
          // Initialize git repository
          const initSuccess = await gitInit(cwd);
          if (initSuccess) {
            initialized = true;
            setGitInitialized(true);
          }
        } else {
          initialized = true;
          setGitInitialized(true);
        }

        // Stage and commit framework files
        if (initialized) {
          const result = await services.commitService.stageAndCommit(
            cwd,
            'chore: initialize red64 framework\n\nAdded .claude/, .red64/, and CLAUDE.md for spec-driven development.'
          );
          if (result.success) {
            committed = true;
            setGitCommitted(true);
          }
        }
      } catch {
        // Git errors are non-fatal, continue to next step
      }

      // Transition to next step
      if (initFlags['no-steering']) {
        setStep({
          type: 'complete',
          summary: {
            createdDirs: ['.claude', '.red64', '.red64/steering', '.red64/specs', '.red64/settings'],
            appliedStack: setupDataRef.current.stack ?? 'generic',
            configPath: '.red64/config.json',
            steeringFiles,
            gitInitialized: initialized,
            gitCommitted: committed
          }
        });
      } else {
        setStep({ type: 'steering-prompt' });
      }
    };

    setupGit();
  }, [step.type, services.commitService, initFlags, steeringFiles]);

  // Render current step
  const renderStep = () => {
    switch (step.type) {
      case 'welcome':
        return (
          <WelcomeStep
            directoryExists={directoryExists}
            onNext={handleNext}
            onError={handleError}
            onConflictResolution={handleConflictResolution}
          />
        );

      case 'checking-existing':
        return (
          <Box flexDirection="column" padding={1}>
            <Spinner label="Checking for existing configuration..." />
          </Box>
        );

      case 'fetching':
        return (
          <FetchStep
            progress={step.progress}
            repo={initFlags.repo ?? DEFAULT_REPO}
            version={initFlags.version ?? DEFAULT_VERSION}
            onNext={handleNext}
            onError={handleError}
          />
        );

      case 'extracting':
        return (
          <Box flexDirection="column" padding={1}>
            <Spinner label="Creating directory structure..." />
          </Box>
        );

      case 'guided-setup':
        return (
          <SetupStep
            availableStacks={availableStacks}
            defaultStack={initFlags.stack}
            skipGuided={initFlags['skip-guided']}
            onNext={handleNext}
            onError={handleError}
            onComplete={handleSetupComplete}
          />
        );

      case 'applying-templates':
        return (
          <Box flexDirection="column" padding={1}>
            <Spinner label="Applying stack templates..." />
          </Box>
        );

      case 'git-setup':
        return (
          <Box flexDirection="column" padding={1}>
            <Spinner label="Setting up git repository..." />
          </Box>
        );

      case 'steering-prompt':
        return (
          <SteeringStep
            steeringFiles={steeringFiles}
            noSteering={initFlags['no-steering']}
            onNext={handleNext}
            onError={handleError}
          />
        );

      case 'complete':
        return <CompleteStep summary={step.summary} />;

      case 'error':
        return (
          <ErrorStep
            error={step.error}
            onRetry={() => setStep({ type: 'fetching', progress: { phase: 'connecting' } })}
            onAbort={() => exit()}
          />
        );

      default:
        return (
          <Box flexDirection="column" padding={1}>
            <Text color="red">Unknown step state</Text>
          </Box>
        );
    }
  };

  return (
    <Box flexDirection="column">
      {renderStep()}
    </Box>
  );
};
