/**
 * parseArgs plugin command tests - Task 10.2
 * Tests for argument parsing of the plugin command group.
 *
 * Requirements coverage:
 * - Task 10.2: 3.1, 3.2, 3.3, 3.4, 3.5, 3.8, 9.1, 11.1, 11.2, 12.1, 12.4
 */
import { describe, it, expect } from 'vitest';
import { parseArgs } from '../../src/cli/parseArgs.js';

describe('parseArgs - plugin command (Task 10.2)', () => {
  // ---------------------------------------------------------------------------
  // Basic Command Recognition
  // ---------------------------------------------------------------------------

  describe('basic command recognition', () => {
    it('recognizes "plugin" as a valid command', () => {
      const result = parseArgs(['plugin']);
      expect(result.command).toBe('plugin');
    });

    it('parses plugin as command with remaining args', () => {
      const result = parseArgs(['plugin', 'list']);
      expect(result.command).toBe('plugin');
      expect(result.args).toEqual(['list']);
    });
  });

  // ---------------------------------------------------------------------------
  // Subcommand Parsing
  // ---------------------------------------------------------------------------

  describe('subcommand parsing', () => {
    it('parses "plugin install <name>" correctly', () => {
      const result = parseArgs(['plugin', 'install', 'my-plugin']);
      expect(result.command).toBe('plugin');
      expect(result.args[0]).toBe('install');
      expect(result.args[1]).toBe('my-plugin');
    });

    it('parses "plugin uninstall <name>" correctly', () => {
      const result = parseArgs(['plugin', 'uninstall', 'my-plugin']);
      expect(result.command).toBe('plugin');
      expect(result.args[0]).toBe('uninstall');
      expect(result.args[1]).toBe('my-plugin');
    });

    it('parses "plugin enable <name>" correctly', () => {
      const result = parseArgs(['plugin', 'enable', 'my-plugin']);
      expect(result.command).toBe('plugin');
      expect(result.args[0]).toBe('enable');
      expect(result.args[1]).toBe('my-plugin');
    });

    it('parses "plugin disable <name>" correctly', () => {
      const result = parseArgs(['plugin', 'disable', 'my-plugin']);
      expect(result.command).toBe('plugin');
      expect(result.args[0]).toBe('disable');
      expect(result.args[1]).toBe('my-plugin');
    });

    it('parses "plugin list" correctly (no additional args)', () => {
      const result = parseArgs(['plugin', 'list']);
      expect(result.command).toBe('plugin');
      expect(result.args[0]).toBe('list');
      expect(result.args.length).toBe(1);
    });

    it('parses "plugin update <name>" correctly', () => {
      const result = parseArgs(['plugin', 'update', 'my-plugin']);
      expect(result.command).toBe('plugin');
      expect(result.args[0]).toBe('update');
      expect(result.args[1]).toBe('my-plugin');
    });

    it('parses "plugin search <query>" correctly', () => {
      const result = parseArgs(['plugin', 'search', 'analyzer']);
      expect(result.command).toBe('plugin');
      expect(result.args[0]).toBe('search');
      expect(result.args[1]).toBe('analyzer');
    });

    it('parses "plugin info <name>" correctly', () => {
      const result = parseArgs(['plugin', 'info', 'my-plugin']);
      expect(result.command).toBe('plugin');
      expect(result.args[0]).toBe('info');
      expect(result.args[1]).toBe('my-plugin');
    });

    it('parses "plugin config <name>" correctly', () => {
      const result = parseArgs(['plugin', 'config', 'my-plugin']);
      expect(result.command).toBe('plugin');
      expect(result.args[0]).toBe('config');
      expect(result.args[1]).toBe('my-plugin');
    });

    it('parses "plugin config <name> <key>" correctly', () => {
      const result = parseArgs(['plugin', 'config', 'my-plugin', 'apiKey']);
      expect(result.command).toBe('plugin');
      expect(result.args).toEqual(['config', 'my-plugin', 'apiKey']);
    });

    it('parses "plugin config <name> <key> <value>" correctly', () => {
      const result = parseArgs(['plugin', 'config', 'my-plugin', 'apiKey', 'secret123']);
      expect(result.command).toBe('plugin');
      expect(result.args).toEqual(['config', 'my-plugin', 'apiKey', 'secret123']);
    });

    it('parses "plugin create <name>" correctly', () => {
      const result = parseArgs(['plugin', 'create', 'my-new-plugin']);
      expect(result.command).toBe('plugin');
      expect(result.args[0]).toBe('create');
      expect(result.args[1]).toBe('my-new-plugin');
    });

    it('parses "plugin validate <path>" correctly', () => {
      const result = parseArgs(['plugin', 'validate', '/path/to/plugin']);
      expect(result.command).toBe('plugin');
      expect(result.args[0]).toBe('validate');
      expect(result.args[1]).toBe('/path/to/plugin');
    });
  });

  // ---------------------------------------------------------------------------
  // Plugin-specific Flags
  // ---------------------------------------------------------------------------

  describe('plugin-specific flags', () => {
    it('parses --registry flag for custom registry URL (Req 11.3)', () => {
      const result = parseArgs(['plugin', 'install', 'my-plugin', '--registry', 'https://custom.registry.com']);
      expect(result.command).toBe('plugin');
      expect(result.args[0]).toBe('install');
      expect(result.args[1]).toBe('my-plugin');
      expect(result.flags.registry).toBe('https://custom.registry.com');
    });

    it('parses --registry=value syntax', () => {
      const result = parseArgs(['plugin', 'search', 'test', '--registry=https://private.npm.com']);
      expect(result.command).toBe('plugin');
      expect(result.flags.registry).toBe('https://private.npm.com');
    });

    it('parses --local-path flag for local installs', () => {
      const result = parseArgs(['plugin', 'install', '--local-path', '/path/to/local/plugin']);
      expect(result.command).toBe('plugin');
      expect(result.args[0]).toBe('install');
      expect(result.flags['local-path']).toBe('/path/to/local/plugin');
    });

    it('parses --local-path=value syntax', () => {
      const result = parseArgs(['plugin', 'install', '--local-path=/my/plugin/path']);
      expect(result.command).toBe('plugin');
      expect(result.flags['local-path']).toBe('/my/plugin/path');
    });

    it('parses --dev flag for dev mode', () => {
      const result = parseArgs(['plugin', 'install', 'my-plugin', '--dev']);
      expect(result.command).toBe('plugin');
      expect(result.flags.dev).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Combined Flags and Args
  // ---------------------------------------------------------------------------

  describe('combined flags and args', () => {
    it('parses plugin command with global flags', () => {
      const result = parseArgs(['plugin', 'list', '--verbose']);
      expect(result.command).toBe('plugin');
      expect(result.args[0]).toBe('list');
      expect(result.flags.verbose).toBe(true);
    });

    it('parses plugin install with multiple flags', () => {
      const result = parseArgs([
        'plugin', 'install', 'my-plugin',
        '--registry', 'https://custom.registry.com',
        '--dev'
      ]);
      expect(result.command).toBe('plugin');
      expect(result.args[0]).toBe('install');
      expect(result.args[1]).toBe('my-plugin');
      expect(result.flags.registry).toBe('https://custom.registry.com');
      expect(result.flags.dev).toBe(true);
    });

    it('handles flags before and after plugin name', () => {
      const result = parseArgs([
        'plugin', 'install', '--dev', 'my-plugin', '--registry', 'https://example.com'
      ]);
      expect(result.command).toBe('plugin');
      expect(result.args).toContain('install');
      expect(result.args).toContain('my-plugin');
      expect(result.flags.dev).toBe(true);
      expect(result.flags.registry).toBe('https://example.com');
    });
  });

  // ---------------------------------------------------------------------------
  // Edge Cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles plugin command with no subcommand', () => {
      const result = parseArgs(['plugin']);
      expect(result.command).toBe('plugin');
      expect(result.args).toEqual([]);
    });

    it('handles plugin name with special characters', () => {
      const result = parseArgs(['plugin', 'install', '@scope/my-plugin']);
      expect(result.command).toBe('plugin');
      expect(result.args[1]).toBe('@scope/my-plugin');
    });

    it('handles local path with spaces (when quoted)', () => {
      // In real CLI usage, the shell would handle this
      // The parser receives it as a single string
      const result = parseArgs(['plugin', 'validate', '/path/with spaces/plugin']);
      expect(result.command).toBe('plugin');
      expect(result.args[1]).toBe('/path/with spaces/plugin');
    });

    it('does not confuse plugin-related flags with other commands', () => {
      // When used with non-plugin command, registry flag should not interfere
      const result = parseArgs(['init', '--registry', 'ignored']);
      expect(result.command).toBe('init');
      // The flag behavior depends on implementation - it may be parsed or ignored
    });
  });
});
