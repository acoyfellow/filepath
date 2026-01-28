import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import type {
  CommandResult,
  FileOperationResult
} from '@cloudflare/sandbox/openai';
import { nanoid } from 'nanoid';

interface Response {
  naturalResponse: string | null;
  commandResults: CommandResult[];
  fileOperations?: FileOperationResult[];
}

interface Message {
  id: string;
  input: string;
  response: Response | null;
  timestamp: number;
}

interface TerminalTab {
  id: string;
  name: string;
}

interface ChatSession {
  id: string;
  name: string;
  createdAt: number;
}

type TerminalTaskStatus = 'queued' | 'running' | 'done' | 'failed';

interface TerminalTask {
  id: string;
  tabId: string;
  command: string;
  status: TerminalTaskStatus;
  createdAt: number;
  completedAt?: number;
  stdout?: string;
  stderr?: string;
}

type CommandActor = 'user' | 'agent';

interface CommandAuditEntry {
  id: string;
  tabId: string;
  actor: CommandActor;
  command: string;
  status: TerminalTaskStatus;
  createdAt: number;
  completedAt?: number;
  exitCode?: number | null;
}

const STORAGE_KEY = 'openai-agents-history';
const SESSION_LIST_KEY = 'chat-sessions';
const ACTIVE_SESSION_KEY = 'active-session-id';
const DEFAULT_DEV_API_BASE = 'http://localhost:1337';
function getApiBase(): string {
  const envBase = import.meta.env.VITE_API_BASE as string | undefined;
  if (envBase) return envBase;
  if (import.meta.env.DEV) return DEFAULT_DEV_API_BASE;
  return window.location.origin;
}

function toApiUrl(path: string): string {
  return new URL(path, getApiBase()).toString();
}

function toWsUrl(path: string): string {
  const envBase = import.meta.env.VITE_WS_BASE as string | undefined;
  const base = (envBase || getApiBase()).replace(/^http/, 'ws');
  return new URL(path, base).toString();
}

function getHistoryKey(sessionId: string): string {
  return `${STORAGE_KEY}:${sessionId}`;
}

