/**
 * Token Usage Parser Service
 * Parses stdout from Claude CLI (and other agents) to extract token usage information
 */

import type { TokenUsage } from '../types/index.js';

/**
 * Token usage parser service interface
 */
export interface TokenUsageParserService {
  /**
   * Parse stdout to extract token usage
   * @returns TokenUsage if found, undefined otherwise
   */
  parse(stdout: string): TokenUsage | undefined;
}

/**
 * Patterns for extracting token usage from CLI output
 * Claude CLI outputs usage in various formats depending on the version and output mode
 */
const TOKEN_PATTERNS = {
  // JSON format: {"input_tokens": 1234, "output_tokens": 567, ...}
  json: /\{[^{}]*"input_tokens"\s*:\s*(\d+)[^{}]*"output_tokens"\s*:\s*(\d+)[^{}]*\}/i,

  // Claude CLI summary line format: "Total: 1234 input tokens, 567 output tokens"
  summary: /total[:\s]+(\d+)\s*input\s*tokens?\s*,?\s*(\d+)\s*output\s*tokens?/i,

  // Alternative format: "Tokens: 1234 in / 567 out"
  shorthand: /tokens[:\s]+(\d+)\s*in\s*[/,]\s*(\d+)\s*out/i,

  // Usage format: "Usage: 1234 input, 567 output"
  usage: /usage[:\s]+(\d+)\s*input\s*,?\s*(\d+)\s*output/i,

  // Cost format with tokens: "Cost: $0.01 (1234 input, 567 output tokens)"
  cost: /\((\d+)\s*input\s*,?\s*(\d+)\s*output\s*tokens?\)/i,

  // Model info pattern (often appears with usage)
  model: /model[:\s]+([a-zA-Z0-9._-]+)/i,

  // Cache tokens patterns
  cacheRead: /cache[_\s]?read[_\s]?tokens?\s*[:\s]+(\d+)/i,
  cacheCreation: /cache[_\s]?creation[_\s]?tokens?\s*[:\s]+(\d+)/i,

  // JSON fields for cache (in case of JSON output)
  jsonCacheRead: /"cache_read_input_tokens"\s*:\s*(\d+)/i,
  jsonCacheCreation: /"cache_creation_input_tokens"\s*:\s*(\d+)/i,
  jsonModel: /"model"\s*:\s*"([^"]+)"/i,
};

/**
 * Create token usage parser service
 */
export function createTokenUsageParser(): TokenUsageParserService {
  return {
    parse(stdout: string): TokenUsage | undefined {
      if (!stdout || stdout.trim().length === 0) {
        return undefined;
      }

      let inputTokens: number | undefined;
      let outputTokens: number | undefined;
      let model: string | undefined;
      let cacheReadTokens: number | undefined;
      let cacheCreationTokens: number | undefined;

      // Try JSON format first (most structured)
      const jsonMatch = stdout.match(TOKEN_PATTERNS.json);
      if (jsonMatch) {
        inputTokens = parseInt(jsonMatch[1], 10);
        outputTokens = parseInt(jsonMatch[2], 10);
      }

      // Try other patterns if JSON didn't match
      if (inputTokens === undefined || outputTokens === undefined) {
        const patterns = [
          TOKEN_PATTERNS.summary,
          TOKEN_PATTERNS.shorthand,
          TOKEN_PATTERNS.usage,
          TOKEN_PATTERNS.cost,
        ];

        for (const pattern of patterns) {
          const match = stdout.match(pattern);
          if (match) {
            inputTokens = parseInt(match[1], 10);
            outputTokens = parseInt(match[2], 10);
            break;
          }
        }
      }

      // If we couldn't extract tokens, return undefined
      if (inputTokens === undefined || outputTokens === undefined) {
        return undefined;
      }

      // Extract model info
      const jsonModelMatch = stdout.match(TOKEN_PATTERNS.jsonModel);
      if (jsonModelMatch) {
        model = jsonModelMatch[1];
      } else {
        const modelMatch = stdout.match(TOKEN_PATTERNS.model);
        if (modelMatch) {
          model = modelMatch[1];
        }
      }

      // Extract cache tokens
      const jsonCacheReadMatch = stdout.match(TOKEN_PATTERNS.jsonCacheRead);
      if (jsonCacheReadMatch) {
        cacheReadTokens = parseInt(jsonCacheReadMatch[1], 10);
      } else {
        const cacheReadMatch = stdout.match(TOKEN_PATTERNS.cacheRead);
        if (cacheReadMatch) {
          cacheReadTokens = parseInt(cacheReadMatch[1], 10);
        }
      }

      const jsonCacheCreationMatch = stdout.match(TOKEN_PATTERNS.jsonCacheCreation);
      if (jsonCacheCreationMatch) {
        cacheCreationTokens = parseInt(jsonCacheCreationMatch[1], 10);
      } else {
        const cacheCreationMatch = stdout.match(TOKEN_PATTERNS.cacheCreation);
        if (cacheCreationMatch) {
          cacheCreationTokens = parseInt(cacheCreationMatch[1], 10);
        }
      }

      const result: TokenUsage = {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        ...(model && { model }),
        ...(cacheReadTokens !== undefined && { cacheReadTokens }),
        ...(cacheCreationTokens !== undefined && { cacheCreationTokens }),
      };

      return result;
    }
  };
}
