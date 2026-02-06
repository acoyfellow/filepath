/**
 * Conductor Interface
 * 
 * Typed interface for orchestrating agent sessions.
 * This is the programmatic equivalent of:
 *   ~/bin/worker  - start/stop/list loops
 *   ~/bin/conv    - manage conversations
 *   ~/bin/ctx     - context window management
 *   ~/bin/steerer - auto-commit, error watch (merged into Conductor)
 *   deja API      - cross-session memory
 *   shelley API   - conversation CRUD
 * 
 * The conductor is the "outermost loop" — the human (or orchestrator agent)
 * steering workers, managing memory, and observing progress.
 */

import type { AgentType, AgentConfig, ModelId, RouterId } from './session';

// ============================================================
// Worker Loop Management (~/bin/worker equivalent)
// ============================================================

export type WorkerStatus = 
  | 'running'       // actively in a session
  | 'between'       // between sessions (handoff in progress)
  | 'stopped'       // manually stopped
  | 'complete'      // agent said DONE:
  | 'error'         // crashed or failed
  | 'max_reached';  // hit session limit

export interface WorkerState {
  name: string;
  status: WorkerStatus;
  pid: number;
  dir: string;
  task: string;
  session: number;         // current session number
  maxSessions: number;
  model: ModelId;
  convId: string | null;   // current conversation ID
  lastConvId: string | null;
  started: string;         // ISO timestamp
  lastHandoff?: string;    // last HANDOFF: message
}

export interface StartWorkerParams {
  name: string;
  task: string;
  dir: string;
  maxSessions?: number;    // default 10
  model?: ModelId;         // default claude-opus-4-6
  agentType?: AgentType;   // which agent binary to use
  config?: AgentConfig;    // full agent config
}

export interface AdjustWorkerParams {
  name: string;
  maxSessions?: number;
  model?: ModelId;
  task?: string;           // update task mid-run
}

export interface WorkerManager {
  /** Start a new worker loop */
  start(params: StartWorkerParams): Promise<WorkerState>;
  
  /** Stop a worker (graceful — waits for current tool call) */
  stop(name: string): Promise<void>;
  
  /** Stop all running workers */
  stopAll(): Promise<void>;
  
  /** List all workers with current state */
  list(): Promise<WorkerState[]>;
  
  /** Get a single worker's state */
  get(name: string): Promise<WorkerState | null>;
  
  /** Adjust a running worker's params */
  adjust(params: AdjustWorkerParams): Promise<WorkerState>;
  
  /** Get recent log output */
  log(name: string, lines?: number): Promise<string>;
  
  /** Stream log output in real-time */
  tailLog(name: string): AsyncIterable<string>;
}

// ============================================================
// Conversation Management (~/bin/conv + shelley API equivalent)
// ============================================================

export interface ConversationInfo {
  id: string;
  slug: string;
  model: string;
  archived: boolean;
  working: boolean;         // currently processing
  contextSize: number;      // tokens used
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  type: 'user' | 'agent';
  text: string;
  toolCalls?: ToolCall[];
  timestamp: string;
}

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
  output?: string;
}

export interface ConversationManager {
  /** List all conversations (optionally filter working only) */
  list(opts?: { working?: boolean; archived?: boolean }): Promise<ConversationInfo[]>;
  
  /** Get conversation details */
  get(idOrSlug: string): Promise<ConversationInfo | null>;
  
  /** Get messages from a conversation */
  messages(id: string, opts?: { limit?: number; offset?: number }): Promise<ConversationMessage[]>;
  
  /** Send a message to a conversation (human interjection) */
  send(id: string, message: string): Promise<void>;
  
  /** Cancel a running conversation */
  cancel(id: string): Promise<void>;
  
  /** Archive a conversation */
  archive(id: string): Promise<void>;
  
  /** Unarchive */
  unarchive(id: string): Promise<void>;
  
  /** Get context window size in tokens */
  contextSize(id: string): Promise<number>;
}

// ============================================================
// Context Management (~/bin/ctx equivalent)
// ============================================================

export interface ContextMessage {
  messageId: string;
  type: string;
  preview: string;          // first 200 chars
  tokens: number;
}

export interface ContextManager {
  /** Check total context size for a conversation */
  size(conversationId: string): Promise<number>;
  
