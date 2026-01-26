/**
 * Common props interface for screen components
 */

import type { GlobalFlags } from '../../types/index.js';

/**
 * Props passed to all screen components
 */
export interface ScreenProps {
  readonly args: readonly string[];
  readonly flags: GlobalFlags;
}
