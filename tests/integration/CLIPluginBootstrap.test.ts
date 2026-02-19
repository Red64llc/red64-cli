/**
 * Integration tests for plugin loading in CLI startup
 * Task 9.5: Integrate plugin loading into the CLI startup sequence
 * Requirements: 1.1, 1.5, 1.6, 10.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  createPluginBootstrap,
  type PluginBootstrapResult,
  type PluginBootstrapConfig,
} from '../../src/plugins/PluginBootstrap.js';

describe('CLI Plugin Bootstrap', () => {
  let tempDir: string;
  let pluginsDir: string;
  let stateFilePath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plugin-bootstrap-test-'));
    pluginsDir = path.join(tempDir, 'node_modules');
    stateFilePath = path.join(tempDir, '.red64', 'plugins.json');
    await fs.mkdir(path.join(tempDir, '.red64'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Task 9.5: Plugin loading during startup', () => {
    it('should discover and load enabled plugins from state file', async () => {
      // Create a mock plugin in node_modules
      const pluginDir = path.join(pluginsDir, 'test-plugin');
      await fs.mkdir(pluginDir, { recursive: true });

      // Create a package.json with red64-plugin keyword (required for npm discovery)
      await fs.writeFile(
        path.join(pluginDir, 'package.json'),
        JSON.stringify({
          name: 'test-plugin',
          version: '1.0.0',
          keywords: ['red64-plugin'],
        })
      );

      // Create a valid manifest
      await fs.writeFile(
        path.join(pluginDir, 'red64-plugin.json'),
        JSON.stringify({
          name: 'test-plugin',
          version: '1.0.0',
          description: 'A test plugin',
          author: 'Test',
          entryPoint: './index.js',
          red64CliVersion: '>=0.1.0',
          extensionPoints: ['commands'],
        })
      );

      // Create a minimal entry point
      await fs.writeFile(
        path.join(pluginDir, 'index.js'),
        `
        export function activate(context) {
          context.log('info', 'Test plugin activated');
        }
        export function deactivate() {}
        `
      );

      // Create state file with the plugin enabled
      await fs.writeFile(
        stateFilePath,
        JSON.stringify({
          schemaVersion: 1,
          plugins: {
            'test-plugin': {
              version: '1.0.0',
              enabled: true,
              installedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              source: 'npm',
            },
          },
        })
      );

      const config: PluginBootstrapConfig = {
        projectDir: tempDir,
        nodeModulesDir: pluginsDir,
        cliVersion: '0.12.0',
        pluginsEnabled: true,
      };

      const result = await createPluginBootstrap(config);

      expect(result.loaded.length).toBe(1);
      expect(result.loaded[0]?.name).toBe('test-plugin');
      expect(result.skipped.length).toBe(0);
      expect(result.errors.length).toBe(0);
    });

    it('should skip disabled plugins', async () => {
      // Create a mock plugin
      const pluginDir = path.join(pluginsDir, 'disabled-plugin');
      await fs.mkdir(pluginDir, { recursive: true });

      // Create package.json with keyword
      await fs.writeFile(
        path.join(pluginDir, 'package.json'),
        JSON.stringify({
          name: 'disabled-plugin',
          version: '1.0.0',
          keywords: ['red64-plugin'],
        })
      );

      await fs.writeFile(
        path.join(pluginDir, 'red64-plugin.json'),
        JSON.stringify({
          name: 'disabled-plugin',
          version: '1.0.0',
          description: 'A disabled plugin',
          author: 'Test',
          entryPoint: './index.js',
          red64CliVersion: '>=0.1.0',
          extensionPoints: [],
        })
      );

      await fs.writeFile(
        path.join(pluginDir, 'index.js'),
        `export function activate() {} export function deactivate() {}`
      );

      // Create state file with the plugin disabled
      await fs.writeFile(
        stateFilePath,
        JSON.stringify({
          schemaVersion: 1,
          plugins: {
            'disabled-plugin': {
              version: '1.0.0',
              enabled: false,
              installedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              source: 'npm',
            },
          },
        })
      );

      const config: PluginBootstrapConfig = {
        projectDir: tempDir,
        nodeModulesDir: pluginsDir,
        cliVersion: '0.12.0',
        pluginsEnabled: true,
      };

      const result = await createPluginBootstrap(config);

      expect(result.loaded.length).toBe(0);
      expect(result.skipped.length).toBe(1);
      expect(result.skipped[0]?.name).toBe('disabled-plugin');
      expect(result.skipped[0]?.reason).toContain('disabled');
    });

    it('should report errors for plugins that fail to load', async () => {
      // Create a plugin with invalid entry point
      const pluginDir = path.join(pluginsDir, 'broken-plugin');
      await fs.mkdir(pluginDir, { recursive: true });

      // Create package.json with keyword
      await fs.writeFile(
        path.join(pluginDir, 'package.json'),
        JSON.stringify({
          name: 'broken-plugin',
          version: '1.0.0',
          keywords: ['red64-plugin'],
        })
      );

      await fs.writeFile(
        path.join(pluginDir, 'red64-plugin.json'),
        JSON.stringify({
          name: 'broken-plugin',
          version: '1.0.0',
          description: 'A broken plugin',
          author: 'Test',
          entryPoint: './nonexistent.js', // Entry point doesn't exist
          red64CliVersion: '>=0.1.0',
          extensionPoints: [],
        })
      );

      // Create state file with the plugin enabled
      await fs.writeFile(
        stateFilePath,
        JSON.stringify({
          schemaVersion: 1,
          plugins: {
            'broken-plugin': {
              version: '1.0.0',
              enabled: true,
              installedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              source: 'npm',
            },
          },
        })
      );

      const config: PluginBootstrapConfig = {
        projectDir: tempDir,
        nodeModulesDir: pluginsDir,
        cliVersion: '0.12.0',
        pluginsEnabled: true,
      };

      const result = await createPluginBootstrap(config);

      expect(result.loaded.length).toBe(0);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]?.pluginName).toBe('broken-plugin');
      expect(result.errors[0]?.error).toBeDefined();
    });
  });

  describe('Task 9.5: plugins.enabled config option', () => {
    it('should skip all plugin loading when plugins.enabled is false', async () => {
      // Create a valid plugin
      const pluginDir = path.join(pluginsDir, 'should-skip');
      await fs.mkdir(pluginDir, { recursive: true });

      // Create package.json with keyword
      await fs.writeFile(
        path.join(pluginDir, 'package.json'),
        JSON.stringify({
          name: 'should-skip',
          version: '1.0.0',
          keywords: ['red64-plugin'],
        })
      );

      await fs.writeFile(
        path.join(pluginDir, 'red64-plugin.json'),
        JSON.stringify({
          name: 'should-skip',
          version: '1.0.0',
          description: 'Should be skipped',
          author: 'Test',
          entryPoint: './index.js',
          red64CliVersion: '>=0.1.0',
          extensionPoints: [],
        })
      );

      await fs.writeFile(
        path.join(pluginDir, 'index.js'),
        `export function activate() {} export function deactivate() {}`
      );

      // Plugin is enabled in state
      await fs.writeFile(
        stateFilePath,
        JSON.stringify({
          schemaVersion: 1,
          plugins: {
            'should-skip': {
              version: '1.0.0',
              enabled: true,
              installedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              source: 'npm',
            },
          },
        })
      );

      // But plugins.enabled is false in config
      const config: PluginBootstrapConfig = {
        projectDir: tempDir,
        nodeModulesDir: pluginsDir,
        cliVersion: '0.12.0',
        pluginsEnabled: false, // Disabled globally
      };

      const result = await createPluginBootstrap(config);

      // No plugins should be loaded
      expect(result.loaded.length).toBe(0);
      expect(result.skipped.length).toBe(0);
      expect(result.errors.length).toBe(0);
      expect(result.pluginsDisabledGlobally).toBe(true);
    });

    it('should default to plugins.enabled = true', async () => {
      // Create state file with no plugins
      await fs.writeFile(
        stateFilePath,
        JSON.stringify({
          schemaVersion: 1,
          plugins: {},
        })
      );

      const config: PluginBootstrapConfig = {
        projectDir: tempDir,
        nodeModulesDir: pluginsDir,
        cliVersion: '0.12.0',
        // pluginsEnabled not specified - should default to true
      };

      const result = await createPluginBootstrap(config);

      expect(result.pluginsDisabledGlobally).toBe(false);
    });
  });

  describe('Task 9.5: CLI version compatibility', () => {
    it('should skip incompatible plugins', async () => {
      const pluginDir = path.join(pluginsDir, 'incompatible-plugin');
      await fs.mkdir(pluginDir, { recursive: true });

      // Create package.json with keyword
      await fs.writeFile(
        path.join(pluginDir, 'package.json'),
        JSON.stringify({
          name: 'incompatible-plugin',
          version: '1.0.0',
          keywords: ['red64-plugin'],
        })
      );

      await fs.writeFile(
        path.join(pluginDir, 'red64-plugin.json'),
        JSON.stringify({
          name: 'incompatible-plugin',
          version: '1.0.0',
          description: 'Incompatible plugin',
          author: 'Test',
          entryPoint: './index.js',
          red64CliVersion: '>=99.0.0', // Requires future version
          extensionPoints: [],
        })
      );

      await fs.writeFile(
        path.join(pluginDir, 'index.js'),
        `export function activate() {} export function deactivate() {}`
      );

      await fs.writeFile(
        stateFilePath,
        JSON.stringify({
          schemaVersion: 1,
          plugins: {
            'incompatible-plugin': {
              version: '1.0.0',
              enabled: true,
              installedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              source: 'npm',
            },
          },
        })
      );

      const config: PluginBootstrapConfig = {
        projectDir: tempDir,
        nodeModulesDir: pluginsDir,
        cliVersion: '0.12.0',
        pluginsEnabled: true,
      };

      const result = await createPluginBootstrap(config);

      expect(result.loaded.length).toBe(0);
      expect(result.skipped.length).toBe(1);
      expect(result.skipped[0]?.name).toBe('incompatible-plugin');
      expect(result.skipped[0]?.reason).toContain('CLI version');
    });
  });

  describe('Task 9.5: Bootstrap result summary', () => {
    it('should provide summary counts', async () => {
      await fs.writeFile(
        stateFilePath,
        JSON.stringify({
          schemaVersion: 1,
          plugins: {},
        })
      );

      const config: PluginBootstrapConfig = {
        projectDir: tempDir,
        nodeModulesDir: pluginsDir,
        cliVersion: '0.12.0',
        pluginsEnabled: true,
      };

      const result = await createPluginBootstrap(config);

      expect(result).toHaveProperty('loaded');
      expect(result).toHaveProperty('skipped');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('registry');
      expect(result).toHaveProperty('hookRunner');
      expect(result).toHaveProperty('pluginsDisabledGlobally');
    });
  });

  describe('Empty state file handling', () => {
    it('should handle missing state file gracefully', async () => {
      // Don't create the state file

      const config: PluginBootstrapConfig = {
        projectDir: tempDir,
        nodeModulesDir: pluginsDir,
        cliVersion: '0.12.0',
        pluginsEnabled: true,
      };

      const result = await createPluginBootstrap(config);

      expect(result.loaded.length).toBe(0);
      expect(result.skipped.length).toBe(0);
      expect(result.errors.length).toBe(0);
    });
  });
});
