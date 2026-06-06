// src/components/AgentChat.tsx
// Chat interface with the MemWal-powered AI agent

import React, { useState, useRef, useEffect } from 'react';
import { Send, Brain, User, Loader2, AlertCircle, Cpu, Zap } from 'lucide-react';
import type { AgentMessage, Incident } from '../types/incident';
import { v4 as uuidv4 } from 'uuid';

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3333';


const SUGGESTED_QUERIES = [
  "Any crime patterns near Indiranagar this week?",
  "Which areas have the most critical incidents?",
  "What happened on MG Road recently?",
  "Are Friday nights more dangerous? Show me the data.",
  "What should I watch for near Silk Board Junction?",
];

export const AgentChat: React.FC<{ incidents?: Incident[] }> = ({ incidents = [] }) => {
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `I'm **Sentinel**, your AI community safety agent. I have permanent, cryptographically-verified memory of every incident ever reported in this system — stored on the Walrus blockchain via MemWal.

Ask me anything: patterns, historical incidents, area status, triage recommendations, or emerging threats. My memory never fades.`,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (messageText?: string) => {
    const text = (messageText ?? input).trim();
    if (!text || isLoading) return;

    const userMsg: AgentMessage = {
      id: uuidv4(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setError('');

    // Build history for context (excluding welcome message)
    const history = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch(`${PROXY_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history, currentIncidents: incidents }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || `Proxy returned ${res.status}`);
      }

      const data = await res.json();

      const agentMsg: AgentMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, agentMsg]);
    } catch (err) {
      console.error('Agent error:', err);
      if (err instanceof Error && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
        setError('Proxy not running. Start it with: npm run proxy');
      } else {
        setError(
          err instanceof Error ? err.message : 'Failed to reach the AI agent.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#0a0a0a',
      }}
    >


      {/* Messages */}
      <div
        className="p-5 pb-[120px] md:pb-5"
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="fade-in-up" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Brain size={14} color="#fff" />
            </div>
            <div
              style={{
                background: '#111',
                border: '1px solid #1f1f1f',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                gap: '5px',
                alignItems: 'center',
              }}
            >
              <div className="typing-dot" style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#555' }} />
              <div className="typing-dot" style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#555' }} />
              <div className="typing-dot" style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#555' }} />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#ef4444',
            }}
          >
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Status cards + Suggested queries — only in empty state */}
      {messages.length <= 1 && (
        <>


          {/* Suggested queries */}
          <div
            className="mobile-query-grid"
            style={{
              padding: '0 16px 16px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              flexShrink: 0,
            }}
          >
            {SUGGESTED_QUERIES.slice(0, 4).map((q, idx) => {
              const icons = [<AlertCircle size={14} color="#ef4444" />, <Brain size={14} color="#8b5cf6" />, <Zap size={14} color="#3b82f6" />, <Cpu size={14} color="#22c55e" />];
              return (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  disabled={isLoading}
                  style={{
                    padding: '12px',
                    background: '#111',
                    border: '1px solid #1f1f1f',
                    borderRadius: '10px',
                    color: '#aaa',
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    alignItems: 'flex-start',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = '#181818';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a2a2a';
                    (e.currentTarget as HTMLButtonElement).style.color = '#ccc';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = '#111';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#1f1f1f';
                    (e.currentTarget as HTMLButtonElement).style.color = '#aaa';
                  }}
                >
                  {icons[idx]}
                  {q}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Input */}
      <div
        style={{
          padding: '16px 20px',
          background: 'transparent',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-end',
            background: '#111',
            border: '1px solid #222',
            borderRadius: '12px',
            padding: '10px 14px',
            transition: 'border-color 0.15s',
          }}
          onFocusCapture={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(59, 130, 246, 0.4)';
          }}
          onBlurCapture={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = '#222';
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about incidents, patterns, or area safety…"
            rows={1}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#e5e5e5',
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
              resize: 'none',
              lineHeight: '1.5',
              minHeight: '20px',
              maxHeight: '100px',
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${el.scrollHeight}px`;
            }}
            disabled={isLoading}
          />
          <button
            id="agent-send-btn"
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            style={{
              padding: '6px',
              background:
                isLoading || !input.trim()
                  ? 'transparent'
                  : 'linear-gradient(135deg, #3b82f6, #2563eb)',
              border: 'none',
              borderRadius: '8px',
              color: isLoading || !input.trim() ? '#444' : '#fff',
              cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.15s',
            }}
          >
            {isLoading ? (
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
        <p style={{ marginTop: '8px', fontSize: '11px', color: '#444', textAlign: 'center' }}>
          Shift+Enter for newline · Enter to send
        </p>
      </div>
    </div>
  );
};

// Render markdown-like bold text (simple)
function renderContent(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} style={{ color: '#e5e5e5', fontWeight: 600 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

const ChatMessage: React.FC<{ message: AgentMessage }> = ({ message }) => {
  const isAgent = message.role === 'assistant';

  return (
    <div
      className="fade-in-up"
      style={{
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
        flexDirection: isAgent ? 'row' : 'row-reverse',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '8px',
          background: isAgent
            ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)'
            : '#1f1f1f',
          border: isAgent ? 'none' : '1px solid #2a2a2a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {isAgent ? (
          <Brain size={14} color="#fff" />
        ) : (
          <User size={13} color="#888" />
        )}
      </div>

      {/* Bubble */}
      <div
        style={{
          maxWidth: '80%',
          background: isAgent ? '#111' : 'rgba(59, 130, 246, 0.1)',
          border: isAgent
            ? '1px solid #1f1f1f'
            : '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: isAgent ? '4px 10px 10px 10px' : '10px 4px 10px 10px',
          padding: '12px 14px',
        }}
      >
        <p
          style={{
            fontSize: '13px',
            color: '#ccc',
            lineHeight: '1.65',
            whiteSpace: 'pre-wrap',
          }}
        >
          {renderContent(message.content)}
        </p>
        <div
          style={{
            marginTop: '6px',
            fontSize: '10px',
            color: '#444',
            fontFamily: 'monospace',
            textAlign: isAgent ? 'left' : 'right',
          }}
        >
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};
