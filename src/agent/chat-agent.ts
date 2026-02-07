import { AIChatAgent } from '@cloudflare/ai-chat';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, convertToModelMessages, type StreamTextOnFinishCallback, type ToolSet } from 'ai';
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
 * Maps our ModelId to AI SDK model identifiers.
 * Throws a clear error if the required API key is missing.
 */
function getModel(modelId: ModelId, env: Env) {
  const requireKey = (key: string | undefined, provider: string): string => {
    if (!key) throw new Error(`Missing ${provider} API key. Configure it in your environment.`);
    return key;
  };

  switch (modelId) {
    case 'claude-sonnet-4':
      return createAnthropic({ apiKey: requireKey(env.ANTHROPIC_API_KEY, 'ANTHROPIC_API_KEY') })('claude-sonnet-4-20250514');
    case 'claude-opus-4-6':
      return createAnthropic({ apiKey: requireKey(env.ANTHROPIC_API_KEY, 'ANTHROPIC_API_KEY') })('claude-opus-4-20250610');
    case 'gpt-4o':
      return createOpenAI({ apiKey: requireKey(env.OPENAI_API_KEY, 'OPENAI_API_KEY') })('gpt-4o');
    case 'o3':
      return createOpenAI({ apiKey: requireKey(env.OPENAI_API_KEY, 'OPENAI_API_KEY') })('o3');
    case 'deepseek-r1':
      return createOpenAI({ baseURL: 'https://api.deepseek.com/v1' })('deepseek-reasoner');
    case 'gemini-2.5-pro':
      return createOpenAI({ baseURL: 'https://openrouter.ai/api/v1' })('google/gemini-2.5-pro');
    default: {
      const _exhaustive: never = modelId;
      void _exhaustive;
      return createAnthropic({ apiKey: requireKey(env.ANTHROPIC_API_KEY, 'ANTHROPIC_API_KEY') })('claude-sonnet-4-20250514');
    }
  }
}

const DEFAULT_SYSTEM_PROMPT = `You are an AI coding assistant running inside a container environment. You can help with programming tasks, answer questions, and assist with software development.`;

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

    console.log(
      `[ChatAgent] onChatMessage slot=${agentState?.slotId ?? 'unknown'} model=${modelId} messages=${this.messages.length}`,
    );

    let model;
    try {
      model = getModel(modelId, this.env);
    } catch (err) {
      // Return error as a text response so the client sees it
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
      abortSignal: options?.abortSignal,
      onFinish,
    });

    return result.toUIMessageStreamResponse();
  }
}
