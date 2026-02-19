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

// Export PluginRegistry service
export { createPluginRegistry, type PluginRegistryService } from './PluginRegistry.js';

// Export PluginContext
export { createPluginContext, type PluginContextOptions } from './PluginContext.js';

// Export PluginLoader
export { createPluginLoader, type PluginLoaderOptions, type PluginLoaderService as PluginLoaderServiceImpl } from './PluginLoader.js';

// Export Extension Points
export {
  createCommandExtension,
  type CommandExtensionService,
  type CommandExtensionOptions,
  type CommandExecutionResult,
} from './extensions/CommandExtension.js';

export {
  createAgentExtension,
  type AgentExtensionService,
  type AgentExtensionOptions,
  type AgentInvocationResult,
} from './extensions/AgentExtension.js';

export {
  createHookRunner,
  type HookRunnerOptions,
  type HookRunnerExtendedService,
} from './extensions/HookRunner.js';

export {
  createServiceExtension,
  type ServiceExtensionService,
  type ServiceExtensionOptions,
} from './extensions/ServiceExtension.js';

export {
  createTemplateExtension,
  type TemplateExtensionService,
  type TemplateExtensionOptions,
} from './extensions/TemplateExtension.js';

// Export PluginManager
export {
  createPluginManager,
  type PluginManagerService,
  type PluginManagerOptions,
  type InstallOptions,
  type PluginInfo,
  type PluginDetail,
  type RegistryEntry,
  type ScaffoldResult,
  type InstallStep,
  type SpawnFn,
} from './PluginManager.js';

// Export PluginBootstrap (Task 9.5)
export {
  createPluginBootstrap,
  type PluginBootstrapConfig,
  type PluginBootstrapResult,
} from './PluginBootstrap.js';
