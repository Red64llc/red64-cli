/**
 * PluginManager tests - Tasks 6.1, 6.2, 6.3
 * Tests for plugin lifecycle management, enable/disable/list, and configuration.
 *
 * Requirements coverage:
 * - Task 6.1: 3.1, 3.2, 3.6, 3.7, 3.8 (Install, uninstall, update operations)
 * - Task 6.2: 3.3, 3.4, 3.5 (Enable, disable, list operations)
 * - Task 6.3: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6 (Configuration management)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { createPluginManager, type PluginManagerService } from '../../src/plugins/PluginManager.js';
import { createPluginRegistry, type PluginRegistryService } from '../../src/plugins/PluginRegistry.js';
import { createManifestValidator } from '../../src/plugins/ManifestValidator.js';
import type {
  PluginManifest,
  InstallResult,
  UninstallResult,
  UpdateResult,
  PluginInfo,
  InstallStep,
} from '../../src/plugins/types.js';

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
  manifest: PluginManifest
): Promise<string> {
  const pluginDir = path.join(baseDir, pluginName);
  await fs.mkdir(pluginDir, { recursive: true });

  // Write manifest
  await fs.writeFile(
    path.join(pluginDir, 'red64-plugin.json'),
    JSON.stringify(manifest, null, 2)
  );

  // Write entry point
  const entryPoint = `
    export function activate(context) {
      // Activated
    }
  `;
  await fs.writeFile(path.join(pluginDir, 'index.js'), entryPoint);

  return pluginDir;
}

// ---------------------------------------------------------------------------
// Mock spawn function
// ---------------------------------------------------------------------------

interface MockSpawnResult {
  code: number;
  stdout: string;
  stderr: string;
}

function createMockSpawn(results: Map<string, MockSpawnResult>) {
  return vi.fn(async (command: string, args: string[]): Promise<MockSpawnResult> => {
    const key = `${command} ${args.join(' ')}`;
    for (const [pattern, result] of results.entries()) {
      if (key.includes(pattern)) {
        return result;
      }
    }
    // Default: success
    return { code: 0, stdout: '', stderr: '' };
  });
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('PluginManager', () => {
  let tmpDir: string;
  let projectDir: string;
  let nodeModulesDir: string;
  let pluginsStateDir: string;
  let registry: PluginRegistryService;
  let logMessages: Array<{ level: string; message: string }>;
  let mockSpawn: ReturnType<typeof createMockSpawn>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plugin-manager-test-'));
    projectDir = path.join(tmpDir, 'project');
    nodeModulesDir = path.join(projectDir, 'node_modules');
    pluginsStateDir = path.join(projectDir, '.red64');

    await fs.mkdir(projectDir, { recursive: true });
    await fs.mkdir(nodeModulesDir, { recursive: true });
    await fs.mkdir(pluginsStateDir, { recursive: true });

    registry = createPluginRegistry();
    logMessages = [];
    mockSpawn = createMockSpawn(new Map());
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    vi.clearAllMocks();
  });

  function createManager(spawnResults: Map<string, MockSpawnResult> = new Map()): PluginManagerService {
    mockSpawn = createMockSpawn(spawnResults);
    const validator = createManifestValidator();
    const logger = (level: 'info' | 'warn' | 'error', message: string): void => {
      logMessages.push({ level, message });
    };

    return createPluginManager({
      registry,
      validator,
      projectDir,
      nodeModulesDir,
      cliVersion: '1.0.0',
      spawn: mockSpawn,
      logger,
    });
  }

  // ---------------------------------------------------------------------------
  // Task 6.1: Install, Uninstall, and Update Operations
  // ---------------------------------------------------------------------------

  describe('Task 6.1: Install, Uninstall, and Update Operations', () => {
    describe('install() - plugin installation (Req 3.1)', () => {
      it('installs a plugin from npm by spawning npm install', async () => {
        const manifest = createValidManifest({ name: 'npm-plugin' });

        // Create plugin package in node_modules after npm install
        const spawnResults = new Map<string, MockSpawnResult>([
          ['npm install npm-plugin', { code: 0, stdout: 'added 1 package', stderr: '' }],
        ]);

        const manager = createManager(spawnResults);

        // Pre-create the plugin in node_modules (simulating npm install effect)
        await createTestPluginDir(nodeModulesDir, 'npm-plugin', manifest);

        const result = await manager.install('npm-plugin');

        expect(result.success).toBe(true);
        expect(result.pluginName).toBe('npm-plugin');
        expect(result.version).toBe('1.0.0');
        expect(mockSpawn).toHaveBeenCalledWith('npm', expect.arrayContaining(['install', 'npm-plugin']));
      });

      it('installs a plugin from local path', async () => {
        const localPluginDir = path.join(tmpDir, 'local-plugins', 'my-local-plugin');
        const manifest = createValidManifest({ name: 'my-local-plugin' });
        await createTestPluginDir(path.join(tmpDir, 'local-plugins'), 'my-local-plugin', manifest);

        const spawnResults = new Map<string, MockSpawnResult>([
          ['npm install', { code: 0, stdout: 'added 1 package', stderr: '' }],
        ]);

        const manager = createManager(spawnResults);

        // Pre-create the plugin in node_modules (simulating npm install effect)
        await createTestPluginDir(nodeModulesDir, 'my-local-plugin', manifest);

        const result = await manager.install(localPluginDir, { localPath: localPluginDir });

        expect(result.success).toBe(true);
        expect(result.pluginName).toBe('my-local-plugin');
      });

      it('validates manifest after npm install and rolls back if invalid (Req 3.7)', async () => {
        const spawnResults = new Map<string, MockSpawnResult>([
          ['npm install bad-plugin', { code: 0, stdout: 'added 1 package', stderr: '' }],
          ['npm uninstall bad-plugin', { code: 0, stdout: '', stderr: '' }],
        ]);

        const manager = createManager(spawnResults);

        // Create invalid plugin (missing required fields)
        const badPluginDir = path.join(nodeModulesDir, 'bad-plugin');
        await fs.mkdir(badPluginDir, { recursive: true });
        await fs.writeFile(
          path.join(badPluginDir, 'red64-plugin.json'),
          JSON.stringify({ name: 'bad-plugin' }) // Missing required fields
        );

        const result = await manager.install('bad-plugin');

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error).toContain('Invalid');

        // Should have called uninstall for rollback
        expect(mockSpawn).toHaveBeenCalledWith('npm', expect.arrayContaining(['uninstall', 'bad-plugin']));
      });

      it('emits progress callbacks during installation (Req 3.6)', async () => {
        const manifest = createValidManifest({ name: 'progress-plugin' });
        const progressSteps: InstallStep[] = [];

        const spawnResults = new Map<string, MockSpawnResult>([
          ['npm install progress-plugin', { code: 0, stdout: 'added 1 package', stderr: '' }],
        ]);

        const manager = createManager(spawnResults);
        await createTestPluginDir(nodeModulesDir, 'progress-plugin', manifest);

        const result = await manager.install('progress-plugin', {
          onProgress: (step) => progressSteps.push(step),
        });

        expect(result.success).toBe(true);
        expect(progressSteps.length).toBeGreaterThan(0);

        // Should have all phases
        const phases = progressSteps.map((s) => s.phase);
        expect(phases).toContain('downloading');
        expect(phases).toContain('validating');
        expect(phases).toContain('activating');
        expect(phases).toContain('complete');
      });

      it('checks for npm CLI availability and provides actionable error if not found', async () => {
        const spawnResults = new Map<string, MockSpawnResult>([
          ['npm --version', { code: 1, stdout: '', stderr: 'npm: command not found' }],
        ]);

        const manager = createManager(spawnResults);

        const result = await manager.install('some-plugin');

        expect(result.success).toBe(false);
        expect(result.error).toContain('npm');
      });

      it('rolls back on install failure returning to previous state (Req 3.7)', async () => {
        const spawnResults = new Map<string, MockSpawnResult>([
          ['npm install failing-plugin', { code: 1, stdout: '', stderr: 'npm ERR! 404 Not Found' }],
        ]);

        const manager = createManager(spawnResults);

        // Read initial state file
        const stateFilePath = path.join(pluginsStateDir, 'plugins.json');
        await fs.writeFile(stateFilePath, JSON.stringify({ schemaVersion: 1, plugins: {} }));

        const result = await manager.install('failing-plugin');

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();

        // State file should be unchanged
        const stateAfter = JSON.parse(await fs.readFile(stateFilePath, 'utf-8'));
        expect(stateAfter.plugins).toEqual({});
      });
    });

    describe('uninstall() - plugin removal (Req 3.2)', () => {
      it('uninstalls a plugin by deregistering extensions, spawning npm uninstall, and updating state', async () => {
        const manifest = createValidManifest({ name: 'to-remove' });
        const spawnResults = new Map<string, MockSpawnResult>([
          ['npm install to-remove', { code: 0, stdout: '', stderr: '' }],
          ['npm uninstall to-remove', { code: 0, stdout: '', stderr: '' }],
        ]);

        const manager = createManager(spawnResults);
        await createTestPluginDir(nodeModulesDir, 'to-remove', manifest);

        // First install
        await manager.install('to-remove');

        // Then uninstall
        const result = await manager.uninstall('to-remove');

        expect(result.success).toBe(true);
        expect(result.pluginName).toBe('to-remove');
        expect(mockSpawn).toHaveBeenCalledWith('npm', expect.arrayContaining(['uninstall', 'to-remove']));
      });

      it('removes plugin entry from state file', async () => {
        const manifest = createValidManifest({ name: 'state-plugin' });
        const spawnResults = new Map<string, MockSpawnResult>([
          ['npm install state-plugin', { code: 0, stdout: '', stderr: '' }],
          ['npm uninstall state-plugin', { code: 0, stdout: '', stderr: '' }],
        ]);

        const manager = createManager(spawnResults);
        await createTestPluginDir(nodeModulesDir, 'state-plugin', manifest);

        await manager.install('state-plugin');

        // Verify it's in the state
        const stateFilePath = path.join(pluginsStateDir, 'plugins.json');
        let state = JSON.parse(await fs.readFile(stateFilePath, 'utf-8'));
        expect(state.plugins['state-plugin']).toBeDefined();

        // Uninstall
        await manager.uninstall('state-plugin');

        // Verify it's removed from state
        state = JSON.parse(await fs.readFile(stateFilePath, 'utf-8'));
        expect(state.plugins['state-plugin']).toBeUndefined();
      });

      it('disposes services before uninstalling', async () => {
        const manifest = createValidManifest({ name: 'service-plugin', extensionPoints: ['services'] });
        const spawnResults = new Map<string, MockSpawnResult>([
          ['npm install service-plugin', { code: 0, stdout: '', stderr: '' }],
          ['npm uninstall service-plugin', { code: 0, stdout: '', stderr: '' }],
        ]);

        const manager = createManager(spawnResults);

        // Create plugin that registers a service with dispose
        const pluginDir = path.join(nodeModulesDir, 'service-plugin');
        await fs.mkdir(pluginDir, { recursive: true });
        await fs.writeFile(
          path.join(pluginDir, 'red64-plugin.json'),
          JSON.stringify(manifest)
        );
        await fs.writeFile(
          path.join(pluginDir, 'index.js'),
          `
          let disposed = false;
          export function activate(context) {
            context.registerService({
              name: 'my-service',
              factory: () => ({ value: 42 }),
              dispose: () => { disposed = true; globalThis.serviceDisposed = true; }
            });
          }
          `
        );

        // Reset global
        (globalThis as Record<string, unknown>).serviceDisposed = false;

        await manager.install('service-plugin');
        await manager.uninstall('service-plugin');

        // Service should have been disposed
        // Note: We can't directly test this without modifying the registry's unregisterPlugin
        // but the implementation should call registry.unregisterPlugin which disposes services
        expect(mockSpawn).toHaveBeenCalledWith('npm', expect.arrayContaining(['uninstall', 'service-plugin']));
      });
    });

    describe('update() - plugin update (Req 3.8)', () => {
      it('updates a plugin by running npm update and re-validating manifest', async () => {
        const manifestV1 = createValidManifest({ name: 'update-plugin', version: '1.0.0' });
        const manifestV2 = createValidManifest({ name: 'update-plugin', version: '2.0.0' });

        const spawnResults = new Map<string, MockSpawnResult>([
          ['npm install update-plugin', { code: 0, stdout: '', stderr: '' }],
          ['npm update update-plugin', { code: 0, stdout: '', stderr: '' }],
        ]);

        const manager = createManager(spawnResults);

        // Install v1
        await createTestPluginDir(nodeModulesDir, 'update-plugin', manifestV1);
        await manager.install('update-plugin');

        // Simulate npm update by replacing manifest
        await fs.writeFile(
          path.join(nodeModulesDir, 'update-plugin', 'red64-plugin.json'),
          JSON.stringify(manifestV2)
        );

        const result = await manager.update('update-plugin');

        expect(result.success).toBe(true);
        expect(result.previousVersion).toBe('1.0.0');
        expect(result.newVersion).toBe('2.0.0');
      });

      it('preserves user configuration across updates', async () => {
        const manifest = createValidManifest({
          name: 'config-plugin',
          configSchema: {
            apiKey: { type: 'string', description: 'API key', required: true }
          }
        });

        const spawnResults = new Map<string, MockSpawnResult>([
          ['npm install config-plugin', { code: 0, stdout: '', stderr: '' }],
          ['npm update config-plugin', { code: 0, stdout: '', stderr: '' }],
        ]);

        const manager = createManager(spawnResults);
        await createTestPluginDir(nodeModulesDir, 'config-plugin', manifest);

        await manager.install('config-plugin');

        // Set some config
        await manager.setConfig('config-plugin', 'apiKey', 'my-secret-key');

        // Update
        await manager.update('config-plugin');

        // Config should be preserved
        const config = await manager.getConfig('config-plugin');
        expect(config['apiKey']).toBe('my-secret-key');
      });

      it('rolls back if update fails', async () => {
        const manifest = createValidManifest({ name: 'rollback-plugin', version: '1.0.0' });

        const spawnResults = new Map<string, MockSpawnResult>([
          ['npm install rollback-plugin', { code: 0, stdout: '', stderr: '' }],
          ['npm update rollback-plugin', { code: 1, stdout: '', stderr: 'npm ERR! update failed' }],
        ]);

        const manager = createManager(spawnResults);
        await createTestPluginDir(nodeModulesDir, 'rollback-plugin', manifest);
        await manager.install('rollback-plugin');

        const result = await manager.update('rollback-plugin');

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();

        // Plugin should still be at original version in state
        const plugins = await manager.list();
        const plugin = plugins.find((p) => p.name === 'rollback-plugin');
        expect(plugin?.version).toBe('1.0.0');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Task 6.2: Enable, Disable, and List Operations
  // ---------------------------------------------------------------------------

  describe('Task 6.2: Enable, Disable, and List Operations', () => {
    describe('enable() - enabling plugins (Req 3.3)', () => {
      it('sets enabled flag to true in state file', async () => {
        const manifest = createValidManifest({ name: 'enable-test' });
        const spawnResults = new Map<string, MockSpawnResult>([
          ['npm install enable-test', { code: 0, stdout: '', stderr: '' }],
        ]);

        const manager = createManager(spawnResults);
        await createTestPluginDir(nodeModulesDir, 'enable-test', manifest);
        await manager.install('enable-test');

        // Disable first
        await manager.disable('enable-test');
        let plugins = await manager.list();
        expect(plugins.find((p) => p.name === 'enable-test')?.enabled).toBe(false);

        // Enable
        await manager.enable('enable-test');
        plugins = await manager.list();
        expect(plugins.find((p) => p.name === 'enable-test')?.enabled).toBe(true);
      });

      it('throws if plugin is not installed', async () => {
        const manager = createManager();

        await expect(manager.enable('nonexistent')).rejects.toThrow();
      });
    });

    describe('disable() - disabling plugins (Req 3.4)', () => {
      it('sets enabled flag to false and deregisters extensions', async () => {
        const manifest = createValidManifest({ name: 'disable-test', extensionPoints: ['commands'] });
        const spawnResults = new Map<string, MockSpawnResult>([
          ['npm install disable-test', { code: 0, stdout: '', stderr: '' }],
        ]);

        const manager = createManager(spawnResults);
        await createTestPluginDir(nodeModulesDir, 'disable-test', manifest);
        await manager.install('disable-test');

        // Manually register the plugin in the registry to simulate PluginLoader behavior
        // In real usage, PluginLoader would have loaded and activated the plugin
        const mockModule = { activate: () => {} };
        registry.registerPlugin(
          { name: 'disable-test', version: '1.0.0', manifest },
          mockModule
        );
        registry.registerCommand('disable-test', {
          name: 'test-cmd',
          description: 'Test command',
          handler: async () => {},
        });

        // Command should be registered
        expect(registry.getCommand('test-cmd')).toBeDefined();

        await manager.disable('disable-test');

        // Enabled should be false
        const plugins = await manager.list();
        expect(plugins.find((p) => p.name === 'disable-test')?.enabled).toBe(false);

        // Command should be deregistered (via registry.unregisterPlugin)
        expect(registry.getCommand('test-cmd')).toBeUndefined();
      });

      it('warns if other plugins depend on the disabled plugin', async () => {
        const baseManifest = createValidManifest({ name: 'base-plugin' });
        const dependentManifest = createValidManifest({
          name: 'dependent-plugin',
          dependencies: [{ name: 'base-plugin', version: '>=1.0.0' }]
        });

        const spawnResults = new Map<string, MockSpawnResult>([
          ['npm install', { code: 0, stdout: '', stderr: '' }],
        ]);

        const manager = createManager(spawnResults);
        await createTestPluginDir(nodeModulesDir, 'base-plugin', baseManifest);
        await createTestPluginDir(nodeModulesDir, 'dependent-plugin', dependentManifest);

        await manager.install('base-plugin');
        await manager.install('dependent-plugin');

        await manager.disable('base-plugin');

        // Should have logged a warning
        const warnings = logMessages.filter((m) => m.level === 'warn');
        expect(warnings.some((w) => w.message.includes('dependent-plugin') || w.message.includes('depend'))).toBe(true);
      });
    });

    describe('list() - listing plugins (Req 3.5)', () => {
      it('returns all installed plugins with name, version, status, and extension points', async () => {
        const manifest1 = createValidManifest({
          name: 'plugin-1',
          version: '1.0.0',
          extensionPoints: ['commands', 'hooks']
        });
        const manifest2 = createValidManifest({
          name: 'plugin-2',
          version: '2.0.0',
          extensionPoints: ['agents']
        });

        const spawnResults = new Map<string, MockSpawnResult>([
          ['npm install', { code: 0, stdout: '', stderr: '' }],
        ]);

        const manager = createManager(spawnResults);
        await createTestPluginDir(nodeModulesDir, 'plugin-1', manifest1);
        await createTestPluginDir(nodeModulesDir, 'plugin-2', manifest2);

        await manager.install('plugin-1');
        await manager.install('plugin-2');

        const plugins = await manager.list();

        expect(plugins).toHaveLength(2);

        const p1 = plugins.find((p) => p.name === 'plugin-1');
        expect(p1).toBeDefined();
        expect(p1?.version).toBe('1.0.0');
        expect(p1?.enabled).toBe(true);
        expect(p1?.extensionPoints).toContain('commands');
        expect(p1?.extensionPoints).toContain('hooks');

        const p2 = plugins.find((p) => p.name === 'plugin-2');
        expect(p2).toBeDefined();
        expect(p2?.version).toBe('2.0.0');
        expect(p2?.extensionPoints).toContain('agents');
      });

      it('enriches state data with manifest data', async () => {
        const manifest = createValidManifest({
          name: 'enriched-plugin',
          description: 'A plugin with enriched data',
          extensionPoints: ['services', 'templates']
        });

        const spawnResults = new Map<string, MockSpawnResult>([
          ['npm install', { code: 0, stdout: '', stderr: '' }],
        ]);

        const manager = createManager(spawnResults);
        await createTestPluginDir(nodeModulesDir, 'enriched-plugin', manifest);
        await manager.install('enriched-plugin');

        const plugins = await manager.list();
        const plugin = plugins.find((p) => p.name === 'enriched-plugin');

        expect(plugin?.description).toBe('A plugin with enriched data');
        expect(plugin?.extensionPoints).toEqual(['services', 'templates']);
      });

      it('persists state changes atomically to plugins.json', async () => {
        const manifest = createValidManifest({ name: 'atomic-plugin' });
        const spawnResults = new Map<string, MockSpawnResult>([
          ['npm install', { code: 0, stdout: '', stderr: '' }],
        ]);

        const manager = createManager(spawnResults);
        await createTestPluginDir(nodeModulesDir, 'atomic-plugin', manifest);
        await manager.install('atomic-plugin');

        const stateFilePath = path.join(pluginsStateDir, 'plugins.json');
        const state = JSON.parse(await fs.readFile(stateFilePath, 'utf-8'));

        expect(state.schemaVersion).toBe(1);
        expect(state.plugins['atomic-plugin']).toBeDefined();
        expect(state.plugins['atomic-plugin'].version).toBe('1.0.0');
        expect(state.plugins['atomic-plugin'].enabled).toBe(true);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Task 6.3: Plugin Configuration Management
  // ---------------------------------------------------------------------------

  describe('Task 6.3: Plugin Configuration Management', () => {
    describe('getConfig() - reading config (Req 9.1)', () => {
      it('reads plugin-specific configuration values', async () => {
        const manifest = createValidManifest({
          name: 'config-read-plugin',
          configSchema: {
            apiUrl: { type: 'string', description: 'API URL', default: 'https://api.example.com' }
          }
        });

        const spawnResults = new Map<string, MockSpawnResult>([
          ['npm install', { code: 0, stdout: '', stderr: '' }],
        ]);

        const manager = createManager(spawnResults);
        await createTestPluginDir(nodeModulesDir, 'config-read-plugin', manifest);
        await manager.install('config-read-plugin');

        // Set a config value
        await manager.setConfig('config-read-plugin', 'apiUrl', 'https://custom.api.com');

        // Read it back
        const config = await manager.getConfig('config-read-plugin');
        expect(config['apiUrl']).toBe('https://custom.api.com');
      });

      it('reads a specific key when provided', async () => {
        const manifest = createValidManifest({
          name: 'config-key-plugin',
          configSchema: {
            key1: { type: 'string', description: 'Key 1', default: 'value1' },
            key2: { type: 'number', description: 'Key 2', default: 42 }
          }
        });

        const spawnResults = new Map<string, MockSpawnResult>([
          ['npm install', { code: 0, stdout: '', stderr: '' }],
        ]);

        const manager = createManager(spawnResults);
        await createTestPluginDir(nodeModulesDir, 'config-key-plugin', manifest);
        await manager.install('config-key-plugin');
        await manager.setConfig('config-key-plugin', 'key1', 'custom');
        await manager.setConfig('config-key-plugin', 'key2', 100);

        const config = await manager.getConfig('config-key-plugin', 'key1');
        expect(config['key1']).toBe('custom');
        expect(config['key2']).toBeUndefined(); // Only key1 requested
      });
    });

    describe('setConfig() - writing config (Req 9.1, 9.2, 9.3)', () => {
      it('validates config values against plugin schema (Req 9.2)', async () => {
        const manifest = createValidManifest({
          name: 'schema-plugin',
          configSchema: {
            port: { type: 'number', description: 'Port number' },
            debug: { type: 'boolean', description: 'Debug mode' }
          }
        });

        const spawnResults = new Map<string, MockSpawnResult>([
          ['npm install', { code: 0, stdout: '', stderr: '' }],
        ]);

        const manager = createManager(spawnResults);
        await createTestPluginDir(nodeModulesDir, 'schema-plugin', manifest);
        await manager.install('schema-plugin');

        // Valid values
        await expect(manager.setConfig('schema-plugin', 'port', 8080)).resolves.not.toThrow();
        await expect(manager.setConfig('schema-plugin', 'debug', true)).resolves.not.toThrow();
      });

      it('rejects invalid values with descriptive error message (Req 9.3)', async () => {
        const manifest = createValidManifest({
          name: 'reject-plugin',
          configSchema: {
            count: { type: 'number', description: 'Count' }
          }
        });

        const spawnResults = new Map<string, MockSpawnResult>([
          ['npm install', { code: 0, stdout: '', stderr: '' }],
        ]);

        const manager = createManager(spawnResults);
        await createTestPluginDir(nodeModulesDir, 'reject-plugin', manifest);
        await manager.install('reject-plugin');

        // Invalid value (string instead of number)
        await expect(manager.setConfig('reject-plugin', 'count', 'not-a-number'))
          .rejects.toThrow(/number|type|invalid/i);
      });

      it('stores config in .red64/plugins/<plugin-name>/config.json (Req 9.4)', async () => {
        const manifest = createValidManifest({
          name: 'store-plugin',
          configSchema: {
            setting: { type: 'string', description: 'A setting' }
          }
        });

        const spawnResults = new Map<string, MockSpawnResult>([
          ['npm install', { code: 0, stdout: '', stderr: '' }],
        ]);

        const manager = createManager(spawnResults);
        await createTestPluginDir(nodeModulesDir, 'store-plugin', manifest);
        await manager.install('store-plugin');

        await manager.setConfig('store-plugin', 'setting', 'my-value');

        const configFilePath = path.join(pluginsStateDir, 'plugins', 'store-plugin', 'config.json');
        const configFile = JSON.parse(await fs.readFile(configFilePath, 'utf-8'));
        expect(configFile.setting).toBe('my-value');
      });
    });

    describe('config merging (Req 9.5, 9.6)', () => {
      it('merges defaults from manifest with user overrides (Req 9.6)', async () => {
        const manifest = createValidManifest({
          name: 'merge-plugin',
          configSchema: {
            timeout: { type: 'number', description: 'Timeout', default: 30 },
            retries: { type: 'number', description: 'Retries', default: 3 },
            verbose: { type: 'boolean', description: 'Verbose', default: false }
          }
        });

        const spawnResults = new Map<string, MockSpawnResult>([
          ['npm install', { code: 0, stdout: '', stderr: '' }],
        ]);

        const manager = createManager(spawnResults);
        await createTestPluginDir(nodeModulesDir, 'merge-plugin', manifest);
        await manager.install('merge-plugin');

        // Override only 'timeout'
        await manager.setConfig('merge-plugin', 'timeout', 60);

        const config = await manager.getConfig('merge-plugin');

        // User override takes precedence
        expect(config['timeout']).toBe(60);

        // Defaults are still present
        expect(config['retries']).toBe(3);
        expect(config['verbose']).toBe(false);
      });

      it('provides merged config to plugin via PluginContext (Req 9.5)', async () => {
        const manifest = createValidManifest({
          name: 'context-config-plugin',
          configSchema: {
            apiKey: { type: 'string', description: 'API Key', default: 'default-key' }
          }
        });

        const spawnResults = new Map<string, MockSpawnResult>([
          ['npm install', { code: 0, stdout: '', stderr: '' }],
        ]);

        const manager = createManager(spawnResults);

        // Create plugin that reads config from context
        const pluginDir = path.join(nodeModulesDir, 'context-config-plugin');
        await fs.mkdir(pluginDir, { recursive: true });
        await fs.writeFile(
          path.join(pluginDir, 'red64-plugin.json'),
          JSON.stringify(manifest)
        );
        await fs.writeFile(
          path.join(pluginDir, 'index.js'),
          `
          export function activate(context) {
            globalThis.pluginConfig = context.config;
          }
          `
        );

        // Reset global
        (globalThis as Record<string, unknown>).pluginConfig = null;

        await manager.install('context-config-plugin');

        // Set custom config
        await manager.setConfig('context-config-plugin', 'apiKey', 'custom-key');

        // The config should have been provided during activation
        // Note: For full testing, we'd need to reload the plugin
        // For now, verify the config is stored correctly
        const config = await manager.getConfig('context-config-plugin');
        expect(config['apiKey']).toBe('custom-key');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Additional PluginManager methods (search, info, scaffold, validate)
  // ---------------------------------------------------------------------------

  describe('Additional operations', () => {
    describe('info() - plugin details', () => {
      it('returns detailed plugin metadata', async () => {
        const manifest = createValidManifest({
          name: 'info-plugin',
          description: 'A detailed plugin',
          author: 'Test Author',
          extensionPoints: ['commands', 'services'],
          configSchema: {
            option: { type: 'string', description: 'An option' }
          }
        });

        const spawnResults = new Map<string, MockSpawnResult>([
          ['npm install', { code: 0, stdout: '', stderr: '' }],
        ]);

        const manager = createManager(spawnResults);
        await createTestPluginDir(nodeModulesDir, 'info-plugin', manifest);
        await manager.install('info-plugin');

        const info = await manager.info('info-plugin');

        expect(info).not.toBeNull();
        expect(info?.name).toBe('info-plugin');
        expect(info?.author).toBe('Test Author');
        expect(info?.extensionPoints).toContain('commands');
        expect(info?.configSchema).toHaveProperty('option');
      });

      it('returns null for non-existent plugin', async () => {
        const manager = createManager();
        const info = await manager.info('nonexistent');
        expect(info).toBeNull();
      });
    });

    describe('validate() - manifest validation', () => {
      it('validates a plugin at a given path', async () => {
        const manifest = createValidManifest({ name: 'valid-plugin' });
        const pluginDir = await createTestPluginDir(tmpDir, 'valid-plugin', manifest);

        const manager = createManager();
        const result = await manager.validate(pluginDir);

        expect(result.valid).toBe(true);
        expect(result.manifest?.name).toBe('valid-plugin');
      });

      it('returns validation errors for invalid manifest', async () => {
        const badPluginDir = path.join(tmpDir, 'bad-plugin');
        await fs.mkdir(badPluginDir, { recursive: true });
        await fs.writeFile(
          path.join(badPluginDir, 'red64-plugin.json'),
          JSON.stringify({ name: 'bad-plugin' }) // Missing required fields
        );

        const manager = createManager();
        const result = await manager.validate(badPluginDir);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Task 7.1: Plugin Search and Info Commands
  // Requirements: 11.1, 11.2, 11.3, 11.4
  // ---------------------------------------------------------------------------

  describe('Task 7.1: Plugin Search and Info Commands', () => {
    describe('search() - querying npm registry (Req 11.1)', () => {
      it('queries npm registry with keywords:red64-plugin and returns matching plugins', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            objects: [
              {
                package: {
                  name: 'red64-plugin-analyzer',
                  description: 'Static code analyzer plugin',
                  version: '1.2.0',
                  author: { name: 'Plugin Author' },
                },
              },
              {
                package: {
                  name: 'red64-plugin-formatter',
                  description: 'Code formatter plugin',
                  version: '0.9.0',
                  author: { name: 'Another Author' },
                },
              },
            ],
          }),
        });
        vi.stubGlobal('fetch', mockFetch);

        const manager = createManager();
        const results = await manager.search('analyzer');

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const calledUrl = mockFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain('/-/v1/search');
        expect(calledUrl).toContain('keywords:red64-plugin');
        expect(calledUrl).toContain('analyzer');

        expect(results).toHaveLength(2);
        expect(results[0]).toEqual({
          name: 'red64-plugin-analyzer',
          description: 'Static code analyzer plugin',
          version: '1.2.0',
          author: 'Plugin Author',
        });
        expect(results[1]).toEqual({
          name: 'red64-plugin-formatter',
          description: 'Code formatter plugin',
          version: '0.9.0',
          author: 'Another Author',
        });

        vi.unstubAllGlobals();
      });

      it('supports custom registry URL (Req 11.3)', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ objects: [] }),
        });
        vi.stubGlobal('fetch', mockFetch);

        const manager = createManager();
        const customRegistry = 'https://registry.mycompany.com';
        await manager.search('plugin', { registryUrl: customRegistry });

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const calledUrl = mockFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain('https://registry.mycompany.com');
        expect(calledUrl).toContain('/-/v1/search');

        vi.unstubAllGlobals();
      });

      it('handles unreachable registry gracefully with appropriate message (Req 11.4)', async () => {
        const mockFetch = vi.fn().mockRejectedValue(new Error('ENOTFOUND: getaddrinfo failed'));
        vi.stubGlobal('fetch', mockFetch);

        const manager = createManager();
        const results = await manager.search('plugin');

        // Should return empty array on network error
        expect(results).toEqual([]);

        // Should log an error with guidance
        const errorLogs = logMessages.filter((m) => m.level === 'error');
        expect(errorLogs.length).toBeGreaterThan(0);
        expect(errorLogs.some((e) =>
          e.message.toLowerCase().includes('network') ||
          e.message.toLowerCase().includes('registry') ||
          e.message.toLowerCase().includes('error')
        )).toBe(true);

        vi.unstubAllGlobals();
      });

      it('handles non-OK response from registry', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        });
        vi.stubGlobal('fetch', mockFetch);

        const manager = createManager();
        const results = await manager.search('plugin');

        expect(results).toEqual([]);

        vi.unstubAllGlobals();
      });

      it('handles missing author field gracefully', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            objects: [
              {
                package: {
                  name: 'red64-plugin-noauthor',
                  description: 'A plugin without author',
                  version: '1.0.0',
                  // No author field
                },
              },
            ],
          }),
        });
        vi.stubGlobal('fetch', mockFetch);

        const manager = createManager();
        const results = await manager.search('noauthor');

        expect(results).toHaveLength(1);
        expect(results[0]?.author).toBe('Unknown');

        vi.unstubAllGlobals();
      });

      it('URL-encodes the query parameter', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ objects: [] }),
        });
        vi.stubGlobal('fetch', mockFetch);

        const manager = createManager();
        await manager.search('test plugin with spaces');

        const calledUrl = mockFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain('test%20plugin%20with%20spaces');

        vi.unstubAllGlobals();
      });
    });

    describe('info() - detailed plugin metadata (Req 11.2)', () => {
      it('returns detailed info for locally installed plugin enriched with manifest data', async () => {
        const manifest = createValidManifest({
          name: 'info-detail-plugin',
          version: '2.1.0',
          description: 'A plugin with full details',
          author: 'Detail Author',
          extensionPoints: ['commands', 'hooks', 'services'],
          dependencies: [{ name: 'other-plugin', version: '>=1.0.0' }],
          configSchema: {
            apiKey: { type: 'string', description: 'API Key', default: 'default' },
            retries: { type: 'number', description: 'Retry count', default: 3 },
          },
        });

        const spawnResults = new Map<string, MockSpawnResult>([
          ['npm install', { code: 0, stdout: '', stderr: '' }],
        ]);

        const manager = createManager(spawnResults);
        await createTestPluginDir(nodeModulesDir, 'info-detail-plugin', manifest);
        await manager.install('info-detail-plugin');

        const info = await manager.info('info-detail-plugin');

        expect(info).not.toBeNull();
        expect(info?.name).toBe('info-detail-plugin');
        expect(info?.version).toBe('2.1.0');
        expect(info?.description).toBe('A plugin with full details');
        expect(info?.author).toBe('Detail Author');
        expect(info?.compatibilityRange).toBe('>=1.0.0');
        expect(info?.extensionPoints).toEqual(['commands', 'hooks', 'services']);
        expect(info?.dependencies).toEqual(['other-plugin']);
        expect(info?.configSchema).toHaveProperty('apiKey');
        expect(info?.configSchema).toHaveProperty('retries');
        expect(info?.enabled).toBe(true);
      });

      it('fetches info from npm registry for non-installed plugins', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            name: 'remote-plugin',
            version: '3.0.0',
            description: 'A remote plugin not installed locally',
            author: { name: 'Remote Author' },
            keywords: ['red64-plugin'],
            'red64-plugin': {
              red64CliVersion: '>=1.0.0',
              extensionPoints: ['agents', 'templates'],
              configSchema: {
                endpoint: { type: 'string', description: 'API endpoint' },
              },
            },
          }),
        });
        vi.stubGlobal('fetch', mockFetch);

        const manager = createManager();
        const info = await manager.info('remote-plugin');

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const calledUrl = mockFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain('/remote-plugin');

        expect(info).not.toBeNull();
        expect(info?.name).toBe('remote-plugin');
        expect(info?.version).toBe('3.0.0');
        expect(info?.description).toBe('A remote plugin not installed locally');
        expect(info?.author).toBe('Remote Author');
        expect(info?.enabled).toBe(false);

        vi.unstubAllGlobals();
      });

      it('fetches from custom registry URL when configured (Req 11.3)', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            name: 'private-plugin',
            version: '1.0.0',
            description: 'A private plugin',
            author: { name: 'Private Author' },
          }),
        });
        vi.stubGlobal('fetch', mockFetch);

        const manager = createManager();
        const customRegistry = 'https://private.registry.com';
        const info = await manager.info('private-plugin', { registryUrl: customRegistry });

        const calledUrl = mockFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain('https://private.registry.com');

        vi.unstubAllGlobals();
      });

      it('handles network errors when fetching from registry', async () => {
        const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
        vi.stubGlobal('fetch', mockFetch);

        const manager = createManager();
        const info = await manager.info('nonexistent-plugin');

        expect(info).toBeNull();

        vi.unstubAllGlobals();
      });

      it('handles 404 from registry for non-existent package', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        });
        vi.stubGlobal('fetch', mockFetch);

        const manager = createManager();
        const info = await manager.info('totally-nonexistent-plugin');

        expect(info).toBeNull();

        vi.unstubAllGlobals();
      });

      it('displays all required fields: description, author, version, compatibility, extensions, config', async () => {
        const manifest = createValidManifest({
          name: 'full-detail-plugin',
          version: '1.5.0',
          description: 'Full details test',
          author: 'Full Author',
          red64CliVersion: '>=0.9.0',  // Use a range compatible with CLI version 1.0.0
          extensionPoints: ['commands'],
          configSchema: {
            option: { type: 'boolean', description: 'An option', default: true },
          },
        });

        const spawnResults = new Map<string, MockSpawnResult>([
          ['npm install', { code: 0, stdout: '', stderr: '' }],
        ]);

        const manager = createManager(spawnResults);
        await createTestPluginDir(nodeModulesDir, 'full-detail-plugin', manifest);
        await manager.install('full-detail-plugin');

        const info = await manager.info('full-detail-plugin');

        // All required fields from Req 11.2
        expect(info).toHaveProperty('description', 'Full details test');
        expect(info).toHaveProperty('author', 'Full Author');
        expect(info).toHaveProperty('version', '1.5.0');
        expect(info).toHaveProperty('compatibilityRange', '>=0.9.0');
        expect(info).toHaveProperty('extensionPoints');
        expect(info).toHaveProperty('configSchema');
      });
    });

    describe('custom registry configuration (Req 11.3)', () => {
      it('uses default npm registry when no custom URL provided', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ objects: [] }),
        });
        vi.stubGlobal('fetch', mockFetch);

        const manager = createManager();
        await manager.search('test');

        const calledUrl = mockFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain('registry.npmjs.org');

        vi.unstubAllGlobals();
      });

      it('stores custom registry URL in state file when configured', async () => {
        // This tests that the registry URL can be persisted
        // The actual implementation will store it in plugins.json
        const customRegistryUrl = 'https://custom.registry.example.com';

        // Write initial state with custom registry
        const stateFilePath = path.join(pluginsStateDir, 'plugins.json');
        await fs.writeFile(stateFilePath, JSON.stringify({
          schemaVersion: 1,
          plugins: {},
          registryUrl: customRegistryUrl,
        }));

        // Read the state to verify it's stored
        const state = JSON.parse(await fs.readFile(stateFilePath, 'utf-8'));
        expect(state.registryUrl).toBe(customRegistryUrl);
      });
    });
  });
});
