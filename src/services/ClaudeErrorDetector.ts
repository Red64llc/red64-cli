/**
 * Claude CLI Error Detection Service
 * Parses stdout/stderr from Claude CLI to identify specific error conditions
 */

/**
 * Error codes for Claude CLI-specific failures
 */
export type ClaudeErrorCode =
  | 'CREDIT_EXHAUSTED'     // Account has no credits
  | 'RATE_LIMITED'         // Rate limit exceeded
  | 'AUTH_FAILED'          // Invalid API key or authentication error
  | 'CLI_NOT_FOUND'        // Agent CLI binary not found on PATH
  | 'MODEL_UNAVAILABLE'    // Model not available or overloaded
  | 'CONTEXT_EXCEEDED'     // Context length exceeded
  | 'NETWORK_ERROR'        // Network connectivity issues
  | 'PERMISSION_DENIED'    // Permission/safety refusal
  | 'UNKNOWN';             // Unclassified error

/**
 * Parsed Claude error with actionable information
 */
export interface ClaudeError {
  readonly code: ClaudeErrorCode;
  readonly message: string;
  readonly recoverable: boolean;
  readonly suggestion: string;
  readonly retryAfterMs?: number;  // For rate limiting
}

/**
 * Error detection patterns
 * Order matters: more specific patterns should come first
 */
const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  code: ClaudeErrorCode;
  recoverable: boolean;
  suggestion: string;
  extractRetryAfter?: (match: RegExpMatchArray) => number | undefined;
}> = [
  // Credit/billing errors
  {
    pattern: /credit balance is too low/i,
    code: 'CREDIT_EXHAUSTED',
    recoverable: false,
    suggestion: 'Add credits at https://console.anthropic.com/settings/billing'
  },
  {
    pattern: /insufficient credits/i,
    code: 'CREDIT_EXHAUSTED',
    recoverable: false,
    suggestion: 'Add credits at https://console.anthropic.com/settings/billing'
  },
  {
    pattern: /billing.*(?:issue|error|problem)/i,
    code: 'CREDIT_EXHAUSTED',
    recoverable: false,
    suggestion: 'Check your billing status at https://console.anthropic.com/settings/billing'
  },

  // Rate limiting
  {
    pattern: /rate limit exceeded/i,
    code: 'RATE_LIMITED',
    recoverable: true,
    suggestion: 'Wait a moment and retry, or reduce concurrent requests'
  },
  {
    pattern: /too many requests/i,
    code: 'RATE_LIMITED',
    recoverable: true,
    suggestion: 'Wait a moment and retry'
  },
  {
    pattern: /retry.after.*?(\d+)/i,
    code: 'RATE_LIMITED',
    recoverable: true,
    suggestion: 'Waiting for rate limit to reset...',
    extractRetryAfter: (match) => {
      const seconds = parseInt(match[1], 10);
      return isNaN(seconds) ? undefined : seconds * 1000;
    }
  },

  // Authentication errors
  {
    pattern: /invalid.*api.?key/i,
    code: 'AUTH_FAILED',
    recoverable: false,
    suggestion: 'Check your ANTHROPIC_API_KEY environment variable or Claude config'
  },
  {
    pattern: /authentication.*(?:failed|error|invalid)/i,
    code: 'AUTH_FAILED',
    recoverable: false,
    suggestion: 'Verify your API key is correct and active'
  },
  {
    pattern: /unauthorized/i,
    code: 'AUTH_FAILED',
    recoverable: false,
    suggestion: 'Your API key may be invalid or revoked'
  },
  {
    pattern: /api.?key.*(?:missing|not found|required)/i,
    code: 'AUTH_FAILED',
    recoverable: false,
    suggestion: 'Set ANTHROPIC_API_KEY environment variable or configure Claude CLI'
  },

  // Model availability
  {
    pattern: /model.*(?:not available|unavailable|overloaded)/i,
    code: 'MODEL_UNAVAILABLE',
    recoverable: true,
    suggestion: 'The model is temporarily unavailable. Try again in a few minutes.'
  },
  {
    pattern: /service.*(?:unavailable|overloaded)/i,
    code: 'MODEL_UNAVAILABLE',
    recoverable: true,
    suggestion: 'Anthropic API is temporarily overloaded. Try again shortly.'
  },
  {
    pattern: /503|504|502/,
    code: 'MODEL_UNAVAILABLE',
    recoverable: true,
    suggestion: 'Service temporarily unavailable. Will retry automatically.'
  },

  // Context length
  {
    pattern: /context.*(?:length|limit).*exceeded/i,
    code: 'CONTEXT_EXCEEDED',
    recoverable: false,
    suggestion: 'Reduce prompt size or split into smaller tasks'
  },
  {
    pattern: /maximum.*tokens.*exceeded/i,
    code: 'CONTEXT_EXCEEDED',
    recoverable: false,
    suggestion: 'The request is too large. Try breaking it into smaller parts.'
  },
  {
    pattern: /prompt.*too.*(?:long|large)/i,
    code: 'CONTEXT_EXCEEDED',
    recoverable: false,
    suggestion: 'Reduce the size of your prompt or context'
  },

  // Network errors
  {
    pattern: /network.*(?:error|failed|unavailable)/i,
    code: 'NETWORK_ERROR',
    recoverable: true,
    suggestion: 'Check your internet connection and try again'
  },
  {
    pattern: /connection.*(?:refused|reset|timed out)/i,
    code: 'NETWORK_ERROR',
    recoverable: true,
    suggestion: 'Network connection failed. Check your connection and retry.'
  },
  {
    pattern: /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET/i,
    code: 'NETWORK_ERROR',
    recoverable: true,
    suggestion: 'Network error. Verify internet connectivity.'
  },
  {
    pattern: /fetch.*failed/i,
    code: 'NETWORK_ERROR',
    recoverable: true,
    suggestion: 'Network request failed. Check your connection.'
  },

  // Permission/safety
  {
    pattern: /(?:content|request).*(?:blocked|refused|rejected)/i,
    code: 'PERMISSION_DENIED',
    recoverable: false,
    suggestion: 'The request was blocked by safety filters'
  },
  {
    pattern: /safety.*(?:filter|check)/i,
    code: 'PERMISSION_DENIED',
    recoverable: false,
    suggestion: 'Content was flagged by safety systems'
  }
];

