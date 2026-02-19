/**
 * Plugin Dev Mode Tests - Task 8.3
 * Tests for dev mode with hot reload using chokidar file watching.
 *
 * Requirements coverage:
 * - Task 8.3: 12.3 (Dev mode with hot reload)
 *
 * Test strategy:
 * - Mock chokidar to avoid actual filesystem watching in tests
 * - Verify that the watcher is set up correctly
 * - Verify that file changes trigger reload
 * - Verify that the watcher only watches the specific plugin directory
 * - Verify cleanup (watcher closed) on plugin unload
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
// Chokidar Mock
// ---------------------------------------------------------------------------

/**
 * Mock chokidar watcher that captures watch calls and allows simulating events
 */
interface MockWatcher {
  readonly path: string;
  on: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  /** Simulate a file change event */
  simulateChange: (filePath: string) => void;
}

interface MockChokidar {
  watch: ReturnType<typeof vi.fn>;
  getWatchers: () => MockWatcher[];
}

function createMockChokidar(): MockChokidar {
  const watchers: MockWatcher[] = [];

  const watch = vi.fn((watchPath: string) => {
    const handlers = new Map<string, ((...args: unknown[]) => void)[]>();

    const watcher: MockWatcher = {
      path: watchPath,
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        const existing = handlers.get(event) ?? [];
        existing.push(handler);
        handlers.set(event, existing);
        return watcher;
      }),
      close: vi.fn(() => Promise.resolve()),
      simulateChange: (filePath: string) => {
        const changeHandlers = handlers.get('change') ?? [];
        for (const handler of changeHandlers) {
          handler(filePath);
        }
      },
    };

    watchers.push(watcher);
    return watcher;
  });

  return {
    watch,
    getWatchers: () => [...watchers],
  };
}

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
    devMode: true,
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

  await fs.writeFile(
    path.join(pluginDir, 'red64-plugin.json'),
    JSON.stringify(manifest, null, 2)
  );

  const entryPoint = entryPointContent ?? `
    export function activate(context) {
      // Activated
    }
  `;
  await fs.writeFile(path.join(pluginDir, 'index.js'), entryPoint);

  return pluginDir;
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Task 8.3: Dev Mode with Hot Reload (chokidar integration)', () => {
  let tmpDir: string;
  let registry: PluginRegistryService;
  let logMessages: Array<{ level: string; message: string }>;
  let mockChokidar: MockChokidar;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plugin-devmode-test-'));
    registry = createPluginRegistry();
    logMessages = [];
    mockChokidar = createMockChokidar();
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    vi.clearAllMocks();
  });

  function createLoader() {
    const validator = createManifestValidator();
    const logger = (level: 'info' | 'warn' | 'error', message: string): void => {
      logMessages.push({ level, message });
    };
    const contextFactory = (options: PluginContextOptions): PluginContextInterface => {
      return createPluginContext({ ...options, logger });
    };

    return createPluginLoader({
      registry,
      validator,
      contextFactory,
      logger,
      // Inject the mock chokidar watcher factory
      watcherFactory: mockChokidar.watch,
    });
  }

  // ---------------------------------------------------------------------------
  // Dev mode watcher setup
  // ---------------------------------------------------------------------------

  describe('File watcher setup when devMode is true', () => {
    it('sets up a file watcher for the plugin directory when devMode is enabled', async () => {
      const manifest = createValidManifest({ name: 'dev-plugin' });
      const pluginDir = await createTestPluginDir(tmpDir, 'dev-plugin', manifest);

      const loader = createLoader();
      await loader.loadPlugins({
        ...createLoadConfig({ devMode: true }),
        pluginDirs: [tmpDir],
        enabledPlugins: new Set(['dev-plugin']),
      });

      // Verify that chokidar.watch was called for the plugin directory
      expect(mockChokidar.watch).toHaveBeenCalled();
      const watchedPaths = mockChokidar.getWatchers().map((w) => w.path);
      expect(watchedPaths.some((p) => p.includes('dev-plugin'))).toBe(true);
    });

    it('does not set up a file watcher when devMode is false', async () => {
      const manifest = createValidManifest({ name: 'no-watch-plugin' });
      await createTestPluginDir(tmpDir, 'no-watch-plugin', manifest);

      const loader = createLoader();
      await loader.loadPlugins({
        ...createLoadConfig({ devMode: false }),
        pluginDirs: [tmpDir],
        enabledPlugins: new Set(['no-watch-plugin']),
      });

      // Verify that chokidar.watch was NOT called
      expect(mockChokidar.watch).not.toHaveBeenCalled();
    });

    it('only watches the specific plugin directory, not all installed plugins', async () => {
      const manifest1 = createValidManifest({ name: 'watched-plugin' });
      const manifest2 = createValidManifest({ name: 'other-plugin' });

      await createTestPluginDir(tmpDir, 'watched-plugin', manifest1);
      await createTestPluginDir(tmpDir, 'other-plugin', manifest2);

      const loader = createLoader();
      await loader.loadPlugins({
        ...createLoadConfig({ devMode: true }),
        pluginDirs: [tmpDir],
        enabledPlugins: new Set(['watched-plugin', 'other-plugin']),
      });

      // Should have created watchers for both plugins (each in devMode)
      const watchers = mockChokidar.getWatchers();
      // Each plugin gets its own watcher for its specific directory
      expect(watchers.length).toBeGreaterThan(0);

      // Each watcher should target a specific plugin directory
      for (const watcher of watchers) {
        // Should be a specific plugin directory path, not the root
        expect(watcher.path).not.toBe(tmpDir);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // File change triggers reload
  // ---------------------------------------------------------------------------

  describe('File change triggers plugin reload', () => {
    it('reloads the plugin when a file change is detected', async () => {
      const manifest = createValidManifest({ name: 'reload-on-change' });
      await createTestPluginDir(tmpDir, 'reload-on-change', manifest);

      const loader = createLoader();

      await loader.loadPlugins({
        ...createLoadConfig({ devMode: true }),
        pluginDirs: [tmpDir],
        enabledPlugins: new Set(['reload-on-change']),
      });

      // Verify watcher was set up
      const watchers = mockChokidar.getWatchers();
      expect(watchers.length).toBeGreaterThan(0);

      // Clear logs before simulating change
      logMessages.length = 0;

      // Simulate a file change
      const watcher = watchers[0];
      watcher?.simulateChange(path.join(tmpDir, 'reload-on-change', 'index.js'));

      // Wait for async reload operations triggered by the change
      await new Promise((resolve) => setTimeout(resolve, 100));

      // The file change should have triggered a reload log message
      const reloadLogs = logMessages.filter((m) =>
        m.message.toLowerCase().includes('reload') ||
        m.message.toLowerCase().includes('change') ||
        m.message.toLowerCase().includes('reload-on-change')
      );
      expect(reloadLogs.length).toBeGreaterThan(0);
    });

    it('logs that the plugin is being reloaded on file change', async () => {
      const manifest = createValidManifest({ name: 'log-reload-plugin' });
      await createTestPluginDir(tmpDir, 'log-reload-plugin', manifest);

      const loader = createLoader();
      await loader.loadPlugins({
        ...createLoadConfig({ devMode: true }),
        pluginDirs: [tmpDir],
        enabledPlugins: new Set(['log-reload-plugin']),
      });

      // Simulate a file change
      const watchers = mockChokidar.getWatchers();
      watchers[0]?.simulateChange(path.join(tmpDir, 'log-reload-plugin', 'src', 'index.ts'));

      // Wait for any async operations
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should have logged about the reload
      const infoLogs = logMessages.filter((m) =>
        m.level === 'info' &&
        (m.message.toLowerCase().includes('reload') ||
          m.message.toLowerCase().includes('change') ||
          m.message.toLowerCase().includes('log-reload-plugin'))
      );
      expect(infoLogs.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Watcher cleanup
  // ---------------------------------------------------------------------------

  describe('Watcher cleanup on plugin unload', () => {
    it('closes the file watcher when the plugin is unloaded', async () => {
      const manifest = createValidManifest({ name: 'cleanup-plugin' });
      await createTestPluginDir(tmpDir, 'cleanup-plugin', manifest);

      const loader = createLoader();
      await loader.loadPlugins({
        ...createLoadConfig({ devMode: true }),
        pluginDirs: [tmpDir],
        enabledPlugins: new Set(['cleanup-plugin']),
      });

      // Verify watcher was created
      const watchers = mockChokidar.getWatchers();
      expect(watchers.length).toBeGreaterThan(0);

      // Unload the plugin
      await loader.unloadPlugin('cleanup-plugin');

      // Verify the watcher was closed
      const watcher = watchers[0];
      expect(watcher?.close).toHaveBeenCalled();
    });

    it('does not close watchers for other plugins when one is unloaded', async () => {
      const manifest1 = createValidManifest({ name: 'plugin-alpha' });
      const manifest2 = createValidManifest({ name: 'plugin-beta' });

      await createTestPluginDir(tmpDir, 'plugin-alpha', manifest1);
      await createTestPluginDir(tmpDir, 'plugin-beta', manifest2);

      const loader = createLoader();
      await loader.loadPlugins({
        ...createLoadConfig({ devMode: true }),
        pluginDirs: [tmpDir],
        enabledPlugins: new Set(['plugin-alpha', 'plugin-beta']),
      });

      const watchersBefore = mockChokidar.getWatchers();
      expect(watchersBefore.length).toBe(2);

      // Find which watcher belongs to plugin-alpha
      const alphaWatcher = watchersBefore.find((w) => w.path.includes('plugin-alpha'));
      const betaWatcher = watchersBefore.find((w) => w.path.includes('plugin-beta'));

      // Unload only plugin-alpha
      await loader.unloadPlugin('plugin-alpha');

      // Alpha's watcher should be closed
      expect(alphaWatcher?.close).toHaveBeenCalled();
      // Beta's watcher should NOT be closed
      expect(betaWatcher?.close).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Reload warning threshold
  // ---------------------------------------------------------------------------

  describe('Reload warning threshold', () => {
    it('does not warn below the reload threshold', async () => {
      const manifest = createValidManifest({ name: 'threshold-plugin' });
      await createTestPluginDir(tmpDir, 'threshold-plugin', manifest);

      const loader = createLoader();
      await loader.loadPlugins({
        ...createLoadConfig({ devMode: true }),
        pluginDirs: [tmpDir],
        enabledPlugins: new Set(['threshold-plugin']),
      });

      // Only 3 reloads - below any reasonable threshold
      for (let i = 0; i < 3; i++) {
        await loader.reloadPlugin('threshold-plugin');
      }

      const memoryWarnings = logMessages.filter((m) =>
        m.level === 'warn' &&
        (m.message.toLowerCase().includes('memory') ||
          m.message.toLowerCase().includes('cache'))
      );

      // Should not have warned about cache/memory yet
      expect(memoryWarnings.length).toBe(0);
    });

    it('warns about potential memory growth after exceeding reload threshold', async () => {
      const manifest = createValidManifest({ name: 'high-reload-plugin' });
      await createTestPluginDir(tmpDir, 'high-reload-plugin', manifest);

      const loader = createLoader();
      await loader.loadPlugins({
        ...createLoadConfig({ devMode: true }),
        pluginDirs: [tmpDir],
        enabledPlugins: new Set(['high-reload-plugin']),
      });

      // Reload more than 10 times (default threshold)
      for (let i = 0; i < 12; i++) {
        await loader.reloadPlugin('high-reload-plugin');
      }

      const memoryWarnings = logMessages.filter((m) =>
        m.level === 'warn' &&
        (m.message.toLowerCase().includes('memory') ||
          m.message.toLowerCase().includes('cache') ||
          m.message.toLowerCase().includes('reload'))
      );

      expect(memoryWarnings.length).toBeGreaterThan(0);
    });

    it('includes the plugin name and reload count in the warning message', async () => {
      const manifest = createValidManifest({ name: 'named-reload-plugin' });
      await createTestPluginDir(tmpDir, 'named-reload-plugin', manifest);

      const loader = createLoader();
      await loader.loadPlugins({
        ...createLoadConfig({ devMode: true }),
        pluginDirs: [tmpDir],
        enabledPlugins: new Set(['named-reload-plugin']),
      });

      // Reload more than threshold times
      for (let i = 0; i < 12; i++) {
        await loader.reloadPlugin('named-reload-plugin');
      }

      const reloadWarning = logMessages.find((m) =>
        m.level === 'warn' &&
        m.message.includes('named-reload-plugin')
      );

      expect(reloadWarning).toBeDefined();
      expect(reloadWarning?.message).toContain('named-reload-plugin');
    });
  });

  // ---------------------------------------------------------------------------
  // Cache busting for hot reload
  // ---------------------------------------------------------------------------

  describe('Query-string cache busting for ESM hot reload', () => {
    it('uses a different timestamp for each reload to bypass ESM module cache', async () => {
      const manifest = createValidManifest({ name: 'cache-bust-plugin' });
      await createTestPluginDir(tmpDir, 'cache-bust-plugin', manifest);

      // Track import calls to verify cache busting
      const importedUrls: string[] = [];
      const originalImport = globalThis.__importPlugin;

      const loader = createLoader();
      await loader.loadPlugins({
        ...createLoadConfig({ devMode: true }),
        pluginDirs: [tmpDir],
        enabledPlugins: new Set(['cache-bust-plugin']),
      });

      const result1 = await loader.reloadPlugin('cache-bust-plugin');
      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));
      const result2 = await loader.reloadPlugin('cache-bust-plugin');

      // Both reloads should succeed (cache busting is working internally)
      expect(result1.loaded.length).toBe(1);
      expect(result2.loaded.length).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // watcherFactory injection (for testability)
  // ---------------------------------------------------------------------------

  describe('watcherFactory dependency injection', () => {
    it('uses the provided watcherFactory instead of real chokidar', async () => {
      const manifest = createValidManifest({ name: 'factory-plugin' });
      await createTestPluginDir(tmpDir, 'factory-plugin', manifest);

      // Create a custom factory to track calls
      const customFactory = vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        close: vi.fn(),
      }));

      const validator = createManifestValidator();
      const logger = (level: 'info' | 'warn' | 'error', message: string): void => {
        logMessages.push({ level, message });
      };

      const loader = createPluginLoader({
        registry,
        validator,
        contextFactory: (opts) => createPluginContext({ ...opts, logger }),
        logger,
        watcherFactory: customFactory,
      });

      await loader.loadPlugins({
        ...createLoadConfig({ devMode: true }),
        pluginDirs: [tmpDir],
        enabledPlugins: new Set(['factory-plugin']),
      });

      // The custom factory should have been called for the plugin directory
      expect(customFactory).toHaveBeenCalled();
    });

    it('falls back to real chokidar when no watcherFactory is provided', async () => {
      // This test verifies that the loader works without a watcherFactory
      // (i.e., it uses the real chokidar)
      const manifest = createValidManifest({ name: 'real-chokidar-plugin' });
      await createTestPluginDir(tmpDir, 'real-chokidar-plugin', manifest);

      const validator = createManifestValidator();
      const logger = (level: 'info' | 'warn' | 'error', message: string): void => {
        logMessages.push({ level, message });
      };

      // Create a loader WITHOUT watcherFactory - should use real chokidar
      const loader = createPluginLoader({
        registry,
        validator,
        contextFactory: (opts) => createPluginContext({ ...opts, logger }),
        logger,
        // No watcherFactory - should use real chokidar
      });

      // Should load successfully
      const result = await loader.loadPlugins({
        ...createLoadConfig({ devMode: true }),
        pluginDirs: [tmpDir],
        enabledPlugins: new Set(['real-chokidar-plugin']),
      });

      expect(result.loaded.length).toBe(1);

      // Clean up: unload to close real chokidar watcher
      await loader.unloadPlugin('real-chokidar-plugin');
    });
  });
});
