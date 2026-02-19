/**
 * Plugin type system for red64-cli
 * Defines all plugin-related TypeScript types and interfaces.
 * Exported as a public module for plugin developers to consume.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.6, 5.2, 5.4, 6.1, 6.3, 6.4, 6.6, 7.1, 8.4, 10.4, 12.2
 */

// ---------------------------------------------------------------------------
// Extension Point Declaration
// ---------------------------------------------------------------------------

/**
 * The five extension points a plugin can declare
 */
export type ExtensionPointDeclaration =
  | 'commands'
  | 'agents'
  | 'hooks'
  | 'services'
  | 'templates';

/** Runtime array of all extension point values for validation */
export const EXTENSION_POINT_VALUES: readonly ExtensionPointDeclaration[] = [
  'commands',
  'agents',
  'hooks',
  'services',
  'templates',
] as const;

// ---------------------------------------------------------------------------
// Plugin Manifest and Dependencies
// ---------------------------------------------------------------------------

/**
 * Dependency on another plugin (name + semver range)
 */
export interface PluginDependency {
  readonly name: string;
  readonly version: string;
}

/**
 * Configuration field schema for plugin config declarations
 */
export interface ConfigFieldSchema {
  readonly type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  readonly description: string;
  readonly default?: unknown;
  readonly required?: boolean;
}

/**
 * Plugin manifest file schema (red64-plugin.json)
 * Requirements: 2.1, 2.2, 2.3, 2.6
 */
export interface PluginManifest {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly author: string;
  readonly entryPoint: string;
  readonly red64CliVersion: string;
  readonly extensionPoints: readonly ExtensionPointDeclaration[];
  readonly dependencies?: readonly PluginDependency[];
  readonly configSchema?: Record<string, ConfigFieldSchema>;
}

/**
 * Runtime type guard for PluginManifest (structural check)
 */
export function isValidPluginManifest(value: unknown): value is PluginManifest {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['name'] === 'string' &&
    typeof obj['version'] === 'string' &&
    typeof obj['description'] === 'string' &&
    typeof obj['author'] === 'string' &&
    typeof obj['entryPoint'] === 'string' &&
    typeof obj['red64CliVersion'] === 'string' &&
    Array.isArray(obj['extensionPoints'])
  );
}

// ---------------------------------------------------------------------------
// Plugin Module (entry point contract)
// ---------------------------------------------------------------------------

/**
 * The interface that all plugin entry points must export
 * Requirements: 10.4, 12.2
 */
export interface PluginModule {
  activate(context: PluginContextInterface): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}

/**
 * Runtime type guard for PluginModule
 */
export function isValidPluginModule(value: unknown): value is PluginModule {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj['activate'] === 'function';
}

// ---------------------------------------------------------------------------
// Plugin State (persistence)
// ---------------------------------------------------------------------------

/**
 * Per-plugin state stored in .red64/plugins.json
 */
export interface PluginState {
  readonly version: string;
  readonly enabled: boolean;
  readonly installedAt: string;
  readonly updatedAt: string;
  readonly source: 'npm' | 'local';
  readonly localPath?: string;
}

/**
 * Top-level plugin state file (.red64/plugins.json)
 */
export interface PluginStateFile {
  readonly schemaVersion: number;
  readonly plugins: Record<string, PluginState>;
  readonly registryUrl?: string;
}

// ---------------------------------------------------------------------------
// Hook Priority and Workflow Phase
// ---------------------------------------------------------------------------

/**
 * Hook execution priority with five levels
 * Requirements: 6.6
 */
export type HookPriority = 'earliest' | 'early' | 'normal' | 'late' | 'latest';

/** Runtime array of all hook priority values */
export const HOOK_PRIORITY_VALUES: readonly HookPriority[] = [
  'earliest',
  'early',
  'normal',
  'late',
  'latest',
] as const;

/**
 * Numeric ordering map for deterministic hook priority sorting
 */
export const HOOK_PRIORITY_ORDER: Record<HookPriority, number> = {
  earliest: 0,
  early: 1,
  normal: 2,
  late: 3,
  latest: 4,
} as const;

/**
 * Workflow phases available for hook registration
 * Requirements: 6.1
 */
export type WorkflowPhase = 'requirements' | 'design' | 'tasks' | 'implementation';

/** Runtime array of all workflow phase values */
export const WORKFLOW_PHASE_VALUES: readonly WorkflowPhase[] = [
  'requirements',
  'design',
  'tasks',
  'implementation',
] as const;

// ---------------------------------------------------------------------------
// Agent Capability
// ---------------------------------------------------------------------------

/**
 * Capabilities that custom agents can declare
 * Requirements: 5.4
 */
export type AgentCapability =
  | 'code-generation'
  | 'code-review'
  | 'testing'
  | 'documentation'
  | 'refactoring';

/** Runtime array of all agent capability values */
export const AGENT_CAPABILITY_VALUES: readonly AgentCapability[] = [
  'code-generation',
  'code-review',
  'testing',
  'documentation',
  'refactoring',
] as const;

// ---------------------------------------------------------------------------
// Template Category
// ---------------------------------------------------------------------------

