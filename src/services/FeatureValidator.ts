/**
 * Feature Validator Service
 * Task 1.1: Create feature name validator service
 * Requirements: 1.1, 1.2
 */

/**
 * Validation result interface
 * Requirements: 1.1 - Return structured validation result
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly error: string | undefined;
}

/**
 * Feature validator service interface
 * Requirements: 1.1, 1.2
 */
export interface FeatureValidatorService {
  validate(featureName: string): ValidationResult;
}

/**
 * Feature name validation pattern
 * - Must start with lowercase letter
 * - Can contain lowercase letters, numbers, and hyphens
 * - Cannot end with hyphen
 * - Cannot have consecutive hyphens
 */
const FEATURE_NAME_PATTERN = /^[a-z]([a-z0-9]|-(?=[a-z0-9]))*$/;

/**
 * Create feature validator service
 * Requirements: 1.1, 1.2 - Factory function for feature name validation
 */
export function createFeatureValidator(): FeatureValidatorService {
  return {
    /**
     * Validate feature name format
     * Requirements: 1.1 - Validate that feature name starts with lowercase letter
     *                     and contains only lowercase letters, numbers, and hyphens
     * Requirements: 1.2 - Return error message with format examples when invalid
     */
    validate(featureName: string): ValidationResult {
      // Check empty string
      if (!featureName || featureName.length === 0) {
        return {
          valid: false,
          error: 'Feature name cannot be empty. Use lowercase letters, numbers, and hyphens (e.g., "my-feature", "auth2").'
        };
      }

      // Check pattern
      if (!FEATURE_NAME_PATTERN.test(featureName)) {
        return {
          valid: false,
          error: 'Feature name must start with a lowercase letter and contain only lowercase letters, numbers, and hyphens (e.g., "my-feature", "auth2").'
        };
      }

      return {
        valid: true,
        error: undefined
      };
    }
  };
}
