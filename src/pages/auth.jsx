import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api/client.js';
import { FormField, FormError, PageHeader, QueryState, DataTable, ConfirmDialog, useDialog } from '../components/ui.jsx';
import { useMutation, useQuery } from '../hooks/useApi.js';
import { useToast } from '../components/Toast.jsx';
import { dateTime } from '../utils/format.js';

function AuthCard({ title, subtitle, children }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="text-center mb-4">
          <div className="brand-mark mx-auto mb-2 d-grid" style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--erp-primary)', color: '#fff', placeItems: 'center', fontWeight: 700 }}>
            S
          </div>
          <h1 className="h4 mb-1">{title}</h1>
          {subtitle && <p className="text-muted mb-0">{subtitle}</p>}
        </div>
        <div className="card">
          <div className="card-body p-4">{children}</div>
        </div>
        <p className="text-center small text-muted mt-3 mb-0">Collect school fees on time. Track every student’s attendance. Keep parents informed.</p>
      </div>
    </div>
  );
}

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const m = useMutation((f) => auth.login(f.email.trim(), f.password));
  if (auth.status === 'authenticated') return <Navigate to={auth.tenant || auth.isPlatformAdmin ? '/' : '/select-school'} replace />;
  const submit = async (e) => {
    e.preventDefault();
    try {
      const data = await m.mutate(form);
      navigate(data.tenant || data.user.platformRole ? '/' : '/select-school');
    } catch {
      /* shown below */
    }
  };
  const fe = m.error?.fieldErrors?.() || {};
  return (
    <AuthCard title="Sign in" subtitle="Use the email your school registered for you">
      <form onSubmit={submit} noValidate>
        {m.error && m.error.code !== 'VALIDATION_ERROR' && (
          <div className="alert alert-danger py-2" role="alert">
            {m.error.code === 'INVALID_CREDENTIALS' ? 'Incorrect email or password.' : m.error.message}
          </div>
        )}
        <FormField label="Email" name="email" error={fe.email} required>
          <input id="email" type="email" autoComplete="username" className={`form-control ${fe.email ? 'is-invalid' : ''}`} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoFocus />
        </FormField>
        <FormField label="Password" name="password" error={fe.password} required>
          <input id="password" type="password" autoComplete="current-password" className="form-control" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </FormField>
        <button type="submit" className="btn btn-primary w-100" disabled={m.pending || !form.email || !form.password}>
          {m.pending && <span className="spinner-border spinner-border-sm me-2" />}
          Sign in
        </button>
        <div className="text-center mt-3">
          <Link to="/forgot-password" className="small">
            Forgot password?
          </Link>
        </div>
      </form>
    </AuthCard>
  );
}

export function SelectSchoolPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const m = useMutation((id) => auth.selectSchool(id));
  if (auth.status !== 'authenticated') return <Navigate to="/login" replace />;
  return (
    <AuthCard title="Choose a school" subtitle="Your account belongs to more than one institution">
      {auth.schools.length === 0 && <p className="text-muted mb-0">Your account is not linked to any school yet. Please contact your school.</p>}
      <div className="list-group">
        {auth.schools.map((s) => (
          <button
            key={s.schoolId}
            type="button"
            className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
            disabled={m.pending}
            onClick={() => m.mutate(s.schoolId).then(() => navigate('/')).catch((e) => toast.error(e.message))}
          >
            <span>
              <span className="fw-semibold d-block">{s.name}</span>
              <span className="small text-muted">{s.roles.join(', ')}</span>
            </span>
            <i className="bi bi-chevron-right" />
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-link w-100 mt-3" onClick={() => auth.logout()}>
        Sign out
      </button>
    </AuthCard>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const m = useMutation((e) => api.post('/auth/forgot-password', { email: e }));
  return (
    <AuthCard title="Reset your password" subtitle="We’ll email you a link to choose a new password">
      {done ? (
        <div className="alert alert-success mb-0">If an account exists for {email}, a reset link has been sent. The link is valid for one hour.</div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate(email.trim()).then(() => setDone(true)).catch(() => {});
          }}
        >
          <FormError error={m.error} />
          <FormField label="Email" name="email" required>
            <input id="email" type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </FormField>
          <button type="submit" className="btn btn-primary w-100" disabled={m.pending || !email}>
            Send reset link
          </button>
        </form>
      )}
      <div className="text-center mt-3">
        <Link to="/login" className="small">
          Back to sign in
        </Link>
      </div>
    </AuthCard>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const isSetup = params.get('setup') === '1';
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [done, setDone] = useState(false);
  const m = useMutation((p) => api.post('/auth/reset-password', { token, password: p }));
  const fe = m.error?.fieldErrors?.() || {};
  const mismatch = form.confirm && form.confirm !== form.password;
  return (
    <AuthCard title={isSetup ? 'Set up your account' : 'Choose a new password'} subtitle="At least 8 characters with a letter and a number">
      {done ? (
        <div className="alert alert-success">
          Your password has been set. <Link to="/login">Sign in</Link>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!mismatch) m.mutate(form.password).then(() => setDone(true)).catch(() => {});
          }}
        >
          {!token && <div className="alert alert-warning">This link is incomplete. Please use the link from your email.</div>}
          {m.error && m.error.code !== 'VALIDATION_ERROR' && <div className="alert alert-danger py-2">{m.error.message}</div>}
          <FormField label="New password" name="password" error={fe.password} required>
            <input id="password" type="password" autoComplete="new-password" className={`form-control ${fe.password ? 'is-invalid' : ''}`} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </FormField>
          <FormField label="Confirm password" name="confirm" error={mismatch ? 'Passwords do not match' : null} required>
            <input id="confirm" type="password" autoComplete="new-password" className={`form-control ${mismatch ? 'is-invalid' : ''}`} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
          </FormField>
          <button type="submit" className="btn btn-primary w-100" disabled={m.pending || !token || !form.password || mismatch}>
            Save password
          </button>
        </form>
      )}
    </AuthCard>
  );
}

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const q = useQuery(() => api.post('/auth/verify-email', { token: params.get('token') || '' }), []);
  return (
    <AuthCard title="Email verification">
      {q.loading ? <p className="mb-0">Verifying…</p> : q.error ? <div className="alert alert-danger mb-0">{q.error.message}</div> : <div className="alert alert-success mb-0">Your email address is verified.</div>}
      <div className="text-center mt-3">
        <Link to="/" className="small">
          Continue
        </Link>
      </div>
    </AuthCard>
  );
}

