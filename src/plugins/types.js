/**
 * Plugin type system for red64-cli
 * Defines all plugin-related TypeScript types and interfaces.
 * Exported as a public module for plugin developers to consume.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.6, 5.2, 5.4, 6.1, 6.3, 6.4, 6.6, 7.1, 8.4, 10.4, 12.2
 */
/** Runtime array of all extension point values for validation */
export const EXTENSION_POINT_VALUES = [
    'commands',
    'agents',
    'hooks',
    'services',
    'templates',
];
/**
 * Runtime type guard for PluginManifest (structural check)
 */
export function isValidPluginManifest(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const obj = value;
    return (typeof obj['name'] === 'string' &&
        typeof obj['version'] === 'string' &&
        typeof obj['description'] === 'string' &&
        typeof obj['author'] === 'string' &&
        typeof obj['entryPoint'] === 'string' &&
        typeof obj['red64CliVersion'] === 'string' &&
        Array.isArray(obj['extensionPoints']));
}
/**
 * Runtime type guard for PluginModule
 */
export function isValidPluginModule(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const obj = value;
    return typeof obj['activate'] === 'function';
}
/** Runtime array of all hook priority values */
export const HOOK_PRIORITY_VALUES = [
    'earliest',
    'early',
    'normal',
    'late',
    'latest',
];
/**
 * Numeric ordering map for deterministic hook priority sorting
 */
export const HOOK_PRIORITY_ORDER = {
    earliest: 0,
    early: 1,
    normal: 2,
    late: 3,
    latest: 4,
};
/** Runtime array of all workflow phase values */
export const WORKFLOW_PHASE_VALUES = [
    'requirements',
    'design',
    'tasks',
    'implementation',
];
/** Runtime array of all agent capability values */
export const AGENT_CAPABILITY_VALUES = [
    'code-generation',
    'code-review',
    'testing',
    'documentation',
    'refactoring',
];
/** Runtime array of all template category values */
export const TEMPLATE_CATEGORY_VALUES = [
    'stack',
    'spec',
    'steering',
];
