/**
 * TemplateExtension - Template extension point for plugin-provided templates.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 *
 * Responsibilities:
 * - Accept template registrations with category (stack, spec, steering), name, description, and source path
 * - Support sub-type field for spec templates (requirements, design, or tasks)
 * - Automatically namespace registered templates as pluginName/templateName
 * - Provide query methods to list available plugin templates by category
 */

import type {
  TemplateRegistration,
  TemplateCategory,
  RegisteredTemplate,
} from '../types.js';
import type { PluginRegistryService } from '../PluginRegistry.js';

// ---------------------------------------------------------------------------
// Service Interface
// ---------------------------------------------------------------------------

export interface TemplateExtensionService {
  /**
   * Register a template from a plugin
   */
  registerTemplate(pluginName: string, registration: TemplateRegistration): void;

  /**
   * Get all templates for a specific category
   */
  getTemplatesByCategory(category: TemplateCategory): readonly RegisteredTemplate[];

  /**
   * Get a template by its namespaced name
   */
  getTemplateByName(namespacedName: string): RegisteredTemplate | undefined;

  /**
   * Get all registered templates
   */
  getAllTemplates(): readonly RegisteredTemplate[];

  /**
   * Get spec templates filtered by sub-type
   */
  getSpecTemplatesBySubType(
    subType: 'requirements' | 'design' | 'tasks'
  ): readonly RegisteredTemplate[];
}

// ---------------------------------------------------------------------------
// Factory Options
// ---------------------------------------------------------------------------

export interface TemplateExtensionOptions {
  readonly registry: PluginRegistryService;
}

// ---------------------------------------------------------------------------
// Factory Function
// ---------------------------------------------------------------------------

/**
 * Creates a TemplateExtension service instance.
 *
 * The TemplateExtension is responsible for:
 * 1. Accepting template registrations from plugins
 * 2. Auto-namespacing templates as pluginName/templateName
 * 3. Query methods for categories and sub-types
 */
export function createTemplateExtension(
  options: TemplateExtensionOptions
): TemplateExtensionService {
  const { registry } = options;

  // Local cache for quick lookup by namespaced name
  const templateByName = new Map<string, RegisteredTemplate>();

  /**
   * Register a template from a plugin.
   * Automatically namespaces as pluginName/templateName.
   */
  function registerTemplate(
    pluginName: string,
    registration: TemplateRegistration
  ): void {
    // Delegate storage to the registry (which handles namespacing)
    registry.registerTemplate(pluginName, registration);

    // Cache for quick lookup
    const namespacedName = `${pluginName}/${registration.name}`;
    templateByName.set(namespacedName, {
      pluginName,
      namespacedName,
      registration,
    });
  }

  /**
   * Get all templates for a specific category.
   */
  function getTemplatesByCategory(
    category: TemplateCategory
  ): readonly RegisteredTemplate[] {
    return registry.getTemplates(category);
  }

  /**
   * Get a template by its namespaced name.
   */
  function getTemplateByName(
    namespacedName: string
  ): RegisteredTemplate | undefined {
    return templateByName.get(namespacedName);
  }

  /**
   * Get all registered templates.
   */
  function getAllTemplates(): readonly RegisteredTemplate[] {
    // Combine all categories
    const stack = registry.getTemplates('stack');
    const spec = registry.getTemplates('spec');
    const steering = registry.getTemplates('steering');

    return [...stack, ...spec, ...steering];
  }

  /**
   * Get spec templates filtered by sub-type.
   */
  function getSpecTemplatesBySubType(
    subType: 'requirements' | 'design' | 'tasks'
  ): readonly RegisteredTemplate[] {
    const specTemplates = registry.getTemplates('spec');
    return specTemplates.filter(
      (template) => template.registration.subType === subType
    );
  }

  return {
    registerTemplate,
    getTemplatesByCategory,
    getTemplateByName,
    getAllTemplates,
    getSpecTemplatesBySubType,
  };
}
