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

/**
 * Get or create a session ID for this user.
 * The session ID is stored in localStorage and persists across browser sessions.
 */
function getOrCreateSessionId(): string {
  let sessionId = localStorage.getItem('session-id');

  if (!sessionId) {
    sessionId = nanoid(8).toLowerCase();
    localStorage.setItem('session-id', sessionId);
  } else if (sessionId !== sessionId.toLowerCase()) {
    sessionId = sessionId.toLowerCase();
    localStorage.setItem('session-id', sessionId);
  }

  return sessionId;
}

const STORAGE_KEY = 'openai-agents-history';

async function makeApiCall(input: string): Promise<Response> {
  try {
    const response = await fetch('/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': getOrCreateSessionId()
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
  const [terminalTabs, setTerminalTabs] = useState<TerminalTab[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const [selectedTerminalId, setSelectedTerminalId] = useState<string>('chat');
  const [terminalTasks, setTerminalTasks] = useState<TerminalTask[]>([]);
  const [commandAudit, setCommandAudit] = useState<CommandAuditEntry[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionIdRef = useRef<string>('');
  const tabsSocketRef = useRef<WebSocket | null>(null);

  // Load messages from localStorage on mount
  const saveTabs = (tabs: TerminalTab[], activeTabIdValue: string | null) => {
    const sessionId = sessionIdRef.current;
    if (!sessionId || !activeTabIdValue) return;
    void fetch(`/session/${sessionId}/tabs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tabs,
        activeTabId: activeTabIdValue
      })
    });
  };

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setMessages(parsed);
      } catch (error) {
        console.error('Error loading history:', error);
      }
    }
  }, []);

  useEffect(() => {
    sessionIdRef.current = getOrCreateSessionId();
    const sessionId = sessionIdRef.current;

    const initializeSession = async () => {
      try {
        await fetch('/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });

        const tabsResponse = await fetch(`/session/${sessionId}/tabs`);
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
        }
      } catch (error) {
        console.error('Error initializing session:', error);
        const fallbackTab: TerminalTab = {
          id: nanoid(8).toLowerCase(),
          name: 'Terminal 1'
        };
        setTerminalTabs([fallbackTab]);
        setActiveTerminalId(fallbackTab.id);
      }
    };

    initializeSession();

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

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/session/${sessionId}/tabs/ws`;
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
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
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
          `/terminal/${sessionIdRef.current}/${selectedTerminalId}/task`,
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
        const result = await makeApiCall(userInput);
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
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const createTerminalTab = () => {
    const nextIndex = terminalTabs.length + 1;
    const newTab: TerminalTab = {
      id: nanoid(8).toLowerCase(),
      name: `Terminal ${nextIndex}`
    };
    const updatedTabs = [...terminalTabs, newTab];
    setTerminalTabs(updatedTabs);
    setActiveTerminalId(newTab.id);
    saveTabs(updatedTabs, newTab.id);
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
          <h1 className="app-title">Sandbox Studio</h1>
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
                  <button
                    key={tab.id}
                    type="button"
                    className={
                      tab.id === activeTerminalId
                        ? 'terminal-tab terminal-tab-active'
                        : 'terminal-tab'
                    }
                    onClick={() => {
                      setActiveTerminalId(tab.id);
                      saveTabs(terminalTabs, tab.id);
                    }}
                  >
                    {tab.name}
                  </button>
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
                  className={
                    tab.id === activeTerminalId
                      ? 'terminal-iframe terminal-iframe-active'
                      : 'terminal-iframe'
                  }
                  src={`/terminal/${terminalSessionId}/tab?tab=${tab.id}`}
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
