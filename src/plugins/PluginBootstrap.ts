/**
 * PluginBootstrap - Initializes the plugin system during CLI startup
 *
 * Task 9.5: Integrate plugin loading into the CLI startup sequence
 * Requirements: 1.1, 1.5, 1.6, 10.2
 *
 * Responsibilities:
 * - Read the plugin state file after config loading
 * - Call the plugin loader to discover and activate enabled plugins
 * - Pass CLI version, plugin directories, and enabled set to the loader
 * - Log a summary of loaded, skipped, and errored plugins
 * - Support plugins.enabled config option (default: true)
 * - Wire registry, loader, manager, and hook runner for downstream consumers
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  createPluginRegistry,
  type PluginRegistryService,
} from './PluginRegistry.js';
import { createPluginLoader } from './PluginLoader.js';
import { createPluginContext } from './PluginContext.js';
import {
  createHookRunner,
  type HookRunnerExtendedService,
} from './extensions/HookRunner.js';
import {
  createCommandExtension,
  type CommandExtensionService,
} from './extensions/CommandExtension.js';
import {
  createAgentExtension,
  type AgentExtensionService,
} from './extensions/AgentExtension.js';
import {
  createTemplateExtension,
  type TemplateExtensionService,
} from './extensions/TemplateExtension.js';
import {
  createServiceExtension,
  type ServiceExtensionService,
} from './extensions/ServiceExtension.js';
import { createManifestValidator } from './ManifestValidator.js';
import type {
  PluginStateFile,
  LoadedPlugin,
  SkippedPlugin,
  PluginLoadError,
} from './types.js';

// ---------------------------------------------------------------------------
// Bootstrap Config
// ---------------------------------------------------------------------------

/**
 * Configuration for plugin bootstrap
 */
export interface PluginBootstrapConfig {
  /** Path to the project directory (contains .red64/) */
  readonly projectDir: string;
  /** Path to node_modules where plugins are installed */
  readonly nodeModulesDir: string;
  /** Current CLI version for compatibility checking */
  readonly cliVersion: string;
  /** Whether plugins are enabled globally (default: true) */
  readonly pluginsEnabled?: boolean;
  /** Optional logger for plugin events */
  readonly logger?: (level: 'info' | 'warn' | 'error', message: string) => void;
}

// ---------------------------------------------------------------------------
// Bootstrap Result
// ---------------------------------------------------------------------------

/**
 * Result of plugin bootstrap process
 */
export interface PluginBootstrapResult {
  /** Successfully loaded plugins */
  readonly loaded: readonly LoadedPlugin[];
  /** Plugins that were skipped (disabled or incompatible) */
  readonly skipped: readonly SkippedPlugin[];
  /** Plugins that failed to load */
  readonly errors: readonly PluginLoadError[];
  /** Whether plugins were disabled globally */
  readonly pluginsDisabledGlobally: boolean;
  /** The initialized plugin registry */
  readonly registry: PluginRegistryService;
  /** The initialized hook runner */
  readonly hookRunner: HookRunnerExtendedService;
  /** The initialized command extension */
  readonly commandExtension: CommandExtensionService;
  /** The initialized agent extension */
  readonly agentExtension: AgentExtensionService;
  /** The initialized template extension */
  readonly templateExtension: TemplateExtensionService;
  /** The initialized service extension */
  readonly serviceExtension: ServiceExtensionService;
}

// ---------------------------------------------------------------------------
// Default Logger
// ---------------------------------------------------------------------------

const defaultLogger = (): void => {
  // No-op when not provided
};

// ---------------------------------------------------------------------------
// State File Reader
// ---------------------------------------------------------------------------

/**
 * Read the plugin state file from disk
 */
async function readStateFile(projectDir: string): Promise<PluginStateFile> {
  const stateFilePath = path.join(projectDir, '.red64', 'plugins.json');

  try {
    const content = await fs.readFile(stateFilePath, 'utf-8');
    return JSON.parse(content) as PluginStateFile;
  } catch {
    // Return empty state if file doesn't exist
    return {
      schemaVersion: 1,
      plugins: {},
    };
  }
}

// ---------------------------------------------------------------------------
// Bootstrap Function
// ---------------------------------------------------------------------------

