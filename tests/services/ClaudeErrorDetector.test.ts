/**
 * Claude Error Detector Tests
 */

import { describe, it, expect } from 'vitest';
import { createClaudeErrorDetector } from '../../src/services/ClaudeErrorDetector.js';

describe('ClaudeErrorDetector', () => {
  const detector = createClaudeErrorDetector();

  describe('detect', () => {
    describe('credit errors', () => {
      it('should detect "Credit balance is too low" in stdout', () => {
        const error = detector.detect('Credit balance is too low', '');
        expect(error).not.toBeNull();
        expect(error?.code).toBe('CREDIT_EXHAUSTED');
        expect(error?.recoverable).toBe(false);
      });

      it('should detect credit errors case-insensitively', () => {
        const error = detector.detect('CREDIT BALANCE IS TOO LOW', '');
        expect(error?.code).toBe('CREDIT_EXHAUSTED');
      });

      it('should detect "insufficient credits"', () => {
        const error = detector.detect('Error: insufficient credits', '');
        expect(error?.code).toBe('CREDIT_EXHAUSTED');
      });
    });

    describe('rate limiting', () => {
      it('should detect rate limit exceeded', () => {
        const error = detector.detect('', 'Rate limit exceeded');
        expect(error?.code).toBe('RATE_LIMITED');
        expect(error?.recoverable).toBe(true);
      });

      it('should detect "too many requests"', () => {
        const error = detector.detect('Error: Too many requests', '');
        expect(error?.code).toBe('RATE_LIMITED');
      });
    });

    describe('authentication errors', () => {
      it('should detect invalid API key', () => {
        const error = detector.detect('', 'Invalid API key');
        expect(error?.code).toBe('AUTH_FAILED');
        expect(error?.recoverable).toBe(false);
      });

      it('should detect unauthorized', () => {
        const error = detector.detect('Error: unauthorized', '');
        expect(error?.code).toBe('AUTH_FAILED');
      });

      it('should detect missing API key', () => {
        const error = detector.detect('API key is missing', '');
        expect(error?.code).toBe('AUTH_FAILED');
      });
    });

    describe('model availability', () => {
      it('should detect model unavailable', () => {
        const error = detector.detect('Model is not available', '');
        expect(error?.code).toBe('MODEL_UNAVAILABLE');
        expect(error?.recoverable).toBe(true);
      });

      it('should detect service overloaded', () => {
        const error = detector.detect('Service is temporarily overloaded', '');
        expect(error?.code).toBe('MODEL_UNAVAILABLE');
      });

      it('should detect 503 errors', () => {
        const error = detector.detect('Error 503: Service Unavailable', '');
        expect(error?.code).toBe('MODEL_UNAVAILABLE');
      });
    });

    describe('context errors', () => {
      it('should detect context length exceeded', () => {
        const error = detector.detect('Context length exceeded', '');
        expect(error?.code).toBe('CONTEXT_EXCEEDED');
        expect(error?.recoverable).toBe(false);
      });

      it('should detect maximum tokens exceeded', () => {
        const error = detector.detect('Maximum tokens exceeded for this model', '');
        expect(error?.code).toBe('CONTEXT_EXCEEDED');
      });
    });

    describe('network errors', () => {
      it('should detect network error', () => {
        const error = detector.detect('', 'Network error occurred');
        expect(error?.code).toBe('NETWORK_ERROR');
        expect(error?.recoverable).toBe(true);
      });

      it('should detect connection refused', () => {
        const error = detector.detect('', 'Connection refused');
        expect(error?.code).toBe('NETWORK_ERROR');
      });

      it('should detect ECONNREFUSED', () => {
        const error = detector.detect('', 'Error: ECONNREFUSED');
        expect(error?.code).toBe('NETWORK_ERROR');
      });
    });

    describe('no error', () => {
      it('should return null for normal output', () => {
        const error = detector.detect('Task completed successfully', '');
        expect(error).toBeNull();
      });

      it('should return null for empty strings', () => {
        const error = detector.detect('', '');
        expect(error).toBeNull();
      });
    });
  });

  describe('isFatal', () => {
    it('should return true for non-recoverable errors', () => {
      const error = detector.detect('Credit balance is too low', '')!;
      expect(detector.isFatal(error)).toBe(true);
    });

    it('should return false for recoverable errors', () => {
      const error = detector.detect('Rate limit exceeded', '')!;
      expect(detector.isFatal(error)).toBe(false);
    });
  });

  describe('shouldRetry', () => {
    it('should return true for recoverable errors', () => {
      const error = detector.detect('Rate limit exceeded', '')!;
      expect(detector.shouldRetry(error)).toBe(true);
    });

    it('should return false for fatal errors', () => {
      const error = detector.detect('Invalid API key', '')!;
      expect(detector.shouldRetry(error)).toBe(false);
    });
  });

  describe('formatErrorMessage', () => {
    it('should format credit exhausted error', () => {
      const error = detector.detect('Credit balance is too low', '')!;
      const message = detector.formatErrorMessage(error);
      expect(message).toContain('Insufficient Credits');
      expect(message).toContain('console.anthropic.com');
    });

    it('should format rate limited error', () => {
      const error = detector.detect('Rate limit exceeded', '')!;
      const message = detector.formatErrorMessage(error);
      expect(message).toContain('Rate Limited');
    });
  });
});
