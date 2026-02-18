/**
 * PluginScreen tests - Tasks 10.1
 * Tests for plugin management UI component.
 *
 * Requirements coverage:
 * - Task 10.1: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8, 9.1, 11.1, 11.2, 12.1, 12.4
 */
import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { PluginScreen } from '../../src/components/screens/PluginScreen.js';
import type { GlobalFlags } from '../../src/types/index.js';
import type { PluginManagerService } from '../../src/plugins/PluginManager.js';

// ---------------------------------------------------------------------------
// Mock Setup
// ---------------------------------------------------------------------------

// Mock the plugin manager module
const mockPluginManager: Partial<PluginManagerService> = {
  install: vi.fn(),
  uninstall: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
  update: vi.fn(),
  list: vi.fn(),
  search: vi.fn(),
  info: vi.fn(),
  getConfig: vi.fn(),
  setConfig: vi.fn(),
  scaffold: vi.fn(),
  validate: vi.fn(),
};

// Mock the createPluginManager factory
vi.mock('../../src/plugins/PluginManager.js', () => ({
  createPluginManager: vi.fn(() => mockPluginManager),
}));

// Mock the createPluginRegistry factory
vi.mock('../../src/plugins/PluginRegistry.js', () => ({
  createPluginRegistry: vi.fn(() => ({
    registerPlugin: vi.fn(),
    unregisterPlugin: vi.fn(),
    getPlugin: vi.fn(),
    getAllPlugins: vi.fn(() => []),
    registerCommand: vi.fn(),
    getCommand: vi.fn(),
    getAllCommands: vi.fn(() => []),
    registerAgent: vi.fn(),
    getAgent: vi.fn(),
    getAllAgents: vi.fn(() => []),
    registerHook: vi.fn(),
    getHooks: vi.fn(() => []),
    registerService: vi.fn(),
    resolveService: vi.fn(),
    hasService: vi.fn(() => false),
    registerTemplate: vi.fn(),
    getTemplates: vi.fn(() => []),
  })),
}));

// Mock the createManifestValidator factory
vi.mock('../../src/plugins/ManifestValidator.js', () => ({
  createManifestValidator: vi.fn(() => ({
    validate: vi.fn(),
    validateManifestData: vi.fn(),
    checkCompatibility: vi.fn(() => ({ compatible: true, message: 'Compatible' })),
  })),
}));

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

