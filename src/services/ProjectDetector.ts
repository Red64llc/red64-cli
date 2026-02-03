/**
 * Project Detector Service
 * Auto-detects test commands from various project configuration files
 */

import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Check if file exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect Node.js package manager by lockfile
 */
async function detectNodePackageManager(projectDir: string): Promise<'npm' | 'yarn' | 'pnpm' | 'bun'> {
  // Check in priority order (more specific first)
  if (await fileExists(join(projectDir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (await fileExists(join(projectDir, 'yarn.lock'))) return 'yarn';
  if (await fileExists(join(projectDir, 'bun.lockb'))) return 'bun';
  // Default to npm
  return 'npm';
}

/**
 * Get setup command for Node.js package manager
 */
function getNodeSetupCommand(pm: 'npm' | 'yarn' | 'pnpm' | 'bun'): string {
  switch (pm) {
    case 'pnpm': return 'pnpm install';
    case 'yarn': return 'yarn install';
    case 'bun': return 'bun install';
    default: return 'npm ci';
  }
}

/**
 * Get test command for Node.js package manager
 */
function getNodeTestCommand(pm: 'npm' | 'yarn' | 'pnpm' | 'bun'): string {
  switch (pm) {
    case 'pnpm': return 'pnpm test';
    case 'yarn': return 'yarn test';
    case 'bun': return 'bun test';
    default: return 'npm test';
  }
}

/**
 * Detection result interface
 */
export interface DetectionResult {
  readonly detected: boolean;
  readonly setupCommand: string | null;
  readonly testCommand: string | null;
  readonly source: string | null;
  readonly confidence: 'high' | 'medium' | 'low';
}

/**
 * Project detector service interface
 */
export interface ProjectDetectorService {
  /**
   * Detect test command from project files
   * Checks multiple sources in priority order
   */
  detect(projectDir: string): Promise<DetectionResult>;
}

/**
 * Detection strategy result
 */
interface StrategyResult {
  readonly setupCommand: string | null;
  readonly testCommand: string;
}

/**
 * Detection strategy for a specific project type
 */
interface DetectionStrategy {
  readonly file: string;
  readonly detect: (content: string, projectDir: string) => StrategyResult | null | Promise<StrategyResult | null>;
  readonly confidence: 'high' | 'medium' | 'low';
}

/**
 * Detection strategies ordered by priority
 */
const DETECTION_STRATEGIES: readonly DetectionStrategy[] = [
  // Node.js / package.json
  {
    file: 'package.json',
    confidence: 'high',
    detect: async (content: string, projectDir: string) => {
      try {
        const pkg = JSON.parse(content);
        const pm = await detectNodePackageManager(projectDir);
        const setupCommand = getNodeSetupCommand(pm);

        // Check scripts.test - ignore default npm init placeholder
        if (pkg.scripts?.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
          return { setupCommand, testCommand: getNodeTestCommand(pm) };
        }
        // Check for common test runners in dependencies
        const deps = { ...pkg.devDependencies, ...pkg.dependencies };
        if (deps?.vitest) {
          return { setupCommand, testCommand: `${pm === 'npm' ? 'npx' : pm} vitest run` };
        }
        if (deps?.jest) {
          return { setupCommand, testCommand: `${pm === 'npm' ? 'npx' : pm} jest` };
        }
        if (deps?.mocha) {
          return { setupCommand, testCommand: `${pm === 'npm' ? 'npx' : pm} mocha` };
        }
        if (deps?.ava) {
          return { setupCommand, testCommand: `${pm === 'npm' ? 'npx' : pm} ava` };
        }
        return null;
      } catch {
        return null;
      }
    }
  },
  // Python / pyproject.toml
  {
    file: 'pyproject.toml',
    confidence: 'high',
    detect: (content: string) => {
      // Check for uv first (modern Python package manager)
      const usesUv = content.includes('[tool.uv]') || content.includes('uv.lock');
      const setupCommand = usesUv ? 'uv sync' : 'pip install -e .';

      if (content.includes('[tool.pytest') || content.includes('pytest')) {
        return { setupCommand, testCommand: usesUv ? 'uv run pytest' : 'pytest' };
      }
      if (content.includes('unittest')) {
        return { setupCommand, testCommand: 'python -m unittest discover' };
      }
      return null;
    }
  },
  // Python / setup.py fallback
  {
    file: 'setup.py',
    confidence: 'medium',
    detect: (content: string) => {
      if (content.includes('pytest') || content.includes('test_suite')) {
        return { setupCommand: 'pip install -e .', testCommand: 'pytest' };
      }
      return null;
    }
  },
  // Python / requirements.txt fallback
  {
    file: 'requirements.txt',
    confidence: 'medium',
    detect: (content: string) => {
      if (content.includes('pytest')) {
        return { setupCommand: 'pip install -r requirements.txt', testCommand: 'pytest' };
      }
      return null;
    }
  },
  // Rust / Cargo.toml (cargo handles deps automatically)
  {
    file: 'Cargo.toml',
    confidence: 'high',
    detect: () => {
      return { setupCommand: null, testCommand: 'cargo test' };
    }
  },
  // Go / go.mod (go handles deps automatically)
  {
    file: 'go.mod',
    confidence: 'high',
    detect: () => {
      return { setupCommand: null, testCommand: 'go test ./...' };
    }
  },
  // Ruby / Gemfile
  {
    file: 'Gemfile',
    confidence: 'medium',
    detect: (content: string) => {
      const setupCommand = 'bundle install';
      if (content.includes('rspec')) {
        return { setupCommand, testCommand: 'bundle exec rspec' };
      }
      if (content.includes('minitest')) {
        return { setupCommand, testCommand: 'bundle exec rake test' };
      }
      return null;
    }
  },
  // Java / Maven (maven handles deps automatically)
  {
    file: 'pom.xml',
    confidence: 'high',
    detect: () => {
      return { setupCommand: null, testCommand: 'mvn test' };
    }
  },
  // Java/Kotlin / Gradle (gradle handles deps automatically)
  {
    file: 'build.gradle',
    confidence: 'high',
    detect: () => {
      return { setupCommand: null, testCommand: './gradlew test' };
    }
  },
  // Kotlin DSL
  {
    file: 'build.gradle.kts',
    confidence: 'high',
    detect: () => {
      return { setupCommand: null, testCommand: './gradlew test' };
    }
  },
  // Makefile
  {
    file: 'Makefile',
    confidence: 'medium',
    detect: (content: string) => {
      if (content.match(/^test\s*:/m)) {
        // Check if there's an install target
        const hasInstall = content.match(/^install\s*:/m);
        return {
          setupCommand: hasInstall ? 'make install' : null,
          testCommand: 'make test'
        };
      }
      return null;
    }
  },
  // PHP / Composer
  {
    file: 'composer.json',
    confidence: 'medium',
    detect: (content: string) => {
      try {
        const composer = JSON.parse(content);
        const setupCommand = 'composer install';
        if (composer.scripts?.test) {
          return { setupCommand, testCommand: 'composer test' };
        }
        const deps = { ...composer.require, ...composer['require-dev'] };
        if (deps?.['phpunit/phpunit']) {
          return { setupCommand, testCommand: './vendor/bin/phpunit' };
        }
        return null;
      } catch {
        return null;
      }
    }
  },
  // Elixir / Mix
  {
    file: 'mix.exs',
    confidence: 'high',
    detect: () => {
      return { setupCommand: 'mix deps.get', testCommand: 'mix test' };
    }
  },
  // .NET / C# (dotnet restore is usually automatic, but explicit is safer)
  {
    file: '*.csproj',
    confidence: 'high',
    detect: () => {
      return { setupCommand: 'dotnet restore', testCommand: 'dotnet test' };
    }
  }
];

/**
 * Create project detector service
 */
export function createProjectDetector(): ProjectDetectorService {
  return {
    async detect(projectDir: string): Promise<DetectionResult> {
      // Try each strategy in priority order
      for (const strategy of DETECTION_STRATEGIES) {
        // Handle glob patterns (e.g., *.csproj)
        if (strategy.file.includes('*')) {
          // For now, skip glob patterns - can be enhanced later
          continue;
        }

        const filePath = join(projectDir, strategy.file);

        if (await fileExists(filePath)) {
          try {
            const content = await readFile(filePath, 'utf-8');
            const result = await strategy.detect(content, projectDir);

            if (result) {
              return {
                detected: true,
                setupCommand: result.setupCommand,
                testCommand: result.testCommand,
                source: strategy.file,
                confidence: strategy.confidence
              };
            }
          } catch {
            // Continue to next strategy on read error
          }
        }
      }

      // No test command detected
      return {
        detected: false,
        setupCommand: null,
        testCommand: null,
        source: null,
        confidence: 'low'
      };
    }
  };
}
