/**
 * ServiceExtension - Service extension point for plugin-provided services.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 *
 * Responsibilities:
 * - Accept service registrations with name, factory, optional dependencies, optional dispose
 * - Delegate storage to the plugin registry; enforce name uniqueness including core service names
 * - Support lazy instantiation: factory is not called until first resolution
 * - On resolution, resolve declared dependencies first, then call factory with resolved dependencies
 * - On plugin disable/uninstall, call dispose function for all instantiated services belonging to that plugin
 */

import type { ServiceRegistration } from '../types.js';
import type { PluginRegistryService } from '../PluginRegistry.js';

// ---------------------------------------------------------------------------
// Service Interface
// ---------------------------------------------------------------------------

export interface ServiceExtensionService {
  /**
   * Register a service from a plugin
   */
  registerService(pluginName: string, registration: ServiceRegistration): void;

  /**
   * Resolve a service by name (lazy instantiation)
   */
  resolveService<T>(serviceName: string): T;

  /**
   * Check if a service is registered
   */
  hasService(serviceName: string): boolean;

  /**
   * Dispose all instantiated services belonging to a plugin
   */
  disposePluginServices(pluginName: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Factory Options
// ---------------------------------------------------------------------------

export interface ServiceExtensionOptions {
  readonly registry: PluginRegistryService;
  readonly coreServiceNames: ReadonlySet<string>;
  readonly logger?: (level: 'info' | 'warn' | 'error', message: string) => void;
}

// ---------------------------------------------------------------------------
// Default Logger
// ---------------------------------------------------------------------------

const defaultLogger = (): void => {
  // No-op when not provided
};

// ---------------------------------------------------------------------------
// Internal tracking for disposal
// ---------------------------------------------------------------------------

interface ServiceTrackingEntry {
  readonly pluginName: string;
  readonly registration: ServiceRegistration;
  instantiated: boolean;
}

// ---------------------------------------------------------------------------
// Factory Function
// ---------------------------------------------------------------------------

/**
 * Creates a ServiceExtension service instance.
 *
 * The ServiceExtension is responsible for:
 * 1. Accepting service registrations from plugins
 * 2. Validating against core service names and cross-plugin conflicts
 * 3. Lazy instantiation via the registry
 * 4. Dependency resolution via the registry
 * 5. Service disposal on plugin disable/uninstall
 */
export function createServiceExtension(
  options: ServiceExtensionOptions
): ServiceExtensionService {
  const { registry, coreServiceNames, logger = defaultLogger } = options;

  // Track services for disposal purposes
  // Maps service name -> tracking entry
  const serviceTracking = new Map<string, ServiceTrackingEntry>();

  /**
   * Register a service from a plugin.
   * Validates against core service names and delegates storage to the registry.
   */
  function registerService(
    pluginName: string,
    registration: ServiceRegistration
  ): void {
    const { name } = registration;

    // Check for conflict with core service names
    if (coreServiceNames.has(name)) {
      const message = `Service "${name}" from plugin "${pluginName}" conflicts with core service. Core services: ${Array.from(coreServiceNames).join(', ')}`;
      logger('warn', message);
      throw new Error(message);
    }

    // Check for conflict with another plugin's service
    if (registry.hasService(name)) {
      // Get the existing service info - we need to find which plugin owns it
      // Since registry doesn't expose plugin name directly, check our tracking
      const existing = serviceTracking.get(name);
      if (existing) {
        const message = `Service "${name}" from plugin "${pluginName}" conflicts with service from plugin "${existing.pluginName}"`;
        logger('warn', message);
        throw new Error(message);
      }
    }

    // Delegate storage to the registry
    registry.registerService(pluginName, registration);

    // Track for disposal
    serviceTracking.set(name, {
      pluginName,
      registration,
      instantiated: false,
    });
  }

  /**
   * Resolve a service by name with lazy instantiation.
   */
  function resolveService<T>(serviceName: string): T {
    const service = registry.resolveService<T>(serviceName);

    // Mark as instantiated for disposal tracking
    const tracking = serviceTracking.get(serviceName);
    if (tracking) {
      tracking.instantiated = true;
    }

    return service;
  }

  /**
   * Check if a service is registered.
   */
  function hasService(serviceName: string): boolean {
    return registry.hasService(serviceName);
  }

  /**
   * Dispose all instantiated services belonging to a plugin.
   */
  async function disposePluginServices(pluginName: string): Promise<void> {
    // Find all services belonging to this plugin that were instantiated
    const servicesToDispose: ServiceTrackingEntry[] = [];

    for (const [, entry] of serviceTracking) {
      if (entry.pluginName === pluginName && entry.instantiated) {
        servicesToDispose.push(entry);
      }
    }

    // Dispose each service
    for (const entry of servicesToDispose) {
      if (entry.registration.dispose) {
        try {
          const result = entry.registration.dispose();
          if (result instanceof Promise) {
            await result;
          }
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : String(err);
          logger(
            'error',
            `[plugin:${pluginName}] Service "${entry.registration.name}" disposal failed: ${errorMessage}`
          );
          // Continue disposing other services
        }
      }
    }

    // Remove from tracking
    for (const [serviceName, entry] of serviceTracking) {
      if (entry.pluginName === pluginName) {
        serviceTracking.delete(serviceName);
      }
    }
  }

  return {
    registerService,
    resolveService,
    hasService,
    disposePluginServices,
  };
}
