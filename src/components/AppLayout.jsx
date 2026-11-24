import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { navFor } from '../nav.js';
import { api } from '../api/client.js';
import { ROLE_LABELS, dateTime } from '../utils/format.js';
import { useToast } from './Toast.jsx';
import { ErrorBoundary } from './ui.jsx';

function Sidebar({ onNavigate }) {
  const auth = useAuth();
  const groups = navFor(auth);
  return (
    <aside className="erp-sidebar" aria-label="Main navigation">
      <div className="brand">
        <div className="brand-mark">{(auth.tenant?.school?.name || 'S').charAt(0)}</div>
        <div className="min-w-0">
          <div className="fw-semibold text-truncate" style={{ maxWidth: 180 }}>
            {auth.tenant?.school?.name || 'School ERP'}
          </div>
          <div className="small text-muted text-truncate">{auth.tenant ? auth.roles.map((r) => ROLE_LABELS[r] || r).join(', ') : auth.isPlatformAdmin ? 'Platform admin' : ''}</div>
        </div>
      </div>
      <nav>
        {groups.map((g) => (
          <div key={g.group}>
            <div className="erp-nav-group">{g.group}</div>
            {g.items.map((i) => (
              <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => `erp-nav-link ${isActive ? 'active' : ''}`} onClick={onNavigate}>
                <i className={`bi bi-${i.icon}`} aria-hidden="true" />
                <span>{i.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

function useOutsideClose(open, setOpen) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const fn = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open, setOpen]);
  return ref;
}

/** In-app inbox (parents, students and anyone who receives in-app notifications). */
function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ items: [], unread: 0 });
  const ref = useOutsideClose(open, setOpen);
  const load = () =>
    api
      .list('/portal/notifications', { limit: 8 })
      .then((r) => setData({ items: r.items, unread: r.meta?.unread ?? 0 }))
      .catch(() => {});
  useEffect(() => {
    load();
  }, []);
  const markAll = async () => {
    await api.post('/portal/notifications/read-all');
    load();
  };
  return (
    <div className="position-relative" ref={ref}>
      <button type="button" className="btn btn-light position-relative" aria-label={`Notifications (${data.unread} unread)`} onClick={() => { setOpen(!open); if (!open) load(); }}>
        <i className="bi bi-bell" />
        {data.unread > 0 && <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">{data.unread}</span>}
      </button>
      {open && (
        <div className="dropdown-menu dropdown-menu-end show p-0 shadow-sm" style={{ right: 0, left: 'auto', width: 340 }}>
          <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom">
            <strong>Notifications</strong>
            {data.unread > 0 && (
              <button type="button" className="btn btn-link btn-sm p-0" onClick={markAll}>
                Mark all read
              </button>
            )}
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {data.items.length === 0 && <div className="text-muted small p-3">No notifications yet.</div>}
            {data.items.map((n) => (
              <div key={n._id} className={`px-3 py-2 border-bottom ${n.readAt ? '' : 'bg-light'}`}>
                <div className="fw-semibold small">{n.title}</div>
                <div className="small text-muted">{n.body}</div>
                <div className="small text-muted mt-1">{dateTime(n.createdAt)}</div>
              </div>
            ))}
          </div>
          <Link to="/notifications" className="d-block text-center small py-2" onClick={() => setOpen(false)}>
            View all
          </Link>
        </div>
      )}
    </div>
  );
}

function Topbar({ onToggle }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, setOpen);
  const switchSchool = async (id) => {
    try {
      await auth.selectSchool(id);
      navigate('/dashboard');
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <header className="erp-topbar">
      <button type="button" className="btn btn-light d-lg-none" aria-label="Open navigation" onClick={onToggle}>
        <i className="bi bi-list" />
      </button>
      <div className="flex-grow-1 min-w-0">
        {auth.schools.length > 1 && (
          <select className="form-select form-select-sm" style={{ maxWidth: 260 }} aria-label="Switch school" value={auth.tenant?.schoolId || ''} onChange={(e) => switchSchool(e.target.value)}>
            {!auth.tenant && <option value="">Choose a school…</option>}
            {auth.schools.map((s) => (
              <option key={s.schoolId} value={s.schoolId}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {auth.tenant && <NotificationDropdown />}
      <div className="position-relative" ref={ref}>
        <button type="button" className="btn btn-light d-flex align-items-center gap-2" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className="stat-icon tone-primary" style={{ width: 28, height: 28, fontSize: 13 }}>
            {auth.user?.name?.charAt(0)}
          </span>
          <span className="d-none d-md-inline">{auth.user?.name}</span>
          <i className="bi bi-chevron-down small" />
        </button>
        {open && (
          <div className="dropdown-menu dropdown-menu-end show shadow-sm" style={{ right: 0, left: 'auto' }}>
            <div className="px-3 py-2 small text-muted">{auth.user?.email}</div>
            <div className="dropdown-divider" />
            <Link className="dropdown-item" to="/account" onClick={() => setOpen(false)}>
              <i className="bi bi-person me-2" />
              My account
            </Link>
            <button type="button" className="dropdown-item text-danger" onClick={() => auth.logout().then(() => navigate('/login'))}>
              <i className="bi bi-box-arrow-right me-2" />
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  return (
    <div className={`erp-shell ${open ? 'sidebar-open' : ''}`}>
      <Sidebar onNavigate={() => setOpen(false)} />
      <div className="erp-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="erp-main">
        <Topbar onToggle={() => setOpen(true)} />
        <main className="erp-content" id="main">
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