/**
 * Claude Error Detector Service
 */
export interface ClaudeErrorDetectorService {
  /**
   * Parse stdout and stderr to detect Claude-specific errors
   * @returns ClaudeError if a known error pattern is detected, null otherwise
   */
  detect(stdout: string, stderr: string): ClaudeError | null;

  /**
   * Check if error is fatal (non-recoverable)
   */
  isFatal(error: ClaudeError): boolean;

  /**
   * Check if error warrants automatic retry
   */
  shouldRetry(error: ClaudeError): boolean;

  /**
   * Get user-friendly error message
   */
  formatErrorMessage(error: ClaudeError): string;
}

/**
 * Create Claude error detector service
 */
export function createClaudeErrorDetector(): ClaudeErrorDetectorService {
  return {
    detect(stdout: string, stderr: string): ClaudeError | null {
      // Combine stdout and stderr for pattern matching
      // Claude CLI sometimes outputs errors to stdout
      const combined = `${stdout}\n${stderr}`;

      for (const errorDef of ERROR_PATTERNS) {
        const match = combined.match(errorDef.pattern);
        if (match) {
          // Extract the matched text for the error message
          const matchedText = match[0];
          const retryAfterMs = errorDef.extractRetryAfter?.(match);

          return {
            code: errorDef.code,
            message: matchedText,
            recoverable: errorDef.recoverable,
            suggestion: errorDef.suggestion,
            retryAfterMs
          };
        }
      }

      return null;
    },

    isFatal(error: ClaudeError): boolean {
      return !error.recoverable;
    },

    shouldRetry(error: ClaudeError): boolean {
      // Recoverable errors can be retried
      // Rate limits should wait for retryAfterMs first
      return error.recoverable;
    },

    formatErrorMessage(error: ClaudeError): string {
      const codeLabel = ERROR_CODE_LABELS[error.code] ?? error.code;
      return `${codeLabel}: ${error.suggestion}`;
    }
  };
}

/**
 * Human-readable labels for error codes
 */
const ERROR_CODE_LABELS: Record<ClaudeErrorCode, string> = {
  CREDIT_EXHAUSTED: 'Insufficient Credits',
  RATE_LIMITED: 'Rate Limited',
  AUTH_FAILED: 'Authentication Failed',
  CLI_NOT_FOUND: 'CLI Not Found',
  MODEL_UNAVAILABLE: 'Service Unavailable',
  CONTEXT_EXCEEDED: 'Context Too Large',
  NETWORK_ERROR: 'Network Error',
  PERMISSION_DENIED: 'Request Blocked',
  UNKNOWN: 'Unknown Error'
};
