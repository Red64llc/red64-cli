/**
 * ErrorBoundary Component
 * Task 2.5: Create error boundary wrapper component
 * Requirements: 5.5
 */

import React, { Component, type ReactNode } from 'react';
import { Box, Text } from 'ink';

/**
 * Props for ErrorBoundary component
 */
export interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly onError?: (error: Error) => void;
}

/**
 * State for ErrorBoundary
 */
interface ErrorBoundaryState {
  readonly error: Error | null;
}

/**
 * ErrorBoundary Component
 * Catches unhandled errors in Ink components and displays gracefully
 * Requirements: 5.5 - Error boundaries to prevent crash propagation
 *
 * Following Ink steering pattern from .kiro/steering/ink.md
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, _errorInfo: React.ErrorInfo): void {
    // Call onError callback if provided
    if (this.props.onError) {
      this.props.onError(error);
    }
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <Box flexDirection="column" paddingY={1}>
          {/* Error header */}
          <Box>
            <Text color="red" bold>Error: An unexpected error occurred</Text>
          </Box>

          {/* Error message */}
          <Box marginTop={1}>
            <Text color="red">{this.state.error.message || 'Unknown error'}</Text>
          </Box>

          {/* Exit prompt */}
          <Box marginTop={1}>
            <Text dimColor>Press Ctrl+C to exit</Text>
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }
}
