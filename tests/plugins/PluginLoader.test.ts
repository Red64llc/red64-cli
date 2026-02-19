/**
 * PluginLoader tests - Tasks 4.1 and 4.2
 * Tests for plugin discovery, validation, and activation.
 *
 * Requirements coverage:
 * - Task 4.1: 1.1, 1.2, 1.3, 1.5 (Plugin source scanning and discovery)
 * - Task 4.2: 1.4, 1.5, 1.6, 1.7, 2.3, 2.4, 2.5, 10.2, 10.5 (Dependency-aware loading and activation)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { createPluginLoader } from '../../src/plugins/PluginLoader.js';
import { createPluginRegistry, type PluginRegistryService } from '../../src/plugins/PluginRegistry.js';
import { createManifestValidator } from '../../src/plugins/ManifestValidator.js';
import { createPluginContext, type PluginContextOptions } from '../../src/plugins/PluginContext.js';
import type {
  PluginManifest,
  PluginLoadConfig,
  PluginContextInterface,
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

function createLoadConfig(overrides: Partial<PluginLoadConfig> = {}): PluginLoadConfig {
  return {
    pluginDirs: [],
    nodeModulesDir: '/tmp/node_modules',
    cliVersion: '1.0.0',
    enabledPlugins: new Set<string>(),
    devMode: false,
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
  const entryPoint = entryPointContent ?? `
    export function activate(context) {
      // Activated
    }
  `;
  await fs.writeFile(path.join(pluginDir, 'index.js'), entryPoint);

  return pluginDir;
}

async function createNpmPackageWithKeyword(
  nodeModulesDir: string,
  packageName: string,
  manifest: PluginManifest
): Promise<string> {
  const packageDir = path.join(nodeModulesDir, packageName);
  await fs.mkdir(packageDir, { recursive: true });

  // Write package.json with red64-plugin keyword
  const packageJson = {
    name: packageName,
    version: manifest.version,
    keywords: ['red64-plugin'],
    main: manifest.entryPoint,
  };
  await fs.writeFile(
    path.join(packageDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // Write plugin manifest
  await fs.writeFile(
    path.join(packageDir, 'red64-plugin.json'),
    JSON.stringify(manifest, null, 2)
  );

  // Write entry point
  const entryPoint = `
    export function activate(context) {
      // Activated from npm package
    }
  `;
  await fs.writeFile(path.join(packageDir, 'index.js'), entryPoint);

  return packageDir;
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('PluginLoader', () => {
  let tmpDir: string;
  let registry: PluginRegistryService;
  let logMessages: Array<{ level: string; message: string }>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plugin-loader-test-'));
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

  function createLoader() {
    const validator = createManifestValidator();
    const contextFactory = (options: PluginContextOptions): PluginContextInterface => {
      return createPluginContext(options);
    };
    const logger = (level: 'info' | 'warn' | 'error', message: string) => {
      logMessages.push({ level, message });
    };

    return createPluginLoader({
      registry,
      validator,
      contextFactory,
      logger,
    });
  }

  // ---------------------------------------------------------------------------
  // Task 4.1: Plugin Source Scanning and Discovery
  // ---------------------------------------------------------------------------

  describe('Task 4.1: Plugin Source Scanning and Discovery', () => {
    describe('Scanning configured plugin directories (Req 1.1)', () => {
      it('discovers plugins in configured plugin directories', async () => {
        const pluginsDir = path.join(tmpDir, 'plugins');
        await fs.mkdir(pluginsDir, { recursive: true });

        const manifest = createValidManifest({ name: 'local-plugin' });
        await createTestPluginDir(pluginsDir, 'local-plugin', manifest);

        const loader = createLoader();
        const config = createLoadConfig({
          pluginDirs: [pluginsDir],
          enabledPlugins: new Set(['local-plugin']),
        });

        const result = await loader.loadPlugins(config);

        expect(result.loaded).toHaveLength(1);
        expect(result.loaded[0]?.name).toBe('local-plugin');
      });

      it('discovers multiple plugins across multiple directories', async () => {
        const dir1 = path.join(tmpDir, 'plugins1');
        const dir2 = path.join(tmpDir, 'plugins2');
        await fs.mkdir(dir1, { recursive: true });
        await fs.mkdir(dir2, { recursive: true });

        await createTestPluginDir(dir1, 'plugin-a', createValidManifest({ name: 'plugin-a' }));
        await createTestPluginDir(dir2, 'plugin-b', createValidManifest({ name: 'plugin-b' }));

        const loader = createLoader();
        const config = createLoadConfig({
          pluginDirs: [dir1, dir2],
          enabledPlugins: new Set(['plugin-a', 'plugin-b']),
        });

        const result = await loader.loadPlugins(config);

        expect(result.loaded).toHaveLength(2);
        expect(result.loaded.map((p) => p.name).sort()).toEqual(['plugin-a', 'plugin-b']);
      });
    });

    describe('Scanning node_modules for npm packages (Req 1.3)', () => {
      it('discovers npm packages with red64-plugin keyword in package.json', async () => {
        const nodeModulesDir = path.join(tmpDir, 'node_modules');
        await fs.mkdir(nodeModulesDir, { recursive: true });

        const manifest = createValidManifest({ name: 'npm-plugin' });
        await createNpmPackageWithKeyword(nodeModulesDir, 'npm-plugin', manifest);

        const loader = createLoader();
        const config = createLoadConfig({
          nodeModulesDir,
          enabledPlugins: new Set(['npm-plugin']),
        });

        const result = await loader.loadPlugins(config);

        expect(result.loaded).toHaveLength(1);
        expect(result.loaded[0]?.name).toBe('npm-plugin');
      });

      it('ignores npm packages without red64-plugin keyword', async () => {
        const nodeModulesDir = path.join(tmpDir, 'node_modules');
        const packageDir = path.join(nodeModulesDir, 'regular-package');
        await fs.mkdir(packageDir, { recursive: true });

        // Package without the red64-plugin keyword
        const packageJson = {
          name: 'regular-package',
          version: '1.0.0',
          keywords: ['some-other-keyword'],
        };
        await fs.writeFile(
          path.join(packageDir, 'package.json'),
          JSON.stringify(packageJson)
        );

        const loader = createLoader();
        const config = createLoadConfig({
          nodeModulesDir,
          enabledPlugins: new Set(['regular-package']),
        });

        const result = await loader.loadPlugins(config);

        expect(result.loaded).toHaveLength(0);
      });
    });

    describe('Local directory paths as plugin sources (Req 1.2)', () => {
      it('loads plugins from local directory paths without npm publication', async () => {
        const localPluginDir = path.join(tmpDir, 'my-local-plugin');
        const manifest = createValidManifest({ name: 'my-local-plugin' });
        await createTestPluginDir(tmpDir, 'my-local-plugin', manifest);

        const loader = createLoader();
        const config = createLoadConfig({
          pluginDirs: [tmpDir],
          enabledPlugins: new Set(['my-local-plugin']),
        });

        const result = await loader.loadPlugins(config);

        expect(result.loaded).toHaveLength(1);
        expect(result.loaded[0]?.name).toBe('my-local-plugin');
      });
    });

    describe('Error handling for unreadable directories (Req 1.5)', () => {
      it('logs descriptive errors for unreadable directories and continues', async () => {
        const validDir = path.join(tmpDir, 'valid-plugins');
        await fs.mkdir(validDir, { recursive: true });
        await createTestPluginDir(validDir, 'valid-plugin', createValidManifest({ name: 'valid-plugin' }));

        const loader = createLoader();
        const config = createLoadConfig({
          pluginDirs: ['/nonexistent/path', validDir],
          enabledPlugins: new Set(['valid-plugin']),
        });

        const result = await loader.loadPlugins(config);

        // Should still load the valid plugin
        expect(result.loaded).toHaveLength(1);
        expect(result.loaded[0]?.name).toBe('valid-plugin');

        // Should log error for nonexistent directory
        const errorLogs = logMessages.filter((m) => m.level === 'error' || m.level === 'warn');
        expect(errorLogs.some((m) => m.message.includes('/nonexistent/path'))).toBe(true);
      });

      it('logs descriptive errors for invalid JSON in manifest and skips plugin', async () => {
        const pluginsDir = path.join(tmpDir, 'plugins');
        const badPluginDir = path.join(pluginsDir, 'bad-plugin');
        await fs.mkdir(badPluginDir, { recursive: true });

        // Write invalid JSON
        await fs.writeFile(path.join(badPluginDir, 'red64-plugin.json'), '{ invalid json }');

        // Also create a valid plugin
        await createTestPluginDir(
          pluginsDir,
          'good-plugin',
          createValidManifest({ name: 'good-plugin' })
        );

        const loader = createLoader();
        const config = createLoadConfig({
          pluginDirs: [pluginsDir],
          enabledPlugins: new Set(['bad-plugin', 'good-plugin']),
        });

        const result = await loader.loadPlugins(config);

        // Good plugin should still load
        expect(result.loaded).toHaveLength(1);
        expect(result.loaded[0]?.name).toBe('good-plugin');

        // Bad plugin should be in errors
        expect(result.errors.some((e) => e.pluginName === 'bad-plugin')).toBe(true);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Task 4.2: Dependency-aware Loading Order and Activation
  // ---------------------------------------------------------------------------

  describe('Task 4.2: Dependency-aware Loading Order and Activation', () => {
    describe('Topological sort for inter-plugin dependencies (Req 1.6)', () => {
      it('loads plugins in dependency order using topological sort', async () => {
        const pluginsDir = path.join(tmpDir, 'plugins');
        await fs.mkdir(pluginsDir, { recursive: true });

        // Plugin C depends on Plugin B, which depends on Plugin A
        const activationOrder: string[] = [];

        await createTestPluginDir(
          pluginsDir,
          'plugin-a',
          createValidManifest({ name: 'plugin-a' }),
          `export function activate(ctx) { globalThis.activationOrder = globalThis.activationOrder || []; globalThis.activationOrder.push('plugin-a'); }`
        );

        await createTestPluginDir(
          pluginsDir,
          'plugin-b',
          createValidManifest({
            name: 'plugin-b',
            dependencies: [{ name: 'plugin-a', version: '>=1.0.0' }],
          }),
          `export function activate(ctx) { globalThis.activationOrder = globalThis.activationOrder || []; globalThis.activationOrder.push('plugin-b'); }`
        );

        await createTestPluginDir(
          pluginsDir,
          'plugin-c',
          createValidManifest({
            name: 'plugin-c',
            dependencies: [{ name: 'plugin-b', version: '>=1.0.0' }],
          }),
          `export function activate(ctx) { globalThis.activationOrder = globalThis.activationOrder || []; globalThis.activationOrder.push('plugin-c'); }`
        );

        // Reset global state
        (globalThis as Record<string, unknown>).activationOrder = [];

        const loader = createLoader();
        const config = createLoadConfig({
          pluginDirs: [pluginsDir],
          enabledPlugins: new Set(['plugin-a', 'plugin-b', 'plugin-c']),
        });

        const result = await loader.loadPlugins(config);

        expect(result.loaded).toHaveLength(3);

        // Check activation order via global
        const order = (globalThis as Record<string, unknown>).activationOrder as string[];
        expect(order).toEqual(['plugin-a', 'plugin-b', 'plugin-c']);

        // Cleanup
        delete (globalThis as Record<string, unknown>).activationOrder;
      });
    });

    describe('Circular dependency detection (Req 2.4)', () => {
      it('detects circular dependencies and reports them as errors', async () => {
        const pluginsDir = path.join(tmpDir, 'plugins');
        await fs.mkdir(pluginsDir, { recursive: true });

        // Plugin A depends on B, B depends on C, C depends on A (cycle)
        await createTestPluginDir(
          pluginsDir,
          'plugin-a',
          createValidManifest({
            name: 'plugin-a',
            dependencies: [{ name: 'plugin-b', version: '>=1.0.0' }],
          })
        );

        await createTestPluginDir(
          pluginsDir,
          'plugin-b',
          createValidManifest({
            name: 'plugin-b',
            dependencies: [{ name: 'plugin-c', version: '>=1.0.0' }],
          })
        );

        await createTestPluginDir(
          pluginsDir,
          'plugin-c',
          createValidManifest({
            name: 'plugin-c',
            dependencies: [{ name: 'plugin-a', version: '>=1.0.0' }],
          })
        );

        const loader = createLoader();
        const config = createLoadConfig({
          pluginDirs: [pluginsDir],
          enabledPlugins: new Set(['plugin-a', 'plugin-b', 'plugin-c']),
        });

        const result = await loader.loadPlugins(config);

        // Circular plugins should be skipped
        expect(result.loaded).toHaveLength(0);
        expect(result.errors.length).toBeGreaterThan(0);

        // Error should mention circular dependency
        const circularError = result.errors.find((e) =>
          e.error.toLowerCase().includes('circular')
        );
        expect(circularError).toBeDefined();
      });
    });

    describe('Version compatibility checking (Req 2.3, 2.5)', () => {
      it('refuses to load incompatible plugins with version mismatch warning', async () => {
        const pluginsDir = path.join(tmpDir, 'plugins');
        await fs.mkdir(pluginsDir, { recursive: true });

        // Plugin requires CLI version >= 2.0.0, but we're running 1.0.0
        await createTestPluginDir(
          pluginsDir,
          'incompatible-plugin',
          createValidManifest({
            name: 'incompatible-plugin',
            red64CliVersion: '>=2.0.0',
          })
        );

        const loader = createLoader();
        const config = createLoadConfig({
          pluginDirs: [pluginsDir],
          cliVersion: '1.0.0',
          enabledPlugins: new Set(['incompatible-plugin']),
        });

        const result = await loader.loadPlugins(config);

        expect(result.loaded).toHaveLength(0);
        expect(result.skipped).toHaveLength(1);
        expect(result.skipped[0]?.name).toBe('incompatible-plugin');
        expect(result.skipped[0]?.reason).toContain('version');
      });

      it('loads compatible plugins that satisfy version range', async () => {
        const pluginsDir = path.join(tmpDir, 'plugins');
        await fs.mkdir(pluginsDir, { recursive: true });

        await createTestPluginDir(
          pluginsDir,
          'compatible-plugin',
          createValidManifest({
            name: 'compatible-plugin',
            red64CliVersion: '>=1.0.0 <2.0.0',
          })
        );

        const loader = createLoader();
        const config = createLoadConfig({
          pluginDirs: [pluginsDir],
          cliVersion: '1.5.0',
          enabledPlugins: new Set(['compatible-plugin']),
        });

        const result = await loader.loadPlugins(config);

        expect(result.loaded).toHaveLength(1);
        expect(result.loaded[0]?.name).toBe('compatible-plugin');
      });
    });

    describe('Plugin dependency presence verification (Req 2.4)', () => {
      it('verifies all declared plugin dependencies are present before activation', async () => {
        const pluginsDir = path.join(tmpDir, 'plugins');
        await fs.mkdir(pluginsDir, { recursive: true });

        // Plugin that depends on a non-existent plugin
        await createTestPluginDir(
          pluginsDir,
          'orphan-plugin',
          createValidManifest({
            name: 'orphan-plugin',
            dependencies: [{ name: 'missing-plugin', version: '>=1.0.0' }],
          })
        );

        const loader = createLoader();
        const config = createLoadConfig({
          pluginDirs: [pluginsDir],
          enabledPlugins: new Set(['orphan-plugin']),
        });

        const result = await loader.loadPlugins(config);

        expect(result.loaded).toHaveLength(0);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]?.error).toContain('missing-plugin');
      });
    });

    describe('ESM dynamic import (Req 1.7)', () => {
      it('dynamically imports plugin ESM entry point using import()', async () => {
        const pluginsDir = path.join(tmpDir, 'plugins');
        await fs.mkdir(pluginsDir, { recursive: true });

        await createTestPluginDir(
          pluginsDir,
          'esm-plugin',
          createValidManifest({ name: 'esm-plugin' }),
          `
            export function activate(context) {
              // ESM plugin activated
            }
          `
        );

        const loader = createLoader();
        const config = createLoadConfig({
          pluginDirs: [pluginsDir],
          enabledPlugins: new Set(['esm-plugin']),
        });

        const result = await loader.loadPlugins(config);

        expect(result.loaded).toHaveLength(1);
        expect(result.loaded[0]?.name).toBe('esm-plugin');
      });
    });

    describe('Module interface validation (Req 10.5)', () => {
      it('validates that imported module exports PluginModule interface with activate function', async () => {
        const pluginsDir = path.join(tmpDir, 'plugins');
        await fs.mkdir(pluginsDir, { recursive: true });

        // Plugin without activate function
        const badPluginDir = path.join(pluginsDir, 'bad-module');
        await fs.mkdir(badPluginDir, { recursive: true });

        await fs.writeFile(
          path.join(badPluginDir, 'red64-plugin.json'),
          JSON.stringify(createValidManifest({ name: 'bad-module' }))
        );

        // No activate export
        await fs.writeFile(
          path.join(badPluginDir, 'index.js'),
          `
            export function notActivate() {
              // This is not the right export
            }
          `
        );

        const loader = createLoader();
        const config = createLoadConfig({
          pluginDirs: [pluginsDir],
          enabledPlugins: new Set(['bad-module']),
        });

        const result = await loader.loadPlugins(config);

        expect(result.loaded).toHaveLength(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]?.phase).toBe('import');
        expect(result.errors[0]?.error).toContain('activate');
      });
    });

    describe('Activation with PluginContext and error isolation (Req 10.2)', () => {
      it('calls activate(context) with a scoped PluginContext', async () => {
        const pluginsDir = path.join(tmpDir, 'plugins');
        await fs.mkdir(pluginsDir, { recursive: true });

        await createTestPluginDir(
          pluginsDir,
          'context-plugin',
          createValidManifest({ name: 'context-plugin' }),
          `
            export function activate(context) {
              // Store context info in global for test verification
              globalThis.pluginContextInfo = {
                pluginName: context.pluginName,
                pluginVersion: context.pluginVersion,
                hasCLIVersion: typeof context.getCLIVersion === 'function'
              };
            }
          `
        );

        // Reset global
        (globalThis as Record<string, unknown>).pluginContextInfo = null;

        const loader = createLoader();
        const config = createLoadConfig({
          pluginDirs: [pluginsDir],
          enabledPlugins: new Set(['context-plugin']),
        });

        const result = await loader.loadPlugins(config);

        expect(result.loaded).toHaveLength(1);

        const contextInfo = (globalThis as Record<string, unknown>).pluginContextInfo as {
          pluginName: string;
          pluginVersion: string;
          hasCLIVersion: boolean;
        };
        expect(contextInfo.pluginName).toBe('context-plugin');
        expect(contextInfo.pluginVersion).toBe('1.0.0');
        expect(contextInfo.hasCLIVersion).toBe(true);

        // Cleanup
        delete (globalThis as Record<string, unknown>).pluginContextInfo;
      });

      it('wraps activate() in try/catch and isolates plugin errors', async () => {
        const pluginsDir = path.join(tmpDir, 'plugins');
        await fs.mkdir(pluginsDir, { recursive: true });

        // Create a plugin that throws during activation
        const throwingPluginDir = path.join(pluginsDir, 'throwing-plugin');
        await fs.mkdir(throwingPluginDir, { recursive: true });

        await fs.writeFile(
          path.join(throwingPluginDir, 'red64-plugin.json'),
          JSON.stringify(createValidManifest({ name: 'throwing-plugin' }))
        );

        await fs.writeFile(
          path.join(throwingPluginDir, 'index.js'),
          `
            export function activate(context) {
              throw new Error('Plugin activation failed intentionally');
            }
          `
        );

        // Also create a good plugin that should still load
        await createTestPluginDir(
          pluginsDir,
          'good-plugin',
          createValidManifest({ name: 'good-plugin' })
        );

        const loader = createLoader();
        const config = createLoadConfig({
          pluginDirs: [pluginsDir],
          enabledPlugins: new Set(['throwing-plugin', 'good-plugin']),
        });

        // Should not throw
        const result = await loader.loadPlugins(config);

        // Good plugin should still load
        expect(result.loaded.some((p) => p.name === 'good-plugin')).toBe(true);

        // Throwing plugin should be in errors
        expect(result.errors.some((e) => e.pluginName === 'throwing-plugin')).toBe(true);
        const throwingError = result.errors.find((e) => e.pluginName === 'throwing-plugin');
        expect(throwingError?.phase).toBe('activation');
      });
    });

    describe('Registration in plugin registry', () => {
      it('registers activated plugin and its extensions in the registry', async () => {
        const pluginsDir = path.join(tmpDir, 'plugins');
        await fs.mkdir(pluginsDir, { recursive: true });

        await createTestPluginDir(
          pluginsDir,
          'registering-plugin',
          createValidManifest({ name: 'registering-plugin', extensionPoints: ['commands'] }),
          `
            export function activate(context) {
              context.registerCommand({
                name: 'my-custom-cmd',
                description: 'A custom command from plugin',
                handler: async () => {}
              });
            }
          `
        );

        const loader = createLoader();
        const config = createLoadConfig({
          pluginDirs: [pluginsDir],
          enabledPlugins: new Set(['registering-plugin']),
        });

        const result = await loader.loadPlugins(config);

        expect(result.loaded).toHaveLength(1);

        // Check registry for plugin
        const registeredPlugin = registry.getPlugin('registering-plugin');
        expect(registeredPlugin).toBeDefined();
        expect(registeredPlugin?.name).toBe('registering-plugin');

        // Check registry for command
        const registeredCommand = registry.getCommand('my-custom-cmd');
        expect(registeredCommand).toBeDefined();
        expect(registeredCommand?.pluginName).toBe('registering-plugin');
      });
    });

    describe('Structured load result', () => {
      it('returns structured result with loaded, skipped, and errored plugins', async () => {
        const pluginsDir = path.join(tmpDir, 'plugins');
        await fs.mkdir(pluginsDir, { recursive: true });

        // Valid plugin
        await createTestPluginDir(
          pluginsDir,
          'valid-plugin',
          createValidManifest({ name: 'valid-plugin' })
        );

        // Incompatible plugin
        await createTestPluginDir(
          pluginsDir,
          'incompatible-plugin',
          createValidManifest({
            name: 'incompatible-plugin',
            red64CliVersion: '>=99.0.0',
          })
        );

        // Plugin with invalid manifest
        const badManifestDir = path.join(pluginsDir, 'bad-manifest');
        await fs.mkdir(badManifestDir, { recursive: true });
        await fs.writeFile(
          path.join(badManifestDir, 'red64-plugin.json'),
          JSON.stringify({ name: 'bad-manifest' }) // Missing required fields
        );

        const loader = createLoader();
        const config = createLoadConfig({
          pluginDirs: [pluginsDir],
          cliVersion: '1.0.0',
          enabledPlugins: new Set(['valid-plugin', 'incompatible-plugin', 'bad-manifest']),
        });

        const result = await loader.loadPlugins(config);

        // Valid plugin loaded
        expect(result.loaded).toHaveLength(1);
        expect(result.loaded[0]?.name).toBe('valid-plugin');

        // Incompatible plugin skipped
        expect(result.skipped.some((s) => s.name === 'incompatible-plugin')).toBe(true);

        // Bad manifest in errors
        expect(result.errors.some((e) => e.pluginName === 'bad-manifest')).toBe(true);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Unload and Reload Plugin
  // ---------------------------------------------------------------------------

  describe('unloadPlugin', () => {
    it('unloads a plugin from the registry', async () => {
      const pluginsDir = path.join(tmpDir, 'plugins');
      await fs.mkdir(pluginsDir, { recursive: true });

      await createTestPluginDir(
        pluginsDir,
        'unload-test',
        createValidManifest({ name: 'unload-test' })
      );

      const loader = createLoader();
      const config = createLoadConfig({
        pluginDirs: [pluginsDir],
        enabledPlugins: new Set(['unload-test']),
      });

      await loader.loadPlugins(config);
      expect(registry.getPlugin('unload-test')).toBeDefined();

      await loader.unloadPlugin('unload-test');
      expect(registry.getPlugin('unload-test')).toBeUndefined();
    });
  });

  describe('reloadPlugin', () => {
    it('reloads a plugin by unloading and loading again', async () => {
      const pluginsDir = path.join(tmpDir, 'plugins');
      await fs.mkdir(pluginsDir, { recursive: true });

      await createTestPluginDir(
        pluginsDir,
        'reload-test',
        createValidManifest({ name: 'reload-test' })
      );

      const loader = createLoader();
      const config = createLoadConfig({
        pluginDirs: [pluginsDir],
        enabledPlugins: new Set(['reload-test']),
      });

      // Initial load
      const initialResult = await loader.loadPlugins(config);
      expect(initialResult.loaded).toHaveLength(1);

      const initialPlugin = registry.getPlugin('reload-test');
      expect(initialPlugin).toBeDefined();

      // Reload
      const reloadResult = await loader.reloadPlugin('reload-test');
      expect(reloadResult.loaded).toHaveLength(1);
      expect(reloadResult.loaded[0]?.name).toBe('reload-test');

      // Plugin should still be in registry
      expect(registry.getPlugin('reload-test')).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Only enabled plugins are loaded
  // ---------------------------------------------------------------------------

  describe('Enabled plugins filtering', () => {
    it('only loads plugins that are in the enabledPlugins set', async () => {
      const pluginsDir = path.join(tmpDir, 'plugins');
      await fs.mkdir(pluginsDir, { recursive: true });

      await createTestPluginDir(
        pluginsDir,
        'enabled-plugin',
        createValidManifest({ name: 'enabled-plugin' })
      );

      await createTestPluginDir(
        pluginsDir,
        'disabled-plugin',
        createValidManifest({ name: 'disabled-plugin' })
      );

      const loader = createLoader();
      const config = createLoadConfig({
        pluginDirs: [pluginsDir],
        enabledPlugins: new Set(['enabled-plugin']), // Only this one is enabled
      });

      const result = await loader.loadPlugins(config);

      expect(result.loaded).toHaveLength(1);
      expect(result.loaded[0]?.name).toBe('enabled-plugin');
    });

    it('loads all discovered plugins when enabledPlugins is empty (discovery-only mode)', async () => {
      const pluginsDir = path.join(tmpDir, 'plugins');
      await fs.mkdir(pluginsDir, { recursive: true });

      await createTestPluginDir(
        pluginsDir,
        'plugin-1',
        createValidManifest({ name: 'plugin-1' })
      );

      await createTestPluginDir(
        pluginsDir,
        'plugin-2',
        createValidManifest({ name: 'plugin-2' })
      );

      const loader = createLoader();
      const config = createLoadConfig({
        pluginDirs: [pluginsDir],
        enabledPlugins: new Set(), // Empty = load all discovered
      });

      const result = await loader.loadPlugins(config);

      expect(result.loaded).toHaveLength(2);
    });
  });
});
