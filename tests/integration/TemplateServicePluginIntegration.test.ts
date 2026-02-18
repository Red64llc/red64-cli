/**
 * Integration tests for plugin templates in TemplateService
 * Task 9.4: Integrate plugin templates into the TemplateService
 * Requirements: 8.1, 8.2, 8.3, 8.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createPluginRegistry,
  createTemplateExtension,
  type PluginRegistryService,
  type TemplateExtensionService,
} from '../../src/plugins/index.js';

describe('TemplateService Plugin Integration', () => {
  let registry: PluginRegistryService;
  let templateExtension: TemplateExtensionService;

  beforeEach(() => {
    registry = createPluginRegistry();
    templateExtension = createTemplateExtension({ registry });
  });

  describe('Task 9.4: Query plugin templates', () => {
    it('should list stack templates from plugins', () => {
      // Register a stack template
      templateExtension.registerTemplate('stack-plugin', {
        category: 'stack',
        name: 'nextjs-tailwind',
        description: 'Next.js with Tailwind CSS',
        sourcePath: '/path/to/template',
      });

      const stackTemplates = templateExtension.getTemplatesByCategory('stack');

      expect(stackTemplates).toHaveLength(1);
      expect(stackTemplates[0]?.namespacedName).toBe('stack-plugin/nextjs-tailwind');
      expect(stackTemplates[0]?.registration.description).toBe('Next.js with Tailwind CSS');
    });

    it('should list spec templates from plugins', () => {
      // Register a spec template with subType
      templateExtension.registerTemplate('spec-plugin', {
        category: 'spec',
        name: 'api-requirements',
        description: 'Template for API requirements',
        sourcePath: '/path/to/requirements',
        subType: 'requirements',
      });

      const specTemplates = templateExtension.getTemplatesByCategory('spec');

      expect(specTemplates).toHaveLength(1);
      expect(specTemplates[0]?.namespacedName).toBe('spec-plugin/api-requirements');
      expect(specTemplates[0]?.registration.subType).toBe('requirements');
    });

    it('should list steering templates from plugins', () => {
      // Register a steering template
      templateExtension.registerTemplate('steering-plugin', {
        category: 'steering',
        name: 'react-guidelines',
        description: 'React development guidelines',
        sourcePath: '/path/to/steering',
      });

      const steeringTemplates = templateExtension.getTemplatesByCategory('steering');

      expect(steeringTemplates).toHaveLength(1);
      expect(steeringTemplates[0]?.namespacedName).toBe('steering-plugin/react-guidelines');
    });
  });

  describe('Task 9.4: Namespaced template resolution', () => {
    it('should resolve plugin template by namespaced name', () => {
      templateExtension.registerTemplate('my-plugin', {
        category: 'stack',
        name: 'my-template',
        description: 'A plugin template',
        sourcePath: '/plugins/my-plugin/templates/my-template',
      });

      const template = templateExtension.getTemplateByName('my-plugin/my-template');

      expect(template).toBeDefined();
      expect(template?.pluginName).toBe('my-plugin');
      expect(template?.registration.sourcePath).toBe('/plugins/my-plugin/templates/my-template');
    });

    it('should return undefined for non-existent template', () => {
      const template = templateExtension.getTemplateByName('nonexistent/template');

      expect(template).toBeUndefined();
    });
  });

  describe('Task 9.4: Template namespace formatting', () => {
    it('should automatically namespace templates as pluginName/templateName', () => {
      templateExtension.registerTemplate('test-plugin', {
        category: 'stack',
        name: 'test-template',
        description: 'Test template',
        sourcePath: '/path/to/template',
      });

      const templates = templateExtension.getAllTemplates();

      expect(templates[0]?.namespacedName).toBe('test-plugin/test-template');
    });

    it('should preserve plugin name for attribution', () => {
      templateExtension.registerTemplate('attribution-plugin', {
        category: 'spec',
        name: 'attributed-template',
        description: 'Attributed template',
        sourcePath: '/path/to/template',
      });

      const templates = templateExtension.getAllTemplates();

      expect(templates[0]?.pluginName).toBe('attribution-plugin');
    });
  });

  describe('Task 9.4: Spec template sub-types', () => {
    it('should filter spec templates by sub-type requirements', () => {
      templateExtension.registerTemplate('plugin-a', {
        category: 'spec',
        name: 'req-template',
        description: 'Requirements template',
        sourcePath: '/path/a',
        subType: 'requirements',
      });

      templateExtension.registerTemplate('plugin-b', {
        category: 'spec',
        name: 'design-template',
        description: 'Design template',
        sourcePath: '/path/b',
        subType: 'design',
      });

      const requirementsTemplates = templateExtension.getSpecTemplatesBySubType('requirements');
      const designTemplates = templateExtension.getSpecTemplatesBySubType('design');

      expect(requirementsTemplates).toHaveLength(1);
      expect(requirementsTemplates[0]?.namespacedName).toBe('plugin-a/req-template');

      expect(designTemplates).toHaveLength(1);
      expect(designTemplates[0]?.namespacedName).toBe('plugin-b/design-template');
    });

    it('should filter spec templates by sub-type tasks', () => {
      templateExtension.registerTemplate('tasks-plugin', {
        category: 'spec',
        name: 'tasks-template',
        description: 'Tasks template',
        sourcePath: '/path/to/tasks',
        subType: 'tasks',
      });

      const tasksTemplates = templateExtension.getSpecTemplatesBySubType('tasks');

      expect(tasksTemplates).toHaveLength(1);
      expect(tasksTemplates[0]?.namespacedName).toBe('tasks-plugin/tasks-template');
    });
  });

  describe('Multiple templates from same plugin', () => {
    it('should register multiple templates from one plugin', () => {
      templateExtension.registerTemplate('multi-plugin', {
        category: 'stack',
        name: 'stack-one',
        description: 'First stack template',
        sourcePath: '/path/1',
      });

      templateExtension.registerTemplate('multi-plugin', {
        category: 'stack',
        name: 'stack-two',
        description: 'Second stack template',
        sourcePath: '/path/2',
      });

      templateExtension.registerTemplate('multi-plugin', {
        category: 'steering',
        name: 'steering-one',
        description: 'Steering template',
        sourcePath: '/path/3',
      });

      const stackTemplates = templateExtension.getTemplatesByCategory('stack');
      const steeringTemplates = templateExtension.getTemplatesByCategory('steering');
      const allTemplates = templateExtension.getAllTemplates();

      expect(stackTemplates).toHaveLength(2);
      expect(steeringTemplates).toHaveLength(1);
      expect(allTemplates).toHaveLength(3);
    });
  });

  describe('Templates from multiple plugins', () => {
    it('should aggregate templates from different plugins', () => {
      templateExtension.registerTemplate('plugin-alpha', {
        category: 'stack',
        name: 'alpha-template',
        description: 'Alpha template',
        sourcePath: '/alpha/path',
      });

      templateExtension.registerTemplate('plugin-beta', {
        category: 'stack',
        name: 'beta-template',
        description: 'Beta template',
        sourcePath: '/beta/path',
      });

      const stackTemplates = templateExtension.getTemplatesByCategory('stack');

      expect(stackTemplates).toHaveLength(2);

      const names = stackTemplates.map(t => t.namespacedName);
      expect(names).toContain('plugin-alpha/alpha-template');
      expect(names).toContain('plugin-beta/beta-template');
    });
  });
});
