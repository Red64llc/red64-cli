/**
 * Plugin subsystem barrel export
 * Exports all plugin types and services for consumption
 */

// Export all types and runtime values from the type system
export {
  // Type guards
  isValidPluginManifest,
  isValidPluginModule,

  // Runtime constant arrays
  EXTENSION_POINT_VALUES,
  HOOK_PRIORITY_VALUES,
  HOOK_PRIORITY_ORDER,
  WORKFLOW_PHASE_VALUES,
  AGENT_CAPABILITY_VALUES,
  TEMPLATE_CATEGORY_VALUES,

  // Type-only exports
  type ExtensionPointDeclaration,
  type PluginDependency,
  type ConfigFieldSchema,
  type PluginManifest,
  type PluginModule,
  type PluginState,
  type PluginStateFile,
  type HookPriority,
  type WorkflowPhase,
  type AgentCapability,
  type TemplateCategory,
  type ArgumentDefinition,
  type OptionDefinition,
  type CommandArgs,
  type CommandHandler,
  type CommandRegistration,
  type AgentAdapterInvokeOptions,
  type AgentAdapterResult,
  type AgentAdapter,
  type AgentRegistration,
  type HookContext,
  type HookHandlerResult,
  type HookHandler,
  type HookRegistration,
  type ResolvedDependencies,
  type ServiceFactory,
  type ServiceRegistration,
  type TemplateRegistration,
  type ManifestError,
  type ManifestValidationResult,
  type CompatibilityResult,
  type HookError,
  type HookExecutionResult,
  type PluginLoadResult,
  type LoadedPlugin,
  type SkippedPlugin,
  type PluginLoadError,
  type InstallResult,
  type UninstallResult,
  type UpdateResult,
  type RegisteredCommand,
  type RegisteredAgent,
  type RegisteredHook,
  type RegisteredTemplate,
  type RegisteredPlugin,
  type PluginContextInterface,
  type ManifestValidatorService,
  type PluginLoadConfig,
  type PluginLoaderService,
  type HookRunnerService,
} from './types.js';

// Export ManifestValidator service
export { createManifestValidator } from './ManifestValidator.js';
