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
  readonly outdated?: boolean;
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
        // Check if local image is outdated compared to registry
        onProgress?.('Checking for image updates...');
        const freshness = await checkImageFreshness(image);

        if (freshness.isLatest) {
          return {
            exists: true,
            pulled: false,
            outdated: false,
            message: `Image ${image} is up to date`
          };
        }

        if (!pull) {
          return {
            exists: true,
            pulled: false,
            outdated: true,
            error: 'Image is outdated',
            message: `Image ${image} is outdated. Run: docker pull ${image}`
          };
        }

        // Image exists but is outdated, pull the latest
        onProgress?.(`Updating image ${image}...`);
      } else if (!pull) {
        return {
          exists: false,
          pulled: false,
          error: 'Image not found locally',
          message: `Image ${image} not found. Run: docker pull ${image}`
        };
      } else {
        // Image doesn't exist, pull it
        onProgress?.(`Pulling image ${image}...`);
      }

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
              outdated: false,
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
 * Image freshness check result
 */
interface ImageFreshnessResult {
  readonly isLatest: boolean;
  readonly localDigest?: string;
  readonly remoteDigest?: string;
  readonly error?: string;
}

/**
 * Check if local image matches the remote registry version
 */
async function checkImageFreshness(image: string): Promise<ImageFreshnessResult> {
  // Get local image digest
  const localDigest = await getLocalImageDigest(image);
  if (!localDigest) {
    return { isLatest: false, error: 'Could not get local image digest' };
  }

  // Get remote image digest using docker manifest inspect
  const remoteDigest = await getRemoteImageDigest(image);
  if (!remoteDigest) {
    // If we can't check remote, assume local is fine (offline mode)
    return { isLatest: true, localDigest, error: 'Could not check remote registry' };
  }

  const isLatest = localDigest === remoteDigest;
  return { isLatest, localDigest, remoteDigest };
}

/**
 * Get the digest of a local Docker image
 */
async function getLocalImageDigest(image: string): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn('docker', ['inspect', '--format', '{{index .RepoDigests 0}}', image], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    const timeoutId = setTimeout(() => {
      proc.kill('SIGTERM');
      resolve(null);
    }, 10000);

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      if (code === 0 && stdout.trim()) {
        // Extract digest from format: image@sha256:abc123...
        const match = stdout.trim().match(/@(sha256:[a-f0-9]+)/);
        resolve(match ? match[1] : null);
      } else {
        resolve(null);
      }
    });

    proc.on('error', () => {
      clearTimeout(timeoutId);
      resolve(null);
    });
  });
}

/**
 * Get the digest of a remote Docker image from registry
 */
async function getRemoteImageDigest(image: string): Promise<string | null> {
  return new Promise((resolve) => {
    // Use docker manifest inspect to get remote digest without pulling
    const proc = spawn('docker', ['manifest', 'inspect', image, '--verbose'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, DOCKER_CLI_EXPERIMENTAL: 'enabled' }
    });

    let stdout = '';

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    const timeoutId = setTimeout(() => {
      proc.kill('SIGTERM');
      resolve(null);
    }, 30000);

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      if (code === 0 && stdout.trim()) {
        try {
          // Parse the manifest to get the digest for current platform
          const manifest = JSON.parse(stdout);
          // Handle multi-arch manifest list or single manifest
          if (Array.isArray(manifest)) {
            // Multi-arch: find matching platform
            const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
            const platformManifest = manifest.find((m: { Descriptor?: { platform?: { architecture?: string } } }) =>
              m.Descriptor?.platform?.architecture === arch
            );
            if (platformManifest?.Descriptor?.digest) {
              resolve(platformManifest.Descriptor.digest);
              return;
            }
          }
          // Single manifest or fallback
          if (manifest.Descriptor?.digest) {
            resolve(manifest.Descriptor.digest);
            return;
          }
          // Try to find digest in SchemaV2Manifest
          if (manifest.SchemaV2Manifest?.config?.digest) {
            resolve(manifest.SchemaV2Manifest.config.digest);
            return;
          }
        } catch {
          // JSON parse failed
        }
      }
      resolve(null);
    });

    proc.on('error', () => {
      clearTimeout(timeoutId);
      resolve(null);
    });
  });
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
