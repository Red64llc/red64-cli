/**
 * Project Detector Service
 * Auto-detects test commands from various project configuration files
 */

import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Detection result interface
 */
export interface DetectionResult {
  readonly detected: boolean;
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
 * Detection strategy for a specific project type
 */
interface DetectionStrategy {
  readonly file: string;
  readonly detect: (content: string) => string | null;
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
    detect: (content: string) => {
      try {
        const pkg = JSON.parse(content);
        // Check scripts.test - ignore default npm init placeholder
        if (pkg.scripts?.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
          return 'npm test';
        }
        // Check for common test runners in dependencies
        const deps = { ...pkg.devDependencies, ...pkg.dependencies };
        if (deps?.vitest) {
          return 'npx vitest run';
        }
        if (deps?.jest) {
          return 'npx jest';
        }
        if (deps?.mocha) {
          return 'npx mocha';
        }
        if (deps?.ava) {
          return 'npx ava';
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
      if (content.includes('[tool.pytest') || content.includes('pytest')) {
        return 'pytest';
      }
      if (content.includes('unittest')) {
        return 'python -m unittest discover';
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
        return 'pytest';
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
        return 'pytest';
      }
      return null;
    }
  },
  // Rust / Cargo.toml
  {
    file: 'Cargo.toml',
    confidence: 'high',
    detect: (_content: string) => {
      return 'cargo test';
    }
  },
  // Go / go.mod
  {
    file: 'go.mod',
    confidence: 'high',
    detect: (_content: string) => {
      return 'go test ./...';
    }
  },
  // Ruby / Gemfile
  {
    file: 'Gemfile',
    confidence: 'medium',
    detect: (content: string) => {
      if (content.includes('rspec')) {
        return 'bundle exec rspec';
      }
      if (content.includes('minitest')) {
        return 'bundle exec rake test';
      }
      return null;
    }
  },
  // Java / Maven
  {
    file: 'pom.xml',
    confidence: 'high',
    detect: (_content: string) => {
      return 'mvn test';
    }
  },
  // Java/Kotlin / Gradle
  {
    file: 'build.gradle',
    confidence: 'high',
    detect: (_content: string) => {
      return './gradlew test';
    }
  },
  // Kotlin DSL
  {
    file: 'build.gradle.kts',
    confidence: 'high',
    detect: (_content: string) => {
      return './gradlew test';
    }
  },
  // Makefile
  {
    file: 'Makefile',
    confidence: 'medium',
    detect: (content: string) => {
      if (content.match(/^test\s*:/m)) {
        return 'make test';
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
        if (composer.scripts?.test) {
          return 'composer test';
        }
        const deps = { ...composer.require, ...composer['require-dev'] };
        if (deps?.['phpunit/phpunit']) {
          return './vendor/bin/phpunit';
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
    detect: (_content: string) => {
      return 'mix test';
    }
  },
  // .NET / C#
  {
    file: '*.csproj',
    confidence: 'high',
    detect: (_content: string) => {
      return 'dotnet test';
    }
  }
];

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
            const testCommand = strategy.detect(content);

            if (testCommand) {
              return {
                detected: true,
                testCommand,
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
        testCommand: null,
        source: null,
        confidence: 'low'
      };
    }
  };
}
