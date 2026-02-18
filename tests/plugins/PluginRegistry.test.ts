/**
 * PluginRegistry tests - Task 2.1
 * Tests for the central plugin registry (in-memory extension store).
 *
 * Requirements coverage: 4.3, 5.1, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.4
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPluginRegistry } from '../../src/plugins/PluginRegistry';
import type {
  PluginManifest,
  PluginModule,
  LoadedPlugin,
  CommandRegistration,
  AgentRegistration,
  HookRegistration,
  ServiceRegistration,
  TemplateRegistration,
  WorkflowPhase,
  HookPriority,
  AgentCapability,
} from '../../src/plugins/types';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

function createMockManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    name: 'test-plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'Test Author',
    entryPoint: './index.js',
    red64CliVersion: '^1.0.0',
    extensionPoints: [],
    ...overrides,
  };
}

function createMockModule(overrides: Partial<PluginModule> = {}): PluginModule {
  return {
    activate: vi.fn(),
    deactivate: vi.fn(),
    ...overrides,
  };
}

function createMockLoadedPlugin(
  name: string = 'test-plugin',
  overrides: Partial<LoadedPlugin> = {}
): LoadedPlugin {
  return {
    name,
    version: '1.0.0',
    manifest: createMockManifest({ name }),
    ...overrides,
  };
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

// ---------------------------------------------------------------------------
// Plugin Management Tests
// ---------------------------------------------------------------------------

describe('PluginRegistry', () => {
  describe('Plugin Management', () => {
    it('registers a plugin successfully', () => {
      const registry = createPluginRegistry();
      const plugin = createMockLoadedPlugin('my-plugin');
      const module = createMockModule();

      registry.registerPlugin(plugin, module);

      const registered = registry.getPlugin('my-plugin');
      expect(registered).toBeDefined();
      expect(registered?.name).toBe('my-plugin');
      expect(registered?.version).toBe('1.0.0');
      expect(registered?.module).toBe(module);
      expect(registered?.activatedAt).toBeDefined();
    });

    it('returns undefined for non-existent plugin', () => {
      const registry = createPluginRegistry();

      const plugin = registry.getPlugin('non-existent');

      expect(plugin).toBeUndefined();
    });

    it('returns all registered plugins', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('plugin-a'), createMockModule());
      registry.registerPlugin(createMockLoadedPlugin('plugin-b'), createMockModule());
      registry.registerPlugin(createMockLoadedPlugin('plugin-c'), createMockModule());

      const plugins = registry.getAllPlugins();

      expect(plugins).toHaveLength(3);
      expect(plugins.map((p) => p.name)).toEqual(['plugin-a', 'plugin-b', 'plugin-c']);
    });

    it('unregisters a plugin and removes all its extensions', async () => {
      const registry = createPluginRegistry();
      const plugin = createMockLoadedPlugin('my-plugin');
      registry.registerPlugin(plugin, createMockModule());
      registry.registerCommand('my-plugin', createMockCommandRegistration('my-cmd'));

      await registry.unregisterPlugin('my-plugin');

      expect(registry.getPlugin('my-plugin')).toBeUndefined();
      expect(registry.getCommand('my-cmd')).toBeUndefined();
    });

    it('calls dispose on instantiated services when unregistering', async () => {
      const registry = createPluginRegistry();
      const disposeFn = vi.fn();
      const factory = vi.fn().mockReturnValue({ value: 42 });

      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      registry.registerService('my-plugin', {
        name: 'disposable-service',
        factory,
        dispose: disposeFn,
      });

      // Resolve service to instantiate it
      registry.resolveService('disposable-service');
      expect(factory).toHaveBeenCalledTimes(1);

      // Unregister plugin
      await registry.unregisterPlugin('my-plugin');

      expect(disposeFn).toHaveBeenCalledTimes(1);
    });

    it('does not call dispose if service was never instantiated', async () => {
      const registry = createPluginRegistry();
      const disposeFn = vi.fn();
      const factory = vi.fn().mockReturnValue({ value: 42 });

      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      registry.registerService('my-plugin', {
        name: 'lazy-service',
        factory,
        dispose: disposeFn,
      });

      // Unregister without resolving
      await registry.unregisterPlugin('my-plugin');

      expect(factory).not.toHaveBeenCalled();
      expect(disposeFn).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Command Extension Tests
  // ---------------------------------------------------------------------------

  describe('Command Extensions', () => {
    it('registers a command successfully', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      registry.registerCommand('my-plugin', createMockCommandRegistration('my-cmd'));

      const command = registry.getCommand('my-cmd');
      expect(command).toBeDefined();
      expect(command?.pluginName).toBe('my-plugin');
      expect(command?.registration.name).toBe('my-cmd');
    });

    it('returns all registered commands', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('plugin-a'), createMockModule());
      registry.registerPlugin(createMockLoadedPlugin('plugin-b'), createMockModule());
      registry.registerCommand('plugin-a', createMockCommandRegistration('cmd-a'));
      registry.registerCommand('plugin-b', createMockCommandRegistration('cmd-b'));

      const commands = registry.getAllCommands();

      expect(commands).toHaveLength(2);
    });

    it('rejects command name conflicting with core command "init"', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      expect(() => {
        registry.registerCommand('my-plugin', createMockCommandRegistration('init'));
      }).toThrow(/conflicts with core command/i);
    });

    it('rejects command name conflicting with core command "start"', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      expect(() => {
        registry.registerCommand('my-plugin', createMockCommandRegistration('start'));
      }).toThrow(/conflicts with core command/i);
    });

    it('rejects command name conflicting with core command "status"', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      expect(() => {
        registry.registerCommand('my-plugin', createMockCommandRegistration('status'));
      }).toThrow(/conflicts with core command/i);
    });

    it('rejects command name conflicting with core command "list"', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      expect(() => {
        registry.registerCommand('my-plugin', createMockCommandRegistration('list'));
      }).toThrow(/conflicts with core command/i);
    });

    it('rejects command name conflicting with core command "abort"', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      expect(() => {
        registry.registerCommand('my-plugin', createMockCommandRegistration('abort'));
      }).toThrow(/conflicts with core command/i);
    });

    it('rejects command name conflicting with core command "mcp"', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      expect(() => {
        registry.registerCommand('my-plugin', createMockCommandRegistration('mcp'));
      }).toThrow(/conflicts with core command/i);
    });

    it('rejects command name conflicting with core command "help"', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      expect(() => {
        registry.registerCommand('my-plugin', createMockCommandRegistration('help'));
      }).toThrow(/conflicts with core command/i);
    });

    it('rejects command name conflicting with core command "plugin"', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      expect(() => {
        registry.registerCommand('my-plugin', createMockCommandRegistration('plugin'));
      }).toThrow(/conflicts with core command/i);
    });

    it('rejects command name conflicting with another plugin command', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('plugin-a'), createMockModule());
      registry.registerPlugin(createMockLoadedPlugin('plugin-b'), createMockModule());
      registry.registerCommand('plugin-a', createMockCommandRegistration('shared-cmd'));

      expect(() => {
        registry.registerCommand('plugin-b', createMockCommandRegistration('shared-cmd'));
      }).toThrow(/conflicts with command from plugin/i);
    });
  });

  // ---------------------------------------------------------------------------
  // Agent Extension Tests
  // ---------------------------------------------------------------------------

  describe('Agent Extensions', () => {
    it('registers an agent successfully', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      registry.registerAgent('my-plugin', createMockAgentRegistration('my-agent'));

      const agent = registry.getAgent('my-agent');
      expect(agent).toBeDefined();
      expect(agent?.pluginName).toBe('my-plugin');
      expect(agent?.registration.name).toBe('my-agent');
    });

    it('returns all registered agents', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('plugin-a'), createMockModule());
      registry.registerPlugin(createMockLoadedPlugin('plugin-b'), createMockModule());
      registry.registerAgent('plugin-a', createMockAgentRegistration('agent-a'));
      registry.registerAgent('plugin-b', createMockAgentRegistration('agent-b'));

      const agents = registry.getAllAgents();

      expect(agents).toHaveLength(2);
    });

    it('rejects agent name conflicting with core agent "claude"', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      expect(() => {
        registry.registerAgent('my-plugin', createMockAgentRegistration('claude'));
      }).toThrow(/conflicts with core agent/i);
    });

    it('rejects agent name conflicting with core agent "gemini"', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      expect(() => {
        registry.registerAgent('my-plugin', createMockAgentRegistration('gemini'));
      }).toThrow(/conflicts with core agent/i);
    });

    it('rejects agent name conflicting with core agent "codex"', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      expect(() => {
        registry.registerAgent('my-plugin', createMockAgentRegistration('codex'));
      }).toThrow(/conflicts with core agent/i);
    });

    it('rejects agent name conflicting with another plugin agent', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('plugin-a'), createMockModule());
      registry.registerPlugin(createMockLoadedPlugin('plugin-b'), createMockModule());
      registry.registerAgent('plugin-a', createMockAgentRegistration('shared-agent'));

      expect(() => {
        registry.registerAgent('plugin-b', createMockAgentRegistration('shared-agent'));
      }).toThrow(/conflicts with agent from plugin/i);
    });
  });

  // ---------------------------------------------------------------------------
  // Hook Extension Tests
  // ---------------------------------------------------------------------------

  describe('Hook Extensions', () => {
    it('registers a hook successfully', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      registry.registerHook(
        'my-plugin',
        createMockHookRegistration({ phase: 'design', timing: 'post' })
      );

      const hooks = registry.getHooks('design', 'post');
      expect(hooks).toHaveLength(1);
      expect(hooks[0]?.pluginName).toBe('my-plugin');
    });

    it('returns hooks filtered by phase and timing', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      registry.registerHook('my-plugin', createMockHookRegistration({ phase: 'requirements', timing: 'pre' }));
      registry.registerHook('my-plugin', createMockHookRegistration({ phase: 'requirements', timing: 'post' }));
      registry.registerHook('my-plugin', createMockHookRegistration({ phase: 'design', timing: 'pre' }));

      const preReqHooks = registry.getHooks('requirements', 'pre');
      const postReqHooks = registry.getHooks('requirements', 'post');
      const preDesignHooks = registry.getHooks('design', 'pre');

      expect(preReqHooks).toHaveLength(1);
      expect(postReqHooks).toHaveLength(1);
      expect(preDesignHooks).toHaveLength(1);
    });

    it('returns wildcard hooks for any phase', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      registry.registerHook('my-plugin', createMockHookRegistration({ phase: '*', timing: 'pre' }));

      const reqHooks = registry.getHooks('requirements', 'pre');
      const designHooks = registry.getHooks('design', 'pre');
      const tasksHooks = registry.getHooks('tasks', 'pre');
      const implHooks = registry.getHooks('implementation', 'pre');

      expect(reqHooks).toHaveLength(1);
      expect(designHooks).toHaveLength(1);
      expect(tasksHooks).toHaveLength(1);
      expect(implHooks).toHaveLength(1);
    });

    it('returns hooks sorted by priority (earliest to latest)', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      const priorities: HookPriority[] = ['latest', 'early', 'normal', 'earliest', 'late'];
      priorities.forEach((priority) => {
        registry.registerHook('my-plugin', createMockHookRegistration({ phase: 'requirements', timing: 'pre', priority }));
      });

      const hooks = registry.getHooks('requirements', 'pre');

      expect(hooks).toHaveLength(5);
      expect(hooks.map((h) => h.registration.priority)).toEqual([
        'earliest',
        'early',
        'normal',
        'late',
        'latest',
      ]);
    });

    it('maintains registration order for hooks with same priority (stable sort)', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      // Register 3 hooks with the same priority
      const handler1 = vi.fn().mockResolvedValue({ action: 'continue' });
      const handler2 = vi.fn().mockResolvedValue({ action: 'continue' });
      const handler3 = vi.fn().mockResolvedValue({ action: 'continue' });

      registry.registerHook('my-plugin', { phase: 'requirements', timing: 'pre', priority: 'normal', handler: handler1 });
      registry.registerHook('my-plugin', { phase: 'requirements', timing: 'pre', priority: 'normal', handler: handler2 });
      registry.registerHook('my-plugin', { phase: 'requirements', timing: 'pre', priority: 'normal', handler: handler3 });

      const hooks = registry.getHooks('requirements', 'pre');

      expect(hooks[0]?.registration.handler).toBe(handler1);
      expect(hooks[1]?.registration.handler).toBe(handler2);
      expect(hooks[2]?.registration.handler).toBe(handler3);
    });

    it('supports querying all hooks with wildcard phase', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      registry.registerHook('my-plugin', createMockHookRegistration({ phase: 'requirements', timing: 'pre' }));
      registry.registerHook('my-plugin', createMockHookRegistration({ phase: 'design', timing: 'pre' }));
      registry.registerHook('my-plugin', createMockHookRegistration({ phase: '*', timing: 'pre' }));

      const allPreHooks = registry.getHooks('*', 'pre');

      expect(allPreHooks).toHaveLength(3);
    });
  });

  // ---------------------------------------------------------------------------
  // Service Extension Tests
  // ---------------------------------------------------------------------------

  describe('Service Extensions', () => {
    it('registers a service successfully', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      registry.registerService('my-plugin', createMockServiceRegistration('my-service'));

      expect(registry.hasService('my-service')).toBe(true);
    });

    it('supports lazy service instantiation (factory called only on first resolve)', () => {
      const registry = createPluginRegistry();
      const factory = vi.fn().mockReturnValue({ value: 42 });
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      registry.registerService('my-plugin', { name: 'lazy-service', factory });

      // Factory not called on registration
      expect(factory).not.toHaveBeenCalled();

      // Factory called on first resolve
      const service1 = registry.resolveService<{ value: number }>('lazy-service');
      expect(factory).toHaveBeenCalledTimes(1);
      expect(service1.value).toBe(42);

      // Factory NOT called on subsequent resolves (cached)
      const service2 = registry.resolveService<{ value: number }>('lazy-service');
      expect(factory).toHaveBeenCalledTimes(1);
      expect(service2).toBe(service1);
    });

    it('resolves service dependencies before calling factory', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      // Register base service
      registry.registerService('my-plugin', {
        name: 'base-service',
        factory: () => ({ baseValue: 'base' }),
      });

      // Register service with dependency
      const dependentFactory = vi.fn().mockImplementation((deps) => ({
        dependentValue: 'dependent',
        base: deps['base-service'],
      }));
      registry.registerService('my-plugin', {
        name: 'dependent-service',
        factory: dependentFactory,
        dependencies: ['base-service'],
      });

      const service = registry.resolveService<{
        dependentValue: string;
        base: { baseValue: string };
      }>('dependent-service');

      expect(dependentFactory).toHaveBeenCalledWith({ 'base-service': { baseValue: 'base' } });
      expect(service.dependentValue).toBe('dependent');
      expect(service.base.baseValue).toBe('base');
    });

    it('resolves deep service dependency chains', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      // Service A (no deps)
      registry.registerService('my-plugin', {
        name: 'service-a',
        factory: () => ({ a: true }),
      });

      // Service B depends on A
      registry.registerService('my-plugin', {
        name: 'service-b',
        factory: (deps) => ({ b: true, a: deps['service-a'] }),
        dependencies: ['service-a'],
      });

      // Service C depends on B
      registry.registerService('my-plugin', {
        name: 'service-c',
        factory: (deps) => ({ c: true, b: deps['service-b'] }),
        dependencies: ['service-b'],
      });

      const serviceC = registry.resolveService<{
        c: boolean;
        b: { b: boolean; a: { a: boolean } };
      }>('service-c');

      expect(serviceC.c).toBe(true);
      expect(serviceC.b.b).toBe(true);
      expect(serviceC.b.a.a).toBe(true);
    });

    it('detects circular service dependencies and throws descriptive error', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      // Create circular dependency: A -> B -> C -> A
      registry.registerService('my-plugin', {
        name: 'service-a',
        factory: () => ({ a: true }),
        dependencies: ['service-c'],
      });
      registry.registerService('my-plugin', {
        name: 'service-b',
        factory: () => ({ b: true }),
        dependencies: ['service-a'],
      });
      registry.registerService('my-plugin', {
        name: 'service-c',
        factory: () => ({ c: true }),
        dependencies: ['service-b'],
      });

      expect(() => {
        registry.resolveService('service-a');
      }).toThrow(/circular.*dependency/i);
    });

    it('detects self-referential service dependency', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      registry.registerService('my-plugin', {
        name: 'self-ref',
        factory: () => ({ self: true }),
        dependencies: ['self-ref'],
      });

      expect(() => {
        registry.resolveService('self-ref');
      }).toThrow(/circular.*dependency/i);
    });

    it('throws error when resolving non-existent service', () => {
      const registry = createPluginRegistry();

      expect(() => {
        registry.resolveService('non-existent');
      }).toThrow(/service.*not found/i);
    });

    it('throws error when dependency service does not exist', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      registry.registerService('my-plugin', {
        name: 'orphan-service',
        factory: () => ({}),
        dependencies: ['missing-dep'],
      });

      expect(() => {
        registry.resolveService('orphan-service');
      }).toThrow(/dependency.*not found/i);
    });

    it('rejects service name conflicting with another plugin service', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('plugin-a'), createMockModule());
      registry.registerPlugin(createMockLoadedPlugin('plugin-b'), createMockModule());
      registry.registerService('plugin-a', createMockServiceRegistration('shared-service'));

      expect(() => {
        registry.registerService('plugin-b', createMockServiceRegistration('shared-service'));
      }).toThrow(/conflicts with service from plugin/i);
    });

    it('hasService returns false for non-existent service', () => {
      const registry = createPluginRegistry();

      expect(registry.hasService('non-existent')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Template Extension Tests
  // ---------------------------------------------------------------------------

  describe('Template Extensions', () => {
    it('registers a template with automatic namespacing', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      registry.registerTemplate('my-plugin', createMockTemplateRegistration('my-template'));

      const templates = registry.getTemplates('stack');
      expect(templates).toHaveLength(1);
      expect(templates[0]?.namespacedName).toBe('my-plugin/my-template');
    });

    it('returns templates filtered by category', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      registry.registerTemplate('my-plugin', createMockTemplateRegistration('stack-tpl', { category: 'stack' }));
      registry.registerTemplate('my-plugin', createMockTemplateRegistration('spec-tpl', { category: 'spec' }));
      registry.registerTemplate('my-plugin', createMockTemplateRegistration('steering-tpl', { category: 'steering' }));

      expect(registry.getTemplates('stack')).toHaveLength(1);
      expect(registry.getTemplates('spec')).toHaveLength(1);
      expect(registry.getTemplates('steering')).toHaveLength(1);
    });

    it('allows same template name from different plugins (namespaced)', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('plugin-a'), createMockModule());
      registry.registerPlugin(createMockLoadedPlugin('plugin-b'), createMockModule());

      registry.registerTemplate('plugin-a', createMockTemplateRegistration('common'));
      registry.registerTemplate('plugin-b', createMockTemplateRegistration('common'));

      const templates = registry.getTemplates('stack');
      expect(templates).toHaveLength(2);
      expect(templates.map((t) => t.namespacedName)).toContain('plugin-a/common');
      expect(templates.map((t) => t.namespacedName)).toContain('plugin-b/common');
    });

    it('preserves registration details including sourcePath and subType', () => {
      const registry = createPluginRegistry();
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      registry.registerTemplate('my-plugin', {
        category: 'spec',
        name: 'custom-req',
        description: 'Custom requirements template',
        sourcePath: '/path/to/custom/requirements.md',
        subType: 'requirements',
      });

      const templates = registry.getTemplates('spec');
      expect(templates[0]?.registration.sourcePath).toBe('/path/to/custom/requirements.md');
      expect(templates[0]?.registration.subType).toBe('requirements');
    });
  });

  // ---------------------------------------------------------------------------
  // Edge Cases and Error Handling
  // ---------------------------------------------------------------------------

  describe('Edge Cases', () => {
    it('handles async dispose functions during unregister', async () => {
      const registry = createPluginRegistry();
      const asyncDispose = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      registry.registerService('my-plugin', {
        name: 'async-service',
        factory: () => ({ async: true }),
        dispose: asyncDispose,
      });

      // Instantiate
      registry.resolveService('async-service');

      // Unregister should await async dispose
      await registry.unregisterPlugin('my-plugin');

      expect(asyncDispose).toHaveBeenCalledTimes(1);
    });

    it('continues disposing other services if one dispose throws', async () => {
      const registry = createPluginRegistry();
      const failingDispose = vi.fn().mockRejectedValue(new Error('Dispose failed'));
      const successfulDispose = vi.fn();

      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      registry.registerService('my-plugin', {
        name: 'failing-service',
        factory: () => ({ failing: true }),
        dispose: failingDispose,
      });
      registry.registerService('my-plugin', {
        name: 'success-service',
        factory: () => ({ success: true }),
        dispose: successfulDispose,
      });

      // Instantiate both
      registry.resolveService('failing-service');
      registry.resolveService('success-service');

      // Unregister - should not throw even if one dispose fails
      await registry.unregisterPlugin('my-plugin');

      expect(failingDispose).toHaveBeenCalledTimes(1);
      expect(successfulDispose).toHaveBeenCalledTimes(1);
    });

    it('removing non-existent plugin is a no-op', async () => {
      const registry = createPluginRegistry();

      await expect(registry.unregisterPlugin('non-existent')).resolves.not.toThrow();
    });

    it('getAllPlugins returns empty array when no plugins registered', () => {
      const registry = createPluginRegistry();

      expect(registry.getAllPlugins()).toEqual([]);
    });

    it('getAllCommands returns empty array when no commands registered', () => {
      const registry = createPluginRegistry();

      expect(registry.getAllCommands()).toEqual([]);
    });

    it('getAllAgents returns empty array when no agents registered', () => {
      const registry = createPluginRegistry();

      expect(registry.getAllAgents()).toEqual([]);
    });

    it('getHooks returns empty array when no hooks match', () => {
      const registry = createPluginRegistry();

      expect(registry.getHooks('requirements', 'pre')).toEqual([]);
    });

    it('getTemplates returns empty array when no templates match category', () => {
      const registry = createPluginRegistry();

      expect(registry.getTemplates('stack')).toEqual([]);
    });
  });
});
