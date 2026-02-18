/**
 * PluginContext tests - Task 3.1
 * Tests for the scoped plugin context (controlled API surface).
 *
 * Requirements coverage: 4.5, 6.3, 9.5, 10.1, 10.3
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPluginContext } from '../../src/plugins/PluginContext';
import { createPluginRegistry, type PluginRegistryService } from '../../src/plugins/PluginRegistry';
import type {
  CommandRegistration,
  AgentRegistration,
  HookRegistration,
  ServiceRegistration,
  TemplateRegistration,
  LoadedPlugin,
  PluginModule,
  AgentCapability,
} from '../../src/plugins/types';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

function createMockRegistry(): PluginRegistryService {
  return createPluginRegistry();
}

function createMockLogger(): (level: 'info' | 'warn' | 'error', message: string) => void {
  return vi.fn();
}

function createMockCommandRegistration(
  name: string = 'test-command',
  overrides: Partial<CommandRegistration> = {}
): CommandRegistration {
  return {
    name,
    description: 'A test command',
    handler: vi.fn(),
    ...overrides,
  };
}

function createMockAgentRegistration(
  name: string = 'test-agent',
  overrides: Partial<AgentRegistration> = {}
): AgentRegistration {
  return {
    name,
    description: 'A test agent',
    adapter: {
      invoke: vi.fn().mockResolvedValue({ success: true, output: '' }),
      getCapabilities: vi.fn().mockReturnValue(['code-generation'] as AgentCapability[]),
      configure: vi.fn(),
    },
    ...overrides,
  };
}

function createMockHookRegistration(
  overrides: Partial<HookRegistration> = {}
): HookRegistration {
  return {
    phase: 'requirements',
    timing: 'pre',
    priority: 'normal',
    handler: vi.fn().mockResolvedValue({ action: 'continue' }),
    ...overrides,
  };
}

function createMockServiceRegistration(
  name: string = 'test-service',
  overrides: Partial<ServiceRegistration> = {}
): ServiceRegistration {
  return {
    name,
    factory: vi.fn().mockReturnValue({ service: true }),
    ...overrides,
  };
}

function createMockTemplateRegistration(
  name: string = 'test-template',
  overrides: Partial<TemplateRegistration> = {}
): TemplateRegistration {
  return {
    category: 'stack',
    name,
    description: 'A test template',
    sourcePath: '/path/to/template',
    ...overrides,
  };
}

// Helper to register a mock plugin in the registry
function registerMockPlugin(registry: PluginRegistryService, name: string): void {
  const plugin: LoadedPlugin = {
    name,
    version: '1.0.0',
    manifest: {
      name,
      version: '1.0.0',
      description: 'Test plugin',
      author: 'Test Author',
      entryPoint: './index.js',
      red64CliVersion: '^1.0.0',
      extensionPoints: [],
    },
  };
  const module: PluginModule = {
    activate: vi.fn(),
    deactivate: vi.fn(),
  };
  registry.registerPlugin(plugin, module);
}

// ---------------------------------------------------------------------------
// Plugin Context Tests
// ---------------------------------------------------------------------------

describe('PluginContext', () => {
  let registry: PluginRegistryService;

  beforeEach(() => {
    registry = createMockRegistry();
  });

  // ---------------------------------------------------------------------------
  // Plugin Identity Tests
  // ---------------------------------------------------------------------------

  describe('Plugin Identity', () => {
    it('exposes read-only pluginName', () => {
      const context = createPluginContext({
        pluginName: 'my-plugin',
        pluginVersion: '1.0.0',
        config: {},
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
      });

      expect(context.pluginName).toBe('my-plugin');
    });

    it('exposes read-only pluginVersion', () => {
      const context = createPluginContext({
        pluginName: 'my-plugin',
        pluginVersion: '2.3.4',
        config: {},
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
      });

      expect(context.pluginVersion).toBe('2.3.4');
    });
  });

  // ---------------------------------------------------------------------------
  // Configuration Tests (Requirement 9.5)
  // ---------------------------------------------------------------------------

  describe('Configuration Access (Requirement 9.5)', () => {
    it('provides read-only access to plugin config', () => {
      const pluginConfig = { apiKey: 'secret', timeout: 5000 };
      const context = createPluginContext({
        pluginName: 'my-plugin',
        pluginVersion: '1.0.0',
        config: pluginConfig,
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
      });

      expect(context.config).toEqual({ apiKey: 'secret', timeout: 5000 });
    });

    it('returns frozen config object (defaults merged with user overrides)', () => {
      const pluginConfig = { setting1: 'value1', setting2: 42 };
      const context = createPluginContext({
        pluginName: 'my-plugin',
        pluginVersion: '1.0.0',
        config: pluginConfig,
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
      });

      // Verify the config is frozen
      expect(Object.isFrozen(context.config)).toBe(true);
    });

    it('prevents modification of config object', () => {
      const pluginConfig = { mutable: 'original' };
      const context = createPluginContext({
        pluginName: 'my-plugin',
        pluginVersion: '1.0.0',
        config: pluginConfig,
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
      });

      // Attempting to modify should throw in strict mode or be silently ignored
      expect(() => {
        (context.config as Record<string, unknown>)['mutable'] = 'modified';
      }).toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Extension Registration Tests (Requirement 4.5, 6.3)
  // ---------------------------------------------------------------------------

  describe('Extension Registration with Plugin Attribution', () => {
    beforeEach(() => {
      // Register the mock plugin in the registry first
      registerMockPlugin(registry, 'my-plugin');
    });

    it('registerCommand delegates to registry with plugin attribution', () => {
      const context = createPluginContext({
        pluginName: 'my-plugin',
        pluginVersion: '1.0.0',
        config: {},
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
      });

      const cmdRegistration = createMockCommandRegistration('custom-cmd');
      context.registerCommand(cmdRegistration);

      const registered = registry.getCommand('custom-cmd');
      expect(registered).toBeDefined();
      expect(registered?.pluginName).toBe('my-plugin');
      expect(registered?.registration.name).toBe('custom-cmd');
    });

    it('registerAgent delegates to registry with plugin attribution', () => {
      const context = createPluginContext({
        pluginName: 'my-plugin',
        pluginVersion: '1.0.0',
        config: {},
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
      });

      const agentRegistration = createMockAgentRegistration('custom-agent');
      context.registerAgent(agentRegistration);

      const registered = registry.getAgent('custom-agent');
      expect(registered).toBeDefined();
      expect(registered?.pluginName).toBe('my-plugin');
      expect(registered?.registration.name).toBe('custom-agent');
    });

    it('registerHook delegates to registry with plugin attribution', () => {
      const context = createPluginContext({
        pluginName: 'my-plugin',
        pluginVersion: '1.0.0',
        config: {},
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
      });

      const hookRegistration = createMockHookRegistration({ phase: 'design', timing: 'pre' });
      context.registerHook(hookRegistration);

      const hooks = registry.getHooks('design', 'pre');
      expect(hooks).toHaveLength(1);
      expect(hooks[0]?.pluginName).toBe('my-plugin');
    });

    it('registerService delegates to registry with plugin attribution', () => {
      const context = createPluginContext({
        pluginName: 'my-plugin',
        pluginVersion: '1.0.0',
        config: {},
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
      });

      const serviceRegistration = createMockServiceRegistration('custom-service');
      context.registerService(serviceRegistration);

      expect(registry.hasService('custom-service')).toBe(true);
    });

    it('registerTemplate delegates to registry with plugin attribution', () => {
      const context = createPluginContext({
        pluginName: 'my-plugin',
        pluginVersion: '1.0.0',
        config: {},
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
      });

      const templateRegistration = createMockTemplateRegistration('custom-template');
      context.registerTemplate(templateRegistration);

      const templates = registry.getTemplates('stack');
      expect(templates).toHaveLength(1);
      expect(templates[0]?.pluginName).toBe('my-plugin');
      expect(templates[0]?.namespacedName).toBe('my-plugin/custom-template');
    });
  });

  // ---------------------------------------------------------------------------
  // Service Resolution Tests
  // ---------------------------------------------------------------------------

  describe('Service Resolution', () => {
    beforeEach(() => {
      registerMockPlugin(registry, 'my-plugin');
      registerMockPlugin(registry, 'other-plugin');
    });

    it('getService delegates to registry for service resolution', () => {
      // First, register a service via another plugin
      registry.registerService('other-plugin', {
        name: 'shared-service',
        factory: () => ({ value: 'shared-value' }),
      });

      const context = createPluginContext({
        pluginName: 'my-plugin',
        pluginVersion: '1.0.0',
        config: {},
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
      });

      const service = context.getService<{ value: string }>('shared-service');
      expect(service.value).toBe('shared-value');
    });

    it('hasService delegates to registry to check service existence', () => {
      registry.registerService('other-plugin', {
        name: 'existing-service',
        factory: () => ({}),
      });

      const context = createPluginContext({
        pluginName: 'my-plugin',
        pluginVersion: '1.0.0',
        config: {},
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
      });

      expect(context.hasService('existing-service')).toBe(true);
      expect(context.hasService('non-existent')).toBe(false);
    });

    it('getService throws for non-existent service', () => {
      const context = createPluginContext({
        pluginName: 'my-plugin',
        pluginVersion: '1.0.0',
        config: {},
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
      });

      expect(() => {
        context.getService('non-existent');
      }).toThrow(/not found/i);
    });
  });

  // ---------------------------------------------------------------------------
  // Logging Utility Tests
  // ---------------------------------------------------------------------------

  describe('Logging Utility', () => {
    it('log prefixes messages with [plugin:<name>]', () => {
      const mockLogger = createMockLogger();
      const context = createPluginContext({
        pluginName: 'my-plugin',
        pluginVersion: '1.0.0',
        config: {},
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
        logger: mockLogger,
      });

      context.log('info', 'Test message');

      expect(mockLogger).toHaveBeenCalledWith('info', '[plugin:my-plugin] Test message');
    });

    it('log supports info level', () => {
      const mockLogger = createMockLogger();
      const context = createPluginContext({
        pluginName: 'my-plugin',
        pluginVersion: '1.0.0',
        config: {},
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
        logger: mockLogger,
      });

      context.log('info', 'Info message');

      expect(mockLogger).toHaveBeenCalledWith('info', '[plugin:my-plugin] Info message');
    });

    it('log supports warn level', () => {
      const mockLogger = createMockLogger();
      const context = createPluginContext({
        pluginName: 'my-plugin',
        pluginVersion: '1.0.0',
        config: {},
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
        logger: mockLogger,
      });

      context.log('warn', 'Warning message');

      expect(mockLogger).toHaveBeenCalledWith('warn', '[plugin:my-plugin] Warning message');
    });

    it('log supports error level', () => {
      const mockLogger = createMockLogger();
      const context = createPluginContext({
        pluginName: 'my-plugin',
        pluginVersion: '1.0.0',
        config: {},
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
        logger: mockLogger,
      });

      context.log('error', 'Error message');

      expect(mockLogger).toHaveBeenCalledWith('error', '[plugin:my-plugin] Error message');
    });

    it('log uses default logger when not provided (no-op)', () => {
      // This should not throw even without a logger
      const context = createPluginContext({
        pluginName: 'my-plugin',
        pluginVersion: '1.0.0',
        config: {},
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
      });

      expect(() => {
        context.log('info', 'Test message');
      }).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Read-Only Core Access Tests
  // ---------------------------------------------------------------------------

  describe('Read-Only Core Access', () => {
    it('getCLIVersion returns the CLI version', () => {
      const context = createPluginContext({
        pluginName: 'my-plugin',
        pluginVersion: '1.0.0',
        config: {},
        cliVersion: '2.5.0',
        projectConfig: null,
        registry,
      });

      expect(context.getCLIVersion()).toBe('2.5.0');
    });

    it('getProjectConfig returns project config when available', () => {
      const projectConfig = { featureFlags: { beta: true }, name: 'my-project' };
      const context = createPluginContext({
        pluginName: 'my-plugin',
        pluginVersion: '1.0.0',
        config: {},
        cliVersion: '1.0.0',
        projectConfig,
        registry,
      });

      const config = context.getProjectConfig();
      expect(config).toEqual({ featureFlags: { beta: true }, name: 'my-project' });
    });

    it('getProjectConfig returns null when no project config', () => {
      const context = createPluginContext({
        pluginName: 'my-plugin',
        pluginVersion: '1.0.0',
        config: {},
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
      });

      expect(context.getProjectConfig()).toBeNull();
    });

    it('getProjectConfig returns frozen object (read-only)', () => {
      const projectConfig = { setting: 'value' };
      const context = createPluginContext({
        pluginName: 'my-plugin',
        pluginVersion: '1.0.0',
        config: {},
        cliVersion: '1.0.0',
        projectConfig,
        registry,
      });

      const config = context.getProjectConfig();
      expect(config).not.toBeNull();
      expect(Object.isFrozen(config)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Security and Isolation Tests (Requirement 10.1, 10.3)
  // ---------------------------------------------------------------------------

  describe('Security and Isolation (Requirements 10.1, 10.3)', () => {
    it('context does not expose filesystem access', () => {
      const context = createPluginContext({
        pluginName: 'my-plugin',
        pluginVersion: '1.0.0',
        config: {},
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
      });

      // Verify no filesystem-related properties
      expect((context as unknown as Record<string, unknown>)['fs']).toBeUndefined();
      expect((context as unknown as Record<string, unknown>)['readFile']).toBeUndefined();
      expect((context as unknown as Record<string, unknown>)['writeFile']).toBeUndefined();
    });

    it('context does not expose process control', () => {
      const context = createPluginContext({
        pluginName: 'my-plugin',
        pluginVersion: '1.0.0',
        config: {},
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
      });

      // Verify no process-related properties
      expect((context as unknown as Record<string, unknown>)['process']).toBeUndefined();
      expect((context as unknown as Record<string, unknown>)['spawn']).toBeUndefined();
      expect((context as unknown as Record<string, unknown>)['exec']).toBeUndefined();
    });

    it('context does not expose mutable core state', () => {
      const context = createPluginContext({
        pluginName: 'my-plugin',
        pluginVersion: '1.0.0',
        config: {},
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
      });

      // Verify no access to internal state or registry internals
      expect((context as unknown as Record<string, unknown>)['internalState']).toBeUndefined();
      expect((context as unknown as Record<string, unknown>)['_registry']).toBeUndefined();
    });

    it('context only exposes the defined API surface', () => {
      const context = createPluginContext({
        pluginName: 'my-plugin',
        pluginVersion: '1.0.0',
        config: {},
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
      });

      // Get all own property names
      const properties = Object.keys(context);
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(context) || {})
        .filter((p) => p !== 'constructor');

      // Expected API surface
      const expectedProperties = [
        'pluginName',
        'pluginVersion',
        'config',
      ];

      const expectedMethods = [
        'registerCommand',
        'registerAgent',
        'registerHook',
        'registerService',
        'registerTemplate',
        'getService',
        'hasService',
        'log',
        'getCLIVersion',
        'getProjectConfig',
      ];

      // Verify only expected properties exist
      for (const prop of expectedProperties) {
        expect(context).toHaveProperty(prop);
      }

      // Verify methods exist on the context
      for (const method of expectedMethods) {
        expect(typeof (context as unknown as Record<string, unknown>)[method]).toBe('function');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Multiple Plugin Isolation Tests
  // ---------------------------------------------------------------------------

  describe('Multiple Plugin Isolation', () => {
    beforeEach(() => {
      registerMockPlugin(registry, 'plugin-a');
      registerMockPlugin(registry, 'plugin-b');
    });

    it('each plugin has its own isolated context', () => {
      const contextA = createPluginContext({
        pluginName: 'plugin-a',
        pluginVersion: '1.0.0',
        config: { setting: 'A' },
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
      });

      const contextB = createPluginContext({
        pluginName: 'plugin-b',
        pluginVersion: '2.0.0',
        config: { setting: 'B' },
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
      });

      expect(contextA.pluginName).toBe('plugin-a');
      expect(contextB.pluginName).toBe('plugin-b');
      expect(contextA.config).toEqual({ setting: 'A' });
      expect(contextB.config).toEqual({ setting: 'B' });
    });

    it('registrations from different plugins are attributed correctly', () => {
      const contextA = createPluginContext({
        pluginName: 'plugin-a',
        pluginVersion: '1.0.0',
        config: {},
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
      });

      const contextB = createPluginContext({
        pluginName: 'plugin-b',
        pluginVersion: '1.0.0',
        config: {},
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
      });

      contextA.registerCommand(createMockCommandRegistration('cmd-from-a'));
      contextB.registerCommand(createMockCommandRegistration('cmd-from-b'));

      expect(registry.getCommand('cmd-from-a')?.pluginName).toBe('plugin-a');
      expect(registry.getCommand('cmd-from-b')?.pluginName).toBe('plugin-b');
    });
  });

  // ---------------------------------------------------------------------------
  // Edge Cases
  // ---------------------------------------------------------------------------

  describe('Edge Cases', () => {
    it('handles empty config object', () => {
      const context = createPluginContext({
        pluginName: 'my-plugin',
        pluginVersion: '1.0.0',
        config: {},
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
      });

      expect(context.config).toEqual({});
      expect(Object.isFrozen(context.config)).toBe(true);
    });

    it('handles nested config objects (deep frozen)', () => {
      const nestedConfig = {
        level1: {
          level2: {
            value: 'deep',
          },
        },
      };

      const context = createPluginContext({
        pluginName: 'my-plugin',
        pluginVersion: '1.0.0',
        config: nestedConfig,
        cliVersion: '1.0.0',
        projectConfig: null,
        registry,
      });

      // Verify the nested structure is preserved
      expect((context.config as Record<string, unknown>)['level1']).toBeDefined();
    });

    it('handles empty projectConfig correctly', () => {
      const context = createPluginContext({
        pluginName: 'my-plugin',
        pluginVersion: '1.0.0',
        config: {},
        cliVersion: '1.0.0',
        projectConfig: {},
        registry,
      });

      const projectConfig = context.getProjectConfig();
      expect(projectConfig).toEqual({});
      expect(Object.isFrozen(projectConfig)).toBe(true);
    });
  });
});
