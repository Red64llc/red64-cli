/**
 * PR Status Fetcher Service
 * Task 1.2: Implement PR status fetching service
 * Requirements: 2.4, 4.3
 */

import { spawn } from 'node:child_process';

/**
 * PR status information
 * Requirements: 2.4 - Fetch PR status for display
 */
export interface PRStatus {
  readonly number: number;
  readonly url: string;
  readonly state: 'open' | 'closed' | 'merged';
  readonly mergeable: boolean;
  readonly reviewDecision: 'approved' | 'changes_requested' | 'review_required' | 'unknown';
  readonly checksStatus: 'passing' | 'failing' | 'pending' | 'unknown';
}

/**
 * PR close operation result
 * Requirements: 4.3 - Close PR on abort
 */
export interface PRCloseResult {
  readonly success: boolean;
  readonly error: string | undefined;
}

/**
 * PR status fetcher service interface
 * Requirements: 2.4, 4.3
 */
export interface PRStatusFetcherService {
  getStatus(prNumberOrUrl: string | number): Promise<PRStatus | undefined>;
  close(prNumber: number): Promise<PRCloseResult>;
}

/**
 * Execute gh command and return result
 */
function execGh(
  args: readonly string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const process = spawn('gh', args as string[], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    process.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    process.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });

    process.on('error', (error) => {
      resolve({
        stdout,
        stderr: stderr || `gh error: ${error.message}`,
        exitCode: -1
      });
    });
  });
}

/**
 * Map GitHub API state to our state type
 */
function mapState(apiState: string | null | undefined): PRStatus['state'] {
  switch (apiState?.toUpperCase()) {
    case 'OPEN':
      return 'open';
    case 'CLOSED':
      return 'closed';
    case 'MERGED':
      return 'merged';
    default:
      return 'open';
  }
}

/**
 * Map GitHub API mergeable status to boolean
 */
function mapMergeable(apiMergeable: string | null | undefined): boolean {
  return apiMergeable?.toUpperCase() === 'MERGEABLE';
}

/**
 * Map GitHub API review decision to our type
 */
function mapReviewDecision(
  apiDecision: string | null | undefined
): PRStatus['reviewDecision'] {
  switch (apiDecision?.toUpperCase()) {
    case 'APPROVED':
      return 'approved';
    case 'CHANGES_REQUESTED':
      return 'changes_requested';
    case 'REVIEW_REQUIRED':
      return 'review_required';
    default:
      return 'unknown';
  }
}

/**
 * Map GitHub API status check rollup to our type
 */
function mapChecksStatus(
  rollup: { state?: string } | null | undefined
): PRStatus['checksStatus'] {
  if (!rollup || !rollup.state) {
    return 'unknown';
  }

  switch (rollup.state.toUpperCase()) {
    case 'SUCCESS':
      return 'passing';
    case 'FAILURE':
    case 'ERROR':
      return 'failing';
    case 'PENDING':
    case 'EXPECTED':
      return 'pending';
    default:
      return 'unknown';
  }
}

/**
 * Parse gh pr view JSON response
 */
interface GhPrViewResponse {
  number?: number;
  url?: string;
  state?: string;
  mergeable?: string;
  reviewDecision?: string | null;
  statusCheckRollup?: { state?: string } | null;
}

/**
 * Create PR status fetcher service
 * Requirements: 2.4, 4.3 - Factory function for PR operations
 */
export function createPRStatusFetcher(): PRStatusFetcherService {
  return {
    /**
     * Get PR status by number or URL
     * Requirements: 2.4 - Fetch PR status for display
     */
    async getStatus(prNumberOrUrl: string | number): Promise<PRStatus | undefined> {
      const identifier = String(prNumberOrUrl);
      const fields = 'number,url,state,mergeable,reviewDecision,statusCheckRollup';

      const result = await execGh(['pr', 'view', identifier, '--json', fields]);

      if (result.exitCode !== 0) {
        // PR not found or gh not authenticated
        return undefined;
      }

      try {
        const data = JSON.parse(result.stdout) as GhPrViewResponse;

        return {
          number: data.number ?? 0,
          url: data.url ?? '',
          state: mapState(data.state),
          mergeable: mapMergeable(data.mergeable),
          reviewDecision: mapReviewDecision(data.reviewDecision),
          checksStatus: mapChecksStatus(data.statusCheckRollup)
        };
      } catch {
        // Invalid JSON response
        return undefined;
      }
    },

    /**
     * Close a PR by number
     * Requirements: 4.3 - Close PR on abort (never merge)
     */
    async close(prNumber: number): Promise<PRCloseResult> {
      const result = await execGh(['pr', 'close', String(prNumber)]);

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: result.stderr || 'Failed to close PR'
        };
      }

      return {
        success: true,
        error: undefined
      };
    }
  };
}
