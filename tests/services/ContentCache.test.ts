/**
 * ContentCache Unit Tests
 * Requirements: 8.3 - Cache content 5 minutes
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ContentCache } from '../../src/services/ContentCache.js';

describe('ContentCache', () => {
  let cache: ContentCache;

  beforeEach(() => {
    cache = new ContentCache();
    // Use fake timers for TTL testing
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('get', () => {
    it('returns null for cache miss', () => {
      const result = cache.get('/path/to/nonexistent.md');
      expect(result).toBeNull();
    });

    it('returns stored content for cache hit', () => {
      const path = '/path/to/artifact.md';
      const content = '# Test Content\n\nThis is a test.';

      cache.set(path, content);
      const result = cache.get(path);

      expect(result).toBe(content);
    });

    it('returns null for stale entry older than 5 minutes', () => {
      const path = '/path/to/artifact.md';
      const content = '# Test Content';

      cache.set(path, content);

      // Fast-forward time by 5 minutes + 1ms
      vi.advanceTimersByTime(300_001);

      const result = cache.get(path);
      expect(result).toBeNull();
    });

    it('returns content for fresh entry within 5 minutes', () => {
      const path = '/path/to/artifact.md';
      const content = '# Test Content';

      cache.set(path, content);

      // Fast-forward time by 4 minutes 59 seconds
      vi.advanceTimersByTime(299_000);

      const result = cache.get(path);
      expect(result).toBe(content);
    });

    it('automatically prunes stale entries on get', () => {
      const path1 = '/path/to/artifact1.md';
      const path2 = '/path/to/artifact2.md';
      const content1 = 'Content 1';
      const content2 = 'Content 2';

      cache.set(path1, content1);

      // Fast-forward 5 minutes + 1ms to make path1 stale
      vi.advanceTimersByTime(300_001);

      // Set path2 (now fresh)
      cache.set(path2, content2);

      // Get path2 should trigger pruning of path1
      const result2 = cache.get(path2);
      expect(result2).toBe(content2);

      // Verify path1 was pruned
      const result1 = cache.get(path1);
      expect(result1).toBeNull();
    });
  });

  describe('set', () => {
    it('stores content with current timestamp', () => {
      const path = '/path/to/artifact.md';
      const content = '# Test Content';

      cache.set(path, content);

      const result = cache.get(path);
      expect(result).toBe(content);
    });

    it('overwrites existing entry with new content', () => {
      const path = '/path/to/artifact.md';
      const oldContent = 'Old content';
      const newContent = 'New content';

      cache.set(path, oldContent);
      cache.set(path, newContent);

      const result = cache.get(path);
      expect(result).toBe(newContent);
    });

    it('resets TTL when updating existing entry', () => {
      const path = '/path/to/artifact.md';
      const oldContent = 'Old content';
      const newContent = 'New content';

      cache.set(path, oldContent);

      // Fast-forward 4 minutes
      vi.advanceTimersByTime(240_000);

      // Update entry (resets TTL)
      cache.set(path, newContent);

      // Fast-forward another 4 minutes (total 8 minutes from first set, 4 from update)
      vi.advanceTimersByTime(240_000);

      // Should still be fresh because TTL was reset
      const result = cache.get(path);
      expect(result).toBe(newContent);
    });
  });

  describe('clear', () => {
    it('removes all entries from cache', () => {
      const path1 = '/path/to/artifact1.md';
      const path2 = '/path/to/artifact2.md';
      const content1 = 'Content 1';
      const content2 = 'Content 2';

      cache.set(path1, content1);
      cache.set(path2, content2);

      cache.clear();

      expect(cache.get(path1)).toBeNull();
      expect(cache.get(path2)).toBeNull();
    });

    it('works on empty cache without error', () => {
      expect(() => cache.clear()).not.toThrow();
    });
  });

  describe('prune', () => {
    it('removes only stale entries older than 5 minutes', () => {
      const path1 = '/path/to/stale.md';
      const path2 = '/path/to/fresh.md';
      const content1 = 'Stale content';
      const content2 = 'Fresh content';

      cache.set(path1, content1);

      // Fast-forward 5 minutes + 1ms to make path1 stale
      vi.advanceTimersByTime(300_001);

      cache.set(path2, content2);

      cache.prune();

      // Stale entry should be removed
      expect(cache.get(path1)).toBeNull();

      // Fresh entry should remain
      expect(cache.get(path2)).toBe(content2);
    });

    it('keeps all entries when none are stale', () => {
      const path1 = '/path/to/artifact1.md';
      const path2 = '/path/to/artifact2.md';
      const content1 = 'Content 1';
      const content2 = 'Content 2';

      cache.set(path1, content1);
      cache.set(path2, content2);

      // Fast-forward 2 minutes (well within TTL)
      vi.advanceTimersByTime(120_000);

      cache.prune();

      // Both entries should still be present
      expect(cache.get(path1)).toBe(content1);
      expect(cache.get(path2)).toBe(content2);
    });

    it('removes all entries when all are stale', () => {
      const path1 = '/path/to/artifact1.md';
      const path2 = '/path/to/artifact2.md';
      const content1 = 'Content 1';
      const content2 = 'Content 2';

      cache.set(path1, content1);
      cache.set(path2, content2);

      // Fast-forward 5 minutes + 1ms
      vi.advanceTimersByTime(300_001);

      cache.prune();

      // Both entries should be removed
      expect(cache.get(path1)).toBeNull();
      expect(cache.get(path2)).toBeNull();
    });

    it('works on empty cache without error', () => {
      expect(() => cache.prune()).not.toThrow();
    });
  });

  describe('TTL behavior', () => {
    it('has TTL of exactly 300,000 milliseconds (5 minutes)', () => {
      const path = '/path/to/artifact.md';
      const content = 'Test content';

      cache.set(path, content);

      // At 299,999ms - should still be fresh
      vi.advanceTimersByTime(299_999);
      expect(cache.get(path)).toBe(content);

      // Advance 2ms more (total 300,001ms) - should be stale
      vi.advanceTimersByTime(2);
      expect(cache.get(path)).toBeNull();
    });
  });
});
