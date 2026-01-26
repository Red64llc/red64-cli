/**
 * Config service for init configuration management
 * Requirements: 2.7
 */

import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Project type options
 */
export type ProjectType = 'web-app' | 'cli-tool' | 'library' | 'api' | 'other';

/**
 * Init configuration structure
 * Task 4.1: Configuration read/write operations
 */
export interface InitConfig {
  readonly version: string;
  readonly repo: string;
  readonly stack: string;
  readonly projectType: ProjectType;
  readonly projectName: string;
  readonly description: string;
  readonly initializedAt: string;
  readonly customValues: Record<string, string>;
}

/**
 * Config service interface
 * Requirements: 2.7
 */
export interface ConfigService {
  /**
   * Load config from .red64/config.json
   * @returns null if file does not exist
   */
  load(baseDir: string): Promise<InitConfig | null>;

  /**
   * Save config to .red64/config.json
   */
  save(baseDir: string, config: InitConfig): Promise<void>;

  /**
   * Check if project is initialized
   */
  isInitialized(baseDir: string): Promise<boolean>;
}

/**
 * Get config file path
 */
function getConfigPath(baseDir: string): string {
  return join(baseDir, '.red64', 'config.json');
}

/**
 * Check if file exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create config service
 * Task 4.1: Config service factory
 */
export function createConfigService(): ConfigService {
  return {
    async load(baseDir: string): Promise<InitConfig | null> {
      const configPath = getConfigPath(baseDir);

      try {
        const content = await readFile(configPath, 'utf-8');
        const config = JSON.parse(content) as InitConfig;
        return config;
      } catch {
        return null;
      }
    },

    async save(baseDir: string, config: InitConfig): Promise<void> {
      const configPath = getConfigPath(baseDir);
      const red64Dir = join(baseDir, '.red64');

      // Ensure .red64 directory exists
      await mkdir(red64Dir, { recursive: true });

      // Write config with pretty formatting
      const content = JSON.stringify(config, null, 2);
      await writeFile(configPath, content, 'utf-8');
    },

    async isInitialized(baseDir: string): Promise<boolean> {
      const configPath = getConfigPath(baseDir);
      return fileExists(configPath);
    }
  };
}
