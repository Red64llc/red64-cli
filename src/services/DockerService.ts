/**
 * Docker Service
 * Handles Docker availability checks and image management for sandbox mode
 */

import { spawn } from 'node:child_process';

/**
 * Docker check result
 */
export interface DockerCheckResult {
  readonly available: boolean;
  readonly error?: string;
  readonly message: string;
}

/**
 * Image check result
 */
export interface ImageCheckResult {
  readonly exists: boolean;
  readonly pulled: boolean;
  readonly error?: string;
  readonly message: string;
}

/**
 * Docker Service Interface
 */
export interface DockerServiceInterface {
  /**
   * Check if Docker is available and running
   */
  checkDocker(): Promise<DockerCheckResult>;

  /**
   * Check if an image exists locally, optionally pulling it if missing
   * @param image - Docker image name (e.g., ghcr.io/red64llc/red64-sandbox:latest)
   * @param pull - Whether to pull the image if missing
   * @param onProgress - Optional callback for pull progress
   */
  ensureImage(
    image: string,
    pull?: boolean,
    onProgress?: (message: string) => void
  ): Promise<ImageCheckResult>;
}

/**
 * Create Docker service
 */
export function createDockerService(): DockerServiceInterface {
  return {
    async checkDocker(): Promise<DockerCheckResult> {
      return new Promise((resolve) => {
        const proc = spawn('docker', ['info'], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let stderr = '';

        proc.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        const timeoutId = setTimeout(() => {
          proc.kill('SIGTERM');
          resolve({
            available: false,
            error: 'Docker check timed out',
            message: 'Docker is not responding. Is Docker Desktop running?'
          });
        }, 10000);

        proc.on('close', (code) => {
          clearTimeout(timeoutId);
          if (code === 0) {
            resolve({
              available: true,
              message: 'Docker is available'
            });
          } else {
            resolve({
              available: false,
              error: stderr.trim() || 'Docker not available',
              message: 'Docker is not running. Please start Docker Desktop.'
            });
          }
        });

        proc.on('error', (error) => {
          clearTimeout(timeoutId);
          if (error.message.includes('ENOENT')) {
            resolve({
              available: false,
              error: 'Docker not found',
              message: 'Docker is not installed. Please install Docker Desktop.'
            });
          } else {
            resolve({
              available: false,
              error: error.message,
              message: 'Failed to check Docker status'
            });
          }
        });
      });
    },

    async ensureImage(
      image: string,
      pull = true,
      onProgress?: (message: string) => void
    ): Promise<ImageCheckResult> {
      // First check if image exists locally
      const exists = await checkImageExists(image);

      if (exists) {
        return {
          exists: true,
          pulled: false,
          message: `Image ${image} is available`
        };
      }

      if (!pull) {
        return {
          exists: false,
          pulled: false,
          error: 'Image not found locally',
          message: `Image ${image} not found. Run: docker pull ${image}`
        };
      }

      // Pull the image
      onProgress?.(`Pulling image ${image}...`);

      return new Promise((resolve) => {
        const proc = spawn('docker', ['pull', image], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let lastProgress = '';

        proc.stdout?.on('data', (data: Buffer) => {
          const line = data.toString().trim();
          if (line && line !== lastProgress) {
            lastProgress = line;
            // Extract meaningful progress info
            if (line.includes('Pulling') || line.includes('Downloading') ||
                line.includes('Extracting') || line.includes('Pull complete') ||
                line.includes('Already exists')) {
              onProgress?.(line);
            }
          }
        });

        proc.stderr?.on('data', (data: Buffer) => {
          const line = data.toString().trim();
          if (line) {
            onProgress?.(line);
          }
        });

        // 5 minute timeout for image pull
        const timeoutId = setTimeout(() => {
          proc.kill('SIGTERM');
          resolve({
            exists: false,
            pulled: false,
            error: 'Image pull timed out',
            message: `Timed out pulling ${image}. Check your internet connection.`
          });
        }, 300000);

        proc.on('close', (code) => {
          clearTimeout(timeoutId);
          if (code === 0) {
            onProgress?.(`Image ${image} ready`);
            resolve({
              exists: true,
              pulled: true,
              message: `Successfully pulled ${image}`
            });
          } else {
            resolve({
              exists: false,
              pulled: false,
              error: `Failed to pull image (exit code ${code})`,
              message: `Failed to pull ${image}. Check the image name and your access.`
            });
          }
        });

        proc.on('error', (error) => {
          clearTimeout(timeoutId);
          resolve({
            exists: false,
            pulled: false,
            error: error.message,
            message: 'Failed to pull Docker image'
          });
        });
      });
    }
  };
}

/**
 * Check if a Docker image exists locally
 */
async function checkImageExists(image: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('docker', ['images', '-q', image], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    const timeoutId = setTimeout(() => {
      proc.kill('SIGTERM');
      resolve(false);
    }, 10000);

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      // If we got output (image ID), the image exists
      resolve(code === 0 && stdout.trim().length > 0);
    });

    proc.on('error', () => {
      clearTimeout(timeoutId);
      resolve(false);
    });
  });
}
