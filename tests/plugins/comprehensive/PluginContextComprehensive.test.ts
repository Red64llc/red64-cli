/**
 * Comprehensive PluginContext tests - Task 11.1
 * Additional tests for context behavior and security restrictions.
 *
 * Requirements coverage: 4.5, 6.3, 9.5, 10.1, 10.3
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPluginContext, type PluginContextOptions } from '../../../src/plugins/PluginContext.js';
import { createPluginRegistry, type PluginRegistryService } from '../../../src/plugins/PluginRegistry.js';
import type { PluginContextInterface, PluginModule, LoadedPlugin } from '../../../src/plugins/types.js';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

function createMockLoadedPlugin(name: string): LoadedPlugin {
  return {
    name,
    version: '1.0.0',
    manifest: {
      name,
      version: '1.0.0',
      description: 'Test plugin',
      author: 'Test',
      entryPoint: './index.js',
      red64CliVersion: '^1.0.0',
      extensionPoints: ['commands', 'agents', 'hooks', 'services', 'templates'],
    },
  };
}

function createMockModule(): PluginModule {
  return {
    activate: vi.fn(),
    deactivate: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PluginContext - Comprehensive Coverage', () => {
  let registry: PluginRegistryService;
  let logMessages: Array<{ level: string; message: string }>;

  beforeEach(() => {
    registry = createPluginRegistry();
    logMessages = [];
    registry.registerPlugin(createMockLoadedPlugin('test-plugin'), createMockModule());
  });

  function createContext(overrides: Partial<PluginContextOptions> = {}): PluginContextInterface {
    return createPluginContext({
      pluginName: 'test-plugin',
      pluginVersion: '1.0.0',
      config: { apiKey: 'test-key', timeout: 30 },
      cliVersion: '1.0.0',
      projectConfig: { projectName: 'test-project' },
      registry,
      logger: (level, message) => {
        logMessages.push({ level, message });
      },
      ...overrides,
    });
  }

  describe('registration methods delegate to registry with correct plugin attribution', () => {
    it('registerCommand delegates with plugin name', () => {
      const context = createContext();

      context.registerCommand({
        name: 'my-cmd',
        description: 'My command',
        handler: vi.fn(),
      });

      const cmd = registry.getCommand('my-cmd');
      expect(cmd).toBeDefined();
      expect(cmd?.pluginName).toBe('test-plugin');
    });

    it('registerAgent delegates with plugin name', () => {
      const context = createContext();

      context.registerAgent({
        name: 'my-agent',
        description: 'My agent',
        adapter: { invoke: vi.fn(), getCapabilities: vi.fn() },
      });

      const agent = registry.getAgent('my-agent');
      expect(agent).toBeDefined();
      expect(agent?.pluginName).toBe('test-plugin');
    });

    it('registerHook delegates with plugin name', () => {
      const context = createContext();

      context.registerHook({
        phase: 'requirements',
        timing: 'pre',
        priority: 'normal',
        handler: vi.fn(),
      });

      const hooks = registry.getHooks('requirements', 'pre');
      expect(hooks).toHaveLength(1);
      expect(hooks[0]?.pluginName).toBe('test-plugin');
    });

    it('registerService delegates with plugin name', () => {
      const context = createContext();

      context.registerService({
        name: 'my-service',
        factory: () => ({ value: 'test' }),
      });

      expect(registry.hasService('my-service')).toBe(true);
    });

    it('registerTemplate delegates with plugin name', () => {
      const context = createContext();

      context.registerTemplate({
        category: 'stack',
        name: 'my-template',
        description: 'My template',
        sourcePath: '/path/to/template',
      });

      const templates = registry.getTemplates('stack');
      expect(templates).toHaveLength(1);
      expect(templates[0]?.pluginName).toBe('test-plugin');
      expect(templates[0]?.namespacedName).toBe('test-plugin/my-template');
    });
  });

  describe('config returns frozen object', () => {
    it('config object is frozen', () => {
      const context = createContext();

      expect(Object.isFrozen(context.config)).toBe(true);
    });

    it('cannot modify config directly', () => {
      const context = createContext();

      expect(() => {
        (context.config as Record<string, unknown>).apiKey = 'modified';
      }).toThrow();
    });

    it('nested config objects are also frozen', () => {
      const context = createContext({
        config: {
          nested: {
            value: 'original',
          },
        },
      });

      expect(Object.isFrozen(context.config.nested)).toBe(true);
    });

    it('cannot add new properties to config', () => {
      const context = createContext();

      expect(() => {
        (context.config as Record<string, unknown>).newProp = 'new value';
      }).toThrow();
    });
  });

  describe('restricted API does not expose internals', () => {
    it('does not expose registry directly', () => {
      const context = createContext();

      // Context should not have a 'registry' property
      expect((context as Record<string, unknown>).registry).toBeUndefined();
    });

    it('does not expose filesystem access', () => {
      const context = createContext();

      // Context should not have fs-related methods
      expect((context as Record<string, unknown>).readFile).toBeUndefined();
      expect((context as Record<string, unknown>).writeFile).toBeUndefined();
      expect((context as Record<string, unknown>).fs).toBeUndefined();
    });

    it('does not expose process control', () => {
      const context = createContext();

      // Context should not have process-related methods
      expect((context as Record<string, unknown>).spawn).toBeUndefined();
      expect((context as Record<string, unknown>).exec).toBeUndefined();
      expect((context as Record<string, unknown>).process).toBeUndefined();
    });

    it('does not expose mutable core state', () => {
      const context = createContext();

      // Context should not expose internal state manipulation
      expect((context as Record<string, unknown>).setState).toBeUndefined();
      expect((context as Record<string, unknown>).modifyCore).toBeUndefined();
    });

    it('getProjectConfig returns frozen object', () => {
      const context = createContext();

      const projectConfig = context.getProjectConfig();
      expect(projectConfig).not.toBeNull();
      expect(Object.isFrozen(projectConfig)).toBe(true);
    });

    it('getProjectConfig returns null when no project config', () => {
      const context = createContext({ projectConfig: null });

      expect(context.getProjectConfig()).toBeNull();
    });
  });

  describe('service resolution through context', () => {
    it('getService resolves registered services', () => {
      // Register a service first
      registry.registerService('test-plugin', {
        name: 'context-service',
        factory: () => ({ resolved: true }),
      });

      const context = createContext();
      const service = context.getService<{ resolved: boolean }>('context-service');

      expect(service.resolved).toBe(true);
    });

    it('hasService returns true for registered services', () => {
      registry.registerService('test-plugin', {
        name: 'check-service',
        factory: () => ({}),
      });

      const context = createContext();

      expect(context.hasService('check-service')).toBe(true);
      expect(context.hasService('nonexistent')).toBe(false);
    });

    it('getService throws for non-existent service', () => {
      const context = createContext();

      expect(() => {
        context.getService('nonexistent-service');
      }).toThrow();
    });
  });

  describe('logging utility', () => {
    it('log prefixes messages with plugin name', () => {
      const context = createContext();

      context.log('info', 'Test message');

      expect(logMessages).toHaveLength(1);
      expect(logMessages[0]?.level).toBe('info');
      expect(logMessages[0]?.message).toContain('[plugin:test-plugin]');
      expect(logMessages[0]?.message).toContain('Test message');
    });

    it('log supports all log levels', () => {
      const context = createContext();

      context.log('info', 'Info message');
      context.log('warn', 'Warning message');
      context.log('error', 'Error message');

      expect(logMessages).toHaveLength(3);
      expect(logMessages.map((m) => m.level)).toEqual(['info', 'warn', 'error']);
    });
  });

  describe('read-only core access', () => {
    it('getCLIVersion returns CLI version', () => {
      const context = createContext({ cliVersion: '2.5.0' });

      expect(context.getCLIVersion()).toBe('2.5.0');
    });

    it('plugin identity properties are correct', () => {
      const context = createContext({
        pluginName: 'my-plugin',
        pluginVersion: '1.2.3',
      });

      expect(context.pluginName).toBe('my-plugin');
      expect(context.pluginVersion).toBe('1.2.3');
    });

    it('plugin identity properties remain consistent after reassignment attempt', () => {
      // Note: The PluginContext returns a plain object, so assignment may succeed
      // but should not affect the original plugin name used for registration.
      // This tests that the context provides stable plugin identity.
      const context = createContext();
      const originalName = context.pluginName;

      // Try to modify
      try {
        (context as { pluginName: string }).pluginName = 'modified';
      } catch {
        // Expected in strict mode
      }

      // Verify registrations still use original plugin name
      context.registerCommand({
        name: 'identity-test-cmd',
        description: 'Test command',
        handler: vi.fn(),
      });

      const cmd = registry.getCommand('identity-test-cmd');
      expect(cmd?.pluginName).toBe(originalName);
    });
  });

  describe('no logger provided', () => {
    it('works without logger (no-op)', () => {
      const context = createPluginContext({
        pluginName: 'test-plugin',
        pluginVersion: '1.0.0',
        config: {},
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
        // No logger provided
      });

      // Should not throw
      expect(() => {
        context.log('info', 'Test message');
      }).not.toThrow();
    });
  });
});