export function AccountPage() {
  const auth = useAuth();
  const toast = useToast();
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const change = useMutation((b) => api.post('/auth/change-password', b));
  const sessions = useQuery(() => api.get('/auth/sessions'), []);
  const revoke = useDialog();
  const revokeM = useMutation((id) => api.del(`/auth/sessions/${id}`));
  const fe = change.error?.fieldErrors?.() || {};
  return (
    <>
      <PageHeader title="My account" description={`${auth.user?.name} · ${auth.user?.email}`} />
      <div className="row g-3">
        <div className="col-lg-5">
          <div className="card">
            <div className="card-header">Change password</div>
            <form
              className="card-body"
              onSubmit={(e) => {
                e.preventDefault();
                change
                  .mutate(pw)
                  .then(() => {
                    toast.success('Password changed. Other sessions were signed out.');
                    setPw({ currentPassword: '', newPassword: '' });
                    sessions.reload();
                  })
                  .catch(() => {});
              }}
            >
              <FormError error={change.error} />
              <FormField label="Current password" name="cur" error={fe.currentPassword} required>
                <input id="cur" type="password" className="form-control" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
              </FormField>
              <FormField label="New password" name="new" error={fe.newPassword} required hint="At least 8 characters with a letter and a number">
                <input id="new" type="password" className={`form-control ${fe.newPassword ? 'is-invalid' : ''}`} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
              </FormField>
              <button className="btn btn-primary" disabled={change.pending || !pw.currentPassword || !pw.newPassword}>
                Change password
              </button>
            </form>
          </div>
        </div>
        <div className="col-lg-7">
          <div className="card table-card">
            <div className="card-header">Signed-in devices</div>
            <QueryState query={sessions}>
              {(rows) => (
                <DataTable
                  keyField="id"
                  rows={rows}
                  columns={[
                    { key: 'client', label: 'Device', render: (r) => <span title={r.userAgent}>{r.client === 'mobile' ? 'Mobile app' : 'Web browser'}{r.current && <span className="badge text-bg-primary ms-2">This device</span>}</span> },
                    { key: 'lastUsedAt', label: 'Last used', render: (r) => dateTime(r.lastUsedAt) },
                    { key: 'a', label: '', className: 'text-end', render: (r) => !r.current && <button className="btn btn-sm btn-outline-danger" onClick={() => revoke.open(r)}>Sign out</button> },
                  ]}
                />
              )}
            </QueryState>
          </div>
        </div>
      </div>
      {revoke.isOpen && (
        <ConfirmDialog
          title="Sign out device?"
          message="That device will need to sign in again."
          tone="danger"
          confirmLabel="Sign out"
          pending={revokeM.pending}
          onCancel={revoke.close}
          onConfirm={() => revokeM.mutate(revoke.item.id).then(() => { revoke.close(); sessions.reload(); toast.success('Device signed out'); }).catch((e) => toast.error(e.message))}
        />
      )}
    </>
  );
}