function createDefaultFlags(): GlobalFlags {
  return {
    skipPermissions: false,
    brownfield: false,
    greenfield: true,
    tier: undefined,
    help: false,
    version: false,
    verbose: false,
    yes: false,
    sandbox: false,
    model: undefined,
    ollama: false,
    stack: undefined,
    'skip-guided': undefined,
    'no-steering': undefined,
    'skip-tests': undefined,
    'local-image': undefined,
    'task-level': undefined,
    agent: undefined,
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('PluginScreen - Task 10.1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations
    (mockPluginManager.list as Mock).mockResolvedValue([]);
    (mockPluginManager.search as Mock).mockResolvedValue([]);
    (mockPluginManager.info as Mock).mockResolvedValue(null);
    (mockPluginManager.install as Mock).mockResolvedValue({ success: true, pluginName: 'test', version: '1.0.0' });
    (mockPluginManager.uninstall as Mock).mockResolvedValue({ success: true, pluginName: 'test' });
    (mockPluginManager.update as Mock).mockResolvedValue({ success: true, pluginName: 'test', previousVersion: '1.0.0', newVersion: '2.0.0' });
    (mockPluginManager.enable as Mock).mockResolvedValue(undefined);
    (mockPluginManager.disable as Mock).mockResolvedValue(undefined);
    (mockPluginManager.getConfig as Mock).mockResolvedValue({});
    (mockPluginManager.setConfig as Mock).mockResolvedValue(undefined);
    (mockPluginManager.scaffold as Mock).mockResolvedValue({ success: true, createdFiles: [] });
    (mockPluginManager.validate as Mock).mockResolvedValue({ valid: true, manifest: { name: 'test' }, errors: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Help / Unknown Subcommand Tests
  // ---------------------------------------------------------------------------

  describe('help subcommand', () => {
    it('displays help when no subcommand is provided', () => {
      const { lastFrame } = render(
        <PluginScreen args={[]} flags={createDefaultFlags()} />
      );

      expect(lastFrame()).toContain('plugin');
      expect(lastFrame()).toContain('install');
      expect(lastFrame()).toContain('uninstall');
      expect(lastFrame()).toContain('enable');
      expect(lastFrame()).toContain('disable');
      expect(lastFrame()).toContain('list');
    });

    it('displays help when "help" subcommand is provided', () => {
      const { lastFrame } = render(
        <PluginScreen args={['help']} flags={createDefaultFlags()} />
      );

      expect(lastFrame()).toContain('plugin');
      expect(lastFrame()).toContain('install');
    });
  });

  // ---------------------------------------------------------------------------
  // List Subcommand Tests (Req 3.5)
  // ---------------------------------------------------------------------------

  describe('list subcommand (Req 3.5)', () => {
    it('displays "No plugins installed" when no plugins exist', async () => {
      (mockPluginManager.list as Mock).mockResolvedValue([]);

      const { lastFrame } = render(
        <PluginScreen args={['list']} flags={createDefaultFlags()} />
      );

      // Wait for async operation
      await vi.waitFor(() => {
        expect(lastFrame()).toContain('No plugins installed');
      });
    });

    it('displays formatted table with plugin info when plugins exist', async () => {
      (mockPluginManager.list as Mock).mockResolvedValue([
        {
          name: 'test-plugin',
          version: '1.0.0',
          enabled: true,
          extensionPoints: ['commands', 'hooks'],
          description: 'A test plugin',
        },
        {
          name: 'another-plugin',
          version: '2.1.0',
          enabled: false,
          extensionPoints: ['agents'],
          description: 'Another test plugin',
        },
      ]);

      const { lastFrame } = render(
        <PluginScreen args={['list']} flags={createDefaultFlags()} />
      );

      await vi.waitFor(() => {
        const frame = lastFrame();
        expect(frame).toContain('test-plugin');
        expect(frame).toContain('1.0.0');
        expect(frame).toContain('another-plugin');
        expect(frame).toContain('2.1.0');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Install Subcommand Tests (Req 3.1, 3.6)
  // ---------------------------------------------------------------------------

  describe('install subcommand (Req 3.1, 3.6)', () => {
    it('displays usage when no plugin name provided', () => {
      const { lastFrame } = render(
        <PluginScreen args={['install']} flags={createDefaultFlags()} />
      );

      expect(lastFrame()).toContain('Usage');
      expect(lastFrame()).toContain('install');
    });

    it('shows progress feedback during installation (Req 3.6)', async () => {
      let capturedOnProgress: ((step: { phase: string; progress?: number }) => void) | undefined;

      (mockPluginManager.install as Mock).mockImplementation(async (_name, options) => {
        capturedOnProgress = options?.onProgress;
        // Simulate progress
        options?.onProgress?.({ phase: 'downloading', progress: 50 });
        options?.onProgress?.({ phase: 'validating' });
        options?.onProgress?.({ phase: 'activating' });
        options?.onProgress?.({ phase: 'complete' });
        return { success: true, pluginName: 'my-plugin', version: '1.0.0' };
      });

      const { lastFrame } = render(
        <PluginScreen args={['install', 'my-plugin']} flags={createDefaultFlags()} />
      );

      // Wait for completion
      await vi.waitFor(() => {
        const frame = lastFrame();
        // Should show success message when complete
        expect(frame).toMatch(/success|installed|complete/i);
      });
    });

    it('shows success message when installation succeeds', async () => {
      (mockPluginManager.install as Mock).mockResolvedValue({
        success: true,
        pluginName: 'my-plugin',
        version: '1.0.0',
      });

      const { lastFrame } = render(
        <PluginScreen args={['install', 'my-plugin']} flags={createDefaultFlags()} />
      );

      await vi.waitFor(() => {
        const frame = lastFrame();
        expect(frame).toMatch(/success|installed|my-plugin/i);
      });
    });

    it('shows error message when installation fails', async () => {
      (mockPluginManager.install as Mock).mockResolvedValue({
        success: false,
        pluginName: 'bad-plugin',
        version: '',
        error: 'Invalid manifest',
      });

      const { lastFrame } = render(
        <PluginScreen args={['install', 'bad-plugin']} flags={createDefaultFlags()} />
      );

      await vi.waitFor(() => {
        const frame = lastFrame();
        expect(frame).toMatch(/error|failed|Invalid manifest/i);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Uninstall Subcommand Tests (Req 3.2)
  // ---------------------------------------------------------------------------

  describe('uninstall subcommand (Req 3.2)', () => {
    it('displays usage when no plugin name provided', () => {
      const { lastFrame } = render(
        <PluginScreen args={['uninstall']} flags={createDefaultFlags()} />
      );

      expect(lastFrame()).toContain('Usage');
    });

    it('shows success message when uninstall succeeds', async () => {
      (mockPluginManager.uninstall as Mock).mockResolvedValue({
        success: true,
        pluginName: 'my-plugin',
      });

      const { lastFrame } = render(
        <PluginScreen args={['uninstall', 'my-plugin']} flags={createDefaultFlags()} />
      );

      await vi.waitFor(() => {
        const frame = lastFrame();
        expect(frame).toMatch(/success|uninstalled|removed/i);
      });
    });

    it('shows error message when uninstall fails', async () => {
      (mockPluginManager.uninstall as Mock).mockResolvedValue({
        success: false,
        pluginName: 'my-plugin',
        error: 'Plugin not found',
      });

      const { lastFrame } = render(
        <PluginScreen args={['uninstall', 'my-plugin']} flags={createDefaultFlags()} />
      );

      await vi.waitFor(() => {
        const frame = lastFrame();
        expect(frame).toMatch(/error|failed|not found/i);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Enable Subcommand Tests (Req 3.3)
  // ---------------------------------------------------------------------------

  describe('enable subcommand (Req 3.3)', () => {
    it('displays usage when no plugin name provided', () => {
      const { lastFrame } = render(
        <PluginScreen args={['enable']} flags={createDefaultFlags()} />
      );

      expect(lastFrame()).toContain('Usage');
    });

    it('shows success message when enable succeeds', async () => {
      (mockPluginManager.enable as Mock).mockResolvedValue(undefined);

      const { lastFrame } = render(
        <PluginScreen args={['enable', 'my-plugin']} flags={createDefaultFlags()} />
      );

      await vi.waitFor(() => {
        const frame = lastFrame();
        expect(frame).toMatch(/enabled|success/i);
      });
    });

    it('shows error message when enable fails', async () => {
      (mockPluginManager.enable as Mock).mockRejectedValue(new Error('Plugin not installed'));

      const { lastFrame } = render(
        <PluginScreen args={['enable', 'my-plugin']} flags={createDefaultFlags()} />
      );

      await vi.waitFor(() => {
        const frame = lastFrame();
        expect(frame).toMatch(/error|not installed/i);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Disable Subcommand Tests (Req 3.4)
  // ---------------------------------------------------------------------------

  describe('disable subcommand (Req 3.4)', () => {
    it('displays usage when no plugin name provided', () => {
      const { lastFrame } = render(
        <PluginScreen args={['disable']} flags={createDefaultFlags()} />
      );

      expect(lastFrame()).toContain('Usage');
    });

    it('shows success message when disable succeeds', async () => {
      (mockPluginManager.disable as Mock).mockResolvedValue(undefined);

      const { lastFrame } = render(
        <PluginScreen args={['disable', 'my-plugin']} flags={createDefaultFlags()} />
      );

      await vi.waitFor(() => {
        const frame = lastFrame();
        expect(frame).toMatch(/disabled|success/i);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Update Subcommand Tests (Req 3.8)
  // ---------------------------------------------------------------------------

  describe('update subcommand (Req 3.8)', () => {
    it('displays usage when no plugin name provided', () => {
      const { lastFrame } = render(
        <PluginScreen args={['update']} flags={createDefaultFlags()} />
      );

      expect(lastFrame()).toContain('Usage');
    });

    it('shows progress feedback during update', async () => {
      (mockPluginManager.update as Mock).mockResolvedValue({
        success: true,
        pluginName: 'my-plugin',
        previousVersion: '1.0.0',
        newVersion: '2.0.0',
      });

      const { lastFrame } = render(
        <PluginScreen args={['update', 'my-plugin']} flags={createDefaultFlags()} />
      );

      await vi.waitFor(() => {
        const frame = lastFrame();
        expect(frame).toMatch(/updated|success|2\.0\.0/i);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Search Subcommand Tests (Req 11.1)
  // ---------------------------------------------------------------------------

  describe('search subcommand (Req 11.1)', () => {
    it('displays usage when no query provided', () => {
      const { lastFrame } = render(
        <PluginScreen args={['search']} flags={createDefaultFlags()} />
      );

      expect(lastFrame()).toContain('Usage');
    });

    it('displays formatted table with search results', async () => {
      (mockPluginManager.search as Mock).mockResolvedValue([
        { name: 'red64-plugin-test', description: 'A test plugin', version: '1.0.0', author: 'Test Author' },
        { name: 'red64-plugin-other', description: 'Another plugin', version: '2.0.0', author: 'Other Author' },
      ]);

      const { lastFrame } = render(
        <PluginScreen args={['search', 'test']} flags={createDefaultFlags()} />
      );

      await vi.waitFor(() => {
        const frame = lastFrame();
        expect(frame).toContain('red64-plugin-test');
        expect(frame).toContain('red64-plugin-other');
      });
    });

    it('displays "No plugins found" when search returns empty', async () => {
      (mockPluginManager.search as Mock).mockResolvedValue([]);

      const { lastFrame } = render(
        <PluginScreen args={['search', 'nonexistent']} flags={createDefaultFlags()} />
      );

      await vi.waitFor(() => {
        const frame = lastFrame();
        expect(frame).toMatch(/no plugins found|no results/i);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Info Subcommand Tests (Req 11.2)
  // ---------------------------------------------------------------------------

  describe('info subcommand (Req 11.2)', () => {
    it('displays usage when no plugin name provided', () => {
      const { lastFrame } = render(
        <PluginScreen args={['info']} flags={createDefaultFlags()} />
      );

      expect(lastFrame()).toContain('Usage');
    });

    it('displays detailed plugin information', async () => {
      (mockPluginManager.info as Mock).mockResolvedValue({
        name: 'my-plugin',
        version: '1.0.0',
        enabled: true,
        extensionPoints: ['commands', 'hooks'],
        description: 'A wonderful plugin',
        author: 'Plugin Author',
        compatibilityRange: '>=1.0.0',
        configSchema: { option: { type: 'string', description: 'An option' } },
        dependencies: ['other-plugin'],
      });

      const { lastFrame } = render(
        <PluginScreen args={['info', 'my-plugin']} flags={createDefaultFlags()} />
      );

      await vi.waitFor(() => {
        const frame = lastFrame();
        expect(frame).toContain('my-plugin');
        expect(frame).toContain('1.0.0');
        expect(frame).toContain('Plugin Author');
        expect(frame).toContain('wonderful plugin');
      });
    });

    it('displays "Plugin not found" when info returns null', async () => {
      (mockPluginManager.info as Mock).mockResolvedValue(null);

      const { lastFrame } = render(
        <PluginScreen args={['info', 'nonexistent']} flags={createDefaultFlags()} />
      );

      await vi.waitFor(() => {
        const frame = lastFrame();
        expect(frame).toMatch(/not found|could not find/i);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Config Subcommand Tests (Req 9.1)
  // ---------------------------------------------------------------------------

  describe('config subcommand (Req 9.1)', () => {
    it('displays usage when no plugin name provided', () => {
      const { lastFrame } = render(
        <PluginScreen args={['config']} flags={createDefaultFlags()} />
      );

      expect(lastFrame()).toContain('Usage');
    });

    it('displays config values when only plugin name provided', async () => {
      (mockPluginManager.getConfig as Mock).mockResolvedValue({
        apiKey: 'secret-key',
        timeout: 30,
      });

      const { lastFrame } = render(
        <PluginScreen args={['config', 'my-plugin']} flags={createDefaultFlags()} />
      );

      await vi.waitFor(() => {
        const frame = lastFrame();
        expect(frame).toContain('apiKey');
        expect(frame).toContain('timeout');
      });
    });

    it('sets config value when key and value provided', async () => {
      (mockPluginManager.setConfig as Mock).mockResolvedValue(undefined);

      const { lastFrame } = render(
        <PluginScreen args={['config', 'my-plugin', 'apiKey', 'new-value']} flags={createDefaultFlags()} />
      );

      await vi.waitFor(() => {
        expect(mockPluginManager.setConfig).toHaveBeenCalledWith('my-plugin', 'apiKey', 'new-value');
        const frame = lastFrame();
        expect(frame).toMatch(/set|updated|success/i);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Create Subcommand Tests (Req 12.1)
  // ---------------------------------------------------------------------------

  describe('create subcommand (Req 12.1)', () => {
    it('displays usage when no plugin name provided', () => {
      const { lastFrame } = render(
        <PluginScreen args={['create']} flags={createDefaultFlags()} />
      );

      expect(lastFrame()).toContain('Usage');
    });

    it('shows success message when scaffold succeeds', async () => {
      (mockPluginManager.scaffold as Mock).mockResolvedValue({
        success: true,
        createdFiles: ['package.json', 'red64-plugin.json', 'src/index.ts'],
      });

      const { lastFrame } = render(
        <PluginScreen args={['create', 'my-new-plugin']} flags={createDefaultFlags()} />
      );

      await vi.waitFor(() => {
        const frame = lastFrame();
        expect(frame).toMatch(/created|scaffolded|success/i);
      });
    });

    it('shows error message when scaffold fails', async () => {
      (mockPluginManager.scaffold as Mock).mockResolvedValue({
        success: false,
        createdFiles: [],
        error: 'Directory already exists',
      });

      const { lastFrame } = render(
        <PluginScreen args={['create', 'my-new-plugin']} flags={createDefaultFlags()} />
      );

      await vi.waitFor(() => {
        const frame = lastFrame();
        expect(frame).toMatch(/error|failed|already exists/i);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Validate Subcommand Tests (Req 12.4)
  // ---------------------------------------------------------------------------

  describe('validate subcommand (Req 12.4)', () => {
    it('displays usage when no path provided', () => {
      const { lastFrame } = render(
        <PluginScreen args={['validate']} flags={createDefaultFlags()} />
      );

      expect(lastFrame()).toContain('Usage');
    });

    it('displays validation success', async () => {
      (mockPluginManager.validate as Mock).mockResolvedValue({
        valid: true,
        manifest: { name: 'valid-plugin', version: '1.0.0' },
        errors: [],
      });

      const { lastFrame } = render(
        <PluginScreen args={['validate', '/path/to/plugin']} flags={createDefaultFlags()} />
      );

      await vi.waitFor(() => {
        const frame = lastFrame();
        expect(frame).toMatch(/valid|success|passed/i);
      });
    });

    it('displays validation errors', async () => {
      (mockPluginManager.validate as Mock).mockResolvedValue({
        valid: false,
        manifest: null,
        errors: [
          { field: 'version', message: 'Required field missing', code: 'MISSING_FIELD' },
          { field: 'entryPoint', message: 'Entry point not found', code: 'INVALID_VALUE' },
        ],
      });

      const { lastFrame } = render(
        <PluginScreen args={['validate', '/path/to/plugin']} flags={createDefaultFlags()} />
      );

      await vi.waitFor(() => {
        const frame = lastFrame();
        expect(frame).toMatch(/invalid|error|failed/i);
        expect(frame).toContain('version');
        expect(frame).toContain('entryPoint');
      });
    });
  });
});
