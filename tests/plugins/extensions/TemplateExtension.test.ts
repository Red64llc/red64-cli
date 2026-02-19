/**
 * TemplateExtension tests - Task 5.5
 * Tests for the template extension point.
 *
 * Requirements coverage: 8.1, 8.2, 8.3, 8.4, 8.5
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTemplateExtension } from '../../../src/plugins/extensions/TemplateExtension';
import { createPluginRegistry } from '../../../src/plugins/PluginRegistry';
import type {
  TemplateRegistration,
  TemplateCategory,
  PluginModule,
  LoadedPlugin,
} from '../../../src/plugins/types';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

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
      extensionPoints: ['templates'],
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

describe('TemplateExtension', () => {
  let registry: ReturnType<typeof createPluginRegistry>;
  let templateExtension: ReturnType<typeof createTemplateExtension>;

  beforeEach(() => {
    registry = createPluginRegistry();
    templateExtension = createTemplateExtension({
      registry,
    });
  });

  describe('registerTemplate', () => {
    it('accepts template registrations with category "stack"', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      templateExtension.registerTemplate('my-plugin', createMockTemplateRegistration('react-app', {
        category: 'stack',
        description: 'React application template',
        sourcePath: '/path/to/react-template',
      }));

      const templates = templateExtension.getTemplatesByCategory('stack');
      expect(templates).toHaveLength(1);
      expect(templates[0]?.registration.name).toBe('react-app');
    });

    it('accepts template registrations with category "spec"', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      templateExtension.registerTemplate('my-plugin', createMockTemplateRegistration('custom-spec', {
        category: 'spec',
        description: 'Custom spec template',
        sourcePath: '/path/to/spec-template',
      }));

      const templates = templateExtension.getTemplatesByCategory('spec');
      expect(templates).toHaveLength(1);
      expect(templates[0]?.registration.category).toBe('spec');
    });

    it('accepts template registrations with category "steering"', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      templateExtension.registerTemplate('my-plugin', createMockTemplateRegistration('custom-steering', {
        category: 'steering',
        description: 'Custom steering template',
        sourcePath: '/path/to/steering-template',
      }));

      const templates = templateExtension.getTemplatesByCategory('steering');
      expect(templates).toHaveLength(1);
      expect(templates[0]?.registration.category).toBe('steering');
    });

    it('supports sub-type field for spec templates (requirements)', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      templateExtension.registerTemplate('my-plugin', createMockTemplateRegistration('req-template', {
        category: 'spec',
        subType: 'requirements',
        sourcePath: '/path/to/requirements.md',
      }));

      const templates = templateExtension.getTemplatesByCategory('spec');
      expect(templates[0]?.registration.subType).toBe('requirements');
    });

    it('supports sub-type field for spec templates (design)', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      templateExtension.registerTemplate('my-plugin', createMockTemplateRegistration('design-template', {
        category: 'spec',
        subType: 'design',
        sourcePath: '/path/to/design.md',
      }));

      const templates = templateExtension.getTemplatesByCategory('spec');
      expect(templates[0]?.registration.subType).toBe('design');
    });

    it('supports sub-type field for spec templates (tasks)', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      templateExtension.registerTemplate('my-plugin', createMockTemplateRegistration('tasks-template', {
        category: 'spec',
        subType: 'tasks',
        sourcePath: '/path/to/tasks.md',
      }));

      const templates = templateExtension.getTemplatesByCategory('spec');
      expect(templates[0]?.registration.subType).toBe('tasks');
    });

    it('automatically namespaces registered templates as pluginName/templateName', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      templateExtension.registerTemplate('my-plugin', createMockTemplateRegistration('custom-template'));

      const templates = templateExtension.getTemplatesByCategory('stack');
      expect(templates[0]?.namespacedName).toBe('my-plugin/custom-template');
    });

    it('allows same template name from different plugins (namespaced)', () => {
      registry.registerPlugin(createMockLoadedPlugin('plugin-a'), createMockModule());
      registry.registerPlugin(createMockLoadedPlugin('plugin-b'), createMockModule());

      templateExtension.registerTemplate('plugin-a', createMockTemplateRegistration('common-template'));
      templateExtension.registerTemplate('plugin-b', createMockTemplateRegistration('common-template'));

      const templates = templateExtension.getTemplatesByCategory('stack');
      expect(templates).toHaveLength(2);
      expect(templates.map(t => t.namespacedName)).toContain('plugin-a/common-template');
      expect(templates.map(t => t.namespacedName)).toContain('plugin-b/common-template');
    });

    it('preserves all registration details', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      templateExtension.registerTemplate('my-plugin', {
        category: 'spec',
        name: 'detailed-template',
        description: 'A detailed template description',
        sourcePath: '/custom/path/template.md',
        subType: 'design',
      });

      const templates = templateExtension.getTemplatesByCategory('spec');
      expect(templates[0]?.pluginName).toBe('my-plugin');
      expect(templates[0]?.registration.name).toBe('detailed-template');
      expect(templates[0]?.registration.description).toBe('A detailed template description');
      expect(templates[0]?.registration.sourcePath).toBe('/custom/path/template.md');
      expect(templates[0]?.registration.subType).toBe('design');
    });
  });

  describe('getTemplatesByCategory', () => {
    it('provides query methods to list available plugin templates by category', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      templateExtension.registerTemplate('my-plugin', createMockTemplateRegistration('stack-1', { category: 'stack' }));
      templateExtension.registerTemplate('my-plugin', createMockTemplateRegistration('stack-2', { category: 'stack' }));
      templateExtension.registerTemplate('my-plugin', createMockTemplateRegistration('spec-1', { category: 'spec' }));
      templateExtension.registerTemplate('my-plugin', createMockTemplateRegistration('steering-1', { category: 'steering' }));

      expect(templateExtension.getTemplatesByCategory('stack')).toHaveLength(2);
      expect(templateExtension.getTemplatesByCategory('spec')).toHaveLength(1);
      expect(templateExtension.getTemplatesByCategory('steering')).toHaveLength(1);
    });

    it('returns empty array when no templates for category', () => {
      const templates = templateExtension.getTemplatesByCategory('stack');
      expect(templates).toEqual([]);
    });

    it('filters templates correctly by category', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      const categories: TemplateCategory[] = ['stack', 'spec', 'steering'];
      categories.forEach((category, i) => {
        templateExtension.registerTemplate('my-plugin', createMockTemplateRegistration(`template-${i}`, { category }));
      });

      categories.forEach(category => {
        const templates = templateExtension.getTemplatesByCategory(category);
        expect(templates).toHaveLength(1);
        expect(templates[0]?.registration.category).toBe(category);
      });
    });
  });

  describe('getTemplateByName', () => {
    it('retrieves a template by its namespaced name', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      templateExtension.registerTemplate('my-plugin', createMockTemplateRegistration('my-template'));

      const template = templateExtension.getTemplateByName('my-plugin/my-template');

      expect(template).toBeDefined();
      expect(template?.registration.name).toBe('my-template');
    });

    it('returns undefined for non-existent template', () => {
      const template = templateExtension.getTemplateByName('non-existent/template');

      expect(template).toBeUndefined();
    });
  });

  describe('getAllTemplates', () => {
    it('returns all registered plugin templates', () => {
      registry.registerPlugin(createMockLoadedPlugin('plugin-a'), createMockModule());
      registry.registerPlugin(createMockLoadedPlugin('plugin-b'), createMockModule());

      templateExtension.registerTemplate('plugin-a', createMockTemplateRegistration('template-a', { category: 'stack' }));
      templateExtension.registerTemplate('plugin-b', createMockTemplateRegistration('template-b', { category: 'spec' }));
      templateExtension.registerTemplate('plugin-b', createMockTemplateRegistration('template-c', { category: 'steering' }));

      const allTemplates = templateExtension.getAllTemplates();

      expect(allTemplates).toHaveLength(3);
    });
  });

  describe('getSpecTemplatesBySubType', () => {
    it('filters spec templates by sub-type', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      templateExtension.registerTemplate('my-plugin', createMockTemplateRegistration('req-1', {
        category: 'spec',
        subType: 'requirements',
      }));
      templateExtension.registerTemplate('my-plugin', createMockTemplateRegistration('req-2', {
        category: 'spec',
        subType: 'requirements',
      }));
      templateExtension.registerTemplate('my-plugin', createMockTemplateRegistration('design-1', {
        category: 'spec',
        subType: 'design',
      }));
      templateExtension.registerTemplate('my-plugin', createMockTemplateRegistration('tasks-1', {
        category: 'spec',
        subType: 'tasks',
      }));

      expect(templateExtension.getSpecTemplatesBySubType('requirements')).toHaveLength(2);
      expect(templateExtension.getSpecTemplatesBySubType('design')).toHaveLength(1);
      expect(templateExtension.getSpecTemplatesBySubType('tasks')).toHaveLength(1);
    });
  });
});
