/**
 * Container Manager - Sandbox lifecycle and agent spawning
 *
 * Handles:
 * - Workspace container creation/retrieval
 * - Agent process spawning in containers
 * - Backup creation after initial setup
 * - Backup restoration on workspace resume
 */

import { getSandbox, type Sandbox } from '@cloudflare/sandbox';
import type { AdapterConfig } from './adapters';

// Extend Sandbox type to include backup methods (Feb 2026 API)
type SandboxWithBackup = Sandbox & {
  createBackup(options: { dir: string; name?: string; ttl?: number }): Promise<{ id: string; dir: string }>;
  restoreBackup(backup: { id: string; dir: string }): Promise<void>;
};

export interface ContainerInfo {
  id: string;
  sessionId: string;
  status: 'starting' | 'ready' | 'error';
  backupId?: string;
}

export interface BackupHandle {
  id: string;
  dir: string;
  createdAt: number;
}

// Tagged Errors
export class ContainerError extends Error {
  readonly _tag = 'ContainerError';
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'ContainerError';
  }
}

export class BackupError extends Error {
  readonly _tag = 'BackupError';
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'BackupError';
  }
}

export class AgentStartError extends Error {
  readonly _tag = 'AgentStartError';
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'AgentStartError';
  }
}

// Container Service
export interface ContainerEnv {
  Sandbox: Parameters<typeof getSandbox>[0];
}

export async function getOrCreateContainer(
  env: ContainerEnv,
  sessionId: string,
  backupId?: string
): Promise<ContainerInfo> {
  const sandbox = getSandbox(env.Sandbox, `session-${sessionId}`) as SandboxWithBackup;

  try {
    if (backupId) {
      console.log(`[Container] Restoring backup ${backupId} for session ${sessionId}`);
      const backup = JSON.parse(backupId) as BackupHandle;
      await sandbox.restoreBackup(backup);
      console.log(`[Container] Backup restored successfully`);
    } else {
      console.log(`[Container] Creating new container for session ${sessionId}`);
      await sandbox.exec('echo "container ready"');
    }
    return { id: `session-${sessionId}`, sessionId, status: 'ready', backupId };
  } catch (error) {
    console.error(`[Container] Failed to get/create container:`, error);
    throw new ContainerError(`Failed to get or create container for session ${sessionId}`, error);
  }
}

export async function createWorkspaceBackup(
  env: ContainerEnv,
  containerId: string,
  workspacePath: string = '/workspace'
): Promise<BackupHandle> {
  const sandbox = getSandbox(env.Sandbox, containerId) as SandboxWithBackup;
  try {
    console.log(`[Container] Creating backup of ${workspacePath}`);
    const backup = await sandbox.createBackup({ dir: workspacePath, name: `ws-${containerId}-${Date.now()}`, ttl: 7 * 24 * 60 * 60 });
    const handle: BackupHandle = { id: backup.id, dir: backup.dir, createdAt: Date.now() };
    console.log(`[Container] Backup created: ${backup.id}`);
    return handle;
  } catch (error) {
    console.error(`[Container] Failed to create backup:`, error);
    throw new BackupError(`Failed to create workspace backup for ${containerId}`, error);
  }
}

export async function restoreWorkspaceBackup(
  env: ContainerEnv,
  containerId: string,
  backupHandle: BackupHandle
): Promise<void> {
  const sandbox = getSandbox(env.Sandbox, containerId) as SandboxWithBackup;
  try {
    console.log(`[Container] Restoring backup ${backupHandle.id}`);
    await sandbox.restoreBackup(backupHandle);
  } catch (error) {
    console.error(`[Container] Failed to restore backup:`, error);
    throw new BackupError(`Failed to restore workspace backup ${backupHandle.id}`, error);
  }
}

export async function execInContainer(
  env: ContainerEnv,
  containerId: string,
  command: string,
  options?: { cwd?: string; env?: Record<string, string> }
): Promise<{ stdout: string; stderr: string }> {
  const sandbox = getSandbox(env.Sandbox, containerId);
  try {
    const result = await sandbox.exec(command, { cwd: options?.cwd, env: options?.env });
    const exitCode = (result as { code?: number }).code;
    if (exitCode !== 0 && exitCode !== undefined) {
      throw new ContainerError(
        `Command failed in container ${containerId}: ${command}`,
        { stdout: result.stdout, stderr: result.stderr, exitCode }
      );
    }
    return { stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    console.error(`[Container] Exec failed:`, error);
    if (error instanceof ContainerError) {
      throw error;
    }
    throw new ContainerError(`Exec failed in container ${containerId}: ${command}`, error);
  }
}

export async function cloneSource(
  env: ContainerEnv,
  containerId: string,
  sourceUrl: string,
  workspacePath?: string
): Promise<void> {
  const targetWorkspacePath = workspacePath ?? resolveWorkspaceRoot(sourceUrl);
  console.log(`[Container] Checking out ${sourceUrl} to ${targetWorkspacePath}`);
  const sandbox = getSandbox(env.Sandbox, containerId);
  try {
    try {
      await sandbox.gitCheckout(sourceUrl, {
        targetDir: targetWorkspacePath,
        depth: 1,
      });
    } catch (error) {
      throw new ContainerError(
        `Failed to check out source: git checkout failed: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }

    let checkoutEntries;
    try {
      checkoutEntries = await sandbox.listFiles(targetWorkspacePath, {
        recursive: false,
        includeHidden: true,
      });
    } catch (error) {
      throw new ContainerError(
        `Failed to check out source: post-check listing failed: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }

    if (checkoutEntries.count === 0) {
      throw new ContainerError(
        'Failed to clone the repository into the workspace: the checkout completed without any files.',
      );
    }
  } catch (error) {
    let detail =
      error instanceof Error ? error.message : `Unknown checkout failure for ${sourceUrl}`;
    if (
      detail.startsWith('Failed to check out source:')
    ) {
      detail = detail.slice(
        'Failed to check out source:'.length,
      ).trim();
    }
    console.error(`[Container] Checkout failed: ${detail}`);
    throw new ContainerError(
      `Failed to check out source: ${detail}`,
      error,
    );
  }
}

function deriveSourceDirectoryName(sourceUrl: string): string {
  const trimmed = sourceUrl.trim().replace(/[#?].*$/, '').replace(/\/+$/, '');
  const lastSegment = trimmed.split('/').pop() || '';
  const withoutGitSuffix = lastSegment.replace(/\.git$/i, '');
  const safeName = withoutGitSuffix.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '');
  return safeName || 'workspace';
}

export function resolveWorkspaceRoot(sourceUrl?: string | null): string {
  if (!sourceUrl) {
    return '/workspace';
  }
  return `/workspace/${deriveSourceDirectoryName(sourceUrl)}`;
}

// ================================================================
// Process I/O for FAP (filepath Agent Protocol)
// ================================================================

/**
 * Start an agent process that speaks FAP over stdin/stdout.
 * Returns a handle for sending messages and reading responses.
 *
 * This path is intentionally not wired until real stdin/stdout streaming exists.
 */
export interface AgentProcessHandle {
  processId: string;
  send: (message: string) => Promise<void>;
  onEvent: (callback: (event: unknown) => void) => void;
  close: () => Promise<void>;
}

export async function startFAPAgent(
  _env: ContainerEnv,
  containerId: string,
  _harnessId: string,
  _config: AdapterConfig
): Promise<AgentProcessHandle> {
  throw new Error(
    `startFAPAgent is not implemented yet for container ${containerId}. ` +
    "Wire real stdin/stdout streaming before calling it."
  );
}
