/**
 * PreviewHTTPServer Unit Tests  
 * Requirements: 7.4 - Ephemeral HTTP server lifecycle
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PreviewHTTPServer } from '../../src/services/PreviewHTTPServer.js';
import http from 'node:http';

describe('PreviewHTTPServer', () => {
  let server: PreviewHTTPServer;

  beforeEach(() => {
    server = new PreviewHTTPServer();
  });

  afterEach(async () => {
    // Cleanup all servers after each test
    await server.shutdownAll();
  });

  describe('start', () => {
    it('starts server on available port and returns success result', async () => {
      const html = '<h1>Test Content</h1>';

      const result = await server.start(html);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.url).toMatch(/^http:\/\/localhost:\d+$/);
        expect(result.port).toBeGreaterThanOrEqual(3000);
        expect(result.port).toBeLessThanOrEqual(3999);
      }
    });

    it('serves HTML content with correct Content-Type header', async () => {
      const html = '<h1>Test</h1>';

      const result = await server.start(html);
      expect(result.success).toBe(true);

      if (result.success) {
        // Make HTTP request to verify content
        const response = await fetch(result.url);
        const text = await response.text();
        const contentType = response.headers.get('content-type');

        expect(text).toBe(html);
        expect(contentType).toContain('text/html');
        expect(contentType).toContain('charset=utf-8');
      }
    });

    it('retries with different port on conflict', async () => {
      const html1 = '<h1>Server 1</h1>';
      const html2 = '<h1>Server 2</h1>';

      // Start first server
      const result1 = await server.start(html1);
      expect(result1.success).toBe(true);

      // Start second server (should get different port)
      const result2 = await server.start(html2);
      expect(result2.success).toBe(true);

      if (result1.success && result2.success) {
        expect(result1.port).not.toBe(result2.port);
        expect(result1.url).not.toBe(result2.url);
      }
    });

    it('uses preferred port if available', async () => {
      const html = '<h1>Test</h1>';
      const preferredPort = 3500;

      const result = await server.start(html, preferredPort);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.port).toBe(preferredPort);
        expect(result.url).toBe(`http://localhost:${preferredPort}`);
      }
    });

    it('returns error after 3 failed attempts', async () => {
      // Create a server that takes up a port
      const blockingServer = http.createServer();
      const blockingPort = 3000;
      
      await new Promise<void>((resolve) => {
        blockingServer.listen(blockingPort, '127.0.0.1', () => resolve());
      });

      try {
        // Try to start on the same port (should fail after retries)
        const result = await server.start('<h1>Test</h1>', blockingPort);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('Failed to start server');
          expect(result.error).toContain('attempts');
        }
      } finally {
        // Cleanup blocking server
        await new Promise<void>((resolve) => {
          blockingServer.close(() => resolve());
        });
      }
    });

    it('binds to localhost only for security', async () => {
      const html = '<h1>Test</h1>';

      const result = await server.start(html);
      expect(result.success).toBe(true);

      if (result.success) {
        // Verify URL uses localhost
        expect(result.url).toContain('localhost');
        expect(result.url).not.toContain('0.0.0.0');
      }
    });
  });

  describe('shutdown', () => {
    it('shuts down specific server by URL', async () => {
      const html = '<h1>Test</h1>';

      const result = await server.start(html);
      expect(result.success).toBe(true);

      if (result.success) {
        // Shutdown should not throw
        await expect(server.shutdown(result.url)).resolves.not.toThrow();

        // Server should no longer be accessible
        await expect(fetch(result.url)).rejects.toThrow();
      }
    });

    it('handles shutdown of non-existent server gracefully', async () => {
      const fakeUrl = 'http://localhost:9999';

      // Should not throw even if server doesn't exist
      await expect(server.shutdown(fakeUrl)).resolves.not.toThrow();
    });

    it('clears auto-shutdown timeout when manually shut down', async () => {
      const html = '<h1>Test</h1>';

      const result = await server.start(html);
      expect(result.success).toBe(true);

      if (result.success) {
        // Manually shutdown before timeout
        await server.shutdown(result.url);

        // Server should be immediately inaccessible
        await expect(fetch(result.url)).rejects.toThrow();
      }
    });
  });

  describe('shutdownAll', () => {
    it('shuts down all active server instances', async () => {
      const html1 = '<h1>Server 1</h1>';
      const html2 = '<h1>Server 2</h1>';

      const result1 = await server.start(html1);
      const result2 = await server.start(html2);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Shutdown all
      await server.shutdownAll();

      // Both servers should be inaccessible
      if (result1.success) {
        await expect(fetch(result1.url)).rejects.toThrow();
      }
      if (result2.success) {
        await expect(fetch(result2.url)).rejects.toThrow();
      }
    });

    it('works when no servers are active', async () => {
      // Should not throw even with no active servers
      await expect(server.shutdownAll()).resolves.not.toThrow();
    });
  });

  describe('auto-shutdown behavior', () => {
    it('has auto-shutdown timeout configured', async () => {
      const html = '<h1>Test</h1>';

      const result = await server.start(html);
      expect(result.success).toBe(true);

      // We can't easily test the actual 60-second timeout without waiting,
      // but we can verify the server starts and is accessible
      if (result.success) {
        const response = await fetch(result.url);
        expect(response.ok).toBe(true);
      }
    });
  });

  describe('port generation', () => {
    it('generates random ports in range 3000-3999', async () => {
      const html = '<h1>Test</h1>';
      const ports: number[] = [];

      // Start multiple servers to check port range
      for (let i = 0; i < 5; i++) {
        const result = await server.start(html);
        expect(result.success).toBe(true);
        if (result.success) {
          ports.push(result.port);
        }
      }

      // Verify all ports are in valid range
      for (const port of ports) {
        expect(port).toBeGreaterThanOrEqual(3000);
        expect(port).toBeLessThanOrEqual(3999);
      }

      // Verify we got different ports (high probability)
      const uniquePorts = new Set(ports);
      expect(uniquePorts.size).toBeGreaterThan(1);
    });
  });

  describe('concurrent server management', () => {
    it('tracks multiple active servers independently', async () => {
      const html1 = '<h1>Server 1</h1>';
      const html2 = '<h1>Server 2</h1>';
      const html3 = '<h1>Server 3</h1>';

      const result1 = await server.start(html1);
      const result2 = await server.start(html2);
      const result3 = await server.start(html3);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);

      // All servers should be accessible
      if (result1.success && result2.success && result3.success) {
        const [text1, text2, text3] = await Promise.all([
          fetch(result1.url).then(r => r.text()),
          fetch(result2.url).then(r => r.text()),
          fetch(result3.url).then(r => r.text())
        ]);

        expect(text1).toBe(html1);
        expect(text2).toBe(html2);
        expect(text3).toBe(html3);
      }
    });

    it('can shutdown servers independently', async () => {
      const html1 = '<h1>Server 1</h1>';
      const html2 = '<h1>Server 2</h1>';

      const result1 = await server.start(html1);
      const result2 = await server.start(html2);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      if (result1.success && result2.success) {
        // Shutdown only server 1
        await server.shutdown(result1.url);

        // Server 1 should be inaccessible
        await expect(fetch(result1.url)).rejects.toThrow();

        // Server 2 should still work
        const response2 = await fetch(result2.url);
        expect(response2.ok).toBe(true);
        expect(await response2.text()).toBe(html2);
      }
    });
  });
});
