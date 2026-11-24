import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(() => {});

/** Lightweight toasts. Only call `toast.success` after the API has confirmed the action. */
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, tone = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setItems((x) => [...x, { id, message, tone }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), tone === 'warning' ? 9000 : 4500);
  }, []);
  const api = useMemo(() => {
    const t = Object.assign((m) => push(m), { success: (m) => push(m, 'success'), error: (m) => push(m, 'danger'), info: (m) => push(m, 'primary'), warning: (m) => push(m, 'warning') });
    /**
     * After adding a person: `done` ("Staff added") plus whether their email went out
     * (set-password link for new accounts, "you now have access" for existing ones).
     */
    t.added = (done, r) => {
      const isNew = r?.isNewUser ?? r?.ownerIsNew;
      if (!r || r.emailDelivered === undefined || r.emailDelivered === null) return push(done, 'success');
      if (r.emailDelivered) return push(`${done}. ${isNew ? 'A set-password email was sent.' : 'They were emailed that they now have access.'}`, 'success');
      if (r.emailError === 'EMAIL_NOT_CONFIGURED') return push(`${done}, but email is not configured on the server, so no email was sent.`, 'warning');
      return push(`${done}, but the email could not be sent: ${r.emailError}`, 'warning');
    };
    return t;
  }, [push]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-container position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1080 }} aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast show align-items-center text-bg-${t.tone} border-0`} role="status">
            <div className="d-flex">
              <div className="toast-body">{t.message}</div>
              <button type="button" className={`btn-close me-2 m-auto${t.tone === 'warning' ? '' : ' btn-close-white'}`} aria-label="Close" onClick={() => setItems((x) => x.filter((i) => i.id !== t.id))} />
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
