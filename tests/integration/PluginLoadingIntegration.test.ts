/**
 * Integration tests for plugin loading and lifecycle - Task 11.2
 * Tests for loading, mixed valid/invalid plugins, hook integration, install/uninstall, and config.
 *
 * Requirements coverage: 1.1, 1.2, 1.5, 1.6, 3.1, 3.2, 3.3, 3.4, 6.2, 6.4, 9.4, 9.6
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  createPluginLoader,
  createPluginRegistry,
  createManifestValidator,
  createPluginContext,
  createHookRunner,
  type PluginLoaderService,
  type PluginRegistryService,
  type HookRunnerExtendedService,
  type PluginManifest,
  type PluginLoadConfig,
  type HookContext,
  type HookHandlerResult,
} from '../../src/plugins/index.js';
import { createPluginManager, type PluginManagerService } from '../../src/plugins/PluginManager.js';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

function createValidManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    name: 'test-plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'Test Author',
    entryPoint: './index.js',
    red64CliVersion: '>=1.0.0',
    extensionPoints: ['commands'],
    ...overrides,
  };
}

async function createTestPluginDir(
  baseDir: string,
  pluginName: string,
  manifest: PluginManifest,
  entryPointContent?: string
): Promise<string> {
  const pluginDir = path.join(baseDir, pluginName);
  await fs.mkdir(pluginDir, { recursive: true });

  // Write manifest
  await fs.writeFile(
    path.join(pluginDir, 'red64-plugin.json'),
    JSON.stringify(manifest, null, 2)
  );

  // Write entry point
  const content = entryPointContent ?? `
    export function activate(context) {
      // Activated
    }
    export function deactivate() {
      // Deactivated
    }
  `;
  await fs.writeFile(path.join(pluginDir, 'index.js'), content);

  return pluginDir;
}

function createLoadConfig(tmpDir: string, overrides: Partial<PluginLoadConfig> = {}): PluginLoadConfig {
  return {
    pluginDirs: [path.join(tmpDir, 'plugins')],
    nodeModulesDir: path.join(tmpDir, 'node_modules'),
    cliVersion: '1.0.0',
    enabledPlugins: new Set<string>(),
    devMode: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Plugin Loading Integration Tests - Task 11.2', () => {
  let tmpDir: string;
  let pluginsDir: string;
  let registry: PluginRegistryService;
  let logMessages: Array<{ level: string; message: string }>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plugin-integration-test-'));
    pluginsDir = path.join(tmpDir, 'plugins');
    await fs.mkdir(pluginsDir, { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'node_modules'), { recursive: true });

    registry = createPluginRegistry();
    logMessages = [];
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  function createLoader(): PluginLoaderService {
    const validator = createManifestValidator();
    const logger = (level: 'info' | 'warn' | 'error', message: string): void => {
      logMessages.push({ level, message });
    };

    return createPluginLoader({
      registry,
      validator,
      contextFactory: (opts) =>
        createPluginContext({
          ...opts,
          logger,
        }),
      logger,
    });
  }

  // ---------------------------------------------------------------------------
  // Loading a valid test plugin from a local directory
  // ---------------------------------------------------------------------------

  describe('Loading a valid test plugin from a local directory', () => {
    it('loads a valid plugin, activates it, and registers extensions', async () => {
      const manifest = createValidManifest({
        name: 'valid-test-plugin',
        extensionPoints: ['commands'],
      });

      await createTestPluginDir(
        pluginsDir,
        'valid-test-plugin',
        manifest,
        `
        export function activate(context) {
          context.registerCommand({
            name: 'test-command',
            description: 'Test command from plugin',
            handler: async () => ({ success: true }),
          });
        }
        export function deactivate() {}
        `
      );

      const loader = createLoader();
      const config = createLoadConfig(tmpDir, {
        enabledPlugins: new Set(['valid-test-plugin']),
      });

      const result = await loader.loadPlugins(config);

      // Verify load result
      expect(result.loaded).toHaveLength(1);
      expect(result.loaded[0]?.name).toBe('valid-test-plugin');
      expect(result.errors).toHaveLength(0);

      // Verify plugin is registered
      const plugin = registry.getPlugin('valid-test-plugin');
      expect(plugin).toBeDefined();
      expect(plugin?.version).toBe('1.0.0');

      // Verify extension is registered
      const command = registry.getCommand('test-command');
      expect(command).toBeDefined();
      expect(command?.pluginName).toBe('valid-test-plugin');
    });

    it('returns correct load result structure', async () => {
      const manifest = createValidManifest({ name: 'structure-test-plugin' });
      await createTestPluginDir(pluginsDir, 'structure-test-plugin', manifest);

      const loader = createLoader();
      const config = createLoadConfig(tmpDir, {
        enabledPlugins: new Set(['structure-test-plugin']),
      });

      const result = await loader.loadPlugins(config);

      expect(result).toHaveProperty('loaded');
      expect(result).toHaveProperty('skipped');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.loaded)).toBe(true);
      expect(Array.isArray(result.skipped)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Loading a directory with mixed valid and invalid plugins
  // ---------------------------------------------------------------------------

  describe('Loading a directory with mixed valid and invalid plugins', () => {
    it('loads valid plugins and reports errors for invalid ones', async () => {
      // Create a valid plugin
      const validManifest = createValidManifest({ name: 'valid-plugin' });
      await createTestPluginDir(pluginsDir, 'valid-plugin', validManifest);

      // Create an invalid plugin (missing required fields)
      const invalidPluginDir = path.join(pluginsDir, 'invalid-plugin');
      await fs.mkdir(invalidPluginDir, { recursive: true });
      await fs.writeFile(
        path.join(invalidPluginDir, 'red64-plugin.json'),
        JSON.stringify({ name: 'invalid-plugin' }) // Missing required fields
      );

      // Create another valid plugin
      const anotherValidManifest = createValidManifest({ name: 'another-valid-plugin' });
      await createTestPluginDir(pluginsDir, 'another-valid-plugin', anotherValidManifest);

      const loader = createLoader();
      const config = createLoadConfig(tmpDir, {
        enabledPlugins: new Set(['valid-plugin', 'invalid-plugin', 'another-valid-plugin']),
      });

      const result = await loader.loadPlugins(config);

      // Two valid plugins should load
      expect(result.loaded).toHaveLength(2);
      expect(result.loaded.map((p) => p.name).sort()).toEqual(['another-valid-plugin', 'valid-plugin']);

      // One plugin should have an error
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.pluginName).toBe('invalid-plugin');
    });

    it('reports correct skip reason for version-incompatible plugins', async () => {
      // Create a plugin requiring a future CLI version
      const incompatibleManifest = createValidManifest({
        name: 'incompatible-plugin',
        red64CliVersion: '>=99.0.0',
      });
      await createTestPluginDir(pluginsDir, 'incompatible-plugin', incompatibleManifest);

      const loader = createLoader();
      const config = createLoadConfig(tmpDir, {
        cliVersion: '1.0.0',
        enabledPlugins: new Set(['incompatible-plugin']),
      });

      const result = await loader.loadPlugins(config);

      expect(result.loaded).toHaveLength(0);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0]?.name).toBe('incompatible-plugin');
      expect(result.skipped[0]?.reason).toMatch(/version|compatible/i);
    });

    it('handles plugin with invalid entry point', async () => {
      const manifest = createValidManifest({
        name: 'bad-entry-plugin',
        entryPoint: './nonexistent.js',
      });

      const pluginDir = path.join(pluginsDir, 'bad-entry-plugin');
      await fs.mkdir(pluginDir, { recursive: true });
      await fs.writeFile(
        path.join(pluginDir, 'red64-plugin.json'),
        JSON.stringify(manifest)
      );
      // Don't create the entry point file

      const loader = createLoader();
      const config = createLoadConfig(tmpDir, {
        enabledPlugins: new Set(['bad-entry-plugin']),
      });

      const result = await loader.loadPlugins(config);

      expect(result.loaded).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.pluginName).toBe('bad-entry-plugin');
    });
  });

  // ---------------------------------------------------------------------------
  // Hook runner integrated with PhaseExecutor
  // ---------------------------------------------------------------------------

  describe('Hook runner integration', () => {
    it('executes pre-phase hooks in priority order', async () => {
      const hookRunner = createHookRunner({ registry, timeout: 1000 });
      const executionOrder: string[] = [];

      // Register hooks with different priorities
      hookRunner.registerHook('plugin-late', {
        phase: 'requirements',
        timing: 'pre',
        priority: 'late',
        handler: async (): Promise<HookHandlerResult> => {
          executionOrder.push('late');
          return { action: 'continue' };
        },
      });

      hookRunner.registerHook('plugin-early', {
        phase: 'requirements',
        timing: 'pre',
        priority: 'early',
        handler: async (): Promise<HookHandlerResult> => {
          executionOrder.push('early');
          return { action: 'continue' };
        },
      });

      hookRunner.registerHook('plugin-normal', {
        phase: 'requirements',
        timing: 'pre',
        priority: 'normal',
        handler: async (): Promise<HookHandlerResult> => {
          executionOrder.push('normal');
          return { action: 'continue' };
        },
      });

      const context: HookContext = {
        phase: 'requirements',
        timing: 'pre',
        feature: 'test-feature',
        specMetadata: {},
        flowState: {},
      };

      const result = await hookRunner.runPrePhaseHooks('requirements', context);

      expect(result.executedHooks).toBe(3);
      expect(executionOrder).toEqual(['early', 'normal', 'late']);
    });

    it('veto stops pre-phase execution and records reason', async () => {
      const hookRunner = createHookRunner({ registry, timeout: 1000 });
      const executionOrder: string[] = [];

      hookRunner.registerHook('veto-plugin', {
        phase: 'design',
        timing: 'pre',
        priority: 'early',
        handler: async (): Promise<HookHandlerResult> => {
          executionOrder.push('veto');
          return { action: 'veto', reason: 'Design review pending' };
        },
      });

      hookRunner.registerHook('after-veto-plugin', {
        phase: 'design',
        timing: 'pre',
        priority: 'normal',
        handler: async (): Promise<HookHandlerResult> => {
          executionOrder.push('should-not-run');
          return { action: 'continue' };
        },
      });

      const context: HookContext = {
        phase: 'design',
        timing: 'pre',
        feature: 'test-feature',
        specMetadata: {},
        flowState: {},
      };

      const result = await hookRunner.runPrePhaseHooks('design', context);

      expect(result.vetoed).toBe(true);
      expect(result.vetoReason).toBe('Design review pending');
      expect(result.vetoPlugin).toBe('veto-plugin');
      expect(executionOrder).toEqual(['veto']);
      expect(executionOrder).not.toContain('should-not-run');
    });

    it('post-phase hooks continue despite errors', async () => {
      const hookRunner = createHookRunner({ registry, timeout: 1000 });
      const executionOrder: string[] = [];

      hookRunner.registerHook('error-plugin', {
        phase: 'tasks',
        timing: 'post',
        priority: 'early',
        handler: async (): Promise<HookHandlerResult> => {
          executionOrder.push('error');
          throw new Error('Post-hook error');
        },
      });

      hookRunner.registerHook('continue-plugin', {
        phase: 'tasks',
        timing: 'post',
        priority: 'normal',
        handler: async (): Promise<HookHandlerResult> => {
          executionOrder.push('continue');
          return { action: 'continue' };
        },
      });

      const context: HookContext = {
        phase: 'tasks',
        timing: 'post',
        feature: 'test-feature',
        specMetadata: {},
        flowState: {},
      };

      const result = await hookRunner.runPostPhaseHooks('tasks', context);

      // Both hooks should execute
      expect(executionOrder).toEqual(['error', 'continue']);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.pluginName).toBe('error-plugin');
      expect(result.executedHooks).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Plugin install and uninstall with mock npm
  // ---------------------------------------------------------------------------

  describe('Plugin install and uninstall end-to-end with mock npm', () => {
    let projectDir: string;
    let nodeModulesDir: string;
    let pluginsStateDir: string;
    let mockSpawn: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      projectDir = path.join(tmpDir, 'project');
      nodeModulesDir = path.join(projectDir, 'node_modules');
      pluginsStateDir = path.join(projectDir, '.red64');

      await fs.mkdir(projectDir, { recursive: true });
      await fs.mkdir(nodeModulesDir, { recursive: true });
      await fs.mkdir(pluginsStateDir, { recursive: true });

      mockSpawn = vi.fn(async (command: string, args: string[]) => {
        // Simulate successful npm operations
        return { code: 0, stdout: '', stderr: '' };
      });
    });

    function createManager(): PluginManagerService {
      const validator = createManifestValidator();
      const managerRegistry = createPluginRegistry();
      const logger = (level: 'info' | 'warn' | 'error', message: string): void => {
        logMessages.push({ level, message });
      };

      return createPluginManager({
        registry: managerRegistry,
        validator,
        projectDir,
        nodeModulesDir,
        cliVersion: '1.0.0',
        spawn: mockSpawn,
        logger,
      });
    }

    it('installs a plugin and adds it to state file', async () => {
      const manifest = createValidManifest({ name: 'install-test-plugin' });
      await createTestPluginDir(nodeModulesDir, 'install-test-plugin', manifest);

      const manager = createManager();
      const result = await manager.install('install-test-plugin');

      expect(result.success).toBe(true);
      expect(result.pluginName).toBe('install-test-plugin');

      // Verify state file
      const stateFilePath = path.join(pluginsStateDir, 'plugins.json');
      const state = JSON.parse(await fs.readFile(stateFilePath, 'utf-8'));
      expect(state.plugins['install-test-plugin']).toBeDefined();
      expect(state.plugins['install-test-plugin'].enabled).toBe(true);
    });

    it('uninstalls a plugin and removes it from state file', async () => {
      const manifest = createValidManifest({ name: 'uninstall-test-plugin' });
      await createTestPluginDir(nodeModulesDir, 'uninstall-test-plugin', manifest);

      const manager = createManager();

      // First install
      await manager.install('uninstall-test-plugin');

      // Then uninstall
      const result = await manager.uninstall('uninstall-test-plugin');

      expect(result.success).toBe(true);

      // Verify state file
      const stateFilePath = path.join(pluginsStateDir, 'plugins.json');
      const state = JSON.parse(await fs.readFile(stateFilePath, 'utf-8'));
      expect(state.plugins['uninstall-test-plugin']).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Plugin enable/disable with state file persistence
  // ---------------------------------------------------------------------------

  describe('Plugin enable/disable with state file persistence', () => {
    let projectDir: string;
    let nodeModulesDir: string;
    let pluginsStateDir: string;
    let mockSpawn: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      projectDir = path.join(tmpDir, 'project');
      nodeModulesDir = path.join(projectDir, 'node_modules');
      pluginsStateDir = path.join(projectDir, '.red64');

      await fs.mkdir(projectDir, { recursive: true });
      await fs.mkdir(nodeModulesDir, { recursive: true });
      await fs.mkdir(pluginsStateDir, { recursive: true });

      mockSpawn = vi.fn(async () => ({ code: 0, stdout: '', stderr: '' }));
    });

    function createManager(): PluginManagerService {
      const validator = createManifestValidator();
      const managerRegistry = createPluginRegistry();
      const logger = (level: 'info' | 'warn' | 'error', message: string): void => {
        logMessages.push({ level, message });
      };

      return createPluginManager({
        registry: managerRegistry,
        validator,
        projectDir,
        nodeModulesDir,
        cliVersion: '1.0.0',
        spawn: mockSpawn,
        logger,
      });
    }

    it('disabling a plugin persists to state file', async () => {
      const manifest = createValidManifest({ name: 'disable-test-plugin' });
      await createTestPluginDir(nodeModulesDir, 'disable-test-plugin', manifest);

      const manager = createManager();
      await manager.install('disable-test-plugin');
      await manager.disable('disable-test-plugin');

      const stateFilePath = path.join(pluginsStateDir, 'plugins.json');
      const state = JSON.parse(await fs.readFile(stateFilePath, 'utf-8'));
      expect(state.plugins['disable-test-plugin'].enabled).toBe(false);
    });

    it('enabling a plugin persists to state file', async () => {
      const manifest = createValidManifest({ name: 'enable-test-plugin' });
      await createTestPluginDir(nodeModulesDir, 'enable-test-plugin', manifest);

      const manager = createManager();
      await manager.install('enable-test-plugin');
      await manager.disable('enable-test-plugin');
      await manager.enable('enable-test-plugin');

      const stateFilePath = path.join(pluginsStateDir, 'plugins.json');
      const state = JSON.parse(await fs.readFile(stateFilePath, 'utf-8'));
      expect(state.plugins['enable-test-plugin'].enabled).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Config operations: set, get, validation, merge with defaults
  // ---------------------------------------------------------------------------

  describe('Config operations: set, get, validation, merge with defaults', () => {
    let projectDir: string;
    let nodeModulesDir: string;
    let pluginsStateDir: string;
    let mockSpawn: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      projectDir = path.join(tmpDir, 'project');
      nodeModulesDir = path.join(projectDir, 'node_modules');
      pluginsStateDir = path.join(projectDir, '.red64');

      await fs.mkdir(projectDir, { recursive: true });
      await fs.mkdir(nodeModulesDir, { recursive: true });
      await fs.mkdir(pluginsStateDir, { recursive: true });

      mockSpawn = vi.fn(async () => ({ code: 0, stdout: '', stderr: '' }));
    });

    function createManager(): PluginManagerService {
      const validator = createManifestValidator();
      const managerRegistry = createPluginRegistry();
      const logger = (level: 'info' | 'warn' | 'error', message: string): void => {
        logMessages.push({ level, message });
      };

      return createPluginManager({
        registry: managerRegistry,
        validator,
        projectDir,
        nodeModulesDir,
        cliVersion: '1.0.0',
        spawn: mockSpawn,
        logger,
      });
    }

    it('sets and gets config values', async () => {
      const manifest = createValidManifest({
        name: 'config-test-plugin',
        configSchema: {
          apiKey: { type: 'string', description: 'API key' },
          timeout: { type: 'number', description: 'Timeout', default: 30 },
        },
      });
      await createTestPluginDir(nodeModulesDir, 'config-test-plugin', manifest);

      const manager = createManager();
      await manager.install('config-test-plugin');

      // Set config
      await manager.setConfig('config-test-plugin', 'apiKey', 'my-secret-key');

      // Get config
      const config = await manager.getConfig('config-test-plugin');
      expect(config['apiKey']).toBe('my-secret-key');
    });

    it('validates config against schema', async () => {
      const manifest = createValidManifest({
        name: 'schema-config-plugin',
        configSchema: {
          port: { type: 'number', description: 'Port number' },
        },
      });
      await createTestPluginDir(nodeModulesDir, 'schema-config-plugin', manifest);

      const manager = createManager();
      await manager.install('schema-config-plugin');

      // Invalid value should be rejected
      await expect(
        manager.setConfig('schema-config-plugin', 'port', 'not-a-number')
      ).rejects.toThrow();
    });

    it('merges user config with defaults from schema', async () => {
      const manifest = createValidManifest({
        name: 'merge-config-plugin',
        configSchema: {
          host: { type: 'string', description: 'Host', default: 'localhost' },
          port: { type: 'number', description: 'Port', default: 3000 },
          debug: { type: 'boolean', description: 'Debug', default: false },
        },
      });
      await createTestPluginDir(nodeModulesDir, 'merge-config-plugin', manifest);

      const manager = createManager();
      await manager.install('merge-config-plugin');

      // Override only port
      await manager.setConfig('merge-config-plugin', 'port', 8080);

      // Get merged config
      const config = await manager.getConfig('merge-config-plugin');

      // User override
      expect(config['port']).toBe(8080);

      // Defaults
      expect(config['host']).toBe('localhost');
      expect(config['debug']).toBe(false);
    });
  });
});
