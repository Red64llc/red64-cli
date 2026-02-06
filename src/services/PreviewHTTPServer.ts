/**
 * PreviewHTTPServer Service
 * Manages ephemeral HTTP server lifecycle for serving preview HTML
 */

import http from 'node:http';

/**
 * Server start result (discriminated union)
 */
export type ServerStartResult =
  | { readonly success: true; readonly url: string; readonly port: number }
  | { readonly success: false; readonly error: string };

/**
 * PreviewHTTPServerInterface defines the contract for HTTP server lifecycle management
 */
export interface PreviewHTTPServerInterface {
  /**
   * Start ephemeral HTTP server on random available port
   * @param html - HTML content to serve
   * @param preferredPort - Optional preferred port (default: random 3000-3999)
   * @returns Server URL (http://localhost:PORT) or error
   */
  start(html: string, preferredPort?: number): Promise<ServerStartResult>;

  /**
   * Shutdown specific server instance
   * @param url - Server URL returned from start()
   */
  shutdown(url: string): Promise<void>;

  /**
   * Shutdown all active server instances
   */
  shutdownAll(): Promise<void>;
}

/**
 * PreviewHTTPServer implementation using Node.js http module
 */
export class PreviewHTTPServer implements PreviewHTTPServerInterface {
  private readonly activeServers: Map<string, http.Server>;
  private readonly serverTimeouts: Map<string, NodeJS.Timeout>;
  private readonly AUTO_SHUTDOWN_MS = 60_000; // 60 seconds

  constructor() {
    this.activeServers = new Map();
    this.serverTimeouts = new Map();
  }

  /**
   * Start ephemeral HTTP server on random available port
   * Retries up to 3 times if port is unavailable
   */
  async start(html: string, preferredPort?: number): Promise<ServerStartResult> {
    const maxAttempts = 3;
    let lastError = '';

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Generate random port in range 3000-3999 if not preferred
      const port = preferredPort ?? this.generateRandomPort();

      try {
        const result = await this.tryStartServer(html, port);
        if (result.success) {
          return result;
        }
        lastError = result.error;
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    return {
      success: false,
      error: `Failed to start server after ${maxAttempts} attempts. ${lastError}`
    };
  }

  /**
   * Try to start server on specific port
   */
  private async tryStartServer(html: string, port: number): Promise<ServerStartResult> {
    return new Promise((resolve) => {
      const server = http.createServer((_req, res) => {
        // Serve HTML content with proper Content-Type
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      });

      // Handle server errors
      server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          resolve({
            success: false,
            error: `Port ${port} is already in use`
          });
        } else {
          resolve({
            success: false,
            error: error.message
          });
        }
      });

      // Start listening on localhost only
      server.listen(port, '127.0.0.1', () => {
        const url = `http://localhost:${port}`;

        // Track active server
        this.activeServers.set(url, server);

        // Set auto-shutdown timeout
        const timeout = setTimeout(() => {
          this.shutdown(url).catch(() => {
            // Ignore errors during auto-shutdown
          });
        }, this.AUTO_SHUTDOWN_MS);

        this.serverTimeouts.set(url, timeout);

        resolve({
          success: true,
          url,
          port
        });
      });
    });
  }

  /**
   * Generate random port in range 3000-3999
   */
  private generateRandomPort(): number {
    return Math.floor(Math.random() * 1000) + 3000;
  }

  /**
   * Shutdown specific server instance
   */
  async shutdown(url: string): Promise<void> {
    const server = this.activeServers.get(url);
    if (!server) {
      // Server not found or already closed
      return;
    }

    // Clear auto-shutdown timeout
    const timeout = this.serverTimeouts.get(url);
    if (timeout) {
      clearTimeout(timeout);
      this.serverTimeouts.delete(url);
    }

    // Close server
    return new Promise((resolve) => {
      server.close(() => {
        this.activeServers.delete(url);
        resolve();
      });
    });
  }

  /**
   * Shutdown all active server instances
   */
  async shutdownAll(): Promise<void> {
    const urls = Array.from(this.activeServers.keys());
    await Promise.all(urls.map(url => this.shutdown(url)));
  }
}
