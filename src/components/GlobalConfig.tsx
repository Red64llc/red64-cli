/**
 * Global configuration context for red64 CLI
 * Requirements: 3.3
 */

import React, { createContext, useContext, type ReactNode } from 'react';
import type { CLIConfig } from '../types/index.js';

/**
 * Context for sharing CLI configuration throughout component tree
 */
const GlobalConfigContext = createContext<CLIConfig | null>(null);

/**
 * Props for GlobalConfigProvider
 */
interface GlobalConfigProviderProps {
  readonly config: CLIConfig;
  readonly children: ReactNode;
}

/**
 * Provider component for global CLI configuration
 * Requirements: 3.3 - Provide GlobalConfig context for sharing CLI configuration
 */
export const GlobalConfigProvider: React.FC<GlobalConfigProviderProps> = ({
  config,
  children
}) => {
  return (
    <GlobalConfigContext.Provider value={config}>
      {children}
    </GlobalConfigContext.Provider>
  );
};

/**
 * Hook for accessing global CLI configuration
 * Requirements: 3.3 - useGlobalConfig hook for accessing flags throughout component tree
 * @throws Error if used outside of GlobalConfigProvider
 */
export function useGlobalConfig(): CLIConfig {
  const context = useContext(GlobalConfigContext);

  if (context === null) {
    throw new Error('useGlobalConfig must be used within a GlobalConfigProvider');
  }

  return context;
}
