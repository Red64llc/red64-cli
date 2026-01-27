import { describe, it, expect } from 'vitest';
import type {
  Command,
  GlobalFlags,
  CLIConfig
} from '../../src/types/index.js';

describe('CLI Configuration Types', () => {
  describe('Command', () => {
    it('should accept all valid commands', () => {
      const commands: Command[] = [
        'init',
        'start',
        'status',
        'list',
        'abort',
        'help',
        undefined
      ];

      commands.forEach(cmd => {
        const command: Command = cmd;
        expect(command === undefined || typeof command === 'string').toBe(true);
      });
    });

    it('should support init command', () => {
      const command: Command = 'init';
      expect(command).toBe('init');
    });

    it('should support start command', () => {
      const command: Command = 'start';
      expect(command).toBe('start');
    });

    it('should support status command', () => {
      const command: Command = 'status';
      expect(command).toBe('status');
    });

    it('should support list command', () => {
      const command: Command = 'list';
      expect(command).toBe('list');
    });

    it('should support abort command', () => {
      const command: Command = 'abort';
      expect(command).toBe('abort');
    });

    it('should support help command', () => {
      const command: Command = 'help';
      expect(command).toBe('help');
    });

    it('should support undefined for no command', () => {
      const command: Command = undefined;
      expect(command).toBeUndefined();
    });
  });

  describe('GlobalFlags', () => {
    const baseFlags: GlobalFlags = {
      skipPermissions: false,
      brownfield: false,
      greenfield: true,
      tier: undefined,
      help: false,
      version: false,
      verbose: false,
      yes: false,
      sandbox: false
    };

    it('should have all required flag fields', () => {
      const flags: GlobalFlags = { ...baseFlags };

      expect(flags.skipPermissions).toBe(false);
      expect(flags.brownfield).toBe(false);
      expect(flags.greenfield).toBe(true);
      expect(flags.tier).toBeUndefined();
      expect(flags.help).toBe(false);
      expect(flags.version).toBe(false);
      expect(flags.verbose).toBe(false);
      expect(flags.yes).toBe(false);
      expect(flags.sandbox).toBe(false);
    });

    it('should support skipPermissions flag', () => {
      const flags: GlobalFlags = { ...baseFlags, skipPermissions: true };
      expect(flags.skipPermissions).toBe(true);
    });

    it('should support brownfield mode flag', () => {
      const flags: GlobalFlags = { ...baseFlags, brownfield: true, greenfield: false };
      expect(flags.brownfield).toBe(true);
    });

    it('should support greenfield mode flag', () => {
      const flags: GlobalFlags = { ...baseFlags, greenfield: true };
      expect(flags.greenfield).toBe(true);
    });

    it('should support tier option with string value', () => {
      const flags: GlobalFlags = { ...baseFlags, tier: 'custom-tier' };
      expect(flags.tier).toBe('custom-tier');
    });

    it('should support tier as undefined', () => {
      const flags: GlobalFlags = { ...baseFlags, tier: undefined };
      expect(flags.tier).toBeUndefined();
    });

    it('should support help flag', () => {
      const flags: GlobalFlags = { ...baseFlags, help: true };
      expect(flags.help).toBe(true);
    });

    it('should support version flag', () => {
      const flags: GlobalFlags = { ...baseFlags, version: true };
      expect(flags.version).toBe(true);
    });

    it('should support optional agent flag for init command', () => {
      const defaultFlags: GlobalFlags = { ...baseFlags };
      const claudeFlags: GlobalFlags = { ...baseFlags, agent: 'claude' };
      const geminiFlags: GlobalFlags = { ...baseFlags, agent: 'gemini' };
      const codexFlags: GlobalFlags = { ...baseFlags, agent: 'codex' };

      expect(defaultFlags.agent).toBeUndefined();
      expect(claudeFlags.agent).toBe('claude');
      expect(geminiFlags.agent).toBe('gemini');
      expect(codexFlags.agent).toBe('codex');
    });
  });

  describe('CLIConfig', () => {
    const baseFlags: GlobalFlags = {
      skipPermissions: false,
      brownfield: false,
      greenfield: true,
      tier: undefined,
      help: false,
      version: false,
      verbose: false,
      yes: false,
      sandbox: false
    };

    it('should combine command, args, and flags', () => {
      const config: CLIConfig = {
        command: 'start',
        args: ['feature-name', 'Feature description'],
        flags: { ...baseFlags }
      };

      expect(config.command).toBe('start');
      expect(config.args).toHaveLength(2);
      expect(config.flags.greenfield).toBe(true);
    });

    it('should support readonly args array', () => {
      const config: CLIConfig = {
        command: 'status',
        args: [],
        flags: { ...baseFlags }
      };

      expect(Array.isArray(config.args)).toBe(true);
      expect(config.args).toHaveLength(0);
    });

    it('should support undefined command', () => {
      const config: CLIConfig = {
        command: undefined,
        args: [],
        flags: { ...baseFlags }
      };

      expect(config.command).toBeUndefined();
    });
  });
});
