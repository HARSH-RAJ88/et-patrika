'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface ToastMessage {
  id: string;
  text: string;
  type?: 'success' | 'info' | 'error';
}

// Global toast state
let toastListeners: ((toast: ToastMessage) => void)[] = [];

export function showToast(text: string, type: 'success' | 'info' | 'error' = 'info') {
  const toast: ToastMessage = { id: crypto.randomUUID(), text, type };
  toastListeners.forEach((listener) => listener(toast));
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: ToastMessage) => {
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 3000);
  }, []);

  useEffect(() => {
    toastListeners.push(addToast);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== addToast);
    };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      <style>{`
        .toast-container {
          position: fixed;
          bottom: 1.5rem;
          left: 1.5rem;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          pointer-events: none;
        }

        .toast-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          background: var(--color-ink);
          color: white;
          font-family: var(--font-body);
          font-size: 0.88rem;
          font-weight: 500;
          border-radius: var(--radius-md);
          box-shadow: 0 8px 24px rgba(0,0,0,0.2);
          pointer-events: auto;
          animation: toast-slide-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .toast-success { border-left: 3px solid #059669; }
        .toast-info { border-left: 3px solid #2563EB; }
        .toast-error { border-left: 3px solid #DC2626; }

        .toast-icon {
          font-size: 1rem;
          flex-shrink: 0;
        }

        @keyframes toast-slide-in {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (max-width: 640px) {
          .toast-container {
            left: 1rem;
            right: 1rem;
            bottom: 5rem;
          }
        }
      `}</style>

      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-item toast-${toast.type || 'info'}`}>
          <span className="toast-icon">
            {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}
          </span>
          {toast.text}
        </div>
      ))}
    </div>
  );
}
