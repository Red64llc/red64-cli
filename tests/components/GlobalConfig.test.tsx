import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import {
  GlobalConfigProvider,
  useGlobalConfig
} from '../../src/components/GlobalConfig.js';
import type { CLIConfig } from '../../src/types/index.js';

// Test component that uses the context
const TestConsumer = () => {
  const config = useGlobalConfig();
  return (
    <Text>
      command:{config.command ?? 'none'} greenfield:{String(config.flags.greenfield)}
    </Text>
  );
};

describe('GlobalConfigProvider', () => {
  const defaultConfig: CLIConfig = {
    command: 'start',
    args: ['test-feature', 'Test description'],
    flags: {
      skipPermissions: false,
      brownfield: false,
      greenfield: true,
      tier: undefined,
      help: false,
      version: false
    }
  };

  it('should provide CLI config to children', () => {
    const { lastFrame } = render(
      <GlobalConfigProvider config={defaultConfig}>
        <TestConsumer />
      </GlobalConfigProvider>
    );

    expect(lastFrame()).toContain('command:start');
    expect(lastFrame()).toContain('greenfield:true');
  });

  it('should provide flags through context', () => {
    const config: CLIConfig = {
      ...defaultConfig,
      flags: {
        ...defaultConfig.flags,
        skipPermissions: true,
        brownfield: true,
        greenfield: false
      }
    };

    const FlagsConsumer = () => {
      const { flags } = useGlobalConfig();
      return (
        <Text>
          skip:{String(flags.skipPermissions)} brownfield:{String(flags.brownfield)}
        </Text>
      );
    };

    const { lastFrame } = render(
      <GlobalConfigProvider config={config}>
        <FlagsConsumer />
      </GlobalConfigProvider>
    );

    expect(lastFrame()).toContain('skip:true');
    expect(lastFrame()).toContain('brownfield:true');
  });

  it('should provide args through context', () => {
    const ArgsConsumer = () => {
      const { args } = useGlobalConfig();
      return <Text>args:{args.join(',')}</Text>;
    };

    const { lastFrame } = render(
      <GlobalConfigProvider config={defaultConfig}>
        <ArgsConsumer />
      </GlobalConfigProvider>
    );

    expect(lastFrame()).toContain('args:test-feature,Test description');
  });

  it('should provide tier through context', () => {
    const config: CLIConfig = {
      ...defaultConfig,
      flags: {
        ...defaultConfig.flags,
        tier: 'premium'
      }
    };

    const TierConsumer = () => {
      const { flags } = useGlobalConfig();
      return <Text>tier:{flags.tier ?? 'none'}</Text>;
    };

    const { lastFrame } = render(
      <GlobalConfigProvider config={config}>
        <TierConsumer />
      </GlobalConfigProvider>
    );

    expect(lastFrame()).toContain('tier:premium');
  });
});

describe('useGlobalConfig', () => {
  it('should throw error when used outside provider', () => {
    // This test verifies the hook throws when used outside context
    // We need to catch the error during render
    const ComponentWithoutProvider = () => {
      try {
        useGlobalConfig();
        return <Text>should not render</Text>;
      } catch (e) {
        return <Text>error caught</Text>;
      }
    };

    const { lastFrame } = render(<ComponentWithoutProvider />);
    expect(lastFrame()).toContain('error caught');
  });
});
