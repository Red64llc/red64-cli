import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createConfigService,
  type ConfigService,
  type InitConfig
} from '../../src/services/ConfigService.js';

describe('ConfigService', () => {
  let tempDir: string;
  let configService: ConfigService;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'red64-config-test-'));
    configService = createConfigService();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const createTestConfig = (overrides: Partial<InitConfig> = {}): InitConfig => ({
    version: 'v1.0.0',
    repo: 'owner/repo',
    stack: 'react',
    projectType: 'web-app',
    projectName: 'TestProject',
    description: 'A test project',
    initializedAt: new Date().toISOString(),
    customValues: {},
    agent: 'claude',
    ...overrides
  });

  describe('load', () => {
    it('should return null when config file does not exist', async () => {
      const config = await configService.load(tempDir);
      expect(config).toBeNull();
    });

    it('should load and parse existing config file', async () => {
      // Create the config file
      await mkdir(join(tempDir, '.red64'), { recursive: true });
      const configPath = join(tempDir, '.red64', 'config.json');
      const testConfig = createTestConfig();
      await writeFile(configPath, JSON.stringify(testConfig, null, 2));

      const loaded = await configService.load(tempDir);

      expect(loaded).not.toBeNull();
      expect(loaded?.version).toBe('v1.0.0');
      expect(loaded?.repo).toBe('owner/repo');
      expect(loaded?.stack).toBe('react');
      expect(loaded?.projectType).toBe('web-app');
    });

    it('should return null for corrupted JSON', async () => {
      await mkdir(join(tempDir, '.red64'), { recursive: true });
      const configPath = join(tempDir, '.red64', 'config.json');
      await writeFile(configPath, 'not valid json {{{');

      const config = await configService.load(tempDir);
      expect(config).toBeNull();
    });

    it('should preserve customValues', async () => {
      await mkdir(join(tempDir, '.red64'), { recursive: true });
      const configPath = join(tempDir, '.red64', 'config.json');
      const testConfig = createTestConfig({
        customValues: {
          testFramework: 'jest',
          cssFramework: 'tailwind'
        }
      });
      await writeFile(configPath, JSON.stringify(testConfig));

      const loaded = await configService.load(tempDir);

      expect(loaded?.customValues.testFramework).toBe('jest');
      expect(loaded?.customValues.cssFramework).toBe('tailwind');
    });

    it('should preserve all config fields', async () => {
      await mkdir(join(tempDir, '.red64'), { recursive: true });
      const configPath = join(tempDir, '.red64', 'config.json');
      const testConfig: InitConfig = {
        version: 'v2.0.0',
        repo: 'custom/framework',
        stack: 'nextjs',
        projectType: 'api',
        projectName: 'MyAPI',
        description: 'API service',
        initializedAt: '2026-01-26T12:00:00Z',
        customValues: { key: 'value' },
        agent: 'gemini'
      };
      await writeFile(configPath, JSON.stringify(testConfig));

      const loaded = await configService.load(tempDir);

      expect(loaded).toEqual(testConfig);
    });
  });

  describe('save', () => {
    it('should save config to .red64/config.json', async () => {
      const config = createTestConfig();

      await configService.save(tempDir, config);

      // Verify file exists
      const configPath = join(tempDir, '.red64', 'config.json');
      await expect(access(configPath)).resolves.not.toThrow();

      // Verify content
      const content = await readFile(configPath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.version).toBe(config.version);
      expect(parsed.repo).toBe(config.repo);
    });

    it('should create .red64 directory if it does not exist', async () => {
      const config = createTestConfig();

      await configService.save(tempDir, config);

      // Directory should now exist
      const red64Dir = join(tempDir, '.red64');
      await expect(access(red64Dir)).resolves.not.toThrow();
    });

    it('should overwrite existing config', async () => {
      // Save initial config
      const config1 = createTestConfig({ version: 'v1.0.0' });
      await configService.save(tempDir, config1);

      // Save updated config
      const config2 = createTestConfig({ version: 'v2.0.0' });
      await configService.save(tempDir, config2);

      // Verify updated version
      const loaded = await configService.load(tempDir);
      expect(loaded?.version).toBe('v2.0.0');
    });

    it('should maintain proper JSON formatting', async () => {
      const config = createTestConfig();

      await configService.save(tempDir, config);

      const configPath = join(tempDir, '.red64', 'config.json');
      const content = await readFile(configPath, 'utf-8');

      // Should be formatted (contain newlines and indentation)
      expect(content).toContain('\n');
      expect(content).toContain('  '); // 2-space indentation
    });

    it('should preserve customValues', async () => {
      const config = createTestConfig({
        customValues: {
          framework: 'express',
          database: 'postgres'
        }
      });

      await configService.save(tempDir, config);

      const loaded = await configService.load(tempDir);
      expect(loaded?.customValues.framework).toBe('express');
      expect(loaded?.customValues.database).toBe('postgres');
    });
  });

  describe('isInitialized', () => {
    it('should return false when .red64 directory does not exist', async () => {
      const result = await configService.isInitialized(tempDir);
      expect(result).toBe(false);
    });

    it('should return false when config.json does not exist', async () => {
      // Create .red64 directory without config.json
      await mkdir(join(tempDir, '.red64'), { recursive: true });

      const result = await configService.isInitialized(tempDir);
      expect(result).toBe(false);
    });

    it('should return true when config.json exists', async () => {
      // Create config file
      const config = createTestConfig();
      await configService.save(tempDir, config);

      const result = await configService.isInitialized(tempDir);
      expect(result).toBe(true);
    });

    it('should return true even with minimal config', async () => {
      await mkdir(join(tempDir, '.red64'), { recursive: true });
      await writeFile(join(tempDir, '.red64', 'config.json'), '{}');

      const result = await configService.isInitialized(tempDir);
      expect(result).toBe(true);
    });
  });

  describe('project types', () => {
    it.each([
      'web-app',
      'cli-tool',
      'library',
      'api',
      'other'
    ] as const)('should save and load project type: %s', async (projectType) => {
      const config = createTestConfig({ projectType });

      await configService.save(tempDir, config);
      const loaded = await configService.load(tempDir);

      expect(loaded?.projectType).toBe(projectType);
    });
  });
});
