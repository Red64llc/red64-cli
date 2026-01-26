/**
 * State persistence service
 * Requirements: 1.5, 1.7, 8.2
 */

import { mkdir, readFile, writeFile, rm, readdir, rename, access } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { FlowState } from '../types/index.js';

/**
 * State store service interface
 * Requirements: 1.5 - Persist and restore flow state through TypeScript file I/O
 */
export interface StateStoreService {
  save(state: FlowState): Promise<void>;
  load(feature: string): Promise<FlowState | undefined>;
  list(): Promise<readonly FlowState[]>;
  delete(feature: string): Promise<void>;
  exists(feature: string): Promise<boolean>;
}

/**
 * Get flows directory path
 * Requirements: 8.2 - Use .red64/ as the unified directory
 */
function getFlowsDir(baseDir: string): string {
  return join(baseDir, '.red64', 'flows');
}

/**
 * Get feature state file path
 */
function getStatePath(baseDir: string, feature: string): string {
  return join(getFlowsDir(baseDir), feature, 'state.json');
}

/**
 * Get feature directory path
 */
function getFeatureDir(baseDir: string, feature: string): string {
  return join(getFlowsDir(baseDir), feature);
}

/**
 * Validate loaded state structure
 * Requirements: 1.7 - Validate state on load
 */
function isValidFlowState(data: unknown): data is FlowState {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  return (
    typeof obj.feature === 'string' &&
    typeof obj.phase === 'object' &&
    obj.phase !== null &&
    typeof (obj.phase as Record<string, unknown>).type === 'string' &&
    typeof obj.createdAt === 'string' &&
    typeof obj.updatedAt === 'string' &&
    Array.isArray(obj.history) &&
    typeof obj.metadata === 'object' &&
    obj.metadata !== null
  );
}

/**
 * Create state store service
 * Requirements: 1.5 - State persistence service factory
 */
export function createStateStore(baseDir: string): StateStoreService {
  return {
    /**
     * Save flow state
     * Requirements: 1.5 - Use atomic write pattern (temp file + rename)
     */
    async save(state: FlowState): Promise<void> {
      const featureDir = getFeatureDir(baseDir, state.feature);
      const statePath = getStatePath(baseDir, state.feature);

      // Ensure directory exists
      await mkdir(featureDir, { recursive: true });

      // Atomic write: write to temp file, then rename
      const tempPath = join(featureDir, `state.${randomBytes(8).toString('hex')}.tmp`);

      try {
        await writeFile(tempPath, JSON.stringify(state, null, 2), 'utf-8');
        await rename(tempPath, statePath);
      } catch (error) {
        // Clean up temp file on error
        try {
          await rm(tempPath, { force: true });
        } catch {
          // Ignore cleanup errors
        }
        throw error;
      }
    },

    /**
     * Load flow state
     * Requirements: 1.5, 1.7 - Read and validate persisted state
     */
    async load(feature: string): Promise<FlowState | undefined> {
      const statePath = getStatePath(baseDir, feature);

      try {
        const content = await readFile(statePath, 'utf-8');
        const data = JSON.parse(content);

        if (!isValidFlowState(data)) {
          // Invalid state file - treat as non-existent
          return undefined;
        }

        return data;
      } catch {
        // File doesn't exist or couldn't be read
        return undefined;
      }
    },

    /**
     * List all flow states
     * Requirements: 1.5 - Flow management operations
     */
    async list(): Promise<readonly FlowState[]> {
      const flowsDir = getFlowsDir(baseDir);

      try {
        const entries = await readdir(flowsDir, { withFileTypes: true });
        const features = entries
          .filter(entry => entry.isDirectory())
          .map(entry => entry.name);

        const states: FlowState[] = [];

        for (const feature of features) {
          const state = await this.load(feature);
          if (state) {
            states.push(state);
          }
        }

        return states;
      } catch {
        // Directory doesn't exist
        return [];
      }
    },

    /**
     * Delete flow state
     * Requirements: 1.5 - Flow cleanup on abort
     */
    async delete(feature: string): Promise<void> {
      const featureDir = getFeatureDir(baseDir, feature);

      try {
        await rm(featureDir, { recursive: true, force: true });
      } catch {
        // Ignore errors - feature may not exist
      }
    },

    /**
     * Check if flow exists
     * Requirements: 1.5 - Quick existence check
     */
    async exists(feature: string): Promise<boolean> {
      const statePath = getStatePath(baseDir, feature);

      try {
        await access(statePath);
        return true;
      } catch {
        return false;
      }
    }
  };
}
