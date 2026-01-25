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

/**
 * Get or create a session ID for this user.
 * The session ID is stored in localStorage and persists across browser sessions.
 */
function getOrCreateSessionId(): string {
  let sessionId = localStorage.getItem('session-id');

  if (!sessionId) {
    sessionId = nanoid(8);
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionIdRef = useRef<string>('');

  // Load messages from localStorage on mount
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
    const tabsKey = `terminal-tabs:${sessionIdRef.current}`;
    const activeKey = `terminal-active:${sessionIdRef.current}`;
    const storedTabs = localStorage.getItem(tabsKey);
    const storedActive = localStorage.getItem(activeKey);

    if (storedTabs) {
      try {
        const parsed = JSON.parse(storedTabs) as TerminalTab[];
        if (parsed.length > 0) {
          setTerminalTabs(parsed);
          setActiveTerminalId(
            storedActive && parsed.some((t) => t.id === storedActive)
              ? storedActive
              : parsed[0].id
          );
          return;
        }
      } catch (error) {
        console.error('Error loading terminal tabs:', error);
      }
    }

    const firstTab: TerminalTab = { id: nanoid(8), name: 'Terminal 1' };
    setTerminalTabs([firstTab]);
    setActiveTerminalId(firstTab.id);
  }, []);

  useEffect(() => {
    if (!sessionIdRef.current || terminalTabs.length === 0) return;
    const tabsKey = `terminal-tabs:${sessionIdRef.current}`;
    localStorage.setItem(tabsKey, JSON.stringify(terminalTabs));
  }, [terminalTabs]);

  useEffect(() => {
    if (!sessionIdRef.current || !activeTerminalId) return;
    const activeKey = `terminal-active:${sessionIdRef.current}`;
    localStorage.setItem(activeKey, activeTerminalId);
  }, [activeTerminalId]);

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
      const result = await makeApiCall(userInput);
      // Update the message with the response
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === userMessage.id ? { ...msg, response: result } : msg
        )
      );
    } catch (error) {
      console.error('Error:', error);
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
      id: nanoid(8),
      name: `Terminal ${nextIndex}`
    };
    setTerminalTabs((prev) => [...prev, newTab]);
    setActiveTerminalId(newTab.id);
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
                    onClick={() => setActiveTerminalId(tab.id)}
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
          </div>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
