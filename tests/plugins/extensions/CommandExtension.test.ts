/**
 * CommandExtension tests - Task 5.1
 * Tests for the command extension point.
 *
 * Requirements coverage: 4.1, 4.2, 4.3, 4.4, 4.5
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCommandExtension } from '../../../src/plugins/extensions/CommandExtension';
import { createPluginRegistry } from '../../../src/plugins/PluginRegistry';
import type { CommandRegistration, PluginModule, LoadedPlugin } from '../../../src/plugins/types';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

function createMockCommandRegistration(
  name: string = 'test-command',
  overrides: Partial<CommandRegistration> = {}
): CommandRegistration {
  return {
    name,
    description: 'A test command',
    handler: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createMockLoadedPlugin(name: string = 'test-plugin'): LoadedPlugin {
  return {
    name,
    version: '1.0.0',
    manifest: {
      name,
      version: '1.0.0',
      description: 'Test plugin',
      author: 'Test',
      entryPoint: './index.js',
      red64CliVersion: '^1.0.0',
      extensionPoints: ['commands'],
    },
  };
}

function createMockModule(): PluginModule {
  return {
    activate: vi.fn(),
    deactivate: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommandExtension', () => {
  let registry: ReturnType<typeof createPluginRegistry>;
  let commandExtension: ReturnType<typeof createCommandExtension>;
  let logMessages: Array<{ level: string; message: string }>;

  beforeEach(() => {
    registry = createPluginRegistry();
    logMessages = [];
    commandExtension = createCommandExtension({
      registry,
      logger: (level, message) => {
        logMessages.push({ level, message });
      },
    });
  });

  describe('registerCommand', () => {
    it('accepts command registrations from plugins', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      const registration = createMockCommandRegistration('custom-cmd');

      commandExtension.registerCommand('my-plugin', registration);

      const command = commandExtension.getCommand('custom-cmd');
      expect(command).toBeDefined();
      expect(command?.pluginName).toBe('my-plugin');
      expect(command?.registration.name).toBe('custom-cmd');
    });

    it('validates that command name does not conflict with core command "init"', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      expect(() => {
        commandExtension.registerCommand('my-plugin', createMockCommandRegistration('init'));
      }).toThrow(/conflicts with core command/i);

      // Verify conflict warning is logged
      expect(logMessages.some(m => m.level === 'warn' && m.message.includes('init'))).toBe(true);
    });

    it('validates that command name does not conflict with core command "start"', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      expect(() => {
        commandExtension.registerCommand('my-plugin', createMockCommandRegistration('start'));
      }).toThrow(/conflicts with core command/i);
    });

    it('validates that command name does not conflict with core command "status"', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      expect(() => {
        commandExtension.registerCommand('my-plugin', createMockCommandRegistration('status'));
      }).toThrow(/conflicts with core command/i);
    });

    it('validates that command name does not conflict with core command "list"', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      expect(() => {
        commandExtension.registerCommand('my-plugin', createMockCommandRegistration('list'));
      }).toThrow(/conflicts with core command/i);
    });

    it('validates that command name does not conflict with core command "abort"', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      expect(() => {
        commandExtension.registerCommand('my-plugin', createMockCommandRegistration('abort'));
      }).toThrow(/conflicts with core command/i);
    });

    it('validates that command name does not conflict with core command "mcp"', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      expect(() => {
        commandExtension.registerCommand('my-plugin', createMockCommandRegistration('mcp'));
      }).toThrow(/conflicts with core command/i);
    });

    it('validates that command name does not conflict with core command "help"', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      expect(() => {
        commandExtension.registerCommand('my-plugin', createMockCommandRegistration('help'));
      }).toThrow(/conflicts with core command/i);
    });

    it('validates that command name does not conflict with core command "plugin"', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      expect(() => {
        commandExtension.registerCommand('my-plugin', createMockCommandRegistration('plugin'));
      }).toThrow(/conflicts with core command/i);
    });

    it('rejects conflicting registrations from another plugin', () => {
      registry.registerPlugin(createMockLoadedPlugin('plugin-a'), createMockModule());
      registry.registerPlugin(createMockLoadedPlugin('plugin-b'), createMockModule());
      commandExtension.registerCommand('plugin-a', createMockCommandRegistration('shared-cmd'));

      expect(() => {
        commandExtension.registerCommand('plugin-b', createMockCommandRegistration('shared-cmd'));
      }).toThrow(/conflicts with command from plugin/i);

      // Verify conflict warning is logged
      expect(logMessages.some(m => m.level === 'warn' && m.message.includes('shared-cmd'))).toBe(true);
    });

    it('logs a conflict warning when rejecting registration', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());

      try {
        commandExtension.registerCommand('my-plugin', createMockCommandRegistration('init'));
      } catch {
        // Expected
      }

      expect(logMessages.length).toBeGreaterThan(0);
      expect(logMessages[0]?.level).toBe('warn');
      expect(logMessages[0]?.message).toMatch(/conflict/i);
    });
  });

  describe('executeCommand', () => {
    it('wraps command handler execution in try/catch boundary', async () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      const handler = vi.fn().mockRejectedValue(new Error('Handler error'));
      commandExtension.registerCommand('my-plugin', createMockCommandRegistration('failing-cmd', { handler }));

      const result = await commandExtension.executeCommand('failing-cmd', {
        positional: [],
        options: {},
        context: {} as never,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Handler error/);
    });

    it('logs errors with plugin attribution', async () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      const handler = vi.fn().mockRejectedValue(new Error('Handler error'));
      commandExtension.registerCommand('my-plugin', createMockCommandRegistration('failing-cmd', { handler }));

      await commandExtension.executeCommand('failing-cmd', {
        positional: [],
        options: {},
        context: {} as never,
      });

      expect(logMessages.some(m =>
        m.level === 'error' &&
        m.message.includes('my-plugin') &&
        m.message.includes('Handler error')
      )).toBe(true);
    });

    it('propagates a standardized error', async () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      const handler = vi.fn().mockRejectedValue(new Error('Original error'));
      commandExtension.registerCommand('my-plugin', createMockCommandRegistration('failing-cmd', { handler }));

      const result = await commandExtension.executeCommand('failing-cmd', {
        positional: [],
        options: {},
        context: {} as never,
      });

      expect(result.success).toBe(false);
      expect(result.pluginName).toBe('my-plugin');
      expect(result.error).toBeDefined();
    });

    it('returns success result when handler succeeds', async () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      const handler = vi.fn().mockResolvedValue(undefined);
      commandExtension.registerCommand('my-plugin', createMockCommandRegistration('success-cmd', { handler }));

      const result = await commandExtension.executeCommand('success-cmd', {
        positional: ['arg1'],
        options: { verbose: true },
        context: {} as never,
      });

      expect(result.success).toBe(true);
      expect(handler).toHaveBeenCalledWith({
        positional: ['arg1'],
        options: { verbose: true },
        context: expect.anything(),
      });
    });

    it('returns error result for non-existent command', async () => {
      const result = await commandExtension.executeCommand('non-existent', {
        positional: [],
        options: {},
        context: {} as never,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });
  });

  describe('getCommand (lookup for CommandRouter)', () => {
    it('provides lookup function to resolve dynamically registered commands by name', () => {
      registry.registerPlugin(createMockLoadedPlugin('my-plugin'), createMockModule());
      commandExtension.registerCommand('my-plugin', createMockCommandRegistration('dynamic-cmd'));

      const command = commandExtension.getCommand('dynamic-cmd');

      expect(command).toBeDefined();
      expect(command?.registration.name).toBe('dynamic-cmd');
    });

    it('returns undefined for non-existent command', () => {
      const command = commandExtension.getCommand('non-existent');

      expect(command).toBeUndefined();
    });
  });

  describe('getAllCommands', () => {
    it('returns all registered plugin commands', () => {
      registry.registerPlugin(createMockLoadedPlugin('plugin-a'), createMockModule());
      registry.registerPlugin(createMockLoadedPlugin('plugin-b'), createMockModule());
      commandExtension.registerCommand('plugin-a', createMockCommandRegistration('cmd-a'));
      commandExtension.registerCommand('plugin-b', createMockCommandRegistration('cmd-b'));

      const commands = commandExtension.getAllCommands();

      expect(commands).toHaveLength(2);
      expect(commands.map(c => c.registration.name)).toContain('cmd-a');
      expect(commands.map(c => c.registration.name)).toContain('cmd-b');
    });
  });
});
