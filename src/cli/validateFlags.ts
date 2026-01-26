/**
 * Flag validation for red64 CLI
 * Requirements: 5.1-5.5
 */

import type { GlobalFlags } from '../types/index.js';

/**
 * Validation error type
 */
export type FlagValidationError = string;

/**
 * Validation result
 */
export interface FlagValidationResult {
  readonly valid: boolean;
  readonly errors: readonly FlagValidationError[];
}

/**
 * Validate CLI flags and return validation result
 * Requirements: 5.4, 5.5
 */
export function validateFlags(flags: GlobalFlags): FlagValidationResult {
  const errors: FlagValidationError[] = [];

  // Validate tier has a value when provided (not empty string)
  if (flags.tier === '') {
    errors.push('Error: --tier requires a value');
  }

  // Validate brownfield and greenfield are mutually exclusive
  if (flags.brownfield && flags.greenfield) {
    errors.push('Error: --brownfield and --greenfield are mutually exclusive');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
