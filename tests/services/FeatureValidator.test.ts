/**
 * Feature Validator Service Tests
 * Task 1.1: Create feature name validator service
 * Requirements: 1.1, 1.2
 */

import { describe, it, expect } from 'vitest';
import {
  createFeatureValidator,
  type FeatureValidatorService,
  type ValidationResult
} from '../../src/services/FeatureValidator.js';

describe('FeatureValidator', () => {
  let validator: FeatureValidatorService;

  beforeEach(() => {
    validator = createFeatureValidator();
  });

  describe('valid feature names', () => {
    it('should accept lowercase letters only', () => {
      const result = validator.validate('myfeature');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept lowercase letters with numbers', () => {
      const result = validator.validate('feature2');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept lowercase letters with hyphens', () => {
      const result = validator.validate('my-feature');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept complex valid names', () => {
      const result = validator.validate('my-feature-2-test');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept single letter', () => {
      const result = validator.validate('a');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept letter followed by number', () => {
      const result = validator.validate('a1');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('invalid feature names', () => {
    it('should reject names starting with a number', () => {
      const result = validator.validate('2feature');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject names starting with a hyphen', () => {
      const result = validator.validate('-feature');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject names with uppercase letters', () => {
      const result = validator.validate('MyFeature');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject names with underscores', () => {
      const result = validator.validate('my_feature');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject names with spaces', () => {
      const result = validator.validate('my feature');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject names with special characters', () => {
      const result = validator.validate('my@feature');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject empty string', () => {
      const result = validator.validate('');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject names ending with hyphen', () => {
      const result = validator.validate('feature-');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject names with consecutive hyphens', () => {
      const result = validator.validate('my--feature');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('error messages', () => {
    it('should provide format examples in error message', () => {
      const result = validator.validate('Invalid_Name');
      expect(result.error).toContain('my-feature');
    });

    it('should explain the naming rules', () => {
      const result = validator.validate('123');
      expect(result.error).toContain('lowercase');
    });
  });
});
