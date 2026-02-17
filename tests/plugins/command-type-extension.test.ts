/**
 * Tests for Task 1.3: Extend Command type union with 'plugin'
 * TDD: RED phase - these tests should fail before implementation
 */
import { describe, it, expect } from 'vitest';
import type { Command } from '../../src/types/index.js';

describe('Command type extension for plugin system', () => {
  describe('Command type includes plugin', () => {
    it('should accept plugin as a valid command', () => {
      const command: Command = 'plugin';
      expect(command).toBe('plugin');
    });

    it('should still accept all existing commands', () => {
      const commands: Command[] = [
        'init', 'start', 'status', 'list', 'abort', 'mcp', 'help', 'plugin', undefined
      ];
      expect(commands).toHaveLength(9);
      expect(commands).toContain('plugin');
      expect(commands).toContain('init');
      expect(commands).toContain(undefined);
    });
  });

  describe('VALID_COMMANDS includes plugin', () => {
    it('should parse plugin as a valid command', async () => {
      const { parseArgs } = await import('../../src/cli/parseArgs.js');
      const result = parseArgs(['plugin']);
      expect(result.command).toBe('plugin');
    });

    it('should parse plugin with subcommand as args', async () => {
      const { parseArgs } = await import('../../src/cli/parseArgs.js');
      const result = parseArgs(['plugin', 'install', 'my-plugin']);
      expect(result.command).toBe('plugin');
      expect(result.args).toEqual(['install', 'my-plugin']);
    });

    it('should parse plugin with flags', async () => {
      const { parseArgs } = await import('../../src/cli/parseArgs.js');
      const result = parseArgs(['plugin', 'list', '--verbose']);
      expect(result.command).toBe('plugin');
      expect(result.args).toEqual(['list']);
      expect(result.flags.verbose).toBe(true);
    });
  });
});
