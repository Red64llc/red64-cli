/**
 * Model Configuration Service
 * Provides context window sizes and configuration for different Claude models
 * Used for smart context management and utilization tracking
 */

/**
 * Configuration for a model's context capabilities
 */
export interface ModelContextConfig {
  readonly contextWindow: number;      // Total context window size in tokens
  readonly modelFamily: string;        // Human-readable family name (e.g., "opus-4.6")
  readonly premiumThreshold?: number;  // Above this, premium pricing applies (2x input, 1.5x output)
}

/**
 * Model context configurations
 * Based on Anthropic documentation for context window sizes
 * See: https://platform.claude.com/docs/en/build-with-claude/context-windows
 */
export const MODEL_CONTEXT_CONFIGS: Record<string, ModelContextConfig> = {
  // 1M context window models (beta)
  'claude-opus-4-6': {
    contextWindow: 1_000_000,
    modelFamily: 'opus-4.6',
    premiumThreshold: 200_000,
  },
  'claude-sonnet-4-5-20250929': {
    contextWindow: 1_000_000,
    modelFamily: 'sonnet-4.5',
    premiumThreshold: 200_000,
  },
  'claude-sonnet-4-20250514': {
    contextWindow: 1_000_000,
    modelFamily: 'sonnet-4',
    premiumThreshold: 200_000,
  },

  // 200K context window models (standard)
  'claude-opus-4-5-20251101': {
    contextWindow: 200_000,
    modelFamily: 'opus-4.5',
  },
  'claude-opus-4-20250514': {
    contextWindow: 200_000,
    modelFamily: 'opus-4',
  },
  'claude-3-5-sonnet-latest': {
    contextWindow: 200_000,
    modelFamily: 'sonnet-3.5',
  },
  'claude-3-5-haiku-latest': {
    contextWindow: 200_000,
    modelFamily: 'haiku-3.5',
  },
  'claude-haiku-4-5-20251001': {
    contextWindow: 200_000,
    modelFamily: 'haiku-4.5',
  },

  // Default fallback for unknown models
  'default': {
    contextWindow: 200_000,
    modelFamily: 'unknown',
  },
};

/**
 * Get model configuration by model name
 * Falls back to default if model is unknown
 *
 * @param model - Model name/ID (e.g., "claude-opus-4-6")
 * @returns Model context configuration
 */
export function getModelConfig(model?: string): ModelContextConfig {
  if (!model) {
    return MODEL_CONTEXT_CONFIGS['default'];
  }

  // Try exact match first
  if (MODEL_CONTEXT_CONFIGS[model]) {
    return MODEL_CONTEXT_CONFIGS[model];
  }

  // Try prefix matching for model variants
  for (const [key, config] of Object.entries(MODEL_CONTEXT_CONFIGS)) {
    if (key !== 'default' && model.startsWith(key.split('-').slice(0, 3).join('-'))) {
      return config;
    }
  }

  return MODEL_CONTEXT_CONFIGS['default'];
}

/**
 * Check if a model supports 1M context window
 *
 * @param model - Model name/ID
 * @returns true if model supports 1M context
 */
export function supports1MContext(model?: string): boolean {
  const config = getModelConfig(model);
  return config.contextWindow >= 1_000_000;
}

/**
 * Check if token count is in premium pricing range
 *
 * @param model - Model name/ID
 * @param inputTokens - Number of input tokens
 * @returns true if tokens exceed premium threshold
 */
export function isInPremiumRange(model: string | undefined, inputTokens: number): boolean {
  const config = getModelConfig(model);
  return config.premiumThreshold !== undefined && inputTokens > config.premiumThreshold;
}
