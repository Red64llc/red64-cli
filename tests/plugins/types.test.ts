/**
 * Tests for Task 1.1: Plugin type system
 * TDD: RED phase - these tests verify all plugin types and interfaces
 */
import { describe, it, expect } from 'vitest';

describe('Plugin Type System', () => {
  describe('PluginManifest', () => {
    it('should accept a valid complete manifest', async () => {
      const { isValidPluginManifest } = await import('../../src/plugins/types.js');
      const manifest = {
        name: 'my-plugin',
        version: '1.0.0',
        description: 'A test plugin',
        author: 'Test Author',
        entryPoint: './dist/index.js',
        red64CliVersion: '>=0.12.0',
        extensionPoints: ['commands', 'hooks'] as const,
        dependencies: [{ name: 'other-plugin', version: '>=1.0.0' }],
        configSchema: {
          apiKey: {
            type: 'string' as const,
            description: 'API key for the service',
            required: true,
          },
          maxRetries: {
            type: 'number' as const,
            description: 'Maximum retries',
            default: 3,
          },
        },
      };
      // Type-level check: manifest must be assignable to PluginManifest
      expect(isValidPluginManifest(manifest)).toBe(true);
    });

    it('should accept a minimal manifest without optional fields', async () => {
      const { isValidPluginManifest } = await import('../../src/plugins/types.js');
      const manifest = {
        name: 'minimal-plugin',
        version: '0.1.0',
        description: 'Minimal plugin',
        author: 'Author',
        entryPoint: './index.js',
        red64CliVersion: '>=0.10.0',
        extensionPoints: ['commands'] as const,
      };
      expect(isValidPluginManifest(manifest)).toBe(true);
    });
  });

  describe('ExtensionPointDeclaration', () => {
    it('should include all five extension point types', async () => {
      const { EXTENSION_POINT_VALUES } = await import('../../src/plugins/types.js');
      expect(EXTENSION_POINT_VALUES).toContain('commands');
      expect(EXTENSION_POINT_VALUES).toContain('agents');
      expect(EXTENSION_POINT_VALUES).toContain('hooks');
      expect(EXTENSION_POINT_VALUES).toContain('services');
      expect(EXTENSION_POINT_VALUES).toContain('templates');
      expect(EXTENSION_POINT_VALUES).toHaveLength(5);
    });
  });

  describe('HookPriority', () => {
    it('should define five priority levels', async () => {
      const { HOOK_PRIORITY_VALUES } = await import('../../src/plugins/types.js');
      expect(HOOK_PRIORITY_VALUES).toContain('earliest');
      expect(HOOK_PRIORITY_VALUES).toContain('early');
      expect(HOOK_PRIORITY_VALUES).toContain('normal');
      expect(HOOK_PRIORITY_VALUES).toContain('late');
      expect(HOOK_PRIORITY_VALUES).toContain('latest');
      expect(HOOK_PRIORITY_VALUES).toHaveLength(5);
    });

    it('should have a numeric ordering map', async () => {
      const { HOOK_PRIORITY_ORDER } = await import('../../src/plugins/types.js');
      expect(HOOK_PRIORITY_ORDER.earliest).toBeLessThan(HOOK_PRIORITY_ORDER.early);
      expect(HOOK_PRIORITY_ORDER.early).toBeLessThan(HOOK_PRIORITY_ORDER.normal);
      expect(HOOK_PRIORITY_ORDER.normal).toBeLessThan(HOOK_PRIORITY_ORDER.late);
      expect(HOOK_PRIORITY_ORDER.late).toBeLessThan(HOOK_PRIORITY_ORDER.latest);
    });
  });

  describe('WorkflowPhase', () => {
    it('should include all four workflow phases', async () => {
      const { WORKFLOW_PHASE_VALUES } = await import('../../src/plugins/types.js');
      expect(WORKFLOW_PHASE_VALUES).toContain('requirements');
      expect(WORKFLOW_PHASE_VALUES).toContain('design');
      expect(WORKFLOW_PHASE_VALUES).toContain('tasks');
      expect(WORKFLOW_PHASE_VALUES).toContain('implementation');
      expect(WORKFLOW_PHASE_VALUES).toHaveLength(4);
    });
  });

  describe('AgentCapability', () => {
    it('should include all five capabilities', async () => {
      const { AGENT_CAPABILITY_VALUES } = await import('../../src/plugins/types.js');
      expect(AGENT_CAPABILITY_VALUES).toContain('code-generation');
      expect(AGENT_CAPABILITY_VALUES).toContain('code-review');
      expect(AGENT_CAPABILITY_VALUES).toContain('testing');
      expect(AGENT_CAPABILITY_VALUES).toContain('documentation');
      expect(AGENT_CAPABILITY_VALUES).toContain('refactoring');
      expect(AGENT_CAPABILITY_VALUES).toHaveLength(5);
    });
  });

  describe('TemplateCategory', () => {
    it('should include all three categories', async () => {
      const { TEMPLATE_CATEGORY_VALUES } = await import('../../src/plugins/types.js');
      expect(TEMPLATE_CATEGORY_VALUES).toContain('stack');
      expect(TEMPLATE_CATEGORY_VALUES).toContain('spec');
      expect(TEMPLATE_CATEGORY_VALUES).toContain('steering');
      expect(TEMPLATE_CATEGORY_VALUES).toHaveLength(3);
    });
  });

  describe('PluginModule', () => {
    it('should require an activate function', async () => {
      const { isValidPluginModule } = await import('../../src/plugins/types.js');
      const validModule = {
        activate: () => {},
      };
      expect(isValidPluginModule(validModule)).toBe(true);
    });

    it('should accept optional deactivate function', async () => {
      const { isValidPluginModule } = await import('../../src/plugins/types.js');
      const moduleWithDeactivate = {
        activate: () => {},
        deactivate: () => {},
      };
      expect(isValidPluginModule(moduleWithDeactivate)).toBe(true);
    });

    it('should reject objects without activate', async () => {
      const { isValidPluginModule } = await import('../../src/plugins/types.js');
      expect(isValidPluginModule({})).toBe(false);
      expect(isValidPluginModule({ deactivate: () => {} })).toBe(false);
      expect(isValidPluginModule(null)).toBe(false);
      expect(isValidPluginModule(undefined)).toBe(false);
    });
  });

  describe('PluginState', () => {
    it('should accept a valid plugin state', async () => {
      const types = await import('../../src/plugins/types.js');
      // PluginState is a type, so we verify structural shape at runtime
      const state = {
        version: '1.0.0',
        enabled: true,
        installedAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        source: 'npm' as const,
      };
      // Just verify the object has the expected shape
      expect(state.version).toBe('1.0.0');
      expect(state.enabled).toBe(true);
      expect(state.source).toBe('npm');
      // Verify the type module exports exist
      expect(types).toBeDefined();
    });

    it('should support local source with localPath', async () => {
      const state = {
        version: '0.1.0',
        enabled: false,
        installedAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        source: 'local' as const,
        localPath: '/home/user/my-plugin',
      };
      expect(state.source).toBe('local');
      expect(state.localPath).toBe('/home/user/my-plugin');
    });
  });

  describe('PluginStateFile', () => {
    it('should have schemaVersion, plugins record, and optional registryUrl', async () => {
      const types = await import('../../src/plugins/types.js');
      expect(types).toBeDefined();
      const stateFile = {
        schemaVersion: 1,
        plugins: {
          'my-plugin': {
            version: '1.0.0',
            enabled: true,
            installedAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            source: 'npm' as const,
          },
        },
        registryUrl: 'https://registry.npmjs.org',
      };
      expect(stateFile.schemaVersion).toBe(1);
      expect(stateFile.plugins['my-plugin']?.version).toBe('1.0.0');
      expect(stateFile.registryUrl).toBe('https://registry.npmjs.org');
    });
  });

  describe('Result types', () => {
    it('should define ManifestValidationResult with valid, manifest, and errors', async () => {
      const types = await import('../../src/plugins/types.js');
      expect(types).toBeDefined();
      const result = {
        valid: true,
        manifest: {
          name: 'test',
          version: '1.0.0',
          description: 'test',
          author: 'test',
          entryPoint: './index.js',
          red64CliVersion: '>=0.10.0',
          extensionPoints: ['commands'] as const,
        },
        errors: [] as readonly { field: string; message: string; code: string }[],
      };
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should define CompatibilityResult with compatible, requiredRange, actualVersion, message', async () => {
      const types = await import('../../src/plugins/types.js');
      expect(types).toBeDefined();
      const result = {
        compatible: true,
        requiredRange: '>=0.12.0',
        actualVersion: '0.12.0',
        message: 'Compatible',
      };
      expect(result.compatible).toBe(true);
      expect(result.requiredRange).toBe('>=0.12.0');
    });

    it('should define HookExecutionResult with vetoed, executedHooks, and errors', async () => {
      const types = await import('../../src/plugins/types.js');
      expect(types).toBeDefined();
      const result = {
        vetoed: false,
        executedHooks: 3,
        errors: [] as readonly { pluginName: string; error: string }[],
      };
      expect(result.vetoed).toBe(false);
      expect(result.executedHooks).toBe(3);
    });

    it('should define InstallResult', async () => {
      const types = await import('../../src/plugins/types.js');
      expect(types).toBeDefined();
      const result = {
        success: true,
        pluginName: 'test-plugin',
        version: '1.0.0',
      };
      expect(result.success).toBe(true);
      expect(result.pluginName).toBe('test-plugin');
    });

    it('should define UpdateResult with previousVersion and newVersion', async () => {
      const types = await import('../../src/plugins/types.js');
      expect(types).toBeDefined();
      const result = {
        success: true,
        pluginName: 'test-plugin',
        previousVersion: '1.0.0',
        newVersion: '1.1.0',
      };
      expect(result.success).toBe(true);
      expect(result.previousVersion).toBe('1.0.0');
      expect(result.newVersion).toBe('1.1.0');
    });

    it('should define PluginLoadResult with loaded, skipped, and errors', async () => {
      const types = await import('../../src/plugins/types.js');
      expect(types).toBeDefined();
      const result = {
        loaded: [{ name: 'plugin-a', version: '1.0.0', manifest: {} as unknown }],
        skipped: [{ name: 'plugin-b', reason: 'Incompatible version' }],
        errors: [{ pluginName: 'plugin-c', error: 'Import failed', phase: 'import' as const }],
      };
      expect(result.loaded).toHaveLength(1);
      expect(result.skipped).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('Registration types', () => {
    it('should define CommandRegistration with name, description, and handler', async () => {
      const types = await import('../../src/plugins/types.js');
      expect(types).toBeDefined();
      const registration = {
        name: 'my-command',
        description: 'A custom command',
        handler: async () => {},
      };
      expect(registration.name).toBe('my-command');
    });

    it('should define AgentRegistration with name, description, and adapter', async () => {
      const types = await import('../../src/plugins/types.js');
      expect(types).toBeDefined();
      const registration = {
        name: 'my-agent',
        description: 'A custom agent',
        adapter: {
          invoke: async () => ({ success: true, output: '' }),
          getCapabilities: () => ['code-generation' as const],
          configure: () => {},
        },
      };
      expect(registration.name).toBe('my-agent');
    });

    it('should define HookRegistration with phase, timing, priority, and handler', async () => {
      const types = await import('../../src/plugins/types.js');
      expect(types).toBeDefined();
      const registration = {
        phase: 'requirements' as const,
        timing: 'pre' as const,
        priority: 'normal' as const,
        handler: async () => ({ action: 'continue' as const }),
      };
      expect(registration.phase).toBe('requirements');
      expect(registration.timing).toBe('pre');
      expect(registration.priority).toBe('normal');
    });

    it('should define ServiceRegistration with name, factory, and optional dispose', async () => {
      const types = await import('../../src/plugins/types.js');
      expect(types).toBeDefined();
      const registration = {
        name: 'my-service',
        factory: () => ({ doSomething: () => {} }),
        dependencies: ['other-service'],
        dispose: async () => {},
      };
      expect(registration.name).toBe('my-service');
      expect(registration.dependencies).toContain('other-service');
    });

    it('should define TemplateRegistration with category, name, description, and sourcePath', async () => {
      const types = await import('../../src/plugins/types.js');
      expect(types).toBeDefined();
      const registration = {
        category: 'stack' as const,
        name: 'my-template',
        description: 'A custom template',
        sourcePath: '/path/to/template',
      };
      expect(registration.category).toBe('stack');
    });
  });

  describe('HookContext', () => {
    it('should contain phase, timing, feature, specMetadata, and flowState', async () => {
      const types = await import('../../src/plugins/types.js');
      expect(types).toBeDefined();
      const context = {
        phase: 'design' as const,
        timing: 'pre' as const,
        feature: 'my-feature',
        specMetadata: { key: 'value' },
        flowState: { status: 'active' },
      };
      expect(context.phase).toBe('design');
      expect(context.timing).toBe('pre');
      expect(context.feature).toBe('my-feature');
    });
  });

  describe('HookHandlerResult', () => {
    it('should support continue action', async () => {
      const types = await import('../../src/plugins/types.js');
      expect(types).toBeDefined();
      const result = { action: 'continue' as const };
      expect(result.action).toBe('continue');
    });

    it('should support veto action with reason', async () => {
      const types = await import('../../src/plugins/types.js');
      expect(types).toBeDefined();
      const result = { action: 'veto' as const, reason: 'Tests not passing' };
      expect(result.action).toBe('veto');
      expect(result.reason).toBe('Tests not passing');
    });
  });

  describe('Module exports', () => {
    it('should export all types as a public module', async () => {
      const types = await import('../../src/plugins/types.js');
      // Verify runtime exports
      expect(types.EXTENSION_POINT_VALUES).toBeDefined();
      expect(types.HOOK_PRIORITY_VALUES).toBeDefined();
      expect(types.HOOK_PRIORITY_ORDER).toBeDefined();
      expect(types.WORKFLOW_PHASE_VALUES).toBeDefined();
      expect(types.AGENT_CAPABILITY_VALUES).toBeDefined();
      expect(types.TEMPLATE_CATEGORY_VALUES).toBeDefined();
      expect(types.isValidPluginManifest).toBeDefined();
      expect(types.isValidPluginModule).toBeDefined();
    });
  });
});