  /** Search for messages matching a pattern */
  search(conversationId: string, query: string): Promise<ContextMessage[]>;
  
  /** Delete specific messages to free context */
  forget(messageIds: string[]): Promise<{ freed: number }>;
  
  /** List recent messages with token counts */
  list(conversationId: string, limit?: number): Promise<ContextMessage[]>;
}

// ============================================================
// Memory (deja API equivalent)
// ============================================================

export interface Memory {
  id: string;
  trigger: string;
  learning: string;
  confidence: number;
  scope: string;
  createdAt: string;
}

export interface MemoryQuery {
  context: string;
  limit?: number;            // default 5
  scope?: string;            // filter by scope
}

export interface MemoryStore {
  trigger: string;
  learning: string;
  confidence?: number;       // default 0.9
  scope?: string;
}

export interface MemoryManager {
  /** Query for relevant memories */
  query(params: MemoryQuery): Promise<Memory[]>;
  
  /** Store a new learning */
  store(params: MemoryStore): Promise<Memory>;
  
  /** Delete a memory by ID */
  delete(id: string): Promise<void>;
  
  /** List all memories (paginated) */
  list(opts?: { limit?: number; offset?: number }): Promise<Memory[]>;
}

// ============================================================
// Session Search (~/bin/shelley-search equivalent)
// ============================================================

export interface SearchResult {
  conversationId: string;
  slug: string;
  updatedAt: string;
  snippet: string;
}

export interface SessionSearch {
  /** Search past conversations for a pattern */
  search(pattern: string, limit?: number): Promise<SearchResult[]>;
  
  /** Get compact context for prompt injection */
  recall(query: string, limit?: number): Promise<string>;
}

// ============================================================
// Health (~/bin/steerer + gates/health.sh — folded into Conductor)
// ============================================================

export type HealthStatus = 'healthy' | 'warning' | 'error';

export interface HealthCheck {
  status: HealthStatus;
  build: { passing: boolean; errorCount: number; errors?: string[] };
  uncommitted: { count: number; files?: string[] };
  syntax: { passing: boolean; issues?: string[] };
  warnings: string[];
}

// ============================================================
// The Conductor (combines everything)
// ============================================================

/**
 * The Conductor is the top-level orchestration interface.
 * 
 * It's what you use from:
 * - The orchestrator chat panel (UI)
 * - The orchestrator agent (automated)
 * - The human (you, manually)
 * 
 * Everything that was a bash script + curl command
 * is now a typed method call.
 */
export interface Conductor {
  workers: WorkerManager;
  conversations: ConversationManager;
  context: ContextManager;
  memory: MemoryManager;
  search: SessionSearch;
  
  // ---- Health & observation (the "steering") ----
  
  /** Run health check on a directory */
  healthCheck(dir: string): Promise<HealthCheck>;
  
  /** Auto-commit orphaned work */
  rescueOrphans(dir: string): Promise<{ committed: boolean; files?: string[] }>;
  
  /** Check and report type errors */
  typeCheck(dir: string): Promise<{ passing: boolean; errors: string[] }>;
  
  // ---- High-level session lifecycle ----
  
  /** Get full status overview (what you'd see in a dashboard) */
  status(): Promise<ConductorStatus>;
  
  /** Start a session with orchestrator + workers in one call */
  launchSession(params: LaunchSessionParams): Promise<LaunchResult>;
  
  /** Pause all workers in a session (preserve state) */
  pauseSession(sessionId: string): Promise<void>;
  
  /** Resume a paused session */
  resumeSession(sessionId: string): Promise<void>;
  
  /** Teardown: stop everything, final sync, archive */
  destroySession(sessionId: string): Promise<void>;
}

export interface ConductorStatus {
  workers: WorkerState[];
  activeConversations: ConversationInfo[];
  health: HealthCheck;
  memoryCount: number;
  uptime: string;
}

export interface LaunchSessionParams {
  name: string;
  description?: string;
  gitRepoUrl?: string;
  dir: string;
  orchestrator: {
    agentType: AgentType;
    config: AgentConfig;
  };
  workers: Array<{
    name: string;
    agentType: AgentType;
    config: AgentConfig;
    task: string;
  }>;
}

export interface LaunchResult {
  sessionId: string;
  orchestrator: WorkerState;
  workers: WorkerState[];
}
