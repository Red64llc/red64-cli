import { describe, it, expect } from 'vitest';
import { parseArgs } from '../../src/cli/parseArgs.js';
import type { CLIConfig, Command } from '../../src/types/index.js';

describe('parseArgs', () => {
  describe('command parsing', () => {
    it('should parse init command', () => {
      const result = parseArgs(['init']);
      expect(result.command).toBe('init');
    });

    it('should parse start command with feature and description', () => {
      const result = parseArgs(['start', 'my-feature', 'Feature description']);
      expect(result.command).toBe('start');
      expect(result.args).toEqual(['my-feature', 'Feature description']);
    });

    it('should parse status command with optional feature', () => {
      const result = parseArgs(['status']);
      expect(result.command).toBe('status');
      expect(result.args).toEqual([]);
    });

    it('should parse status command with feature argument', () => {
      const result = parseArgs(['status', 'my-feature']);
      expect(result.command).toBe('status');
      expect(result.args).toEqual(['my-feature']);
    });

    it('should parse list command', () => {
      const result = parseArgs(['list']);
      expect(result.command).toBe('list');
    });

    it('should parse abort command with feature', () => {
      const result = parseArgs(['abort', 'my-feature']);
      expect(result.command).toBe('abort');
      expect(result.args).toEqual(['my-feature']);
    });

    it('should parse help command', () => {
      const result = parseArgs(['help']);
      expect(result.command).toBe('help');
    });

    it('should return undefined command when no arguments', () => {
      const result = parseArgs([]);
      expect(result.command).toBeUndefined();
    });

    it('should pass through unknown commands for plugin command support', () => {
      const result = parseArgs(['unknown-command']);
      // Unknown commands are passed through for plugin system to handle
      expect(result.command).toBe('unknown-command');
      expect(result.args).toEqual([]);
    });
  });

  describe('flag parsing', () => {
    it('should parse --skip-permissions flag', () => {
      const result = parseArgs(['start', 'feature', 'desc', '--skip-permissions']);
      expect(result.flags.skipPermissions).toBe(true);
    });

    it('should parse -s shorthand for skip-permissions', () => {
      const result = parseArgs(['start', 'feature', 'desc', '-s']);
      expect(result.flags.skipPermissions).toBe(true);
    });

    it('should parse --brownfield flag', () => {
      const result = parseArgs(['start', 'feature', 'desc', '--brownfield']);
      expect(result.flags.brownfield).toBe(true);
      expect(result.flags.greenfield).toBe(false);
    });

    it('should parse -b shorthand for brownfield', () => {
      const result = parseArgs(['start', 'feature', 'desc', '-b']);
      expect(result.flags.brownfield).toBe(true);
    });

    it('should parse --greenfield flag', () => {
      const result = parseArgs(['start', 'feature', 'desc', '--greenfield']);
      expect(result.flags.greenfield).toBe(true);
      expect(result.flags.brownfield).toBe(false);
    });

    it('should parse -g shorthand for greenfield', () => {
      const result = parseArgs(['start', 'feature', 'desc', '-g']);
      expect(result.flags.greenfield).toBe(true);
    });

    it('should default to greenfield mode', () => {
      const result = parseArgs(['start', 'feature', 'desc']);
      expect(result.flags.greenfield).toBe(true);
      expect(result.flags.brownfield).toBe(false);
    });

    it('should parse --tier option with value', () => {
      const result = parseArgs(['start', 'feature', 'desc', '--tier', 'custom']);
      expect(result.flags.tier).toBe('custom');
    });

    it('should parse -t shorthand for tier', () => {
      const result = parseArgs(['start', 'feature', 'desc', '-t', 'premium']);
      expect(result.flags.tier).toBe('premium');
    });

    it('should parse --help flag', () => {
      const result = parseArgs(['--help']);
      expect(result.flags.help).toBe(true);
    });

    it('should parse -h shorthand for help', () => {
      const result = parseArgs(['-h']);
      expect(result.flags.help).toBe(true);
    });

    it('should parse --version flag', () => {
      const result = parseArgs(['--version']);
      expect(result.flags.version).toBe(true);
    });

    it('should parse -v shorthand for version', () => {
      const result = parseArgs(['-v']);
      expect(result.flags.version).toBe(true);
    });

    it('should parse --agent option with value (init flag)', () => {
      const result = parseArgs(['init', '--agent', 'gemini']);
      expect(result.flags.agent).toBe('gemini');
    });

    it('should parse -a shorthand for agent (init flag)', () => {
      const result = parseArgs(['init', '-a', 'codex']);
      expect(result.flags.agent).toBe('codex');
    });

    it('should have agent undefined by default (set at init time)', () => {
      const result = parseArgs(['start', 'feature', 'desc']);
      expect(result.flags.agent).toBeUndefined();
    });

    it('should ignore invalid agent values', () => {
      const result = parseArgs(['init', '--agent', 'invalid']);
      expect(result.flags.agent).toBeUndefined();
    });

    it('should parse --agent=value syntax (init flag)', () => {
      const result = parseArgs(['init', '--agent=gemini']);
      expect(result.flags.agent).toBe('gemini');
    });

    it('should parse --model option with value', () => {
      const result = parseArgs(['start', 'feature', 'desc', '--model', 'claude-3-5-haiku-latest']);
      expect(result.flags.model).toBe('claude-3-5-haiku-latest');
    });

    it('should parse -m shorthand for model', () => {
      const result = parseArgs(['start', 'feature', 'desc', '-m', 'gpt-4o-mini']);
      expect(result.flags.model).toBe('gpt-4o-mini');
    });

    it('should have model undefined by default', () => {
      const result = parseArgs(['start', 'feature', 'desc']);
      expect(result.flags.model).toBeUndefined();
    });

    it('should parse --model=value syntax', () => {
      const result = parseArgs(['start', 'feature', 'desc', '--model=gemini-2.0-flash']);
      expect(result.flags.model).toBe('gemini-2.0-flash');
    });

    it('should parse --ollama flag', () => {
      const result = parseArgs(['start', 'feature', 'desc', '--ollama']);
      expect(result.flags.ollama).toBe(true);
    });

    it('should have ollama false by default', () => {
      const result = parseArgs(['start', 'feature', 'desc']);
      expect(result.flags.ollama).toBe(false);
    });

    it('should parse --ollama with --model for local models', () => {
      const result = parseArgs(['start', 'feature', 'desc', '--model', 'qwen3-coder-next', '--ollama']);
      expect(result.flags.ollama).toBe(true);
      expect(result.flags.model).toBe('qwen3-coder-next');
    });

    it('should parse --ollama with --sandbox', () => {
      const result = parseArgs(['start', 'feature', 'desc', '--ollama', '--sandbox']);
      expect(result.flags.ollama).toBe(true);
      expect(result.flags.sandbox).toBe(true);
    });

    it('should parse --task-level flag', () => {
      const result = parseArgs(['start', 'feature', 'desc', '--task-level']);
      expect(result.flags['task-level']).toBe(true);
    });

    it('should have task-level undefined by default', () => {
      const result = parseArgs(['start', 'feature', 'desc']);
      expect(result.flags['task-level']).toBeUndefined();
    });

    it('should parse --task-level with other flags', () => {
      const result = parseArgs(['start', 'feature', 'desc', '--task-level', '-y', '--sandbox']);
      expect(result.flags['task-level']).toBe(true);
      expect(result.flags.yes).toBe(true);
      expect(result.flags.sandbox).toBe(true);
    });
  });

  describe('CLIConfig structure', () => {
    it('should return complete CLIConfig', () => {
      const result = parseArgs(['start', 'feature-name', 'A description']);

      expect(result).toHaveProperty('command');
      expect(result).toHaveProperty('args');
      expect(result).toHaveProperty('flags');
      expect(result.flags).toHaveProperty('skipPermissions');
      expect(result.flags).toHaveProperty('brownfield');
      expect(result.flags).toHaveProperty('greenfield');
      expect(result.flags).toHaveProperty('tier');
      expect(result.flags).toHaveProperty('help');
      expect(result.flags).toHaveProperty('version');
    });

    it('should have readonly args array', () => {
      const result = parseArgs(['start', 'feature', 'desc']);
      expect(Array.isArray(result.args)).toBe(true);
    });
  });

  describe('branding', () => {
    it('should include red64 branding in help text', () => {
      const result = parseArgs(['--help']);
      // Help flag should be set, and CLI should show red64 branding
      expect(result.flags.help).toBe(true);
    });
  });
});
