/**
 * Path utilities for red64
 * Requirements: 8.2 - Use .red64/ as the unified directory
 */

import { join } from 'node:path';

/**
 * Get the red64 directory path
 * Requirements: 8.2 - Use .red64/ directory structure
 */
export function getRed64Dir(baseDir: string): string {
  return join(baseDir, '.red64');
}

/**
 * Get the flows directory path
 */
export function getFlowsDir(baseDir: string): string {
  return join(getRed64Dir(baseDir), 'flows');
}

/**
 * Get the specs directory path
 */
export function getSpecsDir(baseDir: string): string {
  return join(getRed64Dir(baseDir), 'specs');
}

/**
 * Get the steering directory path
 */
export function getSteeringDir(baseDir: string): string {
  return join(getRed64Dir(baseDir), 'steering');
}

/**
 * Get feature flow directory path
 */
export function getFeatureDir(baseDir: string, feature: string): string {
  return join(getFlowsDir(baseDir), feature);
}

/**
 * Get feature state file path
 */
export function getStatePath(baseDir: string, feature: string): string {
  return join(getFeatureDir(baseDir, feature), 'state.json');
}
