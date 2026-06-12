// src/components/AgentChat.tsx
// Chat interface with the MemWal-powered AI agent.
// Chat history is persisted to MemWal (Walrus) — not localStorage.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Brain, User, Loader2, AlertCircle, CloudDownload } from 'lucide-react';
import type { AgentMessage, Incident } from '../types/incident';
import { v4 as uuidv4 } from 'uuid';

import { PROXY_URL } from '../lib/api';
import { useAppStore } from '../store/appStore';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useAuthStore } from '../lib/authStore';

// Welcome message constant — kept out of the store so the same object is reused
const WELCOME_MESSAGE: AgentMessage = {
  id: 'welcome',
  role: 'assistant',
  content: `I'm **Sentinel**, your AI community safety agent. I have permanent, cryptographically-verified memory of every incident ever reported in this system — stored on the Walrus blockchain via MemWal.\n\nAsk me anything: patterns, historical incidents, area status, triage recommendations, or emerging threats. My memory never fades.`,
  timestamp: new Date().toISOString(),
};

export const AgentChat: React.FC<{ incidents?: Incident[] }> = ({ incidents = [] }) => {
  const { agentMessages: messages, setAgentMessages: setMessages } = useAppStore();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRestoredRef = useRef(false); // ensure we only attempt restore once per mount

  // ── Resolve wallet userId (dapp-kit preferred, in-app fallback) ──────────────
  const account = useCurrentAccount();
  const { address: inAppAddress } = useAuthStore();
  const userId = account?.address ?? inAppAddress ?? null;

  // ── Scroll to bottom whenever messages change ─────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Load chat history from MemWal on mount (once per wallet session) ──────────
  useEffect(() => {
    if (!userId || hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    // Safety net for immediate refresh race condition
    if (sessionStorage.getItem('sentinel_chat_cleared') === '1') {
      setTimeout(() => sessionStorage.removeItem('sentinel_chat_cleared'), 3000);
      return;
    }

    const loadHistory = async () => {
      setIsRestoring(true);
      try {
        const res = await fetch(`${PROXY_URL}/api/chat-memory/load?userId=${encodeURIComponent(userId)}`);
        if (!res.ok) return; // silently fail — never break the UI
        const data = await res.json();
        
        if (data.found && data.cleared) {
          // Explicitly cleared on another device — wipe local state
          setMessages([WELCOME_MESSAGE]);
        } else if (data.found && Array.isArray(data.messages) && data.messages.length > 0) {
          // Only restore history if we don't already have in-session messages
          const currentMessages = useAppStore.getState().agentMessages;
          const hasRealMessages = currentMessages.some((m) => m.id !== 'welcome');
          if (!hasRealMessages) {
            // Prepend the welcome message, then the restored history
            setMessages([WELCOME_MESSAGE, ...data.messages]);
          }
        }
      } catch {
        // Network error — silently fall back to empty chat
      } finally {
        setIsRestoring(false);
      }
    };

    loadHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── Debounced MemWal save — fires 2s after the last message change ───────────
  const scheduleSave = useCallback(
    (latestMessages: AgentMessage[]) => {
      if (!userId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await fetch(`${PROXY_URL}/api/chat-memory/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, messages: latestMessages }),
          });
        } catch {
          // Silent fail — in-session state is still intact
        }
      }, 2000);
    },
    [userId]
  );

  // Clean up save timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // ── Send message ──────────────────────────────────────────────────────────────
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

      setMessages((prev) => {
        const updated = [...prev, agentMsg];
        // Schedule MemWal save after every assistant reply (debounced 2s)
        scheduleSave(updated);
        return updated;
      });
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
        position: 'relative',
      }}
    >
      {/* ── Restoring indicator — desktop: inline in chat, mobile: centered sub-header ── */}
      {isRestoring && (
        <>
          {/* Desktop: right-aligned, floats above the message list */}
          <div
            className="hidden md:flex"
            style={{
              position: 'absolute',
              top: '10px',
              right: '14px',
              zIndex: 10,
              alignItems: 'center',
              gap: '5px',
              fontSize: '11px',
              color: '#555',
              fontFamily: 'monospace',
              pointerEvents: 'none',
            }}
          >
            <CloudDownload size={11} style={{ opacity: 0.6 }} />
            Restoring conversation…
          </div>

          {/* Mobile: centered banner just below the page header */}
          <div
            className="flex md:hidden"
            style={{
              justifyContent: 'center',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 0',
              fontSize: '11px',
              color: '#555',
              fontFamily: 'monospace',
              borderBottom: '1px solid #111',
              flexShrink: 0,
            }}
          >
            <CloudDownload size={11} style={{ opacity: 0.6 }} />
            Restoring conversation…
          </div>
        </>
      )}

      {/* Messages */}
      <div
        className="pb-[120px] md:pb-10"
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          paddingTop: '16px',
          paddingLeft: '8px',
          paddingRight: '8px',
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
              className="glass-card"
              style={{
                background: 'linear-gradient(145deg, rgba(40,40,40,0.8), rgba(20,20,20,0.9))',
                boxShadow: '0 4px 15px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
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

      {/* Input */}
      <div
        className="mobile-agent-input pt-4"
        style={{
          background: 'transparent',
          flexShrink: 0,
          paddingLeft: '8px',
          paddingRight: '8px',
          paddingBottom: '24px',
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
        <p className="mobile-agent-hint" style={{ marginTop: '8px', fontSize: '11px', color: '#444', textAlign: 'center' }}>
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
      className="fade-in-up max-w-[85%] md:max-w-[70%]"
      style={{
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
        flexDirection: isAgent ? 'row' : 'row-reverse',
        marginRight: isAgent ? 'auto' : undefined,
        marginLeft: !isAgent ? 'auto' : undefined,
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
        className={isAgent ? 'glass-card' : ''}
        style={{
          maxWidth: '80%',
          background: isAgent ? 'linear-gradient(145deg, rgba(40,40,40,0.8), rgba(20,20,20,0.9))' : 'rgba(59, 130, 246, 0.15)',
          boxShadow: isAgent ? '0 4px 15px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)' : undefined,
          border: isAgent
            ? undefined
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
