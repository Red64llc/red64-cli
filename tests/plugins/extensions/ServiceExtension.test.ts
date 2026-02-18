/**
 * ServiceExtension tests - Task 5.4
 * Tests for the service extension point.
 *
 * Requirements coverage: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createServiceExtension } from '../../../src/plugins/extensions/ServiceExtension';
import { createPluginRegistry } from '../../../src/plugins/PluginRegistry';
import type {
  ServiceRegistration,
  PluginModule,
  LoadedPlugin,
} from '../../../src/plugins/types';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

function createMockServiceRegistration(
  name: string = 'test-service',
  overrides: Partial<ServiceRegistration> = {}
): ServiceRegistration {
  return {
    name,
    factory: vi.fn().mockReturnValue({ value: 'test' }),
    ...overrides,
  };
}

function createMockLoadedPlugin(name: string = 'test-plugin'): LoadedPlugin {
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
      extensionPoints: ['services'],
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
// Core service names to protect
// ---------------------------------------------------------------------------

const CORE_SERVICE_NAMES = [
  'stateStore',
  'agentInvoker',
  'phaseExecutor',
  'templateService',
  'configService',
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ServiceExtension', () => {
  let registry: ReturnType<typeof createPluginRegistry>;
  let serviceExtension: ReturnType<typeof createServiceExtension>;
  let logMessages: Array<{ level: string; message: string }>;

  beforeEach(() => {
    registry = createPluginRegistry();
    logMessages = [];
    serviceExtension = createServiceExtension({
      registry,
      coreServiceNames: new Set(CORE_SERVICE_NAMES),
      logger: (level, message) => {
        logMessages.push({ level, message });
      },
    });
  });

  describe('registerService', () => {
    it('accepts service registrations with name, factory function', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      const factory = vi.fn().mockReturnValue({ data: 'test' });

      serviceExtension.registerService('my-plugin', {
        name: 'custom-service',
        factory,
      });

      expect(serviceExtension.hasService('custom-service')).toBe(true);
    });

    it('accepts optional dependency list', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      // Register base service
      serviceExtension.registerService('my-plugin', {
        name: 'base-service',
        factory: () => ({ base: true }),
      });

      // Register service with dependency
      serviceExtension.registerService('my-plugin', {
        name: 'dependent-service',
        factory: (deps) => ({ dependent: true, base: deps['base-service'] }),
        dependencies: ['base-service'],
      });

      expect(serviceExtension.hasService('dependent-service')).toBe(true);
    });

    it('accepts optional dispose function', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      const dispose = vi.fn();

      serviceExtension.registerService('my-plugin', {
        name: 'disposable-service',
        factory: () => ({ disposable: true }),
        dispose,
      });

      expect(serviceExtension.hasService('disposable-service')).toBe(true);
    });

    it('enforces name uniqueness including core service names', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      // Try to register a service with a core service name
      expect(() => {
        serviceExtension.registerService('my-plugin', createMockServiceRegistration('stateStore'));
      }).toThrow(/conflicts with core service/i);
    });

    it('rejects all core service names', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      for (const coreName of CORE_SERVICE_NAMES) {
        expect(() => {
          serviceExtension.registerService('my-plugin', createMockServiceRegistration(coreName));
        }).toThrow(/conflicts with core service/i);
      }
    });

    it('rejects service name conflicts with other plugins', () => {
      registry.registerPlugin(createMockLoadedPlugin('plugin-a'), createMockModule());
      registry.registerPlugin(createMockLoadedPlugin('plugin-b'), createMockModule());

      serviceExtension.registerService('plugin-a', createMockServiceRegistration('shared-service'));

      expect(() => {
        serviceExtension.registerService('plugin-b', createMockServiceRegistration('shared-service'));
      }).toThrow(/conflicts with service from plugin/i);
    });
  });

  describe('lazy instantiation', () => {
    it('supports lazy instantiation: factory is not called until first resolution', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      const factory = vi.fn().mockReturnValue({ lazy: true });

      serviceExtension.registerService('my-plugin', {
        name: 'lazy-service',
        factory,
      });

      // Factory should not be called yet
      expect(factory).not.toHaveBeenCalled();

      // Resolve the service
      const service = serviceExtension.resolveService<{ lazy: boolean }>('lazy-service');

      // Now factory should be called
      expect(factory).toHaveBeenCalledTimes(1);
      expect(service.lazy).toBe(true);
    });

    it('caches service instance after first resolution', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      const factory = vi.fn().mockReturnValue({ cached: true });

      serviceExtension.registerService('my-plugin', {
        name: 'cached-service',
        factory,
      });

      const service1 = serviceExtension.resolveService('cached-service');
      const service2 = serviceExtension.resolveService('cached-service');

      expect(factory).toHaveBeenCalledTimes(1);
      expect(service1).toBe(service2);
    });
  });

  describe('dependency resolution', () => {
    it('resolves declared dependencies first, then calls factory with resolved dependencies', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      serviceExtension.registerService('my-plugin', {
        name: 'dep-a',
        factory: () => ({ a: true }),
      });

      const factoryB = vi.fn().mockImplementation((deps) => ({
        b: true,
        fromA: deps['dep-a'],
      }));

      serviceExtension.registerService('my-plugin', {
        name: 'dep-b',
        factory: factoryB,
        dependencies: ['dep-a'],
      });

      const serviceB = serviceExtension.resolveService<{
        b: boolean;
        fromA: { a: boolean };
      }>('dep-b');

      expect(factoryB).toHaveBeenCalledWith({ 'dep-a': { a: true } });
      expect(serviceB.b).toBe(true);
      expect(serviceB.fromA.a).toBe(true);
    });

    it('resolves deep dependency chains', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      // A -> B -> C chain
      serviceExtension.registerService('my-plugin', {
        name: 'service-a',
        factory: () => ({ a: 'value-a' }),
      });

      serviceExtension.registerService('my-plugin', {
        name: 'service-b',
        factory: (deps) => ({ b: 'value-b', a: deps['service-a'] }),
        dependencies: ['service-a'],
      });

      serviceExtension.registerService('my-plugin', {
        name: 'service-c',
        factory: (deps) => ({ c: 'value-c', b: deps['service-b'] }),
        dependencies: ['service-b'],
      });

      const serviceC = serviceExtension.resolveService<{
        c: string;
        b: { b: string; a: { a: string } };
      }>('service-c');

      expect(serviceC.c).toBe('value-c');
      expect(serviceC.b.b).toBe('value-b');
      expect(serviceC.b.a.a).toBe('value-a');
    });

    it('detects circular dependencies', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      // Create circular: A depends on C, B depends on A, C depends on B
      serviceExtension.registerService('my-plugin', {
        name: 'circular-a',
        factory: () => ({}),
        dependencies: ['circular-c'],
      });

      serviceExtension.registerService('my-plugin', {
        name: 'circular-b',
        factory: () => ({}),
        dependencies: ['circular-a'],
      });

      serviceExtension.registerService('my-plugin', {
        name: 'circular-c',
        factory: () => ({}),
        dependencies: ['circular-b'],
      });

      expect(() => {
        serviceExtension.resolveService('circular-a');
      }).toThrow(/circular.*dependency/i);
    });
  });

  describe('service disposal', () => {
    it('calls dispose function on plugin disable/uninstall for instantiated services', async () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      const dispose = vi.fn();

      serviceExtension.registerService('my-plugin', {
        name: 'disposable-service',
        factory: () => ({ value: 42 }),
        dispose,
      });

      // Instantiate the service
      serviceExtension.resolveService('disposable-service');
      expect(dispose).not.toHaveBeenCalled();

      // Dispose services for the plugin
      await serviceExtension.disposePluginServices('my-plugin');

      expect(dispose).toHaveBeenCalledTimes(1);
    });

    it('does not call dispose for services that were never instantiated', async () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      const dispose = vi.fn();
      const factory = vi.fn().mockReturnValue({});

      serviceExtension.registerService('my-plugin', {
        name: 'lazy-disposable',
        factory,
        dispose,
      });

      // Do NOT resolve the service

      // Dispose services for the plugin
      await serviceExtension.disposePluginServices('my-plugin');

      expect(factory).not.toHaveBeenCalled();
      expect(dispose).not.toHaveBeenCalled();
    });

    it('disposes multiple services from the same plugin', async () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      const dispose1 = vi.fn();
      const dispose2 = vi.fn();

      serviceExtension.registerService('my-plugin', {
        name: 'service-1',
        factory: () => ({}),
        dispose: dispose1,
      });

      serviceExtension.registerService('my-plugin', {
        name: 'service-2',
        factory: () => ({}),
        dispose: dispose2,
      });

      // Instantiate both
      serviceExtension.resolveService('service-1');
      serviceExtension.resolveService('service-2');

      await serviceExtension.disposePluginServices('my-plugin');

      expect(dispose1).toHaveBeenCalledTimes(1);
      expect(dispose2).toHaveBeenCalledTimes(1);
    });

    it('continues disposing other services if one dispose throws', async () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      const failingDispose = vi.fn().mockRejectedValue(new Error('Dispose failed'));
      const successDispose = vi.fn();

      serviceExtension.registerService('my-plugin', {
        name: 'failing-service',
        factory: () => ({}),
        dispose: failingDispose,
      });

      serviceExtension.registerService('my-plugin', {
        name: 'success-service',
        factory: () => ({}),
        dispose: successDispose,
      });

      // Instantiate both
      serviceExtension.resolveService('failing-service');
      serviceExtension.resolveService('success-service');

      // Should not throw, should continue disposing
      await serviceExtension.disposePluginServices('my-plugin');

      expect(failingDispose).toHaveBeenCalled();
      expect(successDispose).toHaveBeenCalled();
    });
  });

  describe('hasService', () => {
    it('returns true for registered services', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      serviceExtension.registerService('my-plugin', createMockServiceRegistration('my-service'));

      expect(serviceExtension.hasService('my-service')).toBe(true);
    });

    it('returns false for non-existent services', () => {
      expect(serviceExtension.hasService('non-existent')).toBe(false);
    });
  });

  describe('resolveService errors', () => {
    it('throws error for non-existent service', () => {
      expect(() => {
        serviceExtension.resolveService('non-existent');
      }).toThrow(/not found/i);
    });

    it('throws error for missing dependency', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      serviceExtension.registerService('my-plugin', {
        name: 'orphan-service',
        factory: () => ({}),
        dependencies: ['missing-dep'],
      });

      expect(() => {
        serviceExtension.resolveService('orphan-service');
      }).toThrow(/dependency.*not found/i);
    });
  });
});