/**
 * Template categories for plugin-provided templates
 * Requirements: 8.4
 */
export type TemplateCategory = 'stack' | 'spec' | 'steering';

/** Runtime array of all template category values */
export const TEMPLATE_CATEGORY_VALUES: readonly TemplateCategory[] = [
  'stack',
  'spec',
  'steering',
] as const;

// ---------------------------------------------------------------------------
// Extension Point Registration Types
// ---------------------------------------------------------------------------

/**
 * Argument definition for plugin commands
 */
export interface ArgumentDefinition {
  readonly name: string;
  readonly description: string;
  readonly required: boolean;
}

/**
 * Option definition for plugin commands
 */
export interface OptionDefinition {
  readonly name: string;
  readonly description: string;
  readonly type: 'string' | 'boolean' | 'number';
  readonly default?: string | boolean | number;
  readonly alias?: string;
}

/**
 * Parsed command arguments passed to plugin command handlers
 */
export interface CommandArgs {
  readonly positional: readonly string[];
  readonly options: Readonly<Record<string, string | boolean | number>>;
  readonly context: PluginContextInterface;
}

/**
 * Command handler function type
 */
export type CommandHandler = (args: CommandArgs) => Promise<void>;

/**
 * Command extension point registration
 * Requirements: 4.1, 4.2
 */
export interface CommandRegistration {
  readonly name: string;
  readonly description: string;
  readonly args?: readonly ArgumentDefinition[];
  readonly options?: readonly OptionDefinition[];
  readonly handler: CommandHandler;
}

/**
 * Agent adapter invoke options
 */
export interface AgentAdapterInvokeOptions {
  readonly prompt: string;
  readonly workingDirectory: string;
  readonly model?: string;
  readonly onOutput?: (chunk: string) => void;
  readonly onError?: (chunk: string) => void;
  readonly timeout?: number;
}

/**
 * Agent adapter invocation result
 */
export interface AgentAdapterResult {
  readonly success: boolean;
  readonly output: string;
  readonly error?: string;
}

/**
 * Agent adapter interface that custom agents must implement
 * Requirements: 5.2
 */
export interface AgentAdapter {
  invoke(options: AgentAdapterInvokeOptions): Promise<AgentAdapterResult>;
  getCapabilities(): readonly AgentCapability[];
  configure(config: Readonly<Record<string, unknown>>): void;
}

/**
 * Agent extension point registration
 * Requirements: 5.1, 5.2
 */
export interface AgentRegistration {
  readonly name: string;
  readonly description: string;
  readonly adapter: AgentAdapter;
}

/**
 * Hook context passed to hook handlers (read-only)
 * Requirements: 6.3
 */
export interface HookContext {
  readonly phase: WorkflowPhase;
  readonly timing: 'pre' | 'post';
  readonly feature: string;
  readonly specMetadata: Readonly<Record<string, unknown>>;
  readonly flowState: Readonly<Record<string, unknown>>;
}

/**
 * Result returned by hook handlers
 * Requirements: 6.4
 */
export type HookHandlerResult =
  | { readonly action: 'continue' }
  | { readonly action: 'veto'; readonly reason: string };

/**
 * Hook handler function type
 */
export type HookHandler = (context: HookContext) => Promise<HookHandlerResult>;

/**
 * Hook extension point registration
 * Requirements: 6.1, 6.6
 */
export interface HookRegistration {
  readonly phase: WorkflowPhase | '*';
  readonly timing: 'pre' | 'post';
  readonly priority: HookPriority;
  readonly handler: HookHandler;
}

/**
 * Resolved dependencies passed to service factories
 */
export type ResolvedDependencies = Readonly<Record<string, unknown>>;

/**
 * Service factory function type
 */
export type ServiceFactory = (resolved: ResolvedDependencies) => unknown;

/**
 * Service extension point registration
 * Requirements: 7.1
 */
export interface ServiceRegistration {
  readonly name: string;
  readonly factory: ServiceFactory;
  readonly dependencies?: readonly string[];
  readonly dispose?: () => Promise<void> | void;
}

/**
 * Template extension point registration
 * Requirements: 8.4
 */
export interface TemplateRegistration {
  readonly category: TemplateCategory;
  readonly name: string;
  readonly description: string;
  readonly sourcePath: string;
  readonly subType?: 'requirements' | 'design' | 'tasks';
}

// ---------------------------------------------------------------------------
// Result Types
// ---------------------------------------------------------------------------

/**
 * Manifest validation error with field-level detail
 */
export interface ManifestError {
  readonly field: string;
  readonly message: string;
  readonly code: 'MISSING_FIELD' | 'INVALID_TYPE' | 'INVALID_VALUE' | 'SCHEMA_ERROR';
}

/**
 * Result of manifest validation
 */
export interface ManifestValidationResult {
  readonly valid: boolean;
  readonly manifest: PluginManifest | null;
  readonly errors: readonly ManifestError[];
}

/**
 * Result of compatibility check
 */
export interface CompatibilityResult {
  readonly compatible: boolean;
  readonly requiredRange: string;
  readonly actualVersion: string;
  readonly message: string;
}

/**
 * Error from a hook execution
 */
