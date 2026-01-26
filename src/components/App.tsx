/**
 * Root App component for red64 CLI
 * Requirements: 3.3
 */

import React, { Component, type ReactNode } from 'react';
import { Box, Text } from 'ink';
import { GlobalConfigProvider } from './GlobalConfig.js';
import type { CLIConfig } from '../types/index.js';

/**
 * Error boundary state
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary props
 */
interface ErrorBoundaryProps {
  children: ReactNode;
}

/**
 * Error boundary component to catch and display component errors gracefully
 * Requirements: 3.3 - Wrap children in error boundary
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <Box flexDirection="column" padding={1}>
          <Text color="red" bold>
            Error: {this.state.error.message}
          </Text>
          <Text dimColor>
            An unexpected error occurred. Please try again or report this issue.
          </Text>
        </Box>
      );
    }

    return this.props.children;
  }
}

/**
 * App component props
 */
interface AppProps {
  readonly config: CLIConfig;
  readonly children: ReactNode;
}

/**
 * Root application component
 * Requirements: 3.3 - Root React component providing global context and error boundary
 */
export const App: React.FC<AppProps> = ({ config, children }) => {
  return (
    <GlobalConfigProvider config={config}>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </GlobalConfigProvider>
  );
};
