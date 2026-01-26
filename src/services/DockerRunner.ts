/**
 * Docker Runner service for sandboxed command execution
 * Runs Claude CLI commands inside a Docker container for isolation
 */

import { spawn, type ChildProcess } from 'node:child_process';

const DEFAULT_IMAGE = 'red64-sandbox:latest';

/**
 * Docker run options
 */
export interface DockerRunOptions {
  readonly image?: string;
  readonly workingDirectory: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly env?: Record<string, string>;
  readonly timeout?: number;
  readonly onOutput?: (chunk: string) => void;
  readonly onError?: (chunk: string) => void;
}

/**
 * Docker run result
 */
export interface DockerRunResult {
  readonly success: boolean;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
}

/**
 * Docker runner service interface
 */
export interface DockerRunnerService {
  run(options: DockerRunOptions): Promise<DockerRunResult>;
  isAvailable(): Promise<boolean>;
  buildImage(dockerfilePath: string, imageName?: string): Promise<boolean>;
  abort(): void;
}

/**
 * Check if Docker is available
 */
async function checkDocker(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('docker', ['version'], { stdio: ['pipe', 'pipe', 'pipe'] });
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

/**
 * Check if image exists locally
 */
async function imageExists(imageName: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('docker', ['image', 'inspect', imageName], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

/**
 * Create Docker runner service
 */
export function createDockerRunner(): DockerRunnerService {
  let currentProcess: ChildProcess | null = null;
  let aborted = false;

  return {
    /**
     * Run command inside Docker container
     */
    async run(options: DockerRunOptions): Promise<DockerRunResult> {
      aborted = false;
      const image = options.image ?? DEFAULT_IMAGE;

      // Build docker run args
      const dockerArgs: string[] = [
        'run',
        '--rm',                              // Remove container after exit
        '-w', '/workspace',                   // Working directory inside container
        '-v', `${options.workingDirectory}:/workspace`,  // Mount workspace
      ];

      // Add environment variables
      if (options.env) {
        for (const [key, value] of Object.entries(options.env)) {
          dockerArgs.push('-e', `${key}=${value}`);
        }
      }

      // Add image and command
      dockerArgs.push(image);
      dockerArgs.push(options.command);
      dockerArgs.push(...options.args);

      return new Promise((resolve) => {
        currentProcess = spawn('docker', dockerArgs, {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        // Close stdin immediately
        currentProcess.stdin?.end();

        let stdout = '';
        let stderr = '';
        let timedOut = false;

        // Handle timeout (default 10 minutes)
        const timeoutMs = options.timeout ?? 600000;
        const timeoutId = setTimeout(() => {
          timedOut = true;
          if (currentProcess) {
            currentProcess.kill('SIGTERM');
          }
        }, timeoutMs);

        // Capture stdout
        currentProcess.stdout?.on('data', (data: Buffer) => {
          const chunk = data.toString();
          stdout += chunk;
          if (options.onOutput) {
            options.onOutput(chunk);
          }
        });

        // Capture stderr
        currentProcess.stderr?.on('data', (data: Buffer) => {
          const chunk = data.toString();
          stderr += chunk;
          if (options.onError) {
            options.onError(chunk);
          }
        });

        // Handle process close
        currentProcess.on('close', (code) => {
          clearTimeout(timeoutId);
          const exitCode = code ?? -1;
          const success = exitCode === 0 && !timedOut && !aborted;

          resolve({
            success,
            exitCode,
            stdout,
            stderr,
            timedOut
          });

          currentProcess = null;
        });

        // Handle spawn errors
        currentProcess.on('error', (error) => {
          clearTimeout(timeoutId);

          resolve({
            success: false,
            exitCode: -1,
            stdout,
            stderr: stderr || `Docker error: ${error.message}`,
            timedOut: false
          });

          currentProcess = null;
        });
      });
    },

    /**
     * Check if Docker is available
     */
    async isAvailable(): Promise<boolean> {
      return checkDocker();
    },

    /**
     * Build the sandbox image
     */
    async buildImage(dockerfilePath: string, imageName?: string): Promise<boolean> {
      const image = imageName ?? DEFAULT_IMAGE;

      return new Promise((resolve) => {
        const proc = spawn('docker', [
          'build',
          '-f', dockerfilePath,
          '-t', image,
          '.'
        ], {
          cwd: dockerfilePath.substring(0, dockerfilePath.lastIndexOf('/')),
          stdio: ['pipe', 'pipe', 'pipe']
        });

        proc.on('close', (code) => resolve(code === 0));
        proc.on('error', () => resolve(false));
      });
    },

    /**
     * Abort running container
     */
    abort(): void {
      aborted = true;
      if (currentProcess) {
        currentProcess.kill('SIGTERM');
      }
    }
  };
}

/**
 * Check if sandbox image is available, build if not
 */
export async function ensureSandboxImage(dockerfilePath?: string): Promise<boolean> {
  const exists = await imageExists(DEFAULT_IMAGE);
  if (exists) {
    return true;
  }

  if (!dockerfilePath) {
    return false;
  }

  const runner = createDockerRunner();
  return runner.buildImage(dockerfilePath, DEFAULT_IMAGE);
}
