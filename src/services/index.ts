/**
 * Services index
 */

export {
  createFlowMachine,
  transition,
  type FlowMachineService
} from './FlowStateMachine.js';

export {
  createStateStore,
  createTaskEntry,
  markTaskStarted,
  markTaskCompleted,
  markTaskFailed,
  updateTaskEntry,
  getInProgressTask,
  getNextPendingTask,
  getResumeTask,
  type StateStoreService
} from './StateStore.js';

export {
  createAgentInvoker,
  type AgentInvokerService
} from './AgentInvoker.js';

export {
  createPhaseExecutor,
  type PhaseExecutorService,
  type PhaseExecutionResult
} from './PhaseExecutor.js';

export {
  createFeatureValidator,
  type FeatureValidatorService,
  type ValidationResult
} from './FeatureValidator.js';

export {
  createWorktreeService,
  sanitizeFeatureName,
  type WorktreeServiceInterface,
  type WorktreeInfo,
  type WorktreeResult
} from './WorktreeService.js';

export {
  createExtendedFlowMachine,
  extendedTransition,
  type ExtendedFlowMachineService
} from './ExtendedFlowStateMachine.js';

export {
  createCommitService,
  type CommitServiceInterface,
  type CommitResult
} from './CommitService.js';

export {
  createTaskParser,
  type TaskParserService,
  type Task
} from './TaskParser.js';

export {
  createTaskRunner,
  type TaskRunnerService,
  type TaskExecutionOptions,
  type TaskExecutionResult,
  type CheckpointDecision
} from './TaskRunner.js';

export {
  createPRCreatorService,
  type PRCreatorServiceInterface,
  type PRCreateOptions,
  type PRCreateResult,
  type PRMergeOptions,
  type PRMergeResult
} from './PRCreatorService.js';

export {
  createGitStatusChecker,
  type GitStatusCheckerService,
  type GitStatus
} from './GitStatusChecker.js';

export {
  createPRStatusFetcher,
  type PRStatusFetcherService,
  type PRStatus,
  type PRCloseResult
} from './PRStatusFetcher.js';

export {
  createBranchService,
  type BranchServiceInterface,
  type BranchDeleteResult
} from './BranchService.js';

export {
  createCacheService,
  type CacheService,
  type CacheEntry,
  type CacheServiceConfig
} from './CacheService.js';

export {
  createTemplateService,
  type TemplateService,
  type StructureResult,
  type StackTemplateOptions,
  type ExtractOptions
} from './TemplateService.js';

export {
  createConfigService,
  type ConfigService,
  type InitConfig,
  type ProjectType,
  type UIConfig
} from './ConfigService.js';

export {
  createGitHubService,
  GitHubFetchError,
  type GitHubService,
  type GitHubServiceConfig,
  type FetchOptions,
  type FetchProgress,
  type FetchResult,
  type GitHubErrorCode
} from './GitHubService.js';

export {
  createSpecInitService,
  type SpecInitService,
  type SpecInitResult
} from './SpecInitService.js';

export {
  createClaudeErrorDetector,
  type ClaudeErrorDetectorService,
  type ClaudeError,
  type ClaudeErrorCode
} from './ClaudeErrorDetector.js';

export {
  createTokenUsageParser,
  type TokenUsageParserService
} from './TokenUsageParser.js';

export {
  getModelConfig,
  supports1MContext,
  isInPremiumRange,
  MODEL_CONTEXT_CONFIGS,
  type ModelContextConfig
} from './ModelConfig.js';

export {
  createContextUsageCalculator,
  type ContextUsageCalculatorService
} from './ContextUsageCalculator.js';

export {
  createClaudeHealthCheck,
  getAgentSetupInstructions,
  type ClaudeHealthCheckService,
  type HealthCheckResult,
  type HealthCheckOptions
} from './ClaudeHealthCheck.js';

export {
  createProjectDetector,
  type ProjectDetectorService,
  type DetectionResult
} from './ProjectDetector.js';

export {
  createTestRunner,
  type TestRunnerService,
  type TestResult,
  type TestRunnerOptions
} from './TestRunner.js';

export {
  ContentCache,
  type ContentCacheInterface
} from './ContentCache.js';

export {
  PreviewHTMLGenerator,
  type PreviewHTMLGeneratorInterface
} from './PreviewHTMLGenerator.js';

export {
  PreviewHTTPServer,
  type PreviewHTTPServerInterface,
  type ServerStartResult
} from './PreviewHTTPServer.js';

export {
  PreviewService,
  type PreviewServiceInterface,
  type PreviewResult,
  type PreviewError,
  type PreviewErrorCode
} from './PreviewService.js';