function loadSessionsFromStorage(): ChatSession[] {
  const raw = localStorage.getItem(SESSION_LIST_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSessionsToStorage(sessions: ChatSession[]): void {
  localStorage.setItem(SESSION_LIST_KEY, JSON.stringify(sessions));
}

async function makeApiCall(
  input: string,
  sessionId: string
): Promise<Response> {
  try {
    const response = await fetch(toApiUrl('/run'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId
      },
      body: JSON.stringify({ input })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}

function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [terminalTabs, setTerminalTabs] = useState<TerminalTab[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const [selectedTerminalId, setSelectedTerminalId] = useState<string>('chat');
  const [terminalTasks, setTerminalTasks] = useState<TerminalTask[]>([]);
  const [commandAudit, setCommandAudit] = useState<CommandAuditEntry[]>([]);
  const [terminalStatus, setTerminalStatus] = useState<Record<string, string>>(
    {}
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionIdRef = useRef<string>('');
  const tabsSocketRef = useRef<WebSocket | null>(null);

  const saveTabs = (tabs: TerminalTab[], activeTabIdValue: string | null) => {
    const sessionId = sessionIdRef.current;
    if (!sessionId || !activeTabIdValue) return;
    void fetch(toApiUrl(`/session/${sessionId}/tabs`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tabs,
        activeTabId: activeTabIdValue
      })
    });
  };

  useEffect(() => {
    const storedSessions = loadSessionsFromStorage();
    if (storedSessions.length === 0) {
      const newSession: ChatSession = {
        id: nanoid(8).toLowerCase(),
        name: 'Session 1',
        createdAt: Date.now()
      };
      setSessions([newSession]);
      saveSessionsToStorage([newSession]);
      setActiveSessionId(newSession.id);
    } else {
      setSessions(storedSessions);
      const storedActive = localStorage.getItem(ACTIVE_SESSION_KEY);
      setActiveSessionId(storedActive || storedSessions[0].id);
    }
  }, []);

  useEffect(() => {
    if (!activeSessionId) return;
    sessionIdRef.current = activeSessionId;
    localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId);

    const initializeSession = async () => {
      try {
        await fetch(toApiUrl('/session'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: activeSessionId })
        });

        const tabsResponse = await fetch(
          toApiUrl(`/session/${activeSessionId}/tabs`)
        );
        if (!tabsResponse.ok) throw new Error('Failed to load tabs');
        const data = (await tabsResponse.json()) as {
          tabs: TerminalTab[];
          activeTabId?: string;
        };
        if (data.tabs && data.tabs.length > 0) {
          setTerminalTabs(data.tabs);
          setActiveTerminalId(
            data.activeTabId && data.tabs.some((t) => t.id === data.activeTabId)
              ? data.activeTabId
              : data.tabs[0].id
          );
          const nextStatus: Record<string, string> = {};
          data.tabs.forEach((tab) => {
            nextStatus[tab.id] = 'expired';
          });
          setTerminalStatus(nextStatus);
        }
      } catch (error) {
        console.error('Error initializing session:', error);
        const fallbackTab: TerminalTab = {
          id: nanoid(8).toLowerCase(),
          name: 'Terminal 1'
        };
        setTerminalTabs([fallbackTab]);
        setActiveTerminalId(fallbackTab.id);
        setTerminalStatus({ [fallbackTab.id]: 'expired' });
      }
    };

    if (tabsSocketRef.current) {
      tabsSocketRef.current.close();
      tabsSocketRef.current = null;
    }

    setTerminalTabs([]);
    setActiveTerminalId(null);
    setTerminalStatus({});
    setTerminalTasks([]);
    setCommandAudit([]);
    setSelectedTerminalId('chat');

    const saved = localStorage.getItem(getHistoryKey(activeSessionId));
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setMessages(Array.isArray(parsed) ? parsed : []);
      } catch (error) {
        console.error('Error loading history:', error);
        setMessages([]);
      }
    } else {
      setMessages([]);
    }

    void initializeSession();
  }, [activeSessionId]);

  useEffect(() => {
    return () => {
      if (tabsSocketRef.current) {
        tabsSocketRef.current.close();
        tabsSocketRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const sessionId = sessionIdRef.current;
    if (!sessionId || tabsSocketRef.current || terminalTabs.length === 0) return;

    const wsUrl = toWsUrl(`/session/${sessionId}/tabs/ws`);
    const socket = new WebSocket(wsUrl);
    tabsSocketRef.current = socket;

    socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data) as {
          tabs?: TerminalTab[];
          activeTabId?: string;
        };
        if (Array.isArray(data.tabs) && data.tabs.length > 0) {
          setTerminalTabs(data.tabs);
          setTerminalStatus((prev) => {
            const next = { ...prev };
            data.tabs.forEach((tab) => {
              if (!next[tab.id]) {
                next[tab.id] = 'expired';
              }
            });
            return next;
          });
        }
        if (typeof data.activeTabId === 'string') {
          setActiveTerminalId(data.activeTabId);
        }
      } catch (error) {
        console.error('Failed to parse tab update:', error);
      }
    });

    socket.addEventListener('close', () => {
      tabsSocketRef.current = null;
    });
  }, [terminalTabs, activeSessionId]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const apiOrigin = new URL(getApiBase()).origin;
      if (
        event.origin !== window.location.origin &&
        event.origin !== apiOrigin
      ) {
        return;
      }
      const data = event.data as
        | { type?: string; tabId?: string; status?: string }
        | undefined;
      if (!data || data.type !== 'terminal-status' || !data.tabId) return;
      setTerminalStatus((prev) => ({
        ...prev,
        [data.tabId!]: data.status || 'expired'
      }));
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    if (messages.length > 0) {
      localStorage.setItem(getHistoryKey(sessionId), JSON.stringify(messages));
    }
  }, [messages]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Focus input after response comes in
  useEffect(() => {
    if (!loading && messages.length > 0) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [loading, messages.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;

    const userInput = input.trim();
    setInput('');
    setLoading(true);

    // Add user message immediately
    const userMessage: Message = {
      id: Date.now().toString(),
      input: userInput,
      response: null,
      timestamp: Date.now()
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      if (selectedTerminalId !== 'chat') {
        const taskId = nanoid(10).toLowerCase();
        const pendingTask: TerminalTask = {
          id: taskId,
          tabId: selectedTerminalId,
          command: userInput,
          status: 'queued',
          createdAt: Date.now()
        };
        setTerminalTasks((prev) => [pendingTask, ...prev]);

        setTerminalTasks((prev) =>
          prev.map((task) =>
            task.id === taskId ? { ...task, status: 'running' } : task
          )
        );

        const response = await fetch(
          toApiUrl(
            `/terminal/${sessionIdRef.current}/${selectedTerminalId}/task`
          ),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: userInput, actor: 'user' })
          }
        );
        const payload = (await response.json()) as {
          task?: TerminalTask;
          error?: string;
        };
        if (!response.ok || !payload.task) {
          throw new Error(payload.error || 'Terminal task failed');
        }
        setTerminalTasks((prev) =>
          prev.map((task) => (task.id === taskId ? payload.task! : task))
        );
        setCommandAudit((prev) => [
          {
            id: nanoid(10),
            tabId: selectedTerminalId,
            actor: 'user',
            command: userInput,
            status: payload.task!.status,
            createdAt: pendingTask.createdAt,
            completedAt: payload.task!.completedAt,
            exitCode: payload.task!.exitCode ?? null
          },
          ...prev
        ]);
      } else {
        const result = await makeApiCall(userInput, sessionId);
        // Update the message with the response
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === userMessage.id ? { ...msg, response: result } : msg
          )
        );
      }
    } catch (error) {
      console.error('Error:', error);
      if (selectedTerminalId !== 'chat') {
        setTerminalTasks((prev) =>
          prev.map((task) =>
            task.command === userInput && task.status !== 'done'
              ? { ...task, status: 'failed', stderr: String(error) }
              : task
          )
        );
        setCommandAudit((prev) => [
          {
            id: nanoid(10),
            tabId: selectedTerminalId,
            actor: 'user',
            command: userInput,
            status: 'failed',
            createdAt: Date.now()
          },
          ...prev
        ]);
      } else {
        const errorResponse: Response = {
          naturalResponse: 'An error occurred while processing your request.',
          commandResults: [],
          fileOperations: []
        };
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === userMessage.id ? { ...msg, response: errorResponse } : msg
          )
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    if (confirm('Are you sure you want to clear all history?')) {
      setMessages([]);
      const sessionId = sessionIdRef.current;
      if (sessionId) {
        localStorage.removeItem(getHistoryKey(sessionId));
      }
    }
  };

  const createSession = async () => {
    const nextSessionId = nanoid(8).toLowerCase();
    const newSession: ChatSession = {
      id: nextSessionId,
      name: `Session ${sessions.length + 1}`,
      createdAt: Date.now()
    };
    const nextSessions = [...sessions, newSession];
    setSessions(nextSessions);
    saveSessionsToStorage(nextSessions);
    setActiveSessionId(nextSessionId);
    try {
      await fetch(toApiUrl('/session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: nextSessionId })
      });
    } catch (error) {
      console.warn('Failed to create session:', error);
    }
  };

  const createTerminalTab = () => {
    if (!sessionIdRef.current) return;
    const nextIndex = terminalTabs.length + 1;
    const newTab: TerminalTab = {
      id: nanoid(8).toLowerCase(),
      name: `Terminal ${nextIndex}`
    };
    const updatedTabs = [...terminalTabs, newTab];
    setTerminalTabs(updatedTabs);
    setActiveTerminalId(newTab.id);
    setTerminalStatus((prev) => ({ ...prev, [newTab.id]: 'connecting' }));
    saveTabs(updatedTabs, newTab.id);
  };

  const closeSession = async (sessionId: string) => {
    if (!window.confirm('Close this session? All terminals and chat history will be deleted.')) {
      return;
    }

    // Call backend to tear down tabs/sandboxes
    try {
      await fetch(toApiUrl(`/session/${sessionId}`), { method: 'DELETE' });
    } catch (error) {
      console.warn('Failed to delete session on server:', error);
    }

    // Close the tabs WebSocket if this is the active session
    if (sessionId === activeSessionId && tabsSocketRef.current) {
      tabsSocketRef.current.close();
      tabsSocketRef.current = null;
    }

    // Remove session from state and localStorage
    const nextSessions = sessions.filter((s) => s.id !== sessionId);
    setSessions(nextSessions);
    saveSessionsToStorage(nextSessions);
    localStorage.removeItem(getHistoryKey(sessionId));

    // Switch active session
    if (sessionId === activeSessionId) {
      if (nextSessions.length > 0) {
        setActiveSessionId(nextSessions[0].id);
      } else {
        // No sessions left — allow empty state
        setActiveSessionId(null);
        setTerminalTabs([]);
        setActiveTerminalId(null);
        setMessages([]);
      }
    }
  };

  const closeTerminalTab = async (tabId: string) => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;

    const apiOrigin = new URL(getApiBase()).origin;
    const frame = document.getElementById(
      `terminal-frame-${tabId}`
    ) as HTMLIFrameElement | null;
    frame?.contentWindow?.postMessage(
      { type: 'terminal-close', tabId },
      apiOrigin
    );

    try {
      await fetch(toApiUrl(`/terminal/${sessionId}/${tabId}/close`), {
        method: 'POST'
      });
    } catch (error) {
      console.warn('Failed to close terminal:', error);
    }

    const nextTabs = terminalTabs.filter((tab) => tab.id !== tabId);
    const nextActive =
      activeTerminalId === tabId
        ? nextTabs[0]?.id ?? null
        : activeTerminalId;
    setTerminalTabs(nextTabs);
    setActiveTerminalId(nextActive);
    if (selectedTerminalId === tabId) {
      setSelectedTerminalId('chat');
    }
    setTerminalStatus((prev) => {
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
    if (nextActive) {
      saveTabs(nextTabs, nextActive);
    } else {
      void fetch(toApiUrl(`/session/${sessionId}/tabs`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tabs: nextTabs })
      });
    }
  };

  const terminalSessionId = sessionIdRef.current;

  const renderMessage = (message: Message) => (
    <div key={message.id} className="message">
      <div className="message-input">
        <div className="message-label">You:</div>
        <div className="message-content">{message.input}</div>
      </div>

      {message.response ? (
        <div className="message-response">
          <div className="output-columns">
            <div className="output-column output-column-left">
              <div className="output-section">
                <div className="output-label">Response:</div>
                {message.response.naturalResponse ? (
                  <div className="output-content">
                    {message.response.naturalResponse}
                  </div>
                ) : (
                  <div className="output-content">No response received.</div>
                )}
              </div>
            </div>

            <div className="output-column output-column-right">
              {(() => {
                // Combine and sort all results by timestamp
                const allResults = [
                  ...message.response.commandResults.map((r) => ({
                    type: 'command' as const,
                    ...r
                  })),
                  ...(message.response.fileOperations || []).map((r) => ({
                    type: 'file' as const,
                    ...r
                  }))
                ].sort((a, b) => a.timestamp - b.timestamp);

                if (allResults.length === 0) {
                  return (
                    <div className="output-section">
                      <div className="output-label">Results:</div>
                      <div className="output-content">
                        No operations performed.
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="output-section">
                    <div className="output-label">Results:</div>
                    {allResults.map((result, index) => {
                      const timestamp = new Date(
                        result.timestamp
                      ).toLocaleTimeString();

                      if (result.type === 'command') {
                        return (
                          <div
                            key={
                              // biome-ignore lint/suspicious/noArrayIndexKey: key is a valid prop
                              index
                            }
                            className="tool-result"
                          >
                            <div className="tool-header">
                              <div className="tool-command">
                                $ {result.command}
                              </div>
                              <div className="tool-timestamp">{timestamp}</div>
                            </div>
                            {result.stdout && (
                              <div className="tool-output">{result.stdout}</div>
                            )}
                            {result.stderr && (
                              <div className="tool-error">{result.stderr}</div>
                            )}
                            {result.exitCode !== null &&
                              result.exitCode !== 0 && (
                                <div className="tool-exit-code">
                                  Exit code: {result.exitCode}
                                </div>
                              )}
                          </div>
                        );
                      } else {
                        return (
                          <div
                            key={
                              // biome-ignore lint/suspicious/noArrayIndexKey: key is a valid prop
                              index
                            }
                            className="tool-result"
                          >
                            <div className="tool-header">
                              <div className="tool-command">
                                {result.operation === 'create' && '📄 Create'}
                                {result.operation === 'update' && '✏️ Update'}
                                {result.operation === 'delete' &&
                                  '🗑️ Delete'}{' '}
                                {result.path}
                              </div>
                              <div className="tool-timestamp">{timestamp}</div>
                            </div>
                            <div
                              className={
                                result.status === 'completed'
                                  ? 'tool-output'
                                  : 'tool-error'
                              }
                            >
                              {result.output}
                            </div>
                            {result.error && (
                              <div className="tool-error">
                                Error: {result.error}
                              </div>
                            )}
                          </div>
                        );
                      }
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      ) : (
        <div className="message-response">
          <div className="output-content">Processing...</div>
        </div>
      )}
    </div>
  );

  return (
    <div className="app">
      <div className="container">
        <div className="header">
          <div className="header-brand">
            <img src="/logo.svg" alt="filepath logo" className="brand-logo" />
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              className="clear-button"
              onClick={clearHistory}
            >
              Clear History
            </button>
          )}
        </div>

        <div className="main-split">
          <div className="chat-pane">
            <div className="session-panel">
              <div className="session-header">
                <div className="session-title">Sessions</div>
                <button
                  type="button"
                  className="session-new"
                  onClick={createSession}
                >
                  + New
                </button>
              </div>
              <div className="session-list">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={
                      session.id === activeSessionId
                        ? 'session-item session-item-active'
                        : 'session-item'
                    }
                  >
                    <button
                      type="button"
                      className="session-item-button"
                      onClick={() => setActiveSessionId(session.id)}
                    >
                      <span className="session-name">{session.name}</span>
                      <span className="session-id">{session.id}</span>
                    </button>
                    <button
                      type="button"
                      className="session-close"
                      onClick={(event) => {
                        event.stopPropagation();
                        void closeSession(session.id);
                      }}
                      aria-label={`Close ${session.name}`}
                      title={`Close ${session.name}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="messages-container">
              {messages.length === 0 ? (
                <div className="empty-state">
                  <div className="output-content">
                    Start a conversation by entering a command below.
                  </div>
                </div>
              ) : (
                messages.map(renderMessage)
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="input-form">
              <div className="input-row">
                <label htmlFor="terminal-select" className="input-label">
                  Assign:
                </label>
                <select
                  id="terminal-select"
                  className="terminal-select"
                  value={selectedTerminalId}
                  onChange={(e) => setSelectedTerminalId(e.target.value)}
                >
                  <option value="chat">Chat only</option>
                  {terminalTabs.map((tab) => (
                    <option key={tab.id} value={tab.id}>
                      {tab.name}
                    </option>
                  ))}
                </select>
              </div>
              <input
                ref={inputRef}
                type="text"
                className="input"
                placeholder="Enter your natural language command..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
              />
            </form>
          </div>

          <div className="terminal-pane">
            <div className="terminal-tabs">
              <div className="terminal-tabs-list">
                {terminalTabs.map((tab) => (
                  <div
                    key={tab.id}
                    className={
                      tab.id === activeTerminalId
                        ? 'terminal-tab terminal-tab-active'
                        : 'terminal-tab'
                    }
                  >
                    <button
                      type="button"
                      className="terminal-tab-button"
                      onClick={() => {
                        setActiveTerminalId(tab.id);
                        saveTabs(terminalTabs, tab.id);
                      }}
                    >
                      <span>{tab.name}</span>
                      <span
                        className={`terminal-status terminal-status-${terminalStatus[tab.id] || 'expired'}`}
                      >
                        {terminalStatus[tab.id] || 'expired'}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="terminal-tab-close"
                        onClick={(event) => {
                          event.stopPropagation();
                          void closeTerminalTab(tab.id);
                        }}
                        aria-label={`Close ${tab.name}`}
                        title={`Close ${tab.name}`}
                      >
                        ×
                      </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="terminal-add-button"
                onClick={createTerminalTab}
              >
                + Terminal
              </button>
            </div>

            <div className="terminal-frame">
              {terminalTabs.map((tab) => (
                <iframe
                  key={tab.id}
                  id={`terminal-frame-${tab.id}`}
                  className={
                    tab.id === activeTerminalId
                      ? 'terminal-iframe terminal-iframe-active'
                      : 'terminal-iframe'
                  }
                  src={toApiUrl(
                    `/terminal/${terminalSessionId}/tab?tab=${tab.id}&parentOrigin=${encodeURIComponent(window.location.origin)}`
                  )}
                  title={`Terminal ${tab.name}`}
                />
              ))}
            </div>
            <div className="terminal-task-log">
              <div className="terminal-task-header">Terminal tasks</div>
              {terminalTasks.length === 0 ? (
                <div className="terminal-task-empty">No terminal tasks yet.</div>
              ) : (
                terminalTasks.map((task) => (
                  <div key={task.id} className="terminal-task">
                    <div className="terminal-task-row">
                      <span className="terminal-task-tab">
                        {terminalTabs.find((t) => t.id === task.tabId)?.name ||
                          task.tabId}
                      </span>
                      <span
                        className={`terminal-task-status terminal-task-${task.status}`}
                      >
                        {task.status}
                      </span>
                    </div>
                    <div className="terminal-task-command">{task.command}</div>
                    {task.stdout && (
                      <pre className="terminal-task-output">{task.stdout}</pre>
                    )}
                    {task.stderr && (
                      <pre className="terminal-task-error">{task.stderr}</pre>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="terminal-task-log">
              <div className="terminal-task-header">Command audit</div>
              {commandAudit.length === 0 ? (
                <div className="terminal-task-empty">No commands logged.</div>
              ) : (
                commandAudit.map((entry) => (
                  <div key={entry.id} className="terminal-task">
                    <div className="terminal-task-row">
                      <span className="terminal-task-tab">
                        {terminalTabs.find((t) => t.id === entry.tabId)?.name ||
                          entry.tabId}
                      </span>
                      <span
                        className={`terminal-task-status terminal-task-${entry.status}`}
                      >
                        {entry.actor}:{entry.status}
                      </span>
                    </div>
                    <div className="terminal-task-command">{entry.command}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
