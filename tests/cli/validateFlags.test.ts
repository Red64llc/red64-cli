import { describe, it, expect } from 'vitest';
import { validateFlags, FlagValidationError } from '../../src/cli/validateFlags.js';
import type { GlobalFlags } from '../../src/types/index.js';

describe('validateFlags', () => {
  const defaultFlags: GlobalFlags = {
    skipPermissions: false,
    brownfield: false,
    greenfield: true,
    tier: undefined,
    help: false,
    version: false
  };

  describe('tier validation', () => {
    it('should pass when tier is undefined', () => {
      const result = validateFlags(defaultFlags);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should pass when tier has a value', () => {
      const flags: GlobalFlags = {
        ...defaultFlags,
        tier: 'custom-tier'
      };
      const result = validateFlags(flags);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should fail when tier is empty string', () => {
      const flags: GlobalFlags = {
        ...defaultFlags,
        tier: ''
      };
      const result = validateFlags(flags);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Error: --tier requires a value');
    });
  });

  describe('mode validation', () => {
    it('should pass when greenfield is true and brownfield is false', () => {
      const flags: GlobalFlags = {
        ...defaultFlags,
        greenfield: true,
        brownfield: false
      };
      const result = validateFlags(flags);
      expect(result.valid).toBe(true);
    });

    it('should pass when brownfield is true and greenfield is false', () => {
      const flags: GlobalFlags = {
        ...defaultFlags,
        greenfield: false,
        brownfield: true
      };
      const result = validateFlags(flags);
      expect(result.valid).toBe(true);
    });

    it('should fail when both brownfield and greenfield are true', () => {
      const flags: GlobalFlags = {
        ...defaultFlags,
        greenfield: true,
        brownfield: true
      };
      const result = validateFlags(flags);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Error: --brownfield and --greenfield are mutually exclusive');
    });
  });

  describe('skip-permissions flag', () => {
    it('should pass with skip-permissions true', () => {
      const flags: GlobalFlags = {
        ...defaultFlags,
        skipPermissions: true
      };
      const result = validateFlags(flags);
      expect(result.valid).toBe(true);
    });

    it('should pass with skip-permissions false', () => {
      const flags: GlobalFlags = {
        ...defaultFlags,
        skipPermissions: false
      };
      const result = validateFlags(flags);
      expect(result.valid).toBe(true);
    });
  });

  describe('combined flags', () => {
    it('should pass with all valid flags', () => {
      const flags: GlobalFlags = {
        skipPermissions: true,
        brownfield: true,
        greenfield: false,
        tier: 'premium',
        help: false,
        version: false
      };
      const result = validateFlags(flags);
      expect(result.valid).toBe(true);
    });

    it('should return multiple errors when multiple validations fail', () => {
      const flags: GlobalFlags = {
        skipPermissions: false,
        brownfield: true,
        greenfield: true, // Conflict
        tier: '', // Empty tier
        help: false,
        version: false
      };
      const result = validateFlags(flags);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });
});
