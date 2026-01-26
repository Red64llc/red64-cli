import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { InitScreen } from '../../../src/components/screens/InitScreen.js';
import type { ScreenProps } from '../../../src/components/screens/ScreenProps.js';

describe('InitScreen', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'red64-init-screen-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  const createProps = (overrides: Partial<ScreenProps> = {}): ScreenProps => ({
    args: [],
    flags: {
      help: false,
      verbose: false,
      skipPermissions: false,
      yes: false,
      ...overrides.flags
    },
    ...overrides
  });

  describe('basic rendering', () => {
    it('should render init command title', () => {
      const props = createProps();
      const { lastFrame } = render(<InitScreen {...props} />);

      expect(lastFrame()).toContain('init');
    });

    it('should show welcome message', () => {
      const props = createProps();
      const { lastFrame } = render(<InitScreen {...props} />);

      expect(lastFrame()).toContain('Welcome to red64 init');
    });
  });

  describe('flags handling', () => {
    it('should handle skipPermissions flag', () => {
      const props = createProps({
        flags: {
          help: false,
          verbose: false,
          skipPermissions: true,
          yes: false
        }
      });

      const { lastFrame } = render(<InitScreen {...props} />);

      // Should render without error
      expect(lastFrame()).toBeTruthy();
    });
  });

  describe('initialization flow', () => {
    it('should accept --stack flag for direct stack selection', () => {
      const props = createProps({
        flags: {
          help: false,
          verbose: false,
          skipPermissions: false,
          yes: false,
          stack: 'react'
        }
      });

      const { lastFrame } = render(<InitScreen {...props} />);

      // Should render without error
      expect(lastFrame()).toBeTruthy();
    });

    it('should accept --skip-guided flag', () => {
      const props = createProps({
        flags: {
          help: false,
          verbose: false,
          skipPermissions: false,
          yes: false,
          'skip-guided': true
        }
      });

      const { lastFrame } = render(<InitScreen {...props} />);

      expect(lastFrame()).toBeTruthy();
    });
  });
});
