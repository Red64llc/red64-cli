/**
 * PluginManager - Orchestrates plugin lifecycle operations
 *
 * Requirements coverage:
 * - Task 6.1: 3.1, 3.2, 3.6, 3.7, 3.8 (Install, uninstall, update)
 * - Task 6.2: 3.3, 3.4, 3.5 (Enable, disable, list)
 * - Task 6.3: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6 (Configuration management)
 *
 * Responsibilities:
 * - Install plugins by spawning `npm install` with the plugin package name
 * - Validate manifest post-install; rollback if invalid
 * - Uninstall plugins by deregistering extensions and spawning `npm uninstall`
 * - Update plugins by running `npm update` and re-validating
 * - Enable/disable plugins by updating state file
 * - List all installed plugins with manifest data
 * - Manage plugin-specific configuration with schema validation
 * - Emit progress callbacks during install/update
 * - Check npm CLI availability before operations
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  PluginManifest,
  PluginStateFile,
  ManifestValidatorService,
  ManifestValidationResult,
  ManifestError,
  InstallResult,
  UninstallResult,
  UpdateResult,
  ConfigFieldSchema,
} from './types.js';
import type { PluginRegistryService } from './PluginRegistry.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Progress step during plugin installation/update
 */
export type InstallStep =
  | { phase: 'downloading'; progress: number }
  | { phase: 'validating' }
  | { phase: 'activating' }
  | { phase: 'complete' };

/**
 * Options for install operation
 */
export interface InstallOptions {
  readonly registryUrl?: string;
  readonly localPath?: string;
  readonly onProgress?: (step: InstallStep) => void;
}

/**
 * Plugin info returned by list()
 */
export interface PluginInfo {
  readonly name: string;
  readonly version: string;
  readonly enabled: boolean;
  readonly extensionPoints: readonly string[];
  readonly description: string;
}

/**
 * Detailed plugin info returned by info()
 */
export interface PluginDetail extends PluginInfo {
  readonly author: string;
  readonly compatibilityRange: string;
  readonly configSchema: Record<string, unknown> | null;
  readonly dependencies: readonly string[];
}

/**
 * Registry entry from npm search
 */
export interface RegistryEntry {
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly author: string;
}

/**
 * Result of scaffold operation
 */
export interface ScaffoldResult {
  readonly success: boolean;
  readonly createdFiles: readonly string[];
  readonly error?: string;
}

/**
 * Spawn function type (injectable for testing)
 */
export type SpawnFn = (
  command: string,
  args: string[]
) => Promise<{ code: number; stdout: string; stderr: string }>;

/**
 * Options for search operation (Req 11.3)
 */
export interface SearchOptions {
  readonly registryUrl?: string;
}

/**
 * Options for info operation (Req 11.3)
 */
export interface InfoOptions {
  readonly registryUrl?: string;
}

/**
 * PluginManager service interface
 */
export interface PluginManagerService {
  install(nameOrPath: string, options?: InstallOptions): Promise<InstallResult>;
  uninstall(name: string): Promise<UninstallResult>;
  enable(name: string): Promise<void>;
  disable(name: string): Promise<void>;
  update(name: string): Promise<UpdateResult>;
  list(): Promise<readonly PluginInfo[]>;
  search(query: string, options?: SearchOptions): Promise<readonly RegistryEntry[]>;
  info(name: string, options?: InfoOptions): Promise<PluginDetail | null>;
  getConfig(name: string, key?: string): Promise<Record<string, unknown>>;
  setConfig(name: string, key: string, value: unknown): Promise<void>;
  scaffold(name: string, targetDir: string): Promise<ScaffoldResult>;
  validate(pluginPath: string): Promise<ManifestValidationResult>;
}

// ---------------------------------------------------------------------------
// Factory Options
// ---------------------------------------------------------------------------

export interface PluginManagerOptions {
  readonly registry: PluginRegistryService;
  readonly validator: ManifestValidatorService;
  readonly projectDir: string;
  readonly nodeModulesDir: string;
  readonly cliVersion: string;
  readonly spawn?: SpawnFn;
  readonly logger?: (level: 'info' | 'warn' | 'error', message: string) => void;
}

