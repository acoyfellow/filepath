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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Sandbox: any;
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
    throw new ContainerError(`Failed to get or create container for session ${sessionId}`, error);
  }
}

export async function startAgentInContainer(
  env: ContainerEnv,
  containerId: string,
  agentType: string,
  config: AdapterConfig
): Promise<{ processId: string }> {
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
    return { processId: proc.pid ? String(proc.pid) : 'unknown' };
  } catch (error) {
    console.error(`[Container] Failed to start agent ${agentType}:`, error);
    throw new AgentStartError(`Failed to start ${agentType} in container ${containerId}`, error);
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

export async function cloneRepo(
  env: ContainerEnv,
  containerId: string,
  repoUrl: string,
  workspacePath: string = '/workspace'
): Promise<void> {
  console.log(`[Container] Cloning ${repoUrl} to ${workspacePath}`);
  const sandbox = getSandbox(env.Sandbox, containerId);
  try {
    try {
      await sandbox.gitCheckout(repoUrl, {
        targetDir: workspacePath,
        depth: 1,
      });
    } catch (error) {
      throw new ContainerError(
        `Failed to clone the session repository into the sandbox workspace: git checkout failed: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }

    let checkoutEntries;
    try {
      checkoutEntries = await sandbox.listFiles(workspacePath, {
        recursive: false,
        includeHidden: true,
      });
    } catch (error) {
      throw new ContainerError(
        `Failed to clone the session repository into the sandbox workspace: workspace post-check listing failed: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }

    if (checkoutEntries.count === 0) {
      throw new ContainerError(
        'Failed to clone the session repository into the sandbox workspace: the checkout completed without any files.',
      );
    }
  } catch (error) {
    let detail =
      error instanceof Error ? error.message : `Unknown clone failure for ${repoUrl}`;
    if (
      detail.startsWith('Failed to clone the session repository into the sandbox workspace:')
    ) {
      detail = detail.slice(
        'Failed to clone the session repository into the sandbox workspace:'.length,
      ).trim();
    }
    console.error(`[Container] Clone failed: ${detail}`);
    throw new ContainerError(
      `Failed to clone the session repository into the sandbox workspace: ${detail}`,
      error,
    );
  }
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
// Explicit Artifact Transport
// ================================================================

function normalizeWorkspacePath(inputPath: string, label: string): string {
  let normalized = inputPath.trim();
  if (!normalized) {
    throw new ContainerError(`${label} is required.`);
  }
  if (normalized === '/workspace') {
    throw new ContainerError(`${label} must point to a file inside /workspace.`);
  }
  if (normalized.startsWith('/workspace/')) {
    normalized = normalized.slice('/workspace/'.length);
  } else if (normalized.startsWith('/')) {
    normalized = normalized.slice(1);
  }

  const parts = normalized.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) {
    throw new ContainerError(`${label} must stay inside the thread workspace.`);
  }

  return parts.join('/');
}

interface StoredArtifactPayload {
  content: string;
  encoding: 'utf-8' | 'base64';
  isBinary: boolean;
  mimeType: string | null;
}

const MAX_ARTIFACT_CONTENT_LENGTH = 512_000;

export async function exportArtifactFromContainer(
  env: ContainerEnv & { ARTIFACTS: R2Bucket },
  containerId: string,
  sessionId: string,
  nodeId: string,
  sourcePath: string
): Promise<{ bucketKey: string }> {
  const relativeSourcePath = normalizeWorkspacePath(sourcePath, 'Source path');
  const sourceAbsolutePath = `/workspace/${relativeSourcePath}`;
  const sandbox = getSandbox(env.Sandbox, containerId);
  const existsResult = await sandbox.exists(sourceAbsolutePath);
  if (!existsResult.exists) {
    throw new ContainerError('Source path does not exist.');
  }

  const file = await sandbox.readFile(sourceAbsolutePath) as {
    content: string;
    encoding?: string;
    isBinary?: boolean;
    mimeType?: string;
  };
  const payload: StoredArtifactPayload = {
    content: file.content,
    encoding: file.encoding === 'base64' ? 'base64' : 'utf-8',
    isBinary: Boolean(file.isBinary),
    mimeType: file.mimeType ?? null,
  };

  if (payload.content.length > MAX_ARTIFACT_CONTENT_LENGTH) {
    throw new ContainerError('Artifact is too large for v1 transfer. Keep transfers under 384KB.');
  }

  const bucketKey = `sessions/${sessionId}/artifacts/${nodeId}/${crypto.randomUUID()}`;
  await env.ARTIFACTS.put(bucketKey, JSON.stringify(payload));
  return { bucketKey };
}

export async function importArtifactToContainer(
  env: ContainerEnv & { ARTIFACTS: R2Bucket },
  containerId: string,
  bucketKey: string,
  targetPath: string
): Promise<void> {
  const relativeTargetPath = normalizeWorkspacePath(targetPath, 'Target path');
  const storedObject = await env.ARTIFACTS.get(bucketKey);
  if (!storedObject) {
    throw new BackupError(`Artifact ${bucketKey} was not found in storage.`);
  }

  const rawPayload = (await storedObject.text()).trim();
  if (!rawPayload) {
    throw new BackupError(`Artifact ${bucketKey} is empty or unreadable.`);
  }
  let payload: StoredArtifactPayload;
  try {
    payload = JSON.parse(rawPayload) as StoredArtifactPayload;
  } catch (error) {
    throw new BackupError(`Artifact ${bucketKey} payload is invalid.`, error);
  }
  if (
    typeof payload.content !== 'string' ||
    (payload.encoding !== 'utf-8' && payload.encoding !== 'base64')
  ) {
    throw new BackupError(`Artifact ${bucketKey} payload is incomplete.`);
  }

  const targetAbsolutePath = `/workspace/${relativeTargetPath}`;
  const lastSlash = targetAbsolutePath.lastIndexOf('/');
  const targetParent =
    lastSlash > 0 ? targetAbsolutePath.slice(0, lastSlash) : '/workspace';
  const sandbox = getSandbox(env.Sandbox, containerId);
  await sandbox.mkdir(targetParent, { recursive: true });
  await sandbox.writeFile(targetAbsolutePath, payload.content, {
    encoding: payload.encoding,
  });
}
