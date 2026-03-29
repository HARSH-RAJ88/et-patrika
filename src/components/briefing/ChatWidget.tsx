'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { UserRole } from '@/types';

const ROLE_COLORS: Record<UserRole, string> = {
  student: '#2563EB',
  investor: '#059669',
  founder: '#7C3AED',
  citizen: '#D97706',
};

const ROLE_BG: Record<UserRole, string> = {
  student: '#EFF6FF',
  investor: '#ECFDF5',
  founder: '#F5F3FF',
  citizen: '#FFFBEB',
};

interface ChatWidgetProps {
  articleId: string;
  role: UserRole;
  articleTitle?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

function getStarterQuestions(role: UserRole): { label: string; question: string }[] {
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  return [
    {
      label: '🧠 Simplify',
      question: 'What does this mean for the average person?',
    },
    {
      label: `🎯 Action for ${roleLabel}s`,
      question: `As a ${role}, what should I do based on this news?`,
    },
    {
      label: '⚠️ Risks',
      question: "What's the biggest risk here?",
    },
    {
      label: '📝 One sentence',
      question: 'Summarize this in one sentence.',
    },
  ];
}

export default function ChatWidget({ articleId, role, articleTitle }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const starterQuestions = getStarterQuestions(role);
  const color = ROLE_COLORS[role];
  const bgColor = ROLE_BG[role];

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
    };

    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsStreaming(true);
    scrollToBottom();

