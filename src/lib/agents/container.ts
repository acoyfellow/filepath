/**
 * Container Manager - Sandbox lifecycle and agent spawning
 *
 * Handles:
 * - Session container creation/retrieval
 * - Agent process spawning in containers
 * - Backup creation after initial setup
 * - Backup restoration on session resume
 */

import { getSandbox, type Sandbox } from '@cloudflare/sandbox';
import type { R2Bucket } from '@cloudflare/workers-types';
import { ADAPTER_COMMANDS, type AdapterConfig } from './adapters';
import { sanitizeEnvForLogging } from '$lib/env';

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

export interface TerminalHandle {
  port: number;
  token: string;
  url: string;
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
  Sandbox: DurableObjectNamespace<Sandbox>;
}

function getTerminalProtocol(hostname: string): 'http' | 'https' {
  const lower = hostname.toLowerCase();
  if (
    lower.includes('localhost') ||
    lower.startsWith('127.0.0.1') ||
    lower.startsWith('[::1]')
  ) {
    return 'http';
  }
  return 'https';
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
    return { id: `session-${sessionId}`, sessionId, status: 'error', backupId };
  }
}

export async function startAgentInContainer(
  env: ContainerEnv,
  containerId: string,
  agentType: string,
  config: AdapterConfig
): Promise<{ processId: string; success: boolean }> {
  const sandbox = getSandbox(env.Sandbox, containerId);
  const command = ADAPTER_COMMANDS[agentType];
  if (!command) throw new AgentStartError(`Unknown agent type: ${agentType}`);

  const envVars = {
    FILEPATH_TASK: config.task || '',
    FILEPATH_API_KEY: config.apiKey,
    FILEPATH_MODEL: config.model,
    FILEPATH_AGENT_TYPE: config.agentType,
    FILEPATH_WORKSPACE: config.workspacePath,
    ...config.envVars,
  };

  // Log sanitized version - never log actual secrets
  console.log(`[Container] Starting agent ${agentType} with env:`, sanitizeEnvForLogging(envVars));

  try {
    const proc = await sandbox.startProcess(command, { env: envVars, cwd: config.workspacePath });
    return { processId: proc.pid ? String(proc.pid) : 'unknown', success: true };
  } catch (error) {
    console.error(`[Container] Failed to start agent ${agentType}:`, error);
    return { processId: '', success: false };
  }
}

export async function createWorkspaceBackup(
  env: ContainerEnv,
  containerId: string,
  workspacePath: string = '/workspace'
): Promise<BackupHandle | null> {
  const sandbox = getSandbox(env.Sandbox, containerId) as SandboxWithBackup;
  try {
    console.log(`[Container] Creating backup of ${workspacePath}`);
    const backup = await sandbox.createBackup({ dir: workspacePath, name: `ws-${containerId}-${Date.now()}`, ttl: 7 * 24 * 60 * 60 });
    const handle: BackupHandle = { id: backup.id, dir: backup.dir, createdAt: Date.now() };
    console.log(`[Container] Backup created: ${backup.id}`);
    return handle;
  } catch (error) {
    console.error(`[Container] Failed to create backup:`, error);
    return null;
  }
}

export async function restoreWorkspaceBackup(
  env: ContainerEnv,
  containerId: string,
  backupHandle: BackupHandle
): Promise<boolean> {
  const sandbox = getSandbox(env.Sandbox, containerId) as SandboxWithBackup;
  try {
    console.log(`[Container] Restoring backup ${backupHandle.id}`);
    await sandbox.restoreBackup(backupHandle);
    return true;
  } catch (error) {
    console.error(`[Container] Failed to restore backup:`, error);
    return false;
  }
}

export async function execInContainer(
  env: ContainerEnv,
  containerId: string,
  command: string,
  options?: { cwd?: string; env?: Record<string, string> }
): Promise<{ stdout: string; stderr: string; success: boolean }> {
  const sandbox = getSandbox(env.Sandbox, containerId);
  try {
    const result = await sandbox.exec(command, { cwd: options?.cwd, env: options?.env });
    const exitCode = (result as { code?: number }).code;
    return { stdout: result.stdout, stderr: result.stderr, success: exitCode === 0 || exitCode === undefined };
  } catch (error) {
    console.error(`[Container] Exec failed:`, error);
    return { stdout: '', stderr: String(error), success: false };
  }
}

