import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { App } from '../../src/components/App.js';
import { useGlobalConfig } from '../../src/components/GlobalConfig.js';
import type { CLIConfig } from '../../src/types/index.js';

const defaultConfig: CLIConfig = {
  command: 'help',
  args: [],
  flags: {
    skipPermissions: false,
    brownfield: false,
    greenfield: true,
    tier: undefined,
    help: false,
    version: false
  }
};

// Test component that accesses global config
const ConfigReader = () => {
  const config = useGlobalConfig();
  return <Text>config-command:{config.command ?? 'none'}</Text>;
};

// Component that throws an error
const ThrowingComponent = () => {
  throw new Error('Test error');
};

describe('App', () => {
  it('should render children', () => {
    const { lastFrame } = render(
      <App config={defaultConfig}>
        <Text>Hello from child</Text>
      </App>
    );

    expect(lastFrame()).toContain('Hello from child');
  });

  it('should provide global config context to children', () => {
    const { lastFrame } = render(
      <App config={defaultConfig}>
        <ConfigReader />
      </App>
    );

    expect(lastFrame()).toContain('config-command:help');
  });

  it('should catch and display errors from children', () => {
    const { lastFrame } = render(
      <App config={defaultConfig}>
        <ThrowingComponent />
      </App>
    );

    // Should display error message instead of crashing
    expect(lastFrame()).toContain('Error');
    expect(lastFrame()).toContain('Test error');
  });

  it('should pass different commands through context', () => {
    const config: CLIConfig = {
      ...defaultConfig,
      command: 'start',
      args: ['my-feature', 'Description']
    };

    const { lastFrame } = render(
      <App config={config}>
        <ConfigReader />
      </App>
    );

    expect(lastFrame()).toContain('config-command:start');
  });
});