    // Build conversation history (last 6 messages)
    const history = [...messages, userMsg]
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          articleId,
          role,
          conversationHistory: history,
        }),
      });

      if (!res.ok) {
        let errorMsg = 'Sorry, I could not process your request right now.';
        try {
          const errorData = await res.json();
          if (errorData.error) errorMsg = errorData.error;
        } catch { /* use default */ }

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: errorMsg,
            isStreaming: false,
          };
          return updated;
        });
        setIsStreaming(false);
        return;
      }

      // Stream the response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;

          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: accumulated,
              isStreaming: true,
            };
            return updated;
          });

          scrollToBottom();
        }

        // Mark streaming as complete
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            isStreaming: false,
          };
          return updated;
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: 'Connection error. Please try again.',
          isStreaming: false,
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
      scrollToBottom();
    }
  }, [isStreaming, articleId, role, messages, scrollToBottom]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleStarterClick = (question: string) => {
    sendMessage(question);
  };

  return (
    <section className={`chat-widget-section ${isOpen ? 'is-open' : ''}`}>
      <style>{`
        .chat-widget-section {
          margin-bottom: 2rem;
        }

        /* ─── Toggle Button ─── */
        .chat-toggle-btn {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          width: 100%;
          padding: 1rem 1.5rem;
          background: var(--color-surface);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-lg);
          font-family: var(--font-body);
          font-size: 0.92rem;
          font-weight: 600;
          color: var(--color-ink-secondary);
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          overflow: hidden;
        }

        .chat-toggle-btn::after {
          content: '';
          position: absolute;
          left: 0;
          bottom: 0;
          height: 2px;
          width: 100%;
          background: var(--gradient-brand);
          transform: scaleX(0);
          transition: transform 0.3s ease;
        }

        .chat-toggle-btn:hover {
          border-color: var(--color-brand);
          color: var(--color-brand);
          box-shadow: var(--shadow-sm);
        }

        .chat-toggle-btn:hover::after {
          transform: scaleX(1);
        }

        .chat-toggle-open {
          border-color: var(--color-brand);
          color: var(--color-brand);
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
          border-bottom: none;
        }

        .chat-toggle-open::after {
          transform: scaleX(1);
        }

        .chat-pulse {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--color-brand);
          animation: pulse-glow 2s ease-in-out infinite;
        }

        .chat-toggle-arrow {
          margin-left: auto;
          font-size: 0.72rem;
          transition: transform 0.3s ease;
        }

        .chat-toggle-open .chat-toggle-arrow {
          transform: rotate(180deg);
        }

        /* ─── Chat Panel ─── */
        .chat-panel {
          overflow: hidden;
          max-height: 0;
          opacity: 0;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .chat-panel-open {
          max-height: 600px;
          opacity: 1;
        }

        .chat-panel-inner {
          background: var(--color-surface);
          border: 1.5px solid var(--color-brand);
          border-top: none;
          border-radius: 0 0 var(--radius-lg) var(--radius-lg);
          overflow: hidden;
        }

        /* ─── Messages Area ─── */
        .chat-messages-area {
          max-height: 380px;
          overflow-y: auto;
          padding: 1rem 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          scrollbar-width: thin;
        }

        /* ─── Empty State (Starter Questions) ─── */
        .chat-empty-state {
          padding: 1rem 0;
        }

        .chat-empty-title {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--color-ink-muted);
          margin-bottom: 0.75rem;
          text-align: center;
        }

        .starter-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
        }

        .starter-card {
          padding: 0.75rem;
          background: var(--color-surface-muted);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
        }

        .starter-card:hover {
          border-color: var(--color-brand);
          background: var(--color-brand-light);
          box-shadow: var(--shadow-sm);
          transform: translateY(-1px);
        }

        .starter-card-label {
          font-size: 0.72rem;
          font-weight: 700;
          margin-bottom: 0.25rem;
          display: block;
        }

        .starter-card-q {
          font-size: 0.82rem;
          color: var(--color-ink-secondary);
          line-height: 1.4;
        }

        /* ─── Message Bubbles ─── */
        .chat-msg-row {
          display: flex;
          animation: fadeIn 0.25s ease both;
        }

        .chat-msg-row-user {
          justify-content: flex-end;
        }

        .chat-msg-row-assistant {
          justify-content: flex-start;
        }

        .chat-bubble {
          max-width: 82%;
          padding: 0.75rem 1rem;
          font-size: 0.88rem;
          line-height: 1.65;
          position: relative;
        }

        .chat-bubble-user {
          border-radius: var(--radius-md) var(--radius-md) 4px var(--radius-md);
          color: white;
        }

        .chat-bubble-assistant {
          background: var(--color-surface-muted);
          border: 1px solid var(--color-border-subtle);
          border-radius: var(--radius-md) var(--radius-md) var(--radius-md) 4px;
          color: var(--color-ink-secondary);
        }

        .chat-ai-label {
          font-size: 0.68rem;
          font-weight: 700;
          color: var(--color-ink-subtle);
          margin-bottom: 0.25rem;
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .chat-ai-label::before {
          content: '✦';
          color: var(--color-brand);
        }

        /* ─── Streaming Cursor ─── */
        .streaming-cursor {
          display: inline-block;
          width: 2px;
          height: 1em;
          background: var(--color-brand);
          margin-left: 2px;
          vertical-align: text-bottom;
          animation: blink-cursor 0.8s step-end infinite;
        }

        @keyframes blink-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        .streaming-dots {
          display: inline-flex;
          gap: 4px;
          padding: 0.5rem 0;
        }

        .streaming-dots span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--color-ink-subtle);
          animation: dot-bounce 1.2s ease-in-out infinite;
        }

        .streaming-dots span:nth-child(2) { animation-delay: 0.15s; }
        .streaming-dots span:nth-child(3) { animation-delay: 0.3s; }

        @keyframes dot-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }

        /* ─── Input Area ─── */
        .chat-input-area {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.875rem 1.25rem;
          border-top: 1px solid var(--color-border);
          background: var(--color-surface);
        }

        .chat-text-input {
          flex: 1;
          padding: 0.625rem 1rem;
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-full);
          font-family: var(--font-body);
          font-size: 0.88rem;
          color: var(--color-ink);
          background: var(--color-surface-muted);
          outline: none;
          transition: all 0.2s ease;
        }

        .chat-text-input:focus {
          border-color: var(--color-brand);
          background: var(--color-surface);
          box-shadow: 0 0 0 3px var(--color-brand-glow);
        }

        .chat-text-input::placeholder {
          color: var(--color-ink-subtle);
        }

        .chat-send {
          padding: 0.625rem 1.25rem;
          background: var(--gradient-brand);
          color: white;
          border: none;
          border-radius: var(--radius-full);
          font-family: var(--font-body);
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
          box-shadow: var(--shadow-brand);
        }

        .chat-send:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(232, 19, 43, 0.25);
        }

        .chat-send:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          box-shadow: none;
        }

        @media (max-width: 640px) {
          .starter-grid {
            grid-template-columns: 1fr;
          }
          .chat-widget-section.is-open {
            position: fixed;
            inset: 0;
            z-index: 1000;
            background: var(--color-surface);
            display: flex;
            flex-direction: column;
            margin: 0;
          }
          .chat-widget-section.is-open .chat-toggle-btn {
            border-radius: 0;
            border: none;
            border-bottom: 1px solid var(--color-border);
          }
          .chat-widget-section.is-open .chat-panel-open {
            flex: 1;
            max-height: none;
            display: flex;
            flex-direction: column;
          }
          .chat-widget-section.is-open .chat-panel-inner {
            flex: 1;
            border: none;
            border-radius: 0;
            display: flex;
            flex-direction: column;
          }
          .chat-widget-section.is-open .chat-messages-area {
            flex: 1;
            max-height: none;
          }
        }
      `}</style>

      {/* ─── Toggle Button ─── */}
      <button
        className={`chat-toggle-btn ${isOpen ? 'chat-toggle-open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="chat-pulse" />
        💬 Ask ET Patrika about this story
        <span className="chat-toggle-arrow">▼</span>
      </button>

      {/* ─── Chat Panel ─── */}
      <div className={`chat-panel ${isOpen ? 'chat-panel-open' : ''}`}>
        <div className="chat-panel-inner">
          <div className="chat-messages-area">
            {/* Empty state with starter questions */}
            {messages.length === 0 && (
              <div className="chat-empty-state">
                <div className="chat-empty-title">
                  Ask anything about this story — I&apos;ll answer for your role
                </div>
                <div className="starter-grid">
                  {starterQuestions.map((sq, i) => (
                    <button
                      key={i}
                      className="starter-card"
                      onClick={() => handleStarterClick(sq.question)}
                      disabled={isStreaming}
                    >
                      <span className="starter-card-label">{sq.label}</span>
                      <span className="starter-card-q">{sq.question}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message bubbles */}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-msg-row ${msg.role === 'user' ? 'chat-msg-row-user' : 'chat-msg-row-assistant'}`}
              >
                <div
                  className={`chat-bubble ${msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}
                  style={msg.role === 'user' ? { background: color } : {}}
                >
                  {msg.role === 'assistant' && (
                    <div className="chat-ai-label">ET Patrika AI</div>
                  )}

                  {msg.content ? (
                    <>
                      {msg.content}
                      {msg.isStreaming && <span className="streaming-cursor" />}
                    </>
                  ) : msg.isStreaming ? (
                    <div className="streaming-dots">
                      <span /><span /><span />
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="chat-input-area">
            <input
              ref={inputRef}
              type="text"
              className="chat-text-input"
              placeholder="Ask a question about this story..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
            />
            <button
              className="chat-send"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isStreaming}
            >
              {isStreaming ? '●●●' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
