import { AIChatAgent } from '@cloudflare/ai-chat';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, convertToModelMessages, tool, type StreamTextOnFinishCallback, type ToolSet } from 'ai';
import { z } from 'zod';
import { getSandbox } from '@cloudflare/sandbox';
import type { Env } from '../types';
import type { ModelId } from '$lib/types/session';

/** Worker slot info available to the orchestrator */
export interface WorkerSlotInfo {
  slotId: string;
  name: string;
  agentType: string;
  status: string;
}

/** State stored in the DO for this chat agent instance */
export interface ChatAgentState {
  slotId: string;
  sessionId: string;
  agentType: string;
  model: ModelId;
  systemPrompt: string;
  containerId?: string;
  /** Whether this is an orchestrator slot (has conductor tools) */
  isOrchestrator?: boolean;
  /** Worker slots this orchestrator can delegate to */
  workers?: WorkerSlotInfo[];
}

/**
 * Model ID mapping to provider-prefixed IDs.
 * All models route through Cloudflare AI Gateway → provider.
 * Gateway URL: https://gateway.ai.cloudflare.com/v1/{account_id}/default/{provider}
 * This gives us logging, caching, rate limiting for free.
 *
 * Fallback chain: CF AI Gateway → OpenRouter → direct OpenAI
 */
const MODEL_CONFIG: Record<ModelId, { provider: 'openai' | 'anthropic' | 'openrouter'; model: string }> = {
  'claude-sonnet-4': { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
  'claude-opus-4-6': { provider: 'anthropic', model: 'claude-opus-4-20250610' },
  'gpt-4o': { provider: 'openai', model: 'gpt-4o' },
  'o3': { provider: 'openai', model: 'o3' },
  'deepseek-r1': { provider: 'openrouter', model: 'deepseek/deepseek-r1' },
  'gemini-2.5-pro': { provider: 'openrouter', model: 'google/gemini-2.5-pro' },
};

/**
 * Get an AI SDK model instance.
 *
 * Routing:
 * 1. OpenRouter-native models (DeepSeek, Gemini) — direct to OpenRouter
 * 2. OpenAI models — CF AI Gateway → direct OpenAI
 * 3. Anthropic models — routed through OpenRouter (no Anthropic key)
 */
function getModel(modelId: ModelId, env: Env) {
  const config = MODEL_CONFIG[modelId];
  if (!config) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  const accountId = env.CLOUDFLARE_ACCOUNT_ID;

  // OpenRouter-native models (DeepSeek, Gemini, etc.)
  if (config.provider === 'openrouter') {
    if (!env.OPENROUTER_API_KEY) {
      throw new Error(
        `No OPENROUTER_API_KEY set for model ${modelId}. This model requires OpenRouter.`
      );
    }
    return createOpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    })(config.model);
  }

  // For OpenAI models: CF Gateway → direct OpenAI → OpenRouter
  if (config.provider === 'openai' && env.OPENAI_API_KEY) {
    const baseURL = accountId
      ? `https://gateway.ai.cloudflare.com/v1/${accountId}/default/openai`
      : 'https://api.openai.com/v1';
    return createOpenAI({ apiKey: env.OPENAI_API_KEY, baseURL })(config.model);
  }

  // For Anthropic models: route through OpenRouter (we don't have an Anthropic key)
  if (config.provider === 'anthropic' && env.OPENROUTER_API_KEY) {
    const OR_ANTHROPIC: Record<string, string> = {
      'claude-sonnet-4-20250514': 'anthropic/claude-sonnet-4',
      'claude-opus-4-20250610': 'anthropic/claude-opus-4.6',
    };
    const orId = OR_ANTHROPIC[config.model] ?? 'anthropic/claude-sonnet-4';
    return createOpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    })(orId);
  }

  throw new Error(
    `No API key for model ${modelId}. Set OPENROUTER_API_KEY or provider-specific keys.`
  );
}

/** Credits to deduct per LLM call (1 credit = $0.01) */
const CREDITS_PER_CALL = 1;

/**
 * Deduct credits from the user who owns this session.
 * Uses D1 directly since ChatAgent DO has access to the DB binding.
 */