/**
 * Initialize the plugin system during CLI startup.
 *
 * This function:
 * 1. Creates the plugin registry and all extension services
 * 2. Reads the plugin state file
 * 3. If plugins are enabled, loads all enabled and compatible plugins
 * 4. Returns the initialized services for downstream consumers
 */
export async function createPluginBootstrap(
  config: PluginBootstrapConfig
): Promise<PluginBootstrapResult> {
  const {
    projectDir,
    nodeModulesDir,
    cliVersion,
    pluginsEnabled = true,
    logger = defaultLogger,
  } = config;

  // Step 1: Create core services
  const registry = createPluginRegistry();
  const validator = createManifestValidator();

  // Step 2: Create extension services (wired to registry)
  const hookRunner = createHookRunner({ registry, logger });
  const commandExtension = createCommandExtension({ registry, logger });
  const agentExtension = createAgentExtension({ registry, logger });
  const templateExtension = createTemplateExtension({ registry });

  // Define core service names that plugins cannot override
  const coreServiceNames = new Set<string>([
    'AgentInvoker',
    'PhaseExecutor',
    'StateManager',
    'FlowController',
    'GitStatusChecker',
    'PRStatusFetcher',
    'TemplateService',
  ]);
  const serviceExtension = createServiceExtension({ registry, coreServiceNames, logger });

  // Step 3: Check if plugins are disabled globally
  if (!pluginsEnabled) {
    logger('info', 'Plugins are disabled globally (plugins.enabled = false)');
    return {
      loaded: [],
      skipped: [],
      errors: [],
      pluginsDisabledGlobally: true,
      registry,
      hookRunner,
      commandExtension,
      agentExtension,
      templateExtension,
      serviceExtension,
    };
  }

  // Step 4: Read plugin state file
  const stateFile = await readStateFile(projectDir);

  // Step 5: Create plugin loader with context factory
  const contextFactory = (options: Parameters<typeof createPluginContext>[0]) =>
    createPluginContext(options);

  const loader = createPluginLoader({
    registry,
    validator,
    contextFactory,
    logger,
  });

  // Step 6: Build enabled set from state file
  const enabledPlugins = new Set<string>();
  const disabledPlugins = new Map<string, string>(); // name -> reason

  // Track if we have any plugins in the state file
  const hasStateFilePlugins = Object.keys(stateFile.plugins).length > 0;

  for (const [name, state] of Object.entries(stateFile.plugins)) {
    if (state.enabled) {
      enabledPlugins.add(name);
    } else {
      disabledPlugins.set(name, 'Plugin is disabled in configuration');
    }
  }

  // Step 7: Load plugins
  // If there are plugins in the state file, only load enabled ones
  // If there are no plugins, the loader will load all (for fresh installs)
  // To prevent loading disabled plugins, we must only pass the enabled set
  // and if enabled set is empty but state file has plugins, we should NOT load any
  let loadResult;
  if (hasStateFilePlugins && enabledPlugins.size === 0) {
    // All plugins are disabled - don't load anything
    loadResult = { loaded: [], skipped: [], errors: [] };
  } else {
    loadResult = await loader.loadPlugins({
      pluginDirs: [],
      nodeModulesDir,
      enabledPlugins,
      cliVersion,
      devMode: false,
    });
  }

  // Step 7b: Add disabled plugins to the skipped list
  const allSkipped: SkippedPlugin[] = [...loadResult.skipped];
  for (const [name, reason] of disabledPlugins) {
    // Only add if not already in skipped list (to avoid duplicates)
    if (!allSkipped.some(s => s.name === name)) {
      allSkipped.push({ name, reason });
    }
  }

  // Step 8: Log summary
  const loadedCount = loadResult.loaded.length;
  const skippedCount = loadResult.skipped.length;
  const errorCount = loadResult.errors.length;

  if (loadedCount > 0 || skippedCount > 0 || errorCount > 0) {
    logger(
      'info',
      `Plugins: ${loadedCount} loaded, ${skippedCount} skipped, ${errorCount} errors`
    );
  }

  // Log individual errors
  for (const error of loadResult.errors) {
    logger('error', `Plugin "${error.pluginName}" failed to load: ${error.error}`);
  }

  return {
    loaded: loadResult.loaded,
    skipped: allSkipped,
    errors: loadResult.errors,
    pluginsDisabledGlobally: false,
    registry,
    hookRunner,
    commandExtension,
    agentExtension,
    templateExtension,
    serviceExtension,
  };
}
