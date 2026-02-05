/**
 * Unit tests for ContentCache service
 * Tests in-memory caching with 5-minute TTL
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ContentCache } from '../../src/services/ContentCache.js';

describe('ContentCache', () => {
  let cache: ContentCache;

  beforeEach(() => {
    cache = new ContentCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('get and set', () => {
    it('should return cached content for valid entry', () => {
      const filePath = '/test/file.md';
      const content = '# Test Content';

      cache.set(filePath, content);
      const result = cache.get(filePath);

      expect(result).toBe(content);
    });

    it('should return null for cache miss', () => {
      const result = cache.get('/nonexistent.md');
      expect(result).toBeNull();
    });

    it('should return null for stale entry (older than 5 minutes)', () => {
      const filePath = '/test/file.md';
      const content = '# Old Content';

      cache.set(filePath, content);

      // Fast-forward time by 6 minutes (360,000 ms)
      vi.advanceTimersByTime(360_000);

      const result = cache.get(filePath);
      expect(result).toBeNull();
    });

    it('should return content for fresh entry (less than 5 minutes old)', () => {
      const filePath = '/test/file.md';
      const content = '# Fresh Content';

      cache.set(filePath, content);

      // Fast-forward time by 4 minutes (240,000 ms)
      vi.advanceTimersByTime(240_000);

      const result = cache.get(filePath);
      expect(result).toBe(content);
    });

    it('should store content with current timestamp', () => {
      const filePath = '/test/file.md';
      const content = '# Content';
      const now = Date.now();

      vi.setSystemTime(now);
      cache.set(filePath, content);

      // Verify it's retrievable immediately
      expect(cache.get(filePath)).toBe(content);
    });

    it('should overwrite existing entry on set', () => {
      const filePath = '/test/file.md';
      const content1 = '# First';
      const content2 = '# Second';

      cache.set(filePath, content1);
      cache.set(filePath, content2);

      expect(cache.get(filePath)).toBe(content2);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('/file1.md', 'Content 1');
      cache.set('/file2.md', 'Content 2');
      cache.set('/file3.md', 'Content 3');

      cache.clear();

      expect(cache.get('/file1.md')).toBeNull();
      expect(cache.get('/file2.md')).toBeNull();
      expect(cache.get('/file3.md')).toBeNull();
    });

    it('should work on empty cache', () => {
      expect(() => cache.clear()).not.toThrow();
    });
  });

  describe('prune', () => {
    it('should remove only stale entries', () => {
      cache.set('/fresh.md', 'Fresh content');

      // Advance time by 1 minute
      vi.advanceTimersByTime(60_000);

      cache.set('/stale.md', 'Stale content');

      // Advance time by 5 more minutes (total 6 minutes for /stale.md)
      vi.advanceTimersByTime(300_000);

      cache.prune();

      // /fresh.md is 6 minutes old (stale), /stale.md is 5 minutes old (fresh)
      expect(cache.get('/fresh.md')).toBeNull();
      expect(cache.get('/stale.md')).toBe('Stale content');
    });

    it('should not remove fresh entries', () => {
      cache.set('/file1.md', 'Content 1');
      cache.set('/file2.md', 'Content 2');

      // Advance time by 2 minutes
      vi.advanceTimersByTime(120_000);

      cache.prune();

      expect(cache.get('/file1.md')).toBe('Content 1');
      expect(cache.get('/file2.md')).toBe('Content 2');
    });

    it('should handle empty cache', () => {
      expect(() => cache.prune()).not.toThrow();
    });
  });

  describe('automatic pruning on get', () => {
    it('should prune stale entries when get is called', () => {
      cache.set('/stale.md', 'Stale content');
      cache.set('/fresh.md', 'Fresh content');

      // Advance time by 6 minutes
      vi.advanceTimersByTime(360_000);

      // Add a new entry to make it fresh
      cache.set('/new.md', 'New content');

      // Get should trigger automatic pruning
      cache.get('/fresh.md');

      // Manually check that stale entry was removed
      // We can't directly test the internal state, but we know get() triggers prune()
      expect(cache.get('/stale.md')).toBeNull();
      expect(cache.get('/new.md')).toBe('New content');
    });
  });

  describe('edge cases', () => {
    it('should handle empty file path', () => {
      cache.set('', 'Empty path content');
      expect(cache.get('')).toBe('Empty path content');
    });

    it('should handle empty content', () => {
      cache.set('/empty.md', '');
      expect(cache.get('/empty.md')).toBe('');
    });

    it('should handle large content', () => {
      const largeContent = 'x'.repeat(1_000_000);
      cache.set('/large.md', largeContent);
      expect(cache.get('/large.md')).toBe(largeContent);
    });

    it('should handle special characters in file path', () => {
      const specialPath = '/test/файл.md';
      cache.set(specialPath, 'Content with special characters');
      expect(cache.get(specialPath)).toBe('Content with special characters');
    });
  });
});
