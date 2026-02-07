import { AIChatAgent } from '@cloudflare/ai-chat';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, convertToModelMessages, tool, type StreamTextOnFinishCallback, type ToolSet } from 'ai';
import { z } from 'zod';
import { getSandbox } from '@cloudflare/sandbox';
import type { Env } from '../types';
import type { ModelId } from '$lib/types/session';

/** State stored in the DO for this chat agent instance */
export interface ChatAgentState {
  slotId: string;
  sessionId: string;
  agentType: string;
  model: ModelId;
  systemPrompt: string;
  containerId?: string;
}

/**
 * OpenRouter model ID mapping.
 * All models route through OpenRouter (OpenAI-compatible API)
 * using the OPENROUTER_API_KEY env var.
 */
const MODEL_MAP: Record<ModelId, string> = {
  'claude-sonnet-4': 'anthropic/claude-sonnet-4',
  'claude-opus-4-6': 'anthropic/claude-opus-4.6',
  'gpt-4o': 'openai/gpt-4o',
  'o3': 'openai/o3',
  'deepseek-r1': 'deepseek/deepseek-r1',
  'gemini-2.5-pro': 'google/gemini-2.5-pro',
};

/**
 * Maps our ModelId to AI SDK model via OpenRouter.
 * Uses a single API key (OPENROUTER_API_KEY) for all providers.
 */
function getModel(modelId: ModelId, env: Env) {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENROUTER_API_KEY. Add it to your environment to enable LLM calls.');
  }

  const openrouter = createOpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
  });

  const routerModelId = MODEL_MAP[modelId] ?? 'anthropic/claude-sonnet-4';
  return openrouter(routerModelId);
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
Prefer small, focused commands over long scripts.`;

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
   * If a container is assigned, includes execute_command for shell access.
   */
  private getTools(): ToolSet {
    const cid = this.containerId;
    if (!cid) return {};

    const env = this.env;

    return {
      execute_command: tool({
        description: 'Execute a shell command in the agent\'s container. Returns stdout, stderr, and exit code.',
        parameters: z.object({
          command: z.string().describe('The shell command to execute'),
          cwd: z.string().optional().describe('Working directory (default: /home/user)'),
          timeout: z.number().optional().describe('Timeout in milliseconds (default: 30000)'),
        }),
        execute: async ({ command, cwd, timeout }) => {
          console.log(`[ChatAgent] exec in ${cid}: ${command}`);
          try {
            // getSandbox expects the Sandbox binding — cast to avoid complex type
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
      }),
    };
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
    const systemPrompt = agentState?.systemPrompt || DEFAULT_SYSTEM_PROMPT;
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
          return new Response(JSON.stringify({ error: 'Insufficient credits. Please add credits to continue.' }), {
            status: 402,
            headers: { 'Content-Type': 'application/json' },
          });
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
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
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