export interface HookError {
  readonly pluginName: string;
  readonly error: string;
}

/**
 * Result of hook execution across all registered hooks
 */
export interface HookExecutionResult {
  readonly vetoed: boolean;
  readonly vetoReason?: string;
  readonly vetoPlugin?: string;
  readonly executedHooks: number;
  readonly errors: readonly HookError[];
}

/**
 * Result of a plugin load operation
 */
export interface PluginLoadResult {
  readonly loaded: readonly LoadedPlugin[];
  readonly skipped: readonly SkippedPlugin[];
  readonly errors: readonly PluginLoadError[];
}

/**
 * Successfully loaded plugin metadata
 */
export interface LoadedPlugin {
  readonly name: string;
  readonly version: string;
  readonly manifest: PluginManifest;
}

/**
 * Plugin that was skipped during loading
 */
export interface SkippedPlugin {
  readonly name: string;
  readonly reason: string;
}

/**
 * Error during plugin loading
 */
export interface PluginLoadError {
  readonly pluginName: string;
  readonly error: string;
  readonly phase: 'discovery' | 'validation' | 'import' | 'activation';
}

/**
 * Result of a plugin install operation
 */
export interface InstallResult {
  readonly success: boolean;
  readonly pluginName: string;
  readonly version: string;
  readonly error?: string;
}

/**
 * Result of a plugin uninstall operation
 */
export interface UninstallResult {
  readonly success: boolean;
  readonly pluginName: string;
  readonly error?: string;
}

/**
 * Result of a plugin update operation
 */
export interface UpdateResult {
  readonly success: boolean;
  readonly pluginName: string;
  readonly previousVersion: string;
  readonly newVersion: string;
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Registered Extension Types (used by PluginRegistry)
// ---------------------------------------------------------------------------

/**
 * A registered command with plugin attribution
 */
export interface RegisteredCommand {
  readonly pluginName: string;
  readonly registration: CommandRegistration;
}

/**
 * A registered agent with plugin attribution
 */
export interface RegisteredAgent {
  readonly pluginName: string;
  readonly registration: AgentRegistration;
}

/**
 * A registered hook with plugin attribution and ordering metadata
 */
export interface RegisteredHook {
  readonly pluginName: string;
  readonly registration: HookRegistration;
  readonly registrationOrder: number;
}

/**
 * A registered template with plugin attribution and namespace
 */
export interface RegisteredTemplate {
  readonly pluginName: string;
  readonly namespacedName: string;
  readonly registration: TemplateRegistration;
}

/**
 * A registered plugin with full metadata
 */
export interface RegisteredPlugin {
  readonly name: string;
  readonly version: string;
  readonly manifest: PluginManifest;
  readonly module: PluginModule;
  readonly activatedAt: string;
}

// ---------------------------------------------------------------------------
// Plugin Context Interface
// ---------------------------------------------------------------------------

/**
 * Controlled API surface for plugin code to interact with red64-cli
 * Requirements: 4.5, 6.3, 9.5, 10.1, 10.3
 */
export interface PluginContextInterface {
  // Plugin identity
  readonly pluginName: string;
  readonly pluginVersion: string;

  // Configuration
  readonly config: Readonly<Record<string, unknown>>;

  // Extension registration
  registerCommand(registration: CommandRegistration): void;
  registerAgent(registration: AgentRegistration): void;
  registerHook(registration: HookRegistration): void;
  registerService(registration: ServiceRegistration): void;
  registerTemplate(registration: TemplateRegistration): void;

  // Service resolution
  getService<T>(serviceName: string): T;
  hasService(serviceName: string): boolean;

  // Utilities
  log(level: 'info' | 'warn' | 'error', message: string): void;

  // Read-only core access
  getCLIVersion(): string;
  getProjectConfig(): Readonly<Record<string, unknown>> | null;
}

// ---------------------------------------------------------------------------
// Service Interfaces
// ---------------------------------------------------------------------------

/**
 * ManifestValidator service interface
 */
export interface ManifestValidatorService {
  validate(manifestPath: string): Promise<ManifestValidationResult>;
  validateManifestData(data: unknown): ManifestValidationResult;
  checkCompatibility(manifest: PluginManifest, cliVersion: string): CompatibilityResult;
}

/**
 * Plugin load configuration
 */
export interface PluginLoadConfig {
  readonly pluginDirs: readonly string[];
  readonly nodeModulesDir: string;
  readonly cliVersion: string;
  readonly enabledPlugins: ReadonlySet<string>;
  readonly devMode: boolean;
}

/**
 * PluginLoader service interface
 */
export interface PluginLoaderService {
  loadPlugins(config: PluginLoadConfig): Promise<PluginLoadResult>;
  unloadPlugin(pluginName: string): Promise<void>;
  reloadPlugin(pluginName: string): Promise<PluginLoadResult>;
}

/**
 * HookRunner service interface
 */
export interface HookRunnerService {
  runPrePhaseHooks(phase: WorkflowPhase, context: HookContext): Promise<HookExecutionResult>;
  runPostPhaseHooks(phase: WorkflowPhase, context: HookContext): Promise<HookExecutionResult>;
}
