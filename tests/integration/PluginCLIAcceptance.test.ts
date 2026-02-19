/**
 * Acceptance-criteria-focused tests for plugin CLI commands - Task 11.3
 * Tests for plugin list, validate, create, install, config, and search.
 *
 * Requirements coverage: 3.5, 3.6, 9.1, 11.1, 11.2, 12.1, 12.4
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  createPluginManager,
  type PluginManagerService,
} from '../../src/plugins/PluginManager.js';
import {
  createPluginRegistry,
  createManifestValidator,
  type PluginRegistryService,
  type PluginManifest,
} from '../../src/plugins/index.js';

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

// ---------------------------------------------------------------------------
// Mock spawn function
// ---------------------------------------------------------------------------

interface MockSpawnResult {
  code: number;
  stdout: string;
  stderr: string;
}

function createMockSpawn(results: Map<string, MockSpawnResult> = new Map()) {
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

describe('Plugin CLI Acceptance Tests - Task 11.3', () => {
  let tmpDir: string;
  let projectDir: string;
  let nodeModulesDir: string;
  let pluginsStateDir: string;
  let registry: PluginRegistryService;
  let logMessages: Array<{ level: string; message: string }>;
  let mockSpawn: ReturnType<typeof createMockSpawn>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plugin-cli-test-'));
    projectDir = path.join(tmpDir, 'project');
    nodeModulesDir = path.join(projectDir, 'node_modules');
    pluginsStateDir = path.join(projectDir, '.red64');

    await fs.mkdir(projectDir, { recursive: true });
    await fs.mkdir(nodeModulesDir, { recursive: true });
    await fs.mkdir(pluginsStateDir, { recursive: true });

    registry = createPluginRegistry();
    logMessages = [];
    mockSpawn = createMockSpawn();
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    vi.clearAllMocks();
  });

  function createManager(
    spawnResults: Map<string, MockSpawnResult> = new Map()
  ): PluginManagerService {
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
  // Test: red64 plugin list with no plugins installed
  // ---------------------------------------------------------------------------

  describe('red64 plugin list with no plugins installed', () => {
    it('returns empty array when no plugins are installed', async () => {
      // Initialize state file with no plugins
      const stateFilePath = path.join(pluginsStateDir, 'plugins.json');
      await fs.writeFile(
        stateFilePath,
        JSON.stringify({ schemaVersion: 1, plugins: {} })
      );

      const manager = createManager();
      const plugins = await manager.list();

      expect(plugins).toEqual([]);
    });

    it('handles missing state file gracefully', async () => {
      // Don't create state file
      const manager = createManager();
      const plugins = await manager.list();

      expect(plugins).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Test: red64 plugin validate against a valid test plugin directory
  // ---------------------------------------------------------------------------

  describe('red64 plugin validate against a valid test plugin directory', () => {
    it('produces success message for valid plugin', async () => {
      const manifest = createValidManifest({ name: 'valid-plugin' });
      const pluginDir = await createTestPluginDir(tmpDir, 'valid-plugin', manifest);

      const manager = createManager();
      const result = await manager.validate(pluginDir);

      expect(result.valid).toBe(true);
      expect(result.manifest).not.toBeNull();
      expect(result.manifest?.name).toBe('valid-plugin');
      expect(result.errors).toEqual([]);
    });

    it('returns validation errors for invalid plugin', async () => {
      const invalidPluginDir = path.join(tmpDir, 'invalid-plugin');
      await fs.mkdir(invalidPluginDir, { recursive: true });
      await fs.writeFile(
        path.join(invalidPluginDir, 'red64-plugin.json'),
        JSON.stringify({ name: 'invalid-plugin' }) // Missing required fields
      );

      const manager = createManager();
      const result = await manager.validate(invalidPluginDir);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('checks entry point existence', async () => {
      const manifest = createValidManifest({
        name: 'missing-entry-plugin',
        entryPoint: './nonexistent.js',
      });

      const pluginDir = path.join(tmpDir, 'missing-entry-plugin');
      await fs.mkdir(pluginDir, { recursive: true });
      await fs.writeFile(
        path.join(pluginDir, 'red64-plugin.json'),
        JSON.stringify(manifest)
      );
      // Don't create the entry point

      const manager = createManager();
      const result = await manager.validate(pluginDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.toLowerCase().includes('entry'))).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Test: red64 plugin create scaffolds new plugin
  // ---------------------------------------------------------------------------

  describe('red64 plugin create scaffolds a new plugin', () => {
    it('creates expected directory structure', async () => {
      const manager = createManager();
      const targetDir = path.join(tmpDir, 'new-plugins');

      const result = await manager.scaffold('my-new-plugin', targetDir);

      expect(result.success).toBe(true);

      // Check directory structure
      const pluginDir = path.join(targetDir, 'my-new-plugin');
      const dirStat = await fs.stat(pluginDir);
      expect(dirStat.isDirectory()).toBe(true);

      // Check src directory
      const srcDir = path.join(pluginDir, 'src');
      const srcStat = await fs.stat(srcDir);
      expect(srcStat.isDirectory()).toBe(true);
    });

    it('creates manifest with correct structure', async () => {
      const manager = createManager();
      const targetDir = path.join(tmpDir, 'scaffold-manifest');

      await manager.scaffold('scaffold-test', targetDir);

      const manifestPath = path.join(targetDir, 'scaffold-test', 'red64-plugin.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      expect(manifest.name).toBe('scaffold-test');
      expect(manifest.version).toBe('0.1.0');
      expect(manifest.extensionPoints).toEqual([]);
      expect(manifest.entryPoint).toBe('./dist/index.js');
      expect(manifest.red64CliVersion).toBeDefined();
    });

    it('creates package.json with ESM configuration', async () => {
      const manager = createManager();
      const targetDir = path.join(tmpDir, 'scaffold-package');

      await manager.scaffold('esm-test', targetDir);

      const packagePath = path.join(targetDir, 'esm-test', 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf-8');
      const pkg = JSON.parse(packageContent);

      expect(pkg.name).toBe('esm-test');
      expect(pkg.type).toBe('module');
      expect(pkg.keywords).toContain('red64-plugin');
    });

    it('creates TypeScript entry point with activate/deactivate', async () => {
      const manager = createManager();
      const targetDir = path.join(tmpDir, 'scaffold-ts');

      await manager.scaffold('ts-test', targetDir);

      const indexPath = path.join(targetDir, 'ts-test', 'src', 'index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      expect(indexContent).toContain('export function activate');
      expect(indexContent).toContain('export function deactivate');
      expect(indexContent).toContain('PluginContextInterface');
    });

    it('creates tsconfig.json with strict mode', async () => {
      const manager = createManager();
      const targetDir = path.join(tmpDir, 'scaffold-tsconfig');

      await manager.scaffold('tsconfig-test', targetDir);

      const tsconfigPath = path.join(targetDir, 'tsconfig-test', 'tsconfig.json');
      const tsconfigContent = await fs.readFile(tsconfigPath, 'utf-8');
      const tsconfig = JSON.parse(tsconfigContent);

      expect(tsconfig.compilerOptions.strict).toBe(true);
      expect(tsconfig.compilerOptions.module).toBe('ESNext');
    });

    it('reports all created files', async () => {
      const manager = createManager();
      const targetDir = path.join(tmpDir, 'scaffold-files');

      const result = await manager.scaffold('files-test', targetDir);

      expect(result.success).toBe(true);
      expect(result.createdFiles.length).toBeGreaterThan(0);

      const fileNames = result.createdFiles.map((f) => path.basename(f));
      expect(fileNames).toContain('package.json');
      expect(fileNames).toContain('red64-plugin.json');
      expect(fileNames).toContain('tsconfig.json');
      expect(fileNames).toContain('index.ts');
    });
  });

  // ---------------------------------------------------------------------------
  // Test: red64 plugin install followed by red64 plugin list
  // ---------------------------------------------------------------------------

  describe('red64 plugin install followed by red64 plugin list shows the installed plugin', () => {
    it('shows installed plugin in list', async () => {
      const manifest = createValidManifest({
        name: 'installable-plugin',
        version: '1.0.0',
        description: 'Test installable plugin',
        extensionPoints: ['commands', 'hooks'],
      });

      const spawnResults = new Map<string, MockSpawnResult>([
        ['npm install', { code: 0, stdout: '', stderr: '' }],
      ]);

      // Create plugin in node_modules
      await createTestPluginDir(nodeModulesDir, 'installable-plugin', manifest);

      const manager = createManager(spawnResults);

      // Install
      const installResult = await manager.install('installable-plugin');
      expect(installResult.success).toBe(true);

      // List
      const plugins = await manager.list();

      expect(plugins).toHaveLength(1);
      expect(plugins[0]?.name).toBe('installable-plugin');
      expect(plugins[0]?.version).toBe('1.0.0');
      expect(plugins[0]?.enabled).toBe(true);
      expect(plugins[0]?.extensionPoints).toContain('commands');
      expect(plugins[0]?.extensionPoints).toContain('hooks');
    });

    it('shows multiple installed plugins in list', async () => {
      const manifest1 = createValidManifest({ name: 'plugin-one', version: '1.0.0' });
      const manifest2 = createValidManifest({ name: 'plugin-two', version: '2.0.0' });

      const spawnResults = new Map<string, MockSpawnResult>([
        ['npm install', { code: 0, stdout: '', stderr: '' }],
      ]);

      await createTestPluginDir(nodeModulesDir, 'plugin-one', manifest1);
      await createTestPluginDir(nodeModulesDir, 'plugin-two', manifest2);

      const manager = createManager(spawnResults);

      await manager.install('plugin-one');
      await manager.install('plugin-two');

      const plugins = await manager.list();

      expect(plugins).toHaveLength(2);
      expect(plugins.map((p) => p.name).sort()).toEqual(['plugin-one', 'plugin-two']);
    });
  });

  // ---------------------------------------------------------------------------
  // Test: red64 plugin config reads and writes plugin configuration
  // ---------------------------------------------------------------------------

  describe('red64 plugin config reads and writes plugin configuration correctly', () => {
    it('sets and gets config value', async () => {
      const manifest = createValidManifest({
        name: 'config-plugin',
        configSchema: {
          apiKey: { type: 'string', description: 'API key' },
          timeout: { type: 'number', description: 'Timeout', default: 30 },
        },
      });

      const spawnResults = new Map<string, MockSpawnResult>([
        ['npm install', { code: 0, stdout: '', stderr: '' }],
      ]);

      await createTestPluginDir(nodeModulesDir, 'config-plugin', manifest);

      const manager = createManager(spawnResults);
      await manager.install('config-plugin');

      // Set config
      await manager.setConfig('config-plugin', 'apiKey', 'secret-key-123');

      // Get config
      const config = await manager.getConfig('config-plugin');

      expect(config['apiKey']).toBe('secret-key-123');
      expect(config['timeout']).toBe(30); // Default value
    });

    it('stores config in correct location', async () => {
      const manifest = createValidManifest({
        name: 'storage-config-plugin',
        configSchema: {
          setting: { type: 'string', description: 'A setting' },
        },
      });

      const spawnResults = new Map<string, MockSpawnResult>([
        ['npm install', { code: 0, stdout: '', stderr: '' }],
      ]);

      await createTestPluginDir(nodeModulesDir, 'storage-config-plugin', manifest);

      const manager = createManager(spawnResults);
      await manager.install('storage-config-plugin');

      await manager.setConfig('storage-config-plugin', 'setting', 'value');

      // Check config file location
      const configPath = path.join(
        pluginsStateDir,
        'plugins',
        'storage-config-plugin',
        'config.json'
      );
      const configContent = await fs.readFile(configPath, 'utf-8');
      const storedConfig = JSON.parse(configContent);

      expect(storedConfig.setting).toBe('value');
    });

    it('validates config against schema', async () => {
      const manifest = createValidManifest({
        name: 'validate-config-plugin',
        configSchema: {
          port: { type: 'number', description: 'Port number' },
        },
      });

      const spawnResults = new Map<string, MockSpawnResult>([
        ['npm install', { code: 0, stdout: '', stderr: '' }],
      ]);

      await createTestPluginDir(nodeModulesDir, 'validate-config-plugin', manifest);

      const manager = createManager(spawnResults);
      await manager.install('validate-config-plugin');

      // Valid value should succeed
      await expect(
        manager.setConfig('validate-config-plugin', 'port', 8080)
      ).resolves.not.toThrow();

      // Invalid value should fail
      await expect(
        manager.setConfig('validate-config-plugin', 'port', 'not-a-number')
      ).rejects.toThrow();
    });

    it('gets specific config key', async () => {
      const manifest = createValidManifest({
        name: 'key-config-plugin',
        configSchema: {
          key1: { type: 'string', description: 'Key 1' },
          key2: { type: 'string', description: 'Key 2' },
        },
      });

      const spawnResults = new Map<string, MockSpawnResult>([
        ['npm install', { code: 0, stdout: '', stderr: '' }],
      ]);

      await createTestPluginDir(nodeModulesDir, 'key-config-plugin', manifest);

      const manager = createManager(spawnResults);
      await manager.install('key-config-plugin');

      await manager.setConfig('key-config-plugin', 'key1', 'value1');
      await manager.setConfig('key-config-plugin', 'key2', 'value2');

      // Get specific key
      const config = await manager.getConfig('key-config-plugin', 'key1');

      expect(config['key1']).toBe('value1');
      expect(config['key2']).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Test: red64 plugin search returns results from mocked registry
  // ---------------------------------------------------------------------------

  describe('red64 plugin search returns results from mocked registry', () => {
    it('returns search results matching query', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            objects: [
              {
                package: {
                  name: 'red64-plugin-test',
                  description: 'Test plugin for red64',
                  version: '1.0.0',
                  author: { name: 'Test Author' },
                },
              },
              {
                package: {
                  name: 'red64-plugin-analyzer',
                  description: 'Code analyzer plugin',
                  version: '2.0.0',
                  author: { name: 'Another Author' },
                },
              },
            ],
          }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const manager = createManager();
      const results = await manager.search('test');

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        name: 'red64-plugin-test',
        description: 'Test plugin for red64',
        version: '1.0.0',
        author: 'Test Author',
      });
      expect(results[1]?.name).toBe('red64-plugin-analyzer');

      vi.unstubAllGlobals();
    });

    it('returns empty array when no matches', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ objects: [] }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const manager = createManager();
      const results = await manager.search('nonexistent-query-12345');

      expect(results).toEqual([]);

      vi.unstubAllGlobals();
    });

    it('uses red64-plugin keyword in search', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ objects: [] }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const manager = createManager();
      await manager.search('myquery');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('keywords:red64-plugin');
      expect(calledUrl).toContain('myquery');

      vi.unstubAllGlobals();
    });

    it('handles network errors gracefully', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      vi.stubGlobal('fetch', mockFetch);

      const manager = createManager();
      const results = await manager.search('test');

      expect(results).toEqual([]);

      vi.unstubAllGlobals();
    });

    it('handles missing author field', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            objects: [
              {
                package: {
                  name: 'red64-plugin-noauthor',
                  description: 'Plugin without author',
                  version: '1.0.0',
                  // No author
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

    it('supports custom registry URL', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ objects: [] }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const manager = createManager();
      await manager.search('test', { registryUrl: 'https://private.registry.com' });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('https://private.registry.com');

      vi.unstubAllGlobals();
    });
  });
});
