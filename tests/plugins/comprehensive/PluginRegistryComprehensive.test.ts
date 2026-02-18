/**
 * Comprehensive PluginRegistry tests - Task 11.1
 * Additional tests for edge cases and comprehensive coverage.
 *
 * Requirements coverage: 4.3, 5.5, 6.4, 6.5, 6.6, 7.4, 7.5, 7.6, 10.1, 10.3
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPluginRegistry, type PluginRegistryService } from '../../../src/plugins/PluginRegistry.js';
import type {
  LoadedPlugin,
  PluginModule,
  PluginManifest,
  CommandRegistration,
  AgentRegistration,
  ServiceRegistration,
  HookRegistration,
  TemplateRegistration,
} from '../../../src/plugins/types.js';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

function createMockManifest(name: string): PluginManifest {
  return {
    name,
    version: '1.0.0',
    description: 'Test plugin',
    author: 'Test',
    entryPoint: './index.js',
    red64CliVersion: '^1.0.0',
    extensionPoints: ['commands', 'agents', 'services', 'hooks', 'templates'],
  };
}

function createMockLoadedPlugin(name: string): LoadedPlugin {
  return {
    name,
    version: '1.0.0',
    manifest: createMockManifest(name),
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

describe('PluginRegistry - Comprehensive Coverage', () => {
  let registry: PluginRegistryService;

  beforeEach(() => {
    registry = createPluginRegistry();
  });

  describe('register/unregister plugins and extensions', () => {
    it('registers a plugin and stores metadata', () => {
      const plugin = createMockLoadedPlugin('my-plugin');
      const module = createMockModule();

      registry.registerPlugin(plugin, module);

      const registered = registry.getPlugin('my-plugin');
      expect(registered).toBeDefined();
      expect(registered?.name).toBe('my-plugin');
      expect(registered?.version).toBe('1.0.0');
      expect(registered?.activatedAt).toBeDefined();
    });

    it('unregisters a plugin and removes all its extensions', async () => {
      const plugin = createMockLoadedPlugin('my-plugin');
      const module = createMockModule();

      registry.registerPlugin(plugin, module);
      registry.registerCommand('my-plugin', {
        name: 'test-cmd',
        description: 'Test command',
        handler: vi.fn(),
      });
      registry.registerAgent('my-plugin', {
        name: 'test-agent',
        description: 'Test agent',
        adapter: { invoke: vi.fn(), getCapabilities: vi.fn() },
      });

      // Verify extensions are registered
      expect(registry.getCommand('test-cmd')).toBeDefined();
      expect(registry.getAgent('test-agent')).toBeDefined();

      // Unregister
      await registry.unregisterPlugin('my-plugin');

      // Verify plugin and extensions are removed
      expect(registry.getPlugin('my-plugin')).toBeUndefined();
      expect(registry.getCommand('test-cmd')).toBeUndefined();
      expect(registry.getAgent('test-agent')).toBeUndefined();
    });

    it('unregisterPlugin is a no-op for non-existent plugin', async () => {
      // Should not throw
      await expect(registry.unregisterPlugin('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('name conflict detection for commands', () => {
    it('throws when registering command that conflicts with core command', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      expect(() => {
        registry.registerCommand('my-plugin', {
          name: 'init',
          description: 'Conflicting init',
          handler: vi.fn(),
        });
      }).toThrow(/conflicts with core command/i);
    });

    it('throws when registering command that conflicts with another plugin', () => {
      registry.registerPlugin(createMockLoadedPlugin('plugin-a'), createMockModule());
      registry.registerPlugin(createMockLoadedPlugin('plugin-b'), createMockModule());

      registry.registerCommand('plugin-a', {
        name: 'shared-cmd',
        description: 'First registration',
        handler: vi.fn(),
      });

      expect(() => {
        registry.registerCommand('plugin-b', {
          name: 'shared-cmd',
          description: 'Conflicting registration',
          handler: vi.fn(),
        });
      }).toThrow(/conflicts with command from plugin/i);
    });
  });

  describe('name conflict detection for agents', () => {
    it('throws when registering agent that conflicts with built-in agent "claude"', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      expect(() => {
        registry.registerAgent('my-plugin', {
          name: 'claude',
          description: 'Conflicting claude',
          adapter: { invoke: vi.fn(), getCapabilities: vi.fn() },
        });
      }).toThrow(/conflicts with core agent/i);
    });

    it('throws when registering agent that conflicts with built-in agent "gemini"', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      expect(() => {
        registry.registerAgent('my-plugin', {
          name: 'gemini',
          description: 'Conflicting gemini',
          adapter: { invoke: vi.fn(), getCapabilities: vi.fn() },
        });
      }).toThrow(/conflicts with core agent/i);
    });

    it('throws when registering agent that conflicts with built-in agent "codex"', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      expect(() => {
        registry.registerAgent('my-plugin', {
          name: 'codex',
          description: 'Conflicting codex',
          adapter: { invoke: vi.fn(), getCapabilities: vi.fn() },
        });
      }).toThrow(/conflicts with core agent/i);
    });

    it('throws when registering agent that conflicts with another plugin', () => {
      registry.registerPlugin(createMockLoadedPlugin('plugin-a'), createMockModule());
      registry.registerPlugin(createMockLoadedPlugin('plugin-b'), createMockModule());

      registry.registerAgent('plugin-a', {
        name: 'shared-agent',
        description: 'First registration',
        adapter: { invoke: vi.fn(), getCapabilities: vi.fn() },
      });

      expect(() => {
        registry.registerAgent('plugin-b', {
          name: 'shared-agent',
          description: 'Conflicting registration',
          adapter: { invoke: vi.fn(), getCapabilities: vi.fn() },
        });
      }).toThrow(/conflicts with agent from plugin/i);
    });
  });

  describe('name conflict detection for services', () => {
    it('throws when registering service that conflicts with another plugin', () => {
      registry.registerPlugin(createMockLoadedPlugin('plugin-a'), createMockModule());
      registry.registerPlugin(createMockLoadedPlugin('plugin-b'), createMockModule());

      registry.registerService('plugin-a', {
        name: 'shared-service',
        factory: () => ({ value: 'a' }),
      });

      expect(() => {
        registry.registerService('plugin-b', {
          name: 'shared-service',
          factory: () => ({ value: 'b' }),
        });
      }).toThrow(/conflicts with service from plugin/i);
    });
  });

  describe('lazy service instantiation', () => {
    it('calls factory only on first resolve', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      const factory = vi.fn().mockReturnValue({ value: 'test' });
      registry.registerService('my-plugin', {
        name: 'lazy-service',
        factory,
      });

      // Factory should not be called yet
      expect(factory).not.toHaveBeenCalled();

      // First resolve
      const service1 = registry.resolveService('lazy-service');
      expect(factory).toHaveBeenCalledTimes(1);
      expect(service1).toEqual({ value: 'test' });

      // Second resolve should not call factory again
      const service2 = registry.resolveService('lazy-service');
      expect(factory).toHaveBeenCalledTimes(1);
      expect(service2).toBe(service1); // Same instance
    });
  });

  describe('service disposal on unregister', () => {
    it('calls dispose function for instantiated services', async () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      const dispose = vi.fn();
      registry.registerService('my-plugin', {
        name: 'disposable-service',
        factory: () => ({ value: 'test' }),
        dispose,
      });

      // Instantiate the service
      registry.resolveService('disposable-service');

      // Unregister the plugin
      await registry.unregisterPlugin('my-plugin');

      // Dispose should have been called
      expect(dispose).toHaveBeenCalledTimes(1);
    });

    it('does not call dispose for services that were never instantiated', async () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      const factory = vi.fn().mockReturnValue({});
      const dispose = vi.fn();
      registry.registerService('my-plugin', {
        name: 'lazy-service',
        factory,
        dispose,
      });

      // Do NOT resolve the service

      // Unregister the plugin
      await registry.unregisterPlugin('my-plugin');

      // Neither factory nor dispose should have been called
      expect(factory).not.toHaveBeenCalled();
      expect(dispose).not.toHaveBeenCalled();
    });

    it('continues disposing other services if one dispose throws', async () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      const dispose1 = vi.fn().mockRejectedValue(new Error('Dispose failed'));
      const dispose2 = vi.fn();

      registry.registerService('my-plugin', {
        name: 'failing-service',
        factory: () => ({}),
        dispose: dispose1,
      });

      registry.registerService('my-plugin', {
        name: 'good-service',
        factory: () => ({}),
        dispose: dispose2,
      });

      // Instantiate both
      registry.resolveService('failing-service');
      registry.resolveService('good-service');

      // Should not throw
      await expect(registry.unregisterPlugin('my-plugin')).resolves.not.toThrow();

      // Both should have been called
      expect(dispose1).toHaveBeenCalled();
      expect(dispose2).toHaveBeenCalled();
    });
  });

  describe('template namespacing', () => {
    it('automatically namespaces templates as pluginName/templateName', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      registry.registerTemplate('my-plugin', {
        category: 'stack',
        name: 'my-template',
        description: 'My template',
        sourcePath: '/path/to/template',
      });

      const templates = registry.getTemplates('stack');
      expect(templates).toHaveLength(1);
      expect(templates[0]?.namespacedName).toBe('my-plugin/my-template');
    });

    it('allows same template name from different plugins', () => {
      registry.registerPlugin(createMockLoadedPlugin('plugin-a'), createMockModule());
      registry.registerPlugin(createMockLoadedPlugin('plugin-b'), createMockModule());

      registry.registerTemplate('plugin-a', {
        category: 'spec',
        name: 'common-template',
        description: 'From plugin A',
        sourcePath: '/path/a',
      });

      registry.registerTemplate('plugin-b', {
        category: 'spec',
        name: 'common-template',
        description: 'From plugin B',
        sourcePath: '/path/b',
      });

      const templates = registry.getTemplates('spec');
      expect(templates).toHaveLength(2);
      expect(templates.map((t) => t.namespacedName)).toContain('plugin-a/common-template');
      expect(templates.map((t) => t.namespacedName)).toContain('plugin-b/common-template');
    });
  });

  describe('service dependency resolution', () => {
    it('resolves dependencies before calling factory', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      registry.registerService('my-plugin', {
        name: 'base-service',
        factory: () => ({ base: 'value' }),
      });

      const dependentFactory = vi.fn().mockImplementation((deps) => ({
        dependent: true,
        fromBase: deps['base-service'],
      }));

      registry.registerService('my-plugin', {
        name: 'dependent-service',
        factory: dependentFactory,
        dependencies: ['base-service'],
      });

      const service = registry.resolveService<{
        dependent: boolean;
        fromBase: { base: string };
      }>('dependent-service');

      expect(dependentFactory).toHaveBeenCalledWith({ 'base-service': { base: 'value' } });
      expect(service.dependent).toBe(true);
      expect(service.fromBase.base).toBe('value');
    });

    it('detects circular dependencies', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      registry.registerService('my-plugin', {
        name: 'service-a',
        factory: () => ({}),
        dependencies: ['service-c'],
      });

      registry.registerService('my-plugin', {
        name: 'service-b',
        factory: () => ({}),
        dependencies: ['service-a'],
      });

      registry.registerService('my-plugin', {
        name: 'service-c',
        factory: () => ({}),
        dependencies: ['service-b'],
      });

      expect(() => {
        registry.resolveService('service-a');
      }).toThrow(/circular.*dependency/i);
    });

    it('throws for missing dependency', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      registry.registerService('my-plugin', {
        name: 'orphan-service',
        factory: () => ({}),
        dependencies: ['nonexistent-service'],
      });

      expect(() => {
        registry.resolveService('orphan-service');
      }).toThrow(/dependency.*not found/i);
    });
  });

  describe('hook management', () => {
    it('removes hooks when plugin is unregistered', async () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      registry.registerHook('my-plugin', {
        phase: 'requirements',
        timing: 'pre',
        priority: 'normal',
        handler: vi.fn(),
      });

      let hooks = registry.getHooks('requirements', 'pre');
      expect(hooks).toHaveLength(1);

      await registry.unregisterPlugin('my-plugin');

      hooks = registry.getHooks('requirements', 'pre');
      expect(hooks).toHaveLength(0);
    });

    it('sorts hooks by priority', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      registry.registerHook('my-plugin', {
        phase: 'design',
        timing: 'pre',
        priority: 'late',
        handler: vi.fn(),
      });

      registry.registerHook('my-plugin', {
        phase: 'design',
        timing: 'pre',
        priority: 'earliest',
        handler: vi.fn(),
      });

      registry.registerHook('my-plugin', {
        phase: 'design',
        timing: 'pre',
        priority: 'normal',
        handler: vi.fn(),
      });

      const hooks = registry.getHooks('design', 'pre');
      const priorities = hooks.map((h) => h.registration.priority);

      expect(priorities).toEqual(['earliest', 'normal', 'late']);
    });

    it('maintains registration order for equal priorities (stable sort)', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      // Register three hooks with the same priority
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      registry.registerHook('my-plugin', {
        phase: 'tasks',
        timing: 'post',
        priority: 'normal',
        handler: handler1,
      });

      registry.registerHook('my-plugin', {
        phase: 'tasks',
        timing: 'post',
        priority: 'normal',
        handler: handler2,
      });

      registry.registerHook('my-plugin', {
        phase: 'tasks',
        timing: 'post',
        priority: 'normal',
        handler: handler3,
      });

      const hooks = registry.getHooks('tasks', 'post');
      expect(hooks).toHaveLength(3);

      // Should maintain registration order
      expect(hooks[0]?.registration.handler).toBe(handler1);
      expect(hooks[1]?.registration.handler).toBe(handler2);
      expect(hooks[2]?.registration.handler).toBe(handler3);
    });

    it('returns wildcard hooks for any phase', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      registry.registerHook('my-plugin', {
        phase: '*',
        timing: 'pre',
        priority: 'normal',
        handler: vi.fn(),
      });

      const reqHooks = registry.getHooks('requirements', 'pre');
      const designHooks = registry.getHooks('design', 'pre');
      const tasksHooks = registry.getHooks('tasks', 'pre');
      const implHooks = registry.getHooks('implementation', 'pre');

      expect(reqHooks).toHaveLength(1);
      expect(designHooks).toHaveLength(1);
      expect(tasksHooks).toHaveLength(1);
      expect(implHooks).toHaveLength(1);
    });
  });

  describe('getAllPlugins and getAllCommands', () => {
    it('returns all registered plugins', () => {
      registry.registerPlugin(createMockLoadedPlugin('plugin-a'), createMockModule());
      registry.registerPlugin(createMockLoadedPlugin('plugin-b'), createMockModule());
      registry.registerPlugin(createMockLoadedPlugin('plugin-c'), createMockModule());

      const plugins = registry.getAllPlugins();
      expect(plugins).toHaveLength(3);
      expect(plugins.map((p) => p.name).sort()).toEqual(['plugin-a', 'plugin-b', 'plugin-c']);
    });

    it('returns all registered commands', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      registry.registerCommand('my-plugin', {
        name: 'cmd-a',
        description: 'Command A',
        handler: vi.fn(),
      });

      registry.registerCommand('my-plugin', {
        name: 'cmd-b',
        description: 'Command B',
        handler: vi.fn(),
      });

      const commands = registry.getAllCommands();
      expect(commands).toHaveLength(2);
      expect(commands.map((c) => c.registration.name).sort()).toEqual(['cmd-a', 'cmd-b']);
    });

    it('returns all registered agents', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      registry.registerAgent('my-plugin', {
        name: 'agent-a',
        description: 'Agent A',
        adapter: { invoke: vi.fn(), getCapabilities: vi.fn() },
      });

      registry.registerAgent('my-plugin', {
        name: 'agent-b',
        description: 'Agent B',
        adapter: { invoke: vi.fn(), getCapabilities: vi.fn() },
      });

      const agents = registry.getAllAgents();
      expect(agents).toHaveLength(2);
    });
  });
});