async function deductCreditsForSession(db: Env['DB'], sessionId: string): Promise<boolean> {
  try {
    // Look up the session's user
    const session = await db.prepare(
      'SELECT user_id FROM multi_agent_session WHERE id = ?'
    ).bind(sessionId).first<{ user_id: string }>();

    if (!session?.user_id) {
      console.warn(`[ChatAgent] No session found for credit deduction: ${sessionId}`);
      return false;
    }

    // Atomic deduction: only deduct if balance >= credits
    const result = await db.prepare(
      'UPDATE user SET credit_balance = credit_balance - ? WHERE id = ? AND credit_balance >= ?'
    ).bind(CREDITS_PER_CALL, session.user_id, CREDITS_PER_CALL).run();

    const success = (result.meta?.changes ?? 0) > 0;
    if (!success) {
      console.warn(`[ChatAgent] Insufficient credits for user ${session.user_id}`);
    } else {
      console.log(`[ChatAgent] Deducted ${CREDITS_PER_CALL} credit(s) from user ${session.user_id}`);
    }
    return success;
  } catch (err) {
    console.error('[ChatAgent] Credit deduction failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

const DEFAULT_SYSTEM_PROMPT = `You are an AI coding assistant running inside a container environment.
You can help with programming tasks, answer questions, and assist with software development.

When you have a container available, use the execute_command tool to run shell commands.
Always check the output of commands and handle errors gracefully.
Prefer small, focused commands over long scripts.

If a git repository was cloned for this session, it will be at /workspace.
Start by checking if /workspace exists and what's in it with: ls -la /workspace`;

const ORCHESTRATOR_SYSTEM_PROMPT = `You are an AI orchestrator managing a team of worker agents.
Your job is to decompose complex tasks into subtasks and delegate them to workers.

You have these tools:
- **list_workers**: See all available workers and their current status
- **delegate_task**: Send a specific task to a worker
- **read_worker_messages**: Check a worker's progress and results
- **execute_command**: Run commands in your own container (if available)

Workflow:
1. When given a task, analyze it and break it into independent subtasks
2. Use list_workers to see available workers
3. Use delegate_task to assign subtasks to appropriate workers
4. Monitor progress with read_worker_messages
5. Synthesize results and report back to the user

Best practices:
- Assign tasks to workers based on their type/specialization
- Send clear, specific instructions to each worker
- Check worker progress periodically
- If a worker encounters issues, try re-delegating or adjusting the task
- Summarize the combined results when all workers finish

If a git repository was cloned for this session, it will be at /workspace in each container.
You can tell workers to look there for the codebase.`;

/**
 * ChatAgent — AIChatAgent-based DO for real LLM conversations.
 *
 * Each agent slot in a multi-agent session gets its own ChatAgent instance.
 * Messages are auto-persisted to DO SQLite by the SDK.
 * Streaming is handled via the WS chat protocol (cf_agent_use_chat_*).
 */
export class ChatAgent extends AIChatAgent<Env, ChatAgentState> {
  /** Get the container ID associated with this agent slot (if running). */
  get containerId(): string | undefined {
    return this.state?.containerId;
  }

  /**
   * Build tools available to the LLM.
   * - All agents with a container get execute_command for shell access.
   * - Orchestrators additionally get delegate_task, list_workers, read_worker_messages.
   */
  private getTools(): ToolSet {
    const tools: ToolSet = {};
    const cid = this.containerId;
    const env = this.env;

    // Container tools (for any agent with a container)
    if (cid) {
      tools.execute_command = tool({
        description: 'Execute a shell command in the agent\'s container. Returns stdout, stderr, and exit code.',
        parameters: z.object({
          command: z.string().describe('The shell command to execute'),
          cwd: z.string().optional().describe('Working directory (default: /home/user)'),
          timeout: z.number().optional().describe('Timeout in milliseconds (default: 30000)'),
        }),
        execute: async ({ command, cwd, timeout }) => {
          console.log(`[ChatAgent] exec in ${cid}: ${command}`);
          try {
            const sandbox = getSandbox(
              env.Sandbox as Parameters<typeof getSandbox>[0],
              cid,
            );
            const result = await sandbox.exec(command, {
              cwd: cwd ?? '/home/user',
              timeout: timeout ?? 30000,
            });
            return {
              stdout: result.stdout ?? '',
              stderr: result.stderr ?? '',
              exitCode: result.exitCode ?? -1,
            };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[ChatAgent] exec error: ${msg}`);
            return { stdout: '', stderr: msg, exitCode: 1 };
          }
        },
      });
    }

    // Conductor tools (orchestrator only)
    const agentState = this.state;
    if (agentState?.isOrchestrator && agentState.workers) {
      const workers = agentState.workers;

      tools.list_workers = tool({
        description: 'List all available workers, their types, and current status.',
        parameters: z.object({}),
        execute: async () => {
          // Re-fetch live statuses from D1
          const liveStatuses = await this.getWorkerStatuses(workers);
          return { workers: liveStatuses };
        },
      });

      tools.delegate_task = tool({
        description: 'Send a task to a worker agent. The worker will process it autonomously. Returns confirmation that the task was sent.',
        parameters: z.object({
          slotId: z.string().describe('The worker slot ID to send the task to (from list_workers)'),
          task: z.string().describe('A clear, specific task description for the worker'),
        }),
        execute: async ({ slotId, task }) => {
          const worker = workers.find(w => w.slotId === slotId);
          if (!worker) {
            return { success: false, error: `Worker with slotId ${slotId} not found` };
          }
          return this.delegateToWorker(slotId, worker.name, task);
        },
      });

      tools.read_worker_messages = tool({
        description: 'Read the recent messages from a worker\'s conversation to check their progress or results.',
        parameters: z.object({
          slotId: z.string().describe('The worker slot ID to read messages from'),
          limit: z.number().optional().describe('Max number of recent messages to read (default: 10)'),
        }),
        execute: async ({ slotId, limit }) => {
          return this.readWorkerMessages(slotId, limit ?? 10);
        },
      });
    }

    return tools;
  }

  /**
   * Fetch live worker statuses from D1.
   */
  private async getWorkerStatuses(workers: WorkerSlotInfo[]): Promise<WorkerSlotInfo[]> {
    const db = this.env.DB;
    if (!db || workers.length === 0) return workers;

    try {
      // Fetch current slot statuses from D1
      const slotIds = workers.map(w => w.slotId);
      const placeholders = slotIds.map(() => '?').join(',');
      const rows = await db.prepare(
        `SELECT id, status FROM agent_slot WHERE id IN (${placeholders})`
      ).bind(...slotIds).all<{ id: string; status: string }>();

      const statusMap = new Map<string, string>();
      for (const row of rows.results) {
        statusMap.set(row.id, row.status);
      }

      return workers.map(w => ({
        ...w,
        status: statusMap.get(w.slotId) ?? w.status,
      }));
    } catch (err) {
      console.error('[ChatAgent] Failed to fetch worker statuses:', err);
      return workers;
    }
  }

  /**
   * Send a task message to a worker's ChatAgent DO.
   */
  private async delegateToWorker(
    slotId: string,
    workerName: string,
    task: string,
  ): Promise<{ success: boolean; error?: string; workerName: string }> {
    try {
      const agentName = `chat-${slotId}`;
      const doId = this.env.ChatAgent.idFromName(agentName);
      const workerDO = this.env.ChatAgent.get(doId);

      // Send via the Agents SDK HTTP interface
      const chatPayload = {
        messages: [
          {
            id: crypto.randomUUID(),
            role: 'user' as const,
            parts: [{ type: 'text' as const, text: `[Task from Orchestrator]\n\n${task}` }],
          },
        ],
      };

      const headers = new Headers({
        'Content-Type': 'application/json',
        'x-partykit-room': agentName,
        'x-partykit-namespace': 'chat-agent',
      });

      const res = await workerDO.fetch(
        new Request(`https://internal/agents/chat-agent/${agentName}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(chatPayload),
        }),
      );

      if (!res.ok) {
        const errText = await res.text().catch(() => `Status ${res.status}`);
        console.error(`[ChatAgent] delegate to ${workerName} failed: ${errText}`);
        return { success: false, error: errText, workerName };
      }

      console.log(`[ChatAgent] delegated task to ${workerName} (${slotId})`);
      return { success: true, workerName };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ChatAgent] delegate error: ${msg}`);
      return { success: false, error: msg, workerName };
    }
  }

  /**
   * Read recent messages from a worker's ChatAgent DO.
   */
  private async readWorkerMessages(
    slotId: string,
    limit: number,
  ): Promise<{ messages: Array<{ role: string; text: string }>; error?: string }> {
    try {
      const agentName = `chat-${slotId}`;
      const doId = this.env.ChatAgent.idFromName(agentName);
      const workerDO = this.env.ChatAgent.get(doId);

      const headers = new Headers({
        'x-partykit-room': agentName,
        'x-partykit-namespace': 'chat-agent',
      });

      // Fetch messages via GET endpoint
      const res = await workerDO.fetch(
        new Request(`https://internal/agents/chat-agent/${agentName}/messages`, {
          method: 'GET',
          headers,
        }),
      );

      if (!res.ok) {
        return { messages: [], error: `Failed to fetch: ${res.status}` };
      }

      const data = await res.json() as Array<{ role?: string; parts?: Array<{ type?: string; text?: string }> }>;
      const messages = data
        .slice(-limit)
        .map((m) => {
          const text = m.parts?.map(p => p.text ?? '').join('') ?? '';
          return { role: m.role ?? 'unknown', text };
        })
        .filter(m => m.text.length > 0);

      return { messages };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { messages: [], error: msg };
    }
  }

  /**
   * Called by the SDK when the client sends a chat message.
   * `this.messages` is already populated with the full conversation
   * including the latest user message.
   */
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    options?: { abortSignal?: AbortSignal }
  ): Promise<Response> {
    const agentState = this.state;
    const modelId: ModelId = agentState?.model ?? 'claude-sonnet-4';
    const defaultPrompt = agentState?.isOrchestrator ? ORCHESTRATOR_SYSTEM_PROMPT : DEFAULT_SYSTEM_PROMPT;
    const systemPrompt = agentState?.systemPrompt || defaultPrompt;
    const tools = this.getTools();
    const hasTools = Object.keys(tools).length > 0;

    console.log(
      `[ChatAgent] onChatMessage slot=${agentState?.slotId ?? 'unknown'} model=${modelId} messages=${this.messages.length} container=${this.containerId ?? 'none'}`,
    );

    const sessionId = agentState?.sessionId;
    const db = this.env.DB;

    // Pre-check: does the user have credits?
    if (sessionId && db) {
      try {
        const session = await db.prepare(
          'SELECT u.credit_balance FROM multi_agent_session s JOIN user u ON s.user_id = u.id WHERE s.id = ?'
        ).bind(sessionId).first<{ credit_balance: number }>();

        if (session && session.credit_balance < CREDITS_PER_CALL) {
          console.warn(`[ChatAgent] Insufficient credits before LLM call, session=${sessionId}`);
          // Return as plain text — SDK wraps it as an assistant message
          return new Response(
            '⚠️ **Insufficient credits.** Please add credits in Settings → Billing to continue using the assistant.',
            { headers: { 'Content-Type': 'text/plain' } },
          );
        }
      } catch (err) {
        console.error('[ChatAgent] Credit check failed:', err instanceof Error ? err.message : err);
        // Continue anyway — don't block on credit check failure
      }
    }

    let model;
    try {
      model = getModel(modelId, this.env);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to initialize model';
      console.error(`[ChatAgent] model init error: ${msg}`);
      return new Response(
        `⚠️ **Configuration error:** ${msg}`,
        { headers: { 'Content-Type': 'text/plain' } },
      );
    }

    const result = streamText({
      model,
      system: systemPrompt,
      messages: await convertToModelMessages(this.messages),
      tools: hasTools ? tools : undefined,
      maxSteps: hasTools ? 10 : 1,
      abortSignal: options?.abortSignal,
      onFinish: async (event) => {
        // Deduct credits after successful LLM response
        if (sessionId && db) {
          await deductCreditsForSession(db, sessionId);
        }
        // Call the SDK's onFinish callback
        await onFinish(event);
      },
    });

    return result.toUIMessageStreamResponse();
  }
}
