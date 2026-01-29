/**
 * Init wizard types
 * Requirements: 1.1-1.7, 4.1-4.9, 5.1-5.7
 */

import type { ProjectType } from '../../services/ConfigService.js';
import type { FetchProgress } from '../../services/GitHubService.js';
import type { DetectionResult } from '../../services/ProjectDetector.js';
import type { CodingAgent } from '../../types/index.js';

/**
 * Base step props interface
 */
export interface BaseStepProps {
  readonly onNext: () => void;
  readonly onError: (error: InitError) => void;
}

/**
 * Init wizard step discriminated union
 * Task 6.1: Step state management
 */
export type InitStep =
  | { type: 'welcome' }
  | { type: 'checking-existing'; path: string }
  | { type: 'conflict-prompt'; existingPath: string }
  | { type: 'fetching'; progress: FetchProgress }
  | { type: 'extracting' }
  | { type: 'guided-setup'; data: Partial<SetupData> }
  | { type: 'detecting-tests' }
  | { type: 'test-check'; detection: DetectionResult }
  | { type: 'applying-templates' }
  | { type: 'git-setup' }
  | { type: 'steering-prompt' }
  | { type: 'complete'; summary: InitSummary }
  | { type: 'error'; error: InitError };

/**
 * Setup data collected during guided setup
 */
export interface SetupData {
  readonly projectType: ProjectType;
  readonly stack: string;
  readonly projectName: string;
  readonly description: string;
  readonly customValues: Record<string, string>;
}

/**
 * Summary displayed at completion
 */
export interface InitSummary {
  readonly createdDirs: readonly string[];
  readonly appliedStack: string;
  readonly configPath: string;
  readonly steeringFiles: readonly string[];
  readonly gitInitialized?: boolean;
  readonly gitCommitted?: boolean;
  readonly testCommand?: string;
  readonly testsPassed?: boolean;
}

/**
 * Error codes
 */
export type InitErrorCode =
  | 'NETWORK_ERROR'
  | 'PERMISSION_ERROR'
  | 'EXTRACTION_ERROR'
  | 'INVALID_REPO';

/**
 * Init error with recovery information
 */
export interface InitError {
  readonly code: InitErrorCode;
  readonly message: string;
  readonly recoverable: boolean;
  readonly suggestion?: string;
}

/**
 * Conflict resolution options
 */
export type ConflictResolution = 'overwrite' | 'merge' | 'abort';

/**
 * Init command flags
 */
export interface InitFlags {
  readonly repo?: string;
  readonly version?: string;
  readonly stack?: string;
  readonly 'skip-guided'?: boolean;
  readonly 'no-steering'?: boolean;
  readonly 'no-cache'?: boolean;
  readonly 'skip-tests'?: boolean;
  readonly agent?: CodingAgent;
}
