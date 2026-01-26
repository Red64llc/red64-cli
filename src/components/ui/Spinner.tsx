/**
 * Spinner component wrapper
 * Requirements: 6.2
 */

import React from 'react';
import { Spinner as InkSpinner } from '@inkjs/ui';

/**
 * Props for Spinner component
 */
interface SpinnerProps {
  readonly label?: string;
}

/**
 * Loading indicator using @inkjs/ui Spinner
 * Requirements: 6.2 - Display spinners during async operations
 */
export const Spinner: React.FC<SpinnerProps> = ({ label }) => {
  return <InkSpinner label={label} />;
};
