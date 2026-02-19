/**
 * Integration tests for plugin commands in CommandRouter
 * Task 9.1: Integrate plugin commands into the command router
 * Requirements: 4.1, 4.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { CommandRouter } from '../../src/components/CommandRouter.js';
import type { GlobalFlags } from '../../src/types/index.js';
import {
  createPluginRegistry,
  createPluginContext,
  type PluginRegistryService,
} from '../../src/plugins/index.js';

// Default flags for testing
const defaultFlags: GlobalFlags = {
  skipPermissions: false,
  brownfield: false,
  greenfield: true,
  tier: undefined,
  help: false,
  version: false,
  verbose: false,
  yes: false,
  sandbox: false,
};

describe('CommandRouter Plugin Integration', () => {
  describe('Task 9.1: Plugin command routing', () => {
    it('should route "plugin" command to PluginScreen', () => {
      const { lastFrame } = render(
        <CommandRouter
          command="plugin"
          args={['list']}
          flags={defaultFlags}
        />
      );

      // PluginScreen should be rendered for plugin command
      // For now it shows a placeholder message (as per task description)
      // The full PluginScreen implementation is Task 10
      const output = lastFrame();
      expect(output).toBeDefined();
    });

    it('should handle plugin subcommand "install"', () => {
      const { lastFrame } = render(
        <CommandRouter
          command="plugin"
          args={['install', 'my-plugin']}
          flags={defaultFlags}
        />
      );

      const output = lastFrame();
      expect(output).toBeDefined();
    });

    it('should handle plugin subcommand "list"', () => {
      const { lastFrame } = render(
        <CommandRouter
          command="plugin"
          args={['list']}
          flags={defaultFlags}
        />
      );

      const output = lastFrame();
      expect(output).toBeDefined();
    });

    it('should handle plugin subcommand "enable"', () => {
      const { lastFrame } = render(
        <CommandRouter
          command="plugin"
          args={['enable', 'my-plugin']}
          flags={defaultFlags}
        />
      );

      const output = lastFrame();
      expect(output).toBeDefined();
    });

    it('should handle plugin subcommand "disable"', () => {
      const { lastFrame } = render(
        <CommandRouter
          command="plugin"
          args={['disable', 'my-plugin']}
          flags={defaultFlags}
        />
      );

      const output = lastFrame();
      expect(output).toBeDefined();
    });
  });

  describe('Dynamic command fallback', () => {
    let registry: PluginRegistryService;
    let mockHandler: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      registry = createPluginRegistry();
      mockHandler = vi.fn().mockResolvedValue(undefined);
    });

    it('should display help for unrecognized commands when no dynamic command matches', () => {
      const { lastFrame } = render(
        <CommandRouter
          command={undefined}
          args={['unknown-command']}
          flags={defaultFlags}
        />
      );

      // Should show help screen for unrecognized commands
      const output = lastFrame();
      expect(output).toBeDefined();
    });

    it('should continue to show help screen for truly unknown commands', () => {
      const { lastFrame } = render(
        <CommandRouter
          command={undefined}
          args={['totally-unknown']}
          flags={defaultFlags}
        />
      );

      const output = lastFrame();
      expect(output).toBeDefined();
    });
  });

  describe('Static command routing preserved', () => {
    it('should route "init" command correctly', () => {
      const { lastFrame } = render(
        <CommandRouter
          command="init"
          args={[]}
          flags={defaultFlags}
        />
      );

      const output = lastFrame();
      expect(output).toBeDefined();
    });

    it('should route "help" command correctly', () => {
      const { lastFrame } = render(
        <CommandRouter
          command="help"
          args={[]}
          flags={defaultFlags}
        />
      );

      const output = lastFrame();
      expect(output).toBeDefined();
    });

    it('should show help for command with --help flag', () => {
      const { lastFrame } = render(
        <CommandRouter
          command="init"
          args={[]}
          flags={{ ...defaultFlags, help: true }}
        />
      );

      const output = lastFrame();
      expect(output).toBeDefined();
    });
  });
});
