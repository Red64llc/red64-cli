/**
 * PluginLoader - Discovers, validates, and loads plugins from multiple sources.
 *
 * Requirements coverage:
 * - Task 4.1: 1.1, 1.2, 1.3, 1.5 (Plugin source scanning and discovery)
 * - Task 4.2: 1.4, 1.5, 1.6, 1.7, 2.3, 2.4, 2.5, 10.2, 10.5 (Dependency-aware loading and activation)
 *
 * Responsibilities:
 * - Scan configured plugin directories for subdirectories containing a red64-plugin.json manifest
 * - Scan node_modules for installed npm packages with red64-plugin keyword
 * - Support local directory paths as plugin sources
 * - Validate each discovered plugin's manifest via ManifestValidator
 * - Check red64-cli version compatibility using semver
 * - Resolve inter-plugin dependencies via topological sort with cycle detection
 * - Dynamically import plugin entry points using ESM import()
 * - Validate that imported modules export the expected PluginModule interface
 * - Activate plugins by calling their activate() function with a PluginContext
 * - Skip invalid plugins with descriptive error logging, never crash the host process
 */

import * as fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import * as path from 'node:path';
import type {
  PluginManifest,
  PluginModule,
  PluginLoadConfig,
  PluginLoadResult,
  LoadedPlugin,
  SkippedPlugin,
  PluginLoadError,
  ManifestValidatorService,
  PluginContextInterface,
} from './types.js';
import { isValidPluginModule } from './types.js';
import type { PluginRegistryService } from './PluginRegistry.js';
import type { PluginContextOptions } from './PluginContext.js';

// ---------------------------------------------------------------------------
// Service Interface
// ---------------------------------------------------------------------------

export interface PluginLoaderService {
  loadPlugins(config: PluginLoadConfig): Promise<PluginLoadResult>;
  unloadPlugin(pluginName: string): Promise<void>;
  reloadPlugin(pluginName: string): Promise<PluginLoadResult>;
}

// ---------------------------------------------------------------------------
// Factory Function Options
// ---------------------------------------------------------------------------

export interface PluginLoaderOptions {
  registry: PluginRegistryService;
  validator: ManifestValidatorService;
  contextFactory: (options: PluginContextOptions) => PluginContextInterface;
  logger?: (level: 'info' | 'warn' | 'error', message: string) => void;
}

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

interface DiscoveredPlugin {
  readonly name: string;
  readonly pluginDir: string;
  readonly manifest: PluginManifest;
  readonly entryPointPath: string;
}

interface DiscoveryResult {
  readonly discovered: DiscoveredPlugin[];
  readonly errors: PluginLoadError[];
}

// ---------------------------------------------------------------------------
// Default Logger (no-op)
// ---------------------------------------------------------------------------

const defaultLogger = (): void => {
  // No-op logger when not provided
};

// ---------------------------------------------------------------------------
// Factory Function
// ---------------------------------------------------------------------------

/**
 * Creates a PluginLoader service instance.
 *
 * The PluginLoader is responsible for:
 * 1. Discovering plugins from configured directories and node_modules
 * 2. Validating plugin manifests
 * 3. Checking version compatibility
 * 4. Resolving dependencies via topological sort
 * 5. Dynamically importing plugin modules
 * 6. Activating plugins with a scoped PluginContext
 */