// ---------------------------------------------------------------------------
// Default Logger (no-op)
// ---------------------------------------------------------------------------

const defaultLogger = (): void => {
  // No-op logger when not provided
};

// ---------------------------------------------------------------------------
// Default Spawn Implementation
// ---------------------------------------------------------------------------

async function defaultSpawn(
  command: string,
  args: string[]
): Promise<{ code: number; stdout: string; stderr: string }> {
  const { spawn } = await import('node:child_process');

  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ code: code ?? 0, stdout, stderr });
    });

    proc.on('error', (err) => {
      resolve({ code: 1, stdout, stderr: err.message });
    });
  });
}

// ---------------------------------------------------------------------------
// Factory Function
// ---------------------------------------------------------------------------

export function createPluginManager(options: PluginManagerOptions): PluginManagerService {
  const {
    registry,
    validator,
    projectDir,
    nodeModulesDir,
    cliVersion,
    spawn = defaultSpawn,
    logger = defaultLogger,
  } = options;

  const stateDir = path.join(projectDir, '.red64');
  const stateFilePath = path.join(stateDir, 'plugins.json');
  const pluginsConfigDir = path.join(stateDir, 'plugins');

  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------

  async function readStateFile(): Promise<PluginStateFile> {
    try {
      const content = await fs.readFile(stateFilePath, 'utf-8');
      return JSON.parse(content) as PluginStateFile;
    } catch {
      return {
        schemaVersion: 1,
        plugins: {},
      };
    }
  }

  async function writeStateFile(state: PluginStateFile): Promise<void> {
    await fs.mkdir(stateDir, { recursive: true });
    // Atomic write: write to temp file then rename
    const tempPath = `${stateFilePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(state, null, 2));
    await fs.rename(tempPath, stateFilePath);
  }

  // ---------------------------------------------------------------------------
  // Config Management
  // ---------------------------------------------------------------------------

  function getPluginConfigPath(pluginName: string): string {
    return path.join(pluginsConfigDir, pluginName, 'config.json');
  }

  async function readPluginConfig(pluginName: string): Promise<Record<string, unknown>> {
    try {
      const content = await fs.readFile(getPluginConfigPath(pluginName), 'utf-8');
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  async function writePluginConfig(pluginName: string, config: Record<string, unknown>): Promise<void> {
    const configPath = getPluginConfigPath(pluginName);
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  }

  async function getManifestForPlugin(pluginName: string): Promise<PluginManifest | null> {
    const manifestPath = path.join(nodeModulesDir, pluginName, 'red64-plugin.json');
    const result = await validator.validate(manifestPath);
    return result.manifest;
  }

  function validateConfigValue(
    key: string,
    value: unknown,
    schema: Record<string, ConfigFieldSchema>
  ): void {
    const fieldSchema = schema[key];
    if (!fieldSchema) {
      // Key not in schema - allow for now
      return;
    }

    const expectedType = fieldSchema.type;
    const actualType = Array.isArray(value) ? 'array' : typeof value;

    if (expectedType === 'array' && !Array.isArray(value)) {
      throw new Error(`Invalid config value for "${key}": expected array, got ${actualType}`);
    }

    if (expectedType === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) {
      throw new Error(`Invalid config value for "${key}": expected object, got ${actualType}`);
    }

    if (expectedType === 'string' && typeof value !== 'string') {
      throw new Error(`Invalid config value for "${key}": expected string, got ${actualType}`);
    }

    if (expectedType === 'number' && typeof value !== 'number') {
      throw new Error(`Invalid config value for "${key}": expected number, got ${actualType}`);
    }

    if (expectedType === 'boolean' && typeof value !== 'boolean') {
      throw new Error(`Invalid config value for "${key}": expected boolean, got ${actualType}`);
    }
  }

  function mergeConfigWithDefaults(
    userConfig: Record<string, unknown>,
    schema: Record<string, ConfigFieldSchema>
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = {};

    // Apply defaults from schema
    for (const [key, fieldSchema] of Object.entries(schema)) {
      if (fieldSchema.default !== undefined) {
        merged[key] = fieldSchema.default;
      }
    }

    // Override with user config
    for (const [key, value] of Object.entries(userConfig)) {
      merged[key] = value;
    }

    return merged;
  }

  // ---------------------------------------------------------------------------
  // npm CLI helpers
  // ---------------------------------------------------------------------------

  async function checkNpmAvailability(): Promise<boolean> {
    try {
      const result = await spawn('npm', ['--version']);
      return result.code === 0;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // install()
  // ---------------------------------------------------------------------------

  async function install(nameOrPath: string, options: InstallOptions = {}): Promise<InstallResult> {
    const { localPath, onProgress } = options;

    // Check npm availability
    const npmAvailable = await checkNpmAvailability();
    if (!npmAvailable) {
      return {
        success: false,
        pluginName: nameOrPath,
        version: '',
        error: 'npm CLI not found. Please ensure npm is installed and available in your PATH.',
      };
    }

    // Emit downloading progress
    onProgress?.({ phase: 'downloading', progress: 0 });

    // Determine install target
    const installTarget = localPath ?? nameOrPath;
    const npmArgs = ['install', installTarget];

    // Run npm install
    const installResult = await spawn('npm', npmArgs);

    onProgress?.({ phase: 'downloading', progress: 100 });

    if (installResult.code !== 0) {
      return {
        success: false,
        pluginName: nameOrPath,
        version: '',
        error: `npm install failed: ${installResult.stderr || installResult.stdout}`,
      };
    }

    // Emit validating progress
    onProgress?.({ phase: 'validating' });

    // Determine plugin name from install target
    let pluginName = nameOrPath;
    if (localPath) {
      // For local installs, try to read the manifest from the local path first
      const localManifestPath = path.join(localPath, 'red64-plugin.json');
      try {
        const localResult = await validator.validate(localManifestPath);
        if (localResult.valid && localResult.manifest) {
          pluginName = localResult.manifest.name;
        }
      } catch {
        // Fall back to using the base name
        pluginName = path.basename(localPath);
      }
    }

    // Validate manifest in node_modules
    const manifestPath = path.join(nodeModulesDir, pluginName, 'red64-plugin.json');
    const validationResult = await validator.validate(manifestPath);

    if (!validationResult.valid || !validationResult.manifest) {
      // Rollback: uninstall the package
      logger('error', `Invalid manifest for ${pluginName}, rolling back installation`);
      await spawn('npm', ['uninstall', pluginName]);

      return {
        success: false,
        pluginName,
        version: '',
        error: `Invalid plugin manifest: ${validationResult.errors.map((e) => e.message).join(', ')}`,
      };
    }

    const manifest = validationResult.manifest;

    // Check CLI version compatibility
    const compatibility = validator.checkCompatibility(manifest, cliVersion);
    if (!compatibility.compatible) {
      // Rollback
      await spawn('npm', ['uninstall', pluginName]);
      return {
        success: false,
        pluginName,
        version: manifest.version,
        error: `Version incompatible: ${compatibility.message}`,
      };
    }

    // Emit activating progress
    onProgress?.({ phase: 'activating' });

    // Update state file
    const state = await readStateFile();
    const now = new Date().toISOString();

    state.plugins[pluginName] = {
      version: manifest.version,
      enabled: true,
      installedAt: now,
      updatedAt: now,
      source: localPath ? 'local' : 'npm',
      localPath: localPath,
    };

    await writeStateFile(state);

    // Emit complete progress
    onProgress?.({ phase: 'complete' });

    logger('info', `Installed plugin: ${pluginName}@${manifest.version}`);

    return {
      success: true,
      pluginName,
      version: manifest.version,
    };
  }

  // ---------------------------------------------------------------------------
  // uninstall()
  // ---------------------------------------------------------------------------

  async function uninstall(name: string): Promise<UninstallResult> {
    // Check npm availability
    const npmAvailable = await checkNpmAvailability();
    if (!npmAvailable) {
      return {
        success: false,
        pluginName: name,
        error: 'npm CLI not found. Please ensure npm is installed and available in your PATH.',
      };
    }

    // Read current state
    const state = await readStateFile();
    const pluginState = state.plugins[name];

    if (!pluginState) {
      return {
        success: false,
        pluginName: name,
        error: `Plugin "${name}" is not installed`,
      };
    }

    // Deregister from registry (this also disposes services)
    await registry.unregisterPlugin(name);

    // Run npm uninstall
    const uninstallResult = await spawn('npm', ['uninstall', name]);

    if (uninstallResult.code !== 0) {
      // Note: We've already deregistered, so this is a partial failure
      return {
        success: false,
        pluginName: name,
        error: `npm uninstall failed: ${uninstallResult.stderr || uninstallResult.stdout}`,
      };
    }

    // Remove from state file
    delete state.plugins[name];
    await writeStateFile(state);

    // Optionally remove config directory
    try {
      await fs.rm(path.join(pluginsConfigDir, name), { recursive: true, force: true });
    } catch {
      // Ignore config removal errors
    }

    logger('info', `Uninstalled plugin: ${name}`);

    return {
      success: true,
      pluginName: name,
    };
  }

  // ---------------------------------------------------------------------------
  // update()
  // ---------------------------------------------------------------------------

  async function update(name: string): Promise<UpdateResult> {
    // Check npm availability
    const npmAvailable = await checkNpmAvailability();
    if (!npmAvailable) {
      return {
        success: false,
        pluginName: name,
        previousVersion: '',
        newVersion: '',
        error: 'npm CLI not found. Please ensure npm is installed and available in your PATH.',
      };
    }

    // Read current state
    const state = await readStateFile();
    const pluginState = state.plugins[name];

    if (!pluginState) {
      return {
        success: false,
        pluginName: name,
        previousVersion: '',
        newVersion: '',
        error: `Plugin "${name}" is not installed`,
      };
    }

    const previousVersion = pluginState.version;

    // Preserve current config
    const currentConfig = await readPluginConfig(name);

    // Run npm update
    const updateResult = await spawn('npm', ['update', name]);

    if (updateResult.code !== 0) {
      return {
        success: false,
        pluginName: name,
        previousVersion,
        newVersion: previousVersion,
        error: `npm update failed: ${updateResult.stderr || updateResult.stdout}`,
      };
    }

    // Re-validate manifest
    const manifestPath = path.join(nodeModulesDir, name, 'red64-plugin.json');
    const validationResult = await validator.validate(manifestPath);

    if (!validationResult.valid || !validationResult.manifest) {
      // Update failed during validation - state is inconsistent
      // The package is updated but manifest is invalid
      // In a real scenario, we might try to rollback to previous version
      return {
        success: false,
        pluginName: name,
        previousVersion,
        newVersion: previousVersion,
        error: `Updated manifest is invalid: ${validationResult.errors.map((e) => e.message).join(', ')}`,
      };
    }

    const newManifest = validationResult.manifest;

    // Check CLI version compatibility
    const compatibility = validator.checkCompatibility(newManifest, cliVersion);
    if (!compatibility.compatible) {
      return {
        success: false,
        pluginName: name,
        previousVersion,
        newVersion: newManifest.version,
        error: `Updated version incompatible: ${compatibility.message}`,
      };
    }

    // Update state
    state.plugins[name] = {
      ...pluginState,
      version: newManifest.version,
      updatedAt: new Date().toISOString(),
    };

    await writeStateFile(state);

    // Restore config (it should already be there, but ensure it's preserved)
    if (Object.keys(currentConfig).length > 0) {
      await writePluginConfig(name, currentConfig);
    }

    logger('info', `Updated plugin: ${name} from ${previousVersion} to ${newManifest.version}`);

    return {
      success: true,
      pluginName: name,
      previousVersion,
      newVersion: newManifest.version,
    };
  }

  // ---------------------------------------------------------------------------
  // enable()
  // ---------------------------------------------------------------------------

  async function enable(name: string): Promise<void> {
    const state = await readStateFile();
    const pluginState = state.plugins[name];

    if (!pluginState) {
      throw new Error(`Plugin "${name}" is not installed`);
    }

    state.plugins[name] = {
      ...pluginState,
      enabled: true,
      updatedAt: new Date().toISOString(),
    };

    await writeStateFile(state);
    logger('info', `Enabled plugin: ${name}`);
  }

  // ---------------------------------------------------------------------------
  // disable()
  // ---------------------------------------------------------------------------

  async function disable(name: string): Promise<void> {
    const state = await readStateFile();
    const pluginState = state.plugins[name];

    if (!pluginState) {
      throw new Error(`Plugin "${name}" is not installed`);
    }

    // Check for dependents and warn
    const allPlugins = Object.keys(state.plugins);
    const dependents: string[] = [];

    for (const otherName of allPlugins) {
      if (otherName === name) continue;

      const manifest = await getManifestForPlugin(otherName);
      if (manifest?.dependencies?.some((d) => d.name === name)) {
        dependents.push(otherName);
      }
    }

    if (dependents.length > 0) {
      logger('warn', `Warning: Plugins depend on "${name}": ${dependents.join(', ')}`);
    }

    // Deregister from registry (disposes services, removes commands, etc.)
    await registry.unregisterPlugin(name);

    // Update state
    state.plugins[name] = {
      ...pluginState,
      enabled: false,
      updatedAt: new Date().toISOString(),
    };

    await writeStateFile(state);
    logger('info', `Disabled plugin: ${name}`);
  }

  // ---------------------------------------------------------------------------
  // list()
  // ---------------------------------------------------------------------------

  async function list(): Promise<readonly PluginInfo[]> {
    const state = await readStateFile();
    const plugins: PluginInfo[] = [];

    for (const [name, pluginState] of Object.entries(state.plugins)) {
      const manifest = await getManifestForPlugin(name);

      plugins.push({
        name,
        version: pluginState.version,
        enabled: pluginState.enabled,
        extensionPoints: manifest?.extensionPoints ?? [],
        description: manifest?.description ?? '',
      });
    }

    return plugins;
  }

  // ---------------------------------------------------------------------------
  // search()
  // Requirements: 11.1, 11.3, 11.4
  // ---------------------------------------------------------------------------

  async function search(query: string, options: SearchOptions = {}): Promise<readonly RegistryEntry[]> {
    const { registryUrl } = options;

    // Use custom registry URL if provided, otherwise default to npm registry
    const baseUrl = registryUrl ?? 'https://registry.npmjs.org';
    const searchUrl = `${baseUrl}/-/v1/search?text=keywords:red64-plugin+${encodeURIComponent(query)}&size=20`;

    try {
      const response = await fetch(searchUrl);

      if (!response.ok) {
        logger('warn', `Registry search failed: ${response.statusText}`);
        return [];
      }

      const data = (await response.json()) as {
        objects: Array<{
          package: {
            name: string;
            description: string;
            version: string;
            author?: { name: string };
          };
        }>;
      };

      return data.objects.map((obj) => ({
        name: obj.package.name,
        description: obj.package.description ?? '',
        version: obj.package.version,
        author: obj.package.author?.name ?? 'Unknown',
      }));
    } catch (err) {
      // Requirement 11.4: Handle unreachable registry gracefully
      logger('error', `Registry search error: Unable to connect to registry. Check your network connectivity or registry configuration. Details: ${String(err)}`);
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // info()
  // Requirements: 11.2, 11.3, 11.4
  // ---------------------------------------------------------------------------

  async function info(name: string, options: InfoOptions = {}): Promise<PluginDetail | null> {
    const { registryUrl } = options;
    const state = await readStateFile();
    const pluginState = state.plugins[name];

    // If plugin is installed locally, return enriched local manifest data
    if (pluginState) {
      const manifest = await getManifestForPlugin(name);
      if (!manifest) {
        return null;
      }

      return {
        name,
        version: manifest.version,
        enabled: pluginState.enabled,
        extensionPoints: manifest.extensionPoints,
        description: manifest.description,
        author: manifest.author,
        compatibilityRange: manifest.red64CliVersion,
        configSchema: manifest.configSchema ?? null,
        dependencies: manifest.dependencies?.map((d) => d.name) ?? [],
      };
    }

    // Plugin not installed - fetch from registry
    const baseUrl = registryUrl ?? state.registryUrl ?? 'https://registry.npmjs.org';
    const packageUrl = `${baseUrl}/${encodeURIComponent(name)}`;

    try {
      const response = await fetch(packageUrl);

      if (!response.ok) {
        logger('warn', `Failed to fetch plugin info from registry: ${response.statusText}`);
        return null;
      }

      const data = (await response.json()) as {
        name: string;
        version: string;
        'dist-tags'?: { latest?: string };
        description?: string;
        author?: { name: string } | string;
        keywords?: string[];
        'red64-plugin'?: {
          red64CliVersion?: string;
          extensionPoints?: string[];
          configSchema?: Record<string, unknown>;
        };
        versions?: Record<string, {
          description?: string;
          author?: { name: string } | string;
          keywords?: string[];
          'red64-plugin'?: {
            red64CliVersion?: string;
            extensionPoints?: string[];
            configSchema?: Record<string, unknown>;
          };
        }>;
      };

      // Get the latest version data
      const latestVersion = data['dist-tags']?.latest ?? data.version;
      const versionData = data.versions?.[latestVersion] ?? data;

      // Extract author name
      let authorName = 'Unknown';
      const author = versionData.author ?? data.author;
      if (typeof author === 'string') {
        authorName = author;
      } else if (author && typeof author === 'object' && 'name' in author) {
        authorName = author.name;
      }

      // Extract red64-plugin metadata
      const pluginMeta = versionData['red64-plugin'] ?? data['red64-plugin'];

      return {
        name: data.name,
        version: latestVersion,
        enabled: false, // Not installed
        extensionPoints: (pluginMeta?.extensionPoints ?? []) as readonly string[],
        description: versionData.description ?? data.description ?? '',
        author: authorName,
        compatibilityRange: pluginMeta?.red64CliVersion ?? '',
        configSchema: pluginMeta?.configSchema ?? null,
        dependencies: [],
      };
    } catch (err) {
      // Requirement 11.4: Handle unreachable registry gracefully
      logger('error', `Registry info error: Unable to fetch plugin details. Check your network connectivity or registry configuration. Details: ${String(err)}`);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // getConfig()
  // ---------------------------------------------------------------------------

  async function getConfig(name: string, key?: string): Promise<Record<string, unknown>> {
    const manifest = await getManifestForPlugin(name);
    const userConfig = await readPluginConfig(name);
    const schema = manifest?.configSchema ?? {};

    // Merge defaults with user config
    const merged = mergeConfigWithDefaults(userConfig, schema);

    // If a specific key is requested, return only that key
    if (key !== undefined) {
      const value = merged[key];
      return value !== undefined ? { [key]: value } : {};
    }

    return merged;
  }

  // ---------------------------------------------------------------------------
  // setConfig()
  // ---------------------------------------------------------------------------

  async function setConfig(name: string, key: string, value: unknown): Promise<void> {
    const state = await readStateFile();
    const pluginState = state.plugins[name];

    if (!pluginState) {
      throw new Error(`Plugin "${name}" is not installed`);
    }

    // Get manifest for schema validation
    const manifest = await getManifestForPlugin(name);
    const schema = manifest?.configSchema ?? {};

    // Validate the value against schema
    validateConfigValue(key, value, schema);

    // Read current config, update, and write
    const config = await readPluginConfig(name);
    config[key] = value;
    await writePluginConfig(name, config);

    logger('info', `Set config for ${name}: ${key}`);
  }

  // ---------------------------------------------------------------------------
  // scaffold()
  // ---------------------------------------------------------------------------

  async function scaffold(name: string, targetDir: string): Promise<ScaffoldResult> {
    try {
      const pluginDir = path.join(targetDir, name);
      await fs.mkdir(pluginDir, { recursive: true });

      const createdFiles: string[] = [];

      // Create package.json
      const packageJson = {
        name,
        version: '0.1.0',
        type: 'module',
        keywords: ['red64-plugin'],
        main: './dist/index.js',
        scripts: {
          build: 'tsc',
          prepublishOnly: 'npm run build',
        },
        devDependencies: {
          typescript: '^5.0.0',
        },
      };
      const packageJsonPath = path.join(pluginDir, 'package.json');
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
      createdFiles.push(packageJsonPath);

      // Create red64-plugin.json
      const manifest: PluginManifest = {
        name,
        version: '0.1.0',
        description: `${name} plugin for red64-cli`,
        author: 'Your Name',
        entryPoint: './dist/index.js',
        red64CliVersion: `>=${cliVersion}`,
        extensionPoints: [],
      };
      const manifestPath = path.join(pluginDir, 'red64-plugin.json');
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      createdFiles.push(manifestPath);

      // Create tsconfig.json
      const tsconfig = {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          outDir: './dist',
          rootDir: './src',
          declaration: true,
        },
        include: ['src/**/*'],
      };
      const tsconfigPath = path.join(pluginDir, 'tsconfig.json');
      await fs.writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2));
      createdFiles.push(tsconfigPath);

      // Create src directory
      const srcDir = path.join(pluginDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Create src/index.ts
      const indexTs = `/**
 * ${name} - Plugin for red64-cli
 */

import type { PluginContextInterface } from 'red64-cli';

export function activate(context: PluginContextInterface): void {
  context.log('info', '${name} activated');

  // Register your extensions here:
  // context.registerCommand({ ... });
  // context.registerHook({ ... });
  // context.registerService({ ... });
}

export function deactivate(): void {
  // Cleanup if needed
}
`;
      const indexPath = path.join(srcDir, 'index.ts');
      await fs.writeFile(indexPath, indexTs);
      createdFiles.push(indexPath);

      logger('info', `Scaffolded plugin: ${name} at ${pluginDir}`);

      return {
        success: true,
        createdFiles,
      };
    } catch (err) {
      return {
        success: false,
        createdFiles: [],
        error: `Failed to scaffold plugin: ${String(err)}`,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // validate()
  // Task 8.2: Comprehensive plugin validation (Req 12.4)
  // ---------------------------------------------------------------------------

  async function validate(pluginPath: string): Promise<ManifestValidationResult> {
    const manifestPath = path.join(pluginPath, 'red64-plugin.json');

    // Step 1: Validate manifest against Zod schema
    const manifestResult = await validator.validate(manifestPath);

    // If manifest is invalid, return those errors
    if (!manifestResult.valid || !manifestResult.manifest) {
      return manifestResult;
    }

    const manifest = manifestResult.manifest;
    const errors: ManifestError[] = [];

    // Step 2: Check entry point existence
    const entryPointPath = path.resolve(pluginPath, manifest.entryPoint);
    try {
      await fs.access(entryPointPath);
    } catch {
      errors.push({
        field: 'entryPoint',
        message: `Entry point not found: ${manifest.entryPoint}. File does not exist at ${entryPointPath}`,
        code: 'INVALID_VALUE',
      });
    }

    // Step 3: Verify type conformance of exported module (if entry point exists)
    if (errors.length === 0) {
      try {
        // Import the module to check its exports
        // Use query string for cache busting to ensure fresh import
        const entryPointUrl = `file://${entryPointPath}?t=${Date.now()}`;
        const pluginModule = await import(entryPointUrl);

        // Check for activate function (required by PluginModule interface)
        if (typeof pluginModule.activate !== 'function') {
          errors.push({
            field: 'entryPoint',
            message: `Module does not export a valid PluginModule interface. Missing 'activate' function export.`,
            code: 'INVALID_VALUE',
          });
        }

        // Check that deactivate is either undefined or a function (optional)
        if (pluginModule.deactivate !== undefined && typeof pluginModule.deactivate !== 'function') {
          errors.push({
            field: 'entryPoint',
            message: `Module exports 'deactivate' but it is not a function.`,
            code: 'INVALID_VALUE',
          });
        }
      } catch (importError) {
        errors.push({
          field: 'entryPoint',
          message: `Failed to import module for type verification: ${String(importError)}`,
          code: 'INVALID_VALUE',
        });
      }
    }

    // Return combined result
    if (errors.length > 0) {
      return {
        valid: false,
        manifest,
        errors,
      };
    }

    return {
      valid: true,
      manifest,
      errors: [],
    };
  }

  // ---------------------------------------------------------------------------
  // Return Service Interface
  // ---------------------------------------------------------------------------

  return {
    install,
    uninstall,
    enable,
    disable,
    update,
    list,
    search,
    info,
    getConfig,
    setConfig,
    scaffold,
    validate,
  };
}
