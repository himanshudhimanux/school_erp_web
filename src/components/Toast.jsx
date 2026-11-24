import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(() => {});

/** Lightweight toasts. Only call `toast.success` after the API has confirmed the action. */
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, tone = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setItems((x) => [...x, { id, message, tone }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4500);
  }, []);
  const api = useMemo(() => Object.assign((m) => push(m), { success: (m) => push(m, 'success'), error: (m) => push(m, 'danger'), info: (m) => push(m, 'primary') }), [push]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-container position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1080 }} aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast show align-items-center text-bg-${t.tone} border-0`} role="status">
            <div className="d-flex">
              <div className="toast-body">{t.message}</div>
              <button type="button" className="btn-close btn-close-white me-2 m-auto" aria-label="Close" onClick={() => setItems((x) => x.filter((i) => i.id !== t.id))} />
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