export function createPluginLoader(options: PluginLoaderOptions): PluginLoaderService {
  const {
    registry,
    validator,
    contextFactory,
    logger = defaultLogger,
  } = options;

  // Store last successful config for reload
  let lastConfig: PluginLoadConfig | null = null;
  const loadedPluginPaths = new Map<string, string>();

  // Track reload counts for dev mode warning (Task 8.3)
  const reloadCounts = new Map<string, number>();
  const RELOAD_WARNING_THRESHOLD = 10;

  // ---------------------------------------------------------------------------
  // Discovery Functions
  // ---------------------------------------------------------------------------

  /**
   * Scan a directory for subdirectories containing red64-plugin.json
   */
  async function scanPluginDirectory(dirPath: string): Promise<DiscoveryResult> {
    const discovered: DiscoveredPlugin[] = [];
    const discoveryErrors: PluginLoadError[] = [];

    let entries: Dirent[];
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch (err) {
      logger('warn', `Failed to read plugin directory: ${dirPath} - ${String(err)}`);
      return { discovered, errors: discoveryErrors };
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const pluginDir = path.join(dirPath, entry.name);
      const manifestPath = path.join(pluginDir, 'red64-plugin.json');

      try {
        await fs.access(manifestPath);
      } catch {
        // No manifest file, skip this directory
        continue;
      }

      // Validate manifest
      const validationResult = await validator.validate(manifestPath);
      if (!validationResult.valid || !validationResult.manifest) {
        const errorMsg = `Invalid manifest: ${validationResult.errors.map((e) => e.message).join(', ')}`;
        logger('error', `Invalid manifest in ${manifestPath}: ${validationResult.errors.map((e) => e.message).join(', ')}`);

        // Use directory name as plugin name since manifest is invalid
        discoveryErrors.push({
          pluginName: entry.name,
          error: errorMsg,
          phase: 'discovery',
        });
        continue;
      }

      const manifest = validationResult.manifest;
      const entryPointPath = path.resolve(pluginDir, manifest.entryPoint);

      discovered.push({
        name: manifest.name,
        pluginDir,
        manifest,
        entryPointPath,
      });
    }

    return { discovered, errors: discoveryErrors };
  }

  /**
   * Scan node_modules for packages with red64-plugin keyword
   */
  async function scanNodeModules(nodeModulesDir: string): Promise<DiscoveryResult> {
    const discovered: DiscoveredPlugin[] = [];
    const discoveryErrors: PluginLoadError[] = [];

    let entries: Dirent[];
    try {
      entries = await fs.readdir(nodeModulesDir, { withFileTypes: true });
    } catch {
      // node_modules doesn't exist or is not readable
      return { discovered, errors: discoveryErrors };
    }

    for (const entry of entries) {
      // Handle both directories and symlinks (npm link creates symlinks)
      const isDir = entry.isDirectory() || entry.isSymbolicLink();
      if (!isDir) {
        continue;
      }

      const packageDir = path.join(nodeModulesDir, entry.name);

      // Handle scoped packages (@org/package)
      if (entry.name.startsWith('@')) {
        const scopedEntries = await fs.readdir(packageDir, { withFileTypes: true }).catch(() => []);
        for (const scopedEntry of scopedEntries) {
          if (scopedEntry.isDirectory() || scopedEntry.isSymbolicLink()) {
            const scopedPackageDir = path.join(packageDir, scopedEntry.name);
            const result = await checkNpmPackage(scopedPackageDir, `${entry.name}/${scopedEntry.name}`);
            if (result.plugin) {
              discovered.push(result.plugin);
            }
            if (result.error) {
              discoveryErrors.push(result.error);
            }
          }
        }
        continue;
      }

      const result = await checkNpmPackage(packageDir, entry.name);
      if (result.plugin) {
        discovered.push(result.plugin);
      }
      if (result.error) {
        discoveryErrors.push(result.error);
      }
    }

    return { discovered, errors: discoveryErrors };
  }

  /**
   * Check if an npm package has the red64-plugin keyword and a valid manifest
   */
  async function checkNpmPackage(
    packageDir: string,
    packageName: string
  ): Promise<{ plugin: DiscoveredPlugin | null; error: PluginLoadError | null }> {
    const packageJsonPath = path.join(packageDir, 'package.json');

    let packageJson: Record<string, unknown>;
    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      packageJson = JSON.parse(content) as Record<string, unknown>;
    } catch {
      return { plugin: null, error: null };
    }

    // Check for red64-plugin keyword
    const keywords = packageJson['keywords'];
    if (!Array.isArray(keywords) || !keywords.includes('red64-plugin')) {
      return { plugin: null, error: null };
    }

    // Look for plugin manifest
    const manifestPath = path.join(packageDir, 'red64-plugin.json');
    const validationResult = await validator.validate(manifestPath);

    if (!validationResult.valid || !validationResult.manifest) {
      const errorMsg = `Invalid manifest: ${validationResult.errors.map((e) => e.message).join(', ')}`;
      logger('error', `Invalid manifest in npm package ${packageDir}: ${validationResult.errors.map((e) => e.message).join(', ')}`);
      return {
        plugin: null,
        error: {
          pluginName: packageName,
          error: errorMsg,
          phase: 'discovery',
        },
      };
    }

    const manifest = validationResult.manifest;
    const entryPointPath = path.resolve(packageDir, manifest.entryPoint);

    return {
      plugin: {
        name: manifest.name,
        pluginDir: packageDir,
        manifest,
        entryPointPath,
      },
      error: null,
    };
  }

  // ---------------------------------------------------------------------------
  // Dependency Resolution
  // ---------------------------------------------------------------------------

  /**
   * Perform topological sort on plugins based on their dependencies.
   * Returns plugins in load order, or throws if a cycle is detected.
   */
  function topologicalSort(
    plugins: DiscoveredPlugin[]
  ): { sorted: DiscoveredPlugin[]; errors: PluginLoadError[] } {
    const pluginMap = new Map<string, DiscoveredPlugin>();
    for (const plugin of plugins) {
      pluginMap.set(plugin.name, plugin);
    }

    const sorted: DiscoveredPlugin[] = [];
    const errors: PluginLoadError[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    function visit(name: string, path: string[]): boolean {
      if (visited.has(name)) {
        return true;
      }

      if (visiting.has(name)) {
        // Cycle detected
        const cyclePath = [...path, name].join(' -> ');
        errors.push({
          pluginName: name,
          error: `Circular dependency detected: ${cyclePath}`,
          phase: 'validation',
        });
        return false;
      }

      const plugin = pluginMap.get(name);
      if (!plugin) {
        // Dependency not found - will be handled later
        return true;
      }

      visiting.add(name);

      const dependencies = plugin.manifest.dependencies ?? [];
      for (const dep of dependencies) {
        if (!visit(dep.name, [...path, name])) {
          return false;
        }
      }

      visiting.delete(name);
      visited.add(name);
      sorted.push(plugin);
      return true;
    }

    // Visit all plugins
    for (const plugin of plugins) {
      if (!visited.has(plugin.name) && !visiting.has(plugin.name)) {
        visit(plugin.name, []);
      }
    }

    // If there were cycle errors, return empty sorted list
    if (errors.length > 0) {
      return { sorted: [], errors };
    }

    return { sorted, errors: [] };
  }

  // ---------------------------------------------------------------------------
  // Plugin Loading
  // ---------------------------------------------------------------------------

  /**
   * Load all plugins from configured sources.
   */
  async function loadPlugins(config: PluginLoadConfig): Promise<PluginLoadResult> {
    lastConfig = config;

    const loaded: LoadedPlugin[] = [];
    const skipped: SkippedPlugin[] = [];
    const errors: PluginLoadError[] = [];

    // ---------------------------------------------------------------------------
    // Phase 1: Discovery
    // ---------------------------------------------------------------------------

    logger('info', 'Starting plugin discovery...');

    const allDiscovered: DiscoveredPlugin[] = [];

    // Scan configured plugin directories
    for (const dirPath of config.pluginDirs) {
      const result = await scanPluginDirectory(dirPath);
      allDiscovered.push(...result.discovered);
      errors.push(...result.errors);
    }

    // Scan node_modules
    if (config.nodeModulesDir) {
      const result = await scanNodeModules(config.nodeModulesDir);
      allDiscovered.push(...result.discovered);
      errors.push(...result.errors);
    }

    logger('info', `Discovered ${allDiscovered.length} plugin(s)`);

    // ---------------------------------------------------------------------------
    // Phase 2: Filter by enabled plugins (if set)
    // ---------------------------------------------------------------------------

    let filteredPlugins: DiscoveredPlugin[];
    if (config.enabledPlugins.size > 0) {
      filteredPlugins = allDiscovered.filter((p) => config.enabledPlugins.has(p.name));
    } else {
      // If enabledPlugins is empty, load all discovered plugins
      filteredPlugins = allDiscovered;
    }

    // ---------------------------------------------------------------------------
    // Phase 3: Validate manifests (already done during discovery, but collect errors)
    // ---------------------------------------------------------------------------

    const validatedPlugins: DiscoveredPlugin[] = [];

    for (const plugin of filteredPlugins) {
      // Re-validate (though already validated during discovery)
      const validationResult = validator.validateManifestData(plugin.manifest);
      if (!validationResult.valid) {
        errors.push({
          pluginName: plugin.name,
          error: `Invalid manifest: ${validationResult.errors.map((e) => e.message).join(', ')}`,
          phase: 'validation',
        });
        continue;
      }

      validatedPlugins.push(plugin);
    }

    // ---------------------------------------------------------------------------
    // Phase 4: Check version compatibility
    // ---------------------------------------------------------------------------

    const compatiblePlugins: DiscoveredPlugin[] = [];

    for (const plugin of validatedPlugins) {
      const compatibility = validator.checkCompatibility(plugin.manifest, config.cliVersion);
      if (!compatibility.compatible) {
        skipped.push({
          name: plugin.name,
          reason: `CLI version mismatch: ${compatibility.message}`,
        });
        logger('warn', `Plugin ${plugin.name} skipped: ${compatibility.message}`);
        continue;
      }

      compatiblePlugins.push(plugin);
    }

    // ---------------------------------------------------------------------------
    // Phase 5: Check dependency presence
    // ---------------------------------------------------------------------------

    const pluginsWithDeps: DiscoveredPlugin[] = [];
    const availableNames = new Set(compatiblePlugins.map((p) => p.name));

    for (const plugin of compatiblePlugins) {
      const dependencies = plugin.manifest.dependencies ?? [];
      let missingDep: string | null = null;

      for (const dep of dependencies) {
        if (!availableNames.has(dep.name)) {
          missingDep = dep.name;
          break;
        }
      }

      if (missingDep) {
        errors.push({
          pluginName: plugin.name,
          error: `Missing dependency: ${missingDep}`,
          phase: 'validation',
        });
        continue;
      }

      pluginsWithDeps.push(plugin);
    }

    // ---------------------------------------------------------------------------
    // Phase 6: Topological sort for dependency order
    // ---------------------------------------------------------------------------

    const { sorted, errors: sortErrors } = topologicalSort(pluginsWithDeps);
    errors.push(...sortErrors);

    // ---------------------------------------------------------------------------
    // Phase 7: Dynamic import and activation
    // ---------------------------------------------------------------------------

    for (const plugin of sorted) {
      try {
        // Dynamically import the plugin module
        let pluginModule: unknown;
        try {
          // Use file:// URL for proper ESM import
          const entryPointUrl = `file://${plugin.entryPointPath}`;
          pluginModule = await import(entryPointUrl);
        } catch (importErr) {
          errors.push({
            pluginName: plugin.name,
            error: `Failed to import plugin entry point: ${String(importErr)}`,
            phase: 'import',
          });
          logger('error', `Failed to import ${plugin.name}: ${String(importErr)}`);
          continue;
        }

        // Validate that the module exports the expected interface
        if (!isValidPluginModule(pluginModule)) {
          errors.push({
            pluginName: plugin.name,
            error: `Plugin module does not export a valid PluginModule interface. Missing 'activate' function.`,
            phase: 'import',
          });
          logger('error', `Plugin ${plugin.name} does not export a valid PluginModule interface`);
          continue;
        }

        const typedModule = pluginModule as PluginModule;

        // Create a scoped PluginContext for this plugin
        const context = contextFactory({
          pluginName: plugin.name,
          pluginVersion: plugin.manifest.version,
          config: {}, // Plugin config will be merged later by PluginManager
          cliVersion: config.cliVersion,
          projectConfig: null,
          registry,
        });

        // Register the plugin in the registry first
        const loadedPlugin: LoadedPlugin = {
          name: plugin.name,
          version: plugin.manifest.version,
          manifest: plugin.manifest,
        };
        registry.registerPlugin(loadedPlugin, typedModule);

        // Store the path for reload
        loadedPluginPaths.set(plugin.name, plugin.pluginDir);

        // Activate the plugin (wrapped in try/catch for error isolation)
        try {
          const activateResult = typedModule.activate(context);
          if (activateResult instanceof Promise) {
            await activateResult;
          }
        } catch (activationErr) {
          // Unregister the plugin since activation failed
          await registry.unregisterPlugin(plugin.name);
          loadedPluginPaths.delete(plugin.name);

          errors.push({
            pluginName: plugin.name,
            error: `Plugin activation failed: ${String(activationErr)}`,
            phase: 'activation',
          });
          logger('error', `Plugin ${plugin.name} activation failed: ${String(activationErr)}`);
          continue;
        }

        loaded.push(loadedPlugin);
        logger('info', `Loaded plugin: ${plugin.name}@${plugin.manifest.version}`);

      } catch (err) {
        // Catch-all for any unexpected errors
        errors.push({
          pluginName: plugin.name,
          error: `Unexpected error loading plugin: ${String(err)}`,
          phase: 'activation',
        });
        logger('error', `Unexpected error loading ${plugin.name}: ${String(err)}`);
      }
    }

    logger('info', `Plugin loading complete: ${loaded.length} loaded, ${skipped.length} skipped, ${errors.length} errors`);

    return {
      loaded,
      skipped,
      errors,
    };
  }

  /**
   * Unload a plugin from the registry.
   */
  async function unloadPlugin(pluginName: string): Promise<void> {
    await registry.unregisterPlugin(pluginName);
    loadedPluginPaths.delete(pluginName);
    logger('info', `Unloaded plugin: ${pluginName}`);
  }

  /**
   * Reload a plugin by unloading and loading again.
   * Task 8.3: Hot reload with query-string cache busting
   */
  async function reloadPlugin(pluginName: string): Promise<PluginLoadResult> {
    const pluginDir = loadedPluginPaths.get(pluginName);
    if (!pluginDir || !lastConfig) {
      return {
        loaded: [],
        skipped: [],
        errors: [{
          pluginName,
          error: 'Plugin not found or no previous configuration available',
          phase: 'validation',
        }],
      };
    }

    // Track reload count and warn if exceeding threshold
    const currentCount = (reloadCounts.get(pluginName) ?? 0) + 1;
    reloadCounts.set(pluginName, currentCount);

    if (currentCount > RELOAD_WARNING_THRESHOLD) {
      logger('warn', `Plugin ${pluginName} has been reloaded ${currentCount} times. ` +
        `Excessive reloads may cause memory growth from ESM module cache accumulation.`);
    }

    // Unload first
    await unloadPlugin(pluginName);

    // Create a config that only loads this plugin
    const singlePluginConfig: PluginLoadConfig = {
      ...lastConfig,
      pluginDirs: [path.dirname(pluginDir)],
      enabledPlugins: new Set([pluginName]),
    };

    // Reload
    return loadPlugins(singlePluginConfig);
  }

  // ---------------------------------------------------------------------------
  // Return Service Interface
  // ---------------------------------------------------------------------------

  return {
    loadPlugins,
    unloadPlugin,
    reloadPlugin,
  };
}
