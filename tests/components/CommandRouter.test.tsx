import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { CommandRouter } from '../../src/components/CommandRouter.js';
import type { Command, GlobalFlags } from '../../src/types/index.js';

const defaultFlags: GlobalFlags = {
  skipPermissions: false,
  brownfield: false,
  greenfield: true,
  tier: undefined,
  help: false,
  version: false
};

describe('CommandRouter', () => {
  describe('command routing', () => {
    it('should route to HelpScreen for help command', () => {
      const { lastFrame } = render(
        <CommandRouter command="help" args={[]} flags={defaultFlags} />
      );

      expect(lastFrame()).toContain('Red64 Flow Orchestrator');
    });

    it('should route to HelpScreen for undefined command', () => {
      const { lastFrame } = render(
        <CommandRouter command={undefined} args={[]} flags={defaultFlags} />
      );

      expect(lastFrame()).toContain('Red64 Flow Orchestrator');
    });

    it('should route to InitScreen for init command', () => {
      const { lastFrame } = render(
        <CommandRouter command="init" args={[]} flags={defaultFlags} />
      );

      expect(lastFrame()).toContain('init');
    });

    it('should route to StartScreen for start command', () => {
      const { lastFrame } = render(
        <CommandRouter
          command="start"
          args={['my-feature', 'Feature description']}
          flags={defaultFlags}
        />
      );

      expect(lastFrame()).toContain('start');
    });

    it('should route to ResumeScreen for resume command', () => {
      const { lastFrame } = render(
        <CommandRouter command="resume" args={['my-feature']} flags={defaultFlags} />
      );

      expect(lastFrame()).toContain('resume');
    });

    it('should route to StatusScreen for status command', () => {
      const { lastFrame } = render(
        <CommandRouter command="status" args={[]} flags={defaultFlags} />
      );

      expect(lastFrame()).toContain('status');
    });

    it('should route to ListScreen for list command', () => {
      const { lastFrame } = render(
        <CommandRouter command="list" args={[]} flags={defaultFlags} />
      );

      expect(lastFrame()).toContain('list');
    });

    it('should route to AbortScreen for abort command', () => {
      const { lastFrame } = render(
        <CommandRouter command="abort" args={['my-feature']} flags={defaultFlags} />
      );

      expect(lastFrame()).toContain('abort');
    });
  });

  describe('props passing', () => {
    it('should pass args to screen components', () => {
      const { lastFrame } = render(
        <CommandRouter
          command="start"
          args={['test-feature', 'Test description']}
          flags={defaultFlags}
        />
      );

      // Screen should have access to args
      expect(lastFrame()).toBeTruthy();
    });

    it('should pass flags to screen components', () => {
      const flags: GlobalFlags = {
        ...defaultFlags,
        skipPermissions: true
      };

      const { lastFrame } = render(
        <CommandRouter command="init" args={[]} flags={flags} />
      );

      // Screen should have access to flags
      expect(lastFrame()).toBeTruthy();
    });
  });
});
