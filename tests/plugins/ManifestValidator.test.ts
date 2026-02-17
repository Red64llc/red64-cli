/**
 * Tests for Task 1.2: ManifestValidator service
 * TDD: RED phase - these tests should fail before implementation
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

// We will import the factory function once implemented
let createManifestValidator: typeof import('../../src/plugins/ManifestValidator.js').createManifestValidator;

beforeEach(async () => {
  const mod = await import('../../src/plugins/ManifestValidator.js');
  createManifestValidator = mod.createManifestValidator;
});

/**
 * Helper: creates a valid manifest object for testing
 */
function validManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'test-plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'Test Author',
    entryPoint: './dist/index.js',
    red64CliVersion: '>=0.12.0',
    extensionPoints: ['commands'],
    ...overrides,
  };
}

describe('ManifestValidator', () => {
  describe('createManifestValidator', () => {
    it('should return an object with validate, validateManifestData, and checkCompatibility methods', () => {
      const validator = createManifestValidator();
      expect(typeof validator.validate).toBe('function');
      expect(typeof validator.validateManifestData).toBe('function');
      expect(typeof validator.checkCompatibility).toBe('function');
    });
  });

  describe('validateManifestData', () => {
    it('should validate a correct minimal manifest', () => {
      const validator = createManifestValidator();
      const result = validator.validateManifestData(validManifest());

      expect(result.valid).toBe(true);
      expect(result.manifest).not.toBeNull();
      expect(result.manifest?.name).toBe('test-plugin');
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a complete manifest with all optional fields', () => {
      const validator = createManifestValidator();
      const result = validator.validateManifestData(
        validManifest({
          dependencies: [
            { name: 'other-plugin', version: '>=1.0.0' },
            { name: 'another-plugin', version: '^2.0.0' },
          ],
          configSchema: {
            apiKey: {
              type: 'string',
              description: 'API key',
              required: true,
            },
            maxRetries: {
              type: 'number',
              description: 'Max retries',
              default: 3,
            },
            verbose: {
              type: 'boolean',
              description: 'Verbose output',
              default: false,
            },
          },
        })
      );

      expect(result.valid).toBe(true);
      expect(result.manifest).not.toBeNull();
      expect(result.manifest?.dependencies).toHaveLength(2);
      expect(result.manifest?.configSchema).toBeDefined();
    });

    it('should return MISSING_FIELD error when name is missing', () => {
      const validator = createManifestValidator();
      const data = validManifest();
      delete (data as Record<string, unknown>)['name'];

      const result = validator.validateManifestData(data);

      expect(result.valid).toBe(false);
      expect(result.manifest).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
      const nameError = result.errors.find((e) => e.field === 'name');
      expect(nameError).toBeDefined();
      expect(nameError?.code).toBe('MISSING_FIELD');
    });

    it('should return MISSING_FIELD error when version is missing', () => {
      const validator = createManifestValidator();
      const data = validManifest();
      delete (data as Record<string, unknown>)['version'];

      const result = validator.validateManifestData(data);

      expect(result.valid).toBe(false);
      const versionError = result.errors.find((e) => e.field === 'version');
      expect(versionError).toBeDefined();
      expect(versionError?.code).toBe('MISSING_FIELD');
    });

    it('should return MISSING_FIELD for all required fields when data is empty object', () => {
      const validator = createManifestValidator();
      const result = validator.validateManifestData({});

      expect(result.valid).toBe(false);
      expect(result.manifest).toBeNull();
      const requiredFields = ['name', 'version', 'description', 'author', 'entryPoint', 'red64CliVersion', 'extensionPoints'];
      for (const field of requiredFields) {
        const err = result.errors.find((e) => e.field === field);
        expect(err, `Expected error for field '${field}'`).toBeDefined();
      }
    });

    it('should return INVALID_TYPE when name is not a string', () => {
      const validator = createManifestValidator();
      const result = validator.validateManifestData(validManifest({ name: 123 }));

      expect(result.valid).toBe(false);
      const err = result.errors.find((e) => e.field === 'name');
      expect(err).toBeDefined();
      expect(err?.code).toBe('INVALID_TYPE');
    });

    it('should return INVALID_VALUE when version is not valid semver', () => {
      const validator = createManifestValidator();
      const result = validator.validateManifestData(validManifest({ version: 'not-semver' }));

      expect(result.valid).toBe(false);
      const err = result.errors.find((e) => e.field === 'version');
      expect(err).toBeDefined();
      expect(err?.code).toBe('INVALID_VALUE');
    });

    it('should return INVALID_VALUE when version is semver range instead of exact', () => {
      const validator = createManifestValidator();
      const result = validator.validateManifestData(validManifest({ version: '>=1.0.0' }));

      expect(result.valid).toBe(false);
      const err = result.errors.find((e) => e.field === 'version');
      expect(err).toBeDefined();
      expect(err?.code).toBe('INVALID_VALUE');
    });

    it('should accept valid semver versions including pre-release', () => {
      const validator = createManifestValidator();
      const result = validator.validateManifestData(validManifest({ version: '1.0.0-beta.1' }));
      expect(result.valid).toBe(true);
    });

    it('should return INVALID_VALUE when red64CliVersion is not a valid semver range', () => {
      const validator = createManifestValidator();
      const result = validator.validateManifestData(
        validManifest({ red64CliVersion: 'invalid-range' })
      );

      expect(result.valid).toBe(false);
      const err = result.errors.find((e) => e.field === 'red64CliVersion');
      expect(err).toBeDefined();
      expect(err?.code).toBe('INVALID_VALUE');
    });

    it('should accept valid semver ranges for red64CliVersion', () => {
      const validator = createManifestValidator();

      const validRanges = ['>=0.12.0', '^0.12.0', '~0.12.0', '0.12.x', '>=0.10.0 <1.0.0'];
      for (const range of validRanges) {
        const result = validator.validateManifestData(validManifest({ red64CliVersion: range }));
        expect(result.valid, `Expected range '${range}' to be valid`).toBe(true);
      }
    });

    it('should return INVALID_VALUE for invalid extensionPoints values', () => {
      const validator = createManifestValidator();
      const result = validator.validateManifestData(
        validManifest({ extensionPoints: ['commands', 'invalid-point'] })
      );

      expect(result.valid).toBe(false);
      const err = result.errors.find((e) => e.field === 'extensionPoints');
      expect(err).toBeDefined();
    });

    it('should allow empty extensionPoints array', () => {
      const validator = createManifestValidator();
      const result = validator.validateManifestData(
        validManifest({ extensionPoints: [] })
      );
      expect(result.valid).toBe(true);
    });

    it('should return SCHEMA_ERROR when input is not an object', () => {
      const validator = createManifestValidator();

      const cases = [null, undefined, 'string', 42, true, []];
      for (const input of cases) {
        const result = validator.validateManifestData(input);
        expect(result.valid, `Expected ${String(input)} to be invalid`).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]?.code).toBe('SCHEMA_ERROR');
      }
    });

    it('should validate dependency objects in dependencies array', () => {
      const validator = createManifestValidator();
      const result = validator.validateManifestData(
        validManifest({
          dependencies: [{ name: 'valid-dep', version: '>=1.0.0' }, { name: 123 }],
        })
      );

      expect(result.valid).toBe(false);
    });

    it('should validate configSchema field types', () => {
      const validator = createManifestValidator();
      const result = validator.validateManifestData(
        validManifest({
          configSchema: {
            field1: {
              type: 'invalid-type',
              description: 'test',
            },
          },
        })
      );

      expect(result.valid).toBe(false);
    });
  });

  describe('checkCompatibility', () => {
    it('should return compatible when CLI version satisfies range', () => {
      const validator = createManifestValidator();
      const manifest = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'test',
        author: 'test',
        entryPoint: './index.js',
        red64CliVersion: '>=0.12.0',
        extensionPoints: ['commands' as const],
      };

      const result = validator.checkCompatibility(manifest, '0.12.0');

      expect(result.compatible).toBe(true);
      expect(result.requiredRange).toBe('>=0.12.0');
      expect(result.actualVersion).toBe('0.12.0');
      expect(result.message).toBeDefined();
    });

    it('should return incompatible when CLI version does not satisfy range', () => {
      const validator = createManifestValidator();
      const manifest = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'test',
        author: 'test',
        entryPoint: './index.js',
        red64CliVersion: '>=1.0.0',
        extensionPoints: ['commands' as const],
      };

      const result = validator.checkCompatibility(manifest, '0.12.0');

      expect(result.compatible).toBe(false);
      expect(result.requiredRange).toBe('>=1.0.0');
      expect(result.actualVersion).toBe('0.12.0');
      expect(result.message).toContain('0.12.0');
    });

    it('should handle caret range compatibility', () => {
      const validator = createManifestValidator();
      const manifest = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'test',
        author: 'test',
        entryPoint: './index.js',
        red64CliVersion: '^0.12.0',
        extensionPoints: [] as readonly string[],
      };

      // 0.12.5 should satisfy ^0.12.0
      expect(validator.checkCompatibility(manifest, '0.12.5').compatible).toBe(true);
      // 0.13.0 should NOT satisfy ^0.12.0 (pre-1.0 caret)
      expect(validator.checkCompatibility(manifest, '0.13.0').compatible).toBe(false);
    });

    it('should handle pre-release versions', () => {
      const validator = createManifestValidator();
      const manifest = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'test',
        author: 'test',
        entryPoint: './index.js',
        red64CliVersion: '>=0.12.0',
        extensionPoints: [] as readonly string[],
      };

      // 0.12.0-beta.1 should NOT satisfy >=0.12.0 by default semver
      const result = validator.checkCompatibility(manifest, '0.12.0-beta.1');
      expect(result.compatible).toBe(false);
    });
  });

  describe('validate (file-based)', () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'manifest-test-'));
    });

    it('should validate a valid manifest file', async () => {
      const manifestPath = path.join(tmpDir, 'red64-plugin.json');
      await fs.writeFile(manifestPath, JSON.stringify(validManifest()));

      const validator = createManifestValidator();
      const result = await validator.validate(manifestPath);

      expect(result.valid).toBe(true);
      expect(result.manifest).not.toBeNull();
      expect(result.errors).toHaveLength(0);
    });

    it('should return error for non-existent file', async () => {
      const validator = createManifestValidator();
      const result = await validator.validate('/nonexistent/path/manifest.json');

      expect(result.valid).toBe(false);
      expect(result.manifest).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return error for invalid JSON', async () => {
      const manifestPath = path.join(tmpDir, 'red64-plugin.json');
      await fs.writeFile(manifestPath, 'not valid json {{{');

      const validator = createManifestValidator();
      const result = await validator.validate(manifestPath);

      expect(result.valid).toBe(false);
      expect(result.manifest).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]?.code).toBe('SCHEMA_ERROR');
    });

    it('should return validation errors for invalid manifest content', async () => {
      const manifestPath = path.join(tmpDir, 'red64-plugin.json');
      await fs.writeFile(manifestPath, JSON.stringify({ name: 'only-name' }));

      const validator = createManifestValidator();
      const result = await validator.validate(manifestPath);

      expect(result.valid).toBe(false);
      expect(result.manifest).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