export async function cloneRepo(
  env: ContainerEnv,
  containerId: string,
  repoUrl: string,
  workspacePath: string = '/workspace'
): Promise<boolean> {
  console.log(`[Container] Cloning ${repoUrl} to ${workspacePath}`);
  const result = await execInContainer(env, containerId, `git clone ${repoUrl} .`, { cwd: workspacePath });
  if (!result.success) console.error(`[Container] Clone failed: ${result.stderr}`);
  return result.success;
}

export async function ensureTerminalInContainer(
  env: ContainerEnv,
  containerId: string,
  hostname: string
): Promise<TerminalHandle> {
  const sandbox = getSandbox(env.Sandbox, containerId) as Sandbox & {
    listProcesses(): Promise<Array<{ id: string; command: string; status: string }>>;
    isPortExposed(port: number): Promise<boolean>;
    exposePort(
      port: number,
      options: { hostname: string; token: string; name?: string }
    ): Promise<{ url: string }>;
  };
  const port = 7681;
  const token = `term-${containerId.slice(0, 8).toLowerCase()}`;
  const terminalCommand = "ttyd --writable --port 7681 bash -lc 'cd /workspace && exec bash -l'";

  const existingProcess = (await sandbox.listProcesses()).find(
    (proc) => proc.command.includes('ttyd') && proc.status === 'running'
  );

  if (!existingProcess) {
    try {
      const proc = await sandbox.startProcess(terminalCommand, {
        cwd: '/workspace',
      });
      await proc.waitForPort(port, { timeout: 5000 });
    } catch (error) {
      throw new Error(
        `Unable to start a terminal for ${containerId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const alreadyExposed = await sandbox.isPortExposed(port);
  if (!alreadyExposed) {
    await sandbox.exposePort(port, {
      hostname,
      token,
      name: 'terminal',
    });
  }

  const protocol = getTerminalProtocol(hostname);
  return {
    port,
    token,
    url: `${protocol}://${port}-${containerId}-${token}.${hostname}`,
  };
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
  _agentType: string,
  _config: AdapterConfig
): Promise<AgentProcessHandle> {
  throw new Error(
    `startFAPAgent is not implemented yet for container ${containerId}. ` +
    "Wire real stdin/stdout streaming before calling it."
  );
}

// ================================================================
// Session Mode: R2 Bucket Mounting
// ================================================================

/**
 * Mount an R2 bucket for session mode file sharing.
 * In session mode, all agents share the same filesystem (mounted from R2).
 *
 * This path is intentionally not wired until real R2 mounting exists.
 */
export interface MountBucketOptions {
  bucket: R2Bucket;
  sessionId: string;
  prefix?: string;
}

export async function mountBucket(
  _options: MountBucketOptions
): Promise<{ success: boolean; mountPath: string }> {
  throw new Error(
    `mountBucket is not implemented yet for session ${_options.sessionId}. ` +
    "Wire real R2 mounting before calling it."
  );
}

/**
 * Sync files from container to R2 bucket (for session mode persistence)
 */
export async function syncToBucket(
  _bucket: R2Bucket,
  sessionId: string,
  containerId: string,
  _sourcePath: string = '/workspace'
): Promise<boolean> {
  throw new Error(
    `syncToBucket is not implemented yet for session ${sessionId} (${containerId}). ` +
    "Wire real R2 sync before calling it."
  );
}

/**
 * Restore files from R2 bucket to container (for session mode resume)
 */
export async function restoreFromBucket(
  _bucket: R2Bucket,
  sessionId: string,
  containerId: string,
  _targetPath: string = '/workspace'
): Promise<boolean> {
  throw new Error(
    `restoreFromBucket is not implemented yet for session ${sessionId} (${containerId}). ` +
    "Wire real R2 restore before calling it."
  );
}
