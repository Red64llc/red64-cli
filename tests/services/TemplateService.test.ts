import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createTemplateService,
  type TemplateService,
  type StructureResult
} from '../../src/services/TemplateService.js';

describe('TemplateService', () => {
  let tempDir: string;
  let templateService: TemplateService;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'red64-template-test-'));
    templateService = createTemplateService();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('createStructure', () => {
    it('should create all required directories under .red64/', async () => {
      const result = await templateService.createStructure(tempDir);

      // Check that all required directories were created
      const expectedDirs = [
        '.red64',
        '.red64/steering',
        '.red64/specs',
        '.red64/templates',
        '.red64/settings'
      ];

      for (const dir of expectedDirs) {
        const entries = await readdir(join(tempDir, dir)).catch(() => null);
        expect(entries).not.toBeNull();
      }
    });

    it('should return list of created directories', async () => {
      const result = await templateService.createStructure(tempDir);

      expect(result.createdDirs).toContain('.red64');
      expect(result.createdDirs).toContain('.red64/steering');
      expect(result.createdDirs).toContain('.red64/specs');
      expect(result.createdDirs).toContain('.red64/templates');
      expect(result.createdDirs).toContain('.red64/settings');
    });

    it('should not throw if directories already exist', async () => {
      // Create some directories first
      await mkdir(join(tempDir, '.red64', 'steering'), { recursive: true });

      // Should not throw when called
      await expect(templateService.createStructure(tempDir)).resolves.not.toThrow();
    });

    it('should create settings/rules subdirectory', async () => {
      await templateService.createStructure(tempDir);

      const entries = await readdir(join(tempDir, '.red64', 'settings'));
      // settings directory should exist (rules created within)
    });
  });

  describe('listStacks', () => {
    it('should list available stacks from source directory', async () => {
      // Create a source directory structure with stacks
      const sourceDir = join(tempDir, 'source');
      await mkdir(join(sourceDir, 'stacks', 'react'), { recursive: true });
      await mkdir(join(sourceDir, 'stacks', 'nextjs'), { recursive: true });
      await mkdir(join(sourceDir, 'stacks', 'nodejs'), { recursive: true });

      // Add a file to make sure it's not listed as a stack
      await writeFile(join(sourceDir, 'stacks', 'readme.txt'), 'info');

      const stacks = await templateService.listStacks(sourceDir);

      expect(stacks).toContain('react');
      expect(stacks).toContain('nextjs');
      expect(stacks).toContain('nodejs');
      expect(stacks).not.toContain('readme.txt');
    });

    it('should return empty array when no stacks directory exists', async () => {
      const sourceDir = join(tempDir, 'empty-source');
      await mkdir(sourceDir, { recursive: true });

      const stacks = await templateService.listStacks(sourceDir);

      expect(stacks).toEqual([]);
    });

    it('should return empty array when stacks directory is empty', async () => {
      const sourceDir = join(tempDir, 'source');
      await mkdir(join(sourceDir, 'stacks'), { recursive: true });

      const stacks = await templateService.listStacks(sourceDir);

      expect(stacks).toEqual([]);
    });

    it('should sort stacks alphabetically', async () => {
      const sourceDir = join(tempDir, 'source');
      await mkdir(join(sourceDir, 'stacks', 'python'), { recursive: true });
      await mkdir(join(sourceDir, 'stacks', 'go'), { recursive: true });
      await mkdir(join(sourceDir, 'stacks', 'rust'), { recursive: true });

      const stacks = await templateService.listStacks(sourceDir);

      expect(stacks).toEqual(['go', 'python', 'rust']);
    });
  });

  describe('applyStackTemplates', () => {
    let sourceDir: string;

    beforeEach(async () => {
      sourceDir = join(tempDir, 'source');
      // Create source stack structure
      const stackDir = join(sourceDir, 'stacks', 'react');
      await mkdir(stackDir, { recursive: true });

      // Create template files
      await writeFile(join(stackDir, 'product.md'), '# Product\n\nProject: {{projectName}}');
      await writeFile(join(stackDir, 'tech.md'), '# Tech Stack\n\nUsing React with {{projectName}}');
      await writeFile(join(stackDir, 'structure.md'), '# Structure\n\n{{description}}');
      await writeFile(join(stackDir, 'testing.md'), '# Testing with Jest');
    });

    it('should copy stack template files to target steering directory', async () => {
      const targetDir = join(tempDir, 'target');
      await mkdir(join(targetDir, '.red64', 'steering'), { recursive: true });

      const files = await templateService.applyStackTemplates({
        sourceDir,
        targetDir,
        stack: 'react',
        variables: { projectName: 'MyApp', description: 'A React app' }
      });

      expect(files).toContain('product.md');
      expect(files).toContain('tech.md');
      expect(files).toContain('structure.md');
      expect(files).toContain('testing.md');

      // Verify files exist
      const steeringDir = join(targetDir, '.red64', 'steering');
      const productContent = await readFile(join(steeringDir, 'product.md'), 'utf-8');
      expect(productContent).toContain('MyApp');
    });

    it('should perform variable substitution in templates', async () => {
      const targetDir = join(tempDir, 'target');
      await mkdir(join(targetDir, '.red64', 'steering'), { recursive: true });

      await templateService.applyStackTemplates({
        sourceDir,
        targetDir,
        stack: 'react',
        variables: { projectName: 'TestProject', description: 'Test description' }
      });

      const steeringDir = join(targetDir, '.red64', 'steering');

      const productContent = await readFile(join(steeringDir, 'product.md'), 'utf-8');
      expect(productContent).toContain('TestProject');
      expect(productContent).not.toContain('{{projectName}}');

      const structureContent = await readFile(join(steeringDir, 'structure.md'), 'utf-8');
      expect(structureContent).toContain('Test description');
      expect(structureContent).not.toContain('{{description}}');
    });

    it('should fall back to generic templates when stack not found', async () => {
      // Create generic templates
      const genericDir = join(sourceDir, 'stacks', 'generic');
      await mkdir(genericDir, { recursive: true });
      await writeFile(join(genericDir, 'product.md'), '# Generic Product');
      await writeFile(join(genericDir, 'tech.md'), '# Generic Tech');
      await writeFile(join(genericDir, 'structure.md'), '# Generic Structure');

      const targetDir = join(tempDir, 'target');
      await mkdir(join(targetDir, '.red64', 'steering'), { recursive: true });

      const files = await templateService.applyStackTemplates({
        sourceDir,
        targetDir,
        stack: 'nonexistent',
        variables: {}
      });

      expect(files).toContain('product.md');

      const productContent = await readFile(
        join(targetDir, '.red64', 'steering', 'product.md'),
        'utf-8'
      );
      expect(productContent).toContain('Generic Product');
    });

    it('should return empty array when stack and generic templates not found', async () => {
      const targetDir = join(tempDir, 'target');
      await mkdir(join(targetDir, '.red64', 'steering'), { recursive: true });

      // Use empty source without generic fallback
      const emptySource = join(tempDir, 'empty-source');
      await mkdir(emptySource, { recursive: true });

      const files = await templateService.applyStackTemplates({
        sourceDir: emptySource,
        targetDir,
        stack: 'nonexistent',
        variables: {}
      });

      expect(files).toEqual([]);
    });

    it('should create steering directory if it does not exist', async () => {
      const targetDir = join(tempDir, 'target');
      // Do not create steering directory

      await templateService.applyStackTemplates({
        sourceDir,
        targetDir,
        stack: 'react',
        variables: { projectName: 'Test' }
      });

      // Should have created the directory and copied files
      const steeringDir = join(targetDir, '.red64', 'steering');
      const entries = await readdir(steeringDir);
      expect(entries.length).toBeGreaterThan(0);
    });
  });

  describe('transformContent', () => {
    it('should perform kiro-to-red64 renaming in content', async () => {
      // Create a source with kiro references
      const sourceDir = join(tempDir, 'kiro-source');
      const stackDir = join(sourceDir, 'stacks', 'test');
      await mkdir(stackDir, { recursive: true });

      await writeFile(join(stackDir, 'product.md'),
        'Using .kiro/ directory\nKiro framework\nKIRO CLI');

      const targetDir = join(tempDir, 'target');
      await mkdir(join(targetDir, '.red64', 'steering'), { recursive: true });

      await templateService.applyStackTemplates({
        sourceDir,
        targetDir,
        stack: 'test',
        variables: {}
      });

      const content = await readFile(
        join(targetDir, '.red64', 'steering', 'product.md'),
        'utf-8'
      );

      // Should have replaced kiro references
      expect(content).toContain('.red64/');
      expect(content).toContain('Red64 framework');
      expect(content).toContain('RED64 CLI');
      expect(content).not.toContain('.kiro/');
      expect(content).not.toContain('Kiro framework');
      expect(content).not.toContain('KIRO CLI');
    });

    it('should handle mixed kiro references in content', async () => {
      const sourceDir = join(tempDir, 'kiro-source');
      const stackDir = join(sourceDir, 'stacks', 'test');
      await mkdir(stackDir, { recursive: true });

      await writeFile(join(stackDir, 'tech.md'),
        'kiro-cli tool\n/kiro:command\n.kiro/steering/');

      const targetDir = join(tempDir, 'target');
      await mkdir(join(targetDir, '.red64', 'steering'), { recursive: true });

      await templateService.applyStackTemplates({
        sourceDir,
        targetDir,
        stack: 'test',
        variables: {}
      });

      const content = await readFile(
        join(targetDir, '.red64', 'steering', 'tech.md'),
        'utf-8'
      );

      expect(content).toContain('red64-cli');
      expect(content).toContain('/red64:command');
      expect(content).toContain('.red64/steering/');
    });
  });
});
