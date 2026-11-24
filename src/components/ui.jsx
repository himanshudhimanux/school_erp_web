import { Component, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { titleCase } from '../utils/format.js';

/* ------------------------------ page structure ------------------------------ */

export function PageHeader({ title, description, breadcrumbs, actions }) {
  return (
    <div className="page-header">
      <div>
        {breadcrumbs && (
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb">
              {breadcrumbs.map((b, i) => (
                <li key={i} className={`breadcrumb-item ${i === breadcrumbs.length - 1 ? 'active' : ''}`}>
                  {b.to && i < breadcrumbs.length - 1 ? <Link to={b.to}>{b.label}</Link> : b.label}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <h1 className="mb-0">{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="d-flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon, tone = 'primary', hint, loading }) {
  return (
    <div className="card stat-card h-100">
      <div className="card-body d-flex justify-content-between align-items-start gap-2">
        <div className="min-w-0">
          <div className="stat-label">{label}</div>
          <div className="stat-value">{loading ? <div className="skeleton" style={{ width: 90, height: 26 }} /> : value}</div>
          {hint && <div className="small text-muted mt-1">{hint}</div>}
        </div>
        {icon && (
          <div className={`stat-icon tone-${tone}`} aria-hidden="true">
            <i className={`bi bi-${icon}`} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ status ------------------------------ */

const TONES = {
  success: ['paid', 'present', 'active', 'pass', 'published', 'approved', 'completed', 'sent', 'delivered', 'enrolled'],
  danger: ['overdue', 'absent', 'failed', 'fail', 'suspended', 'rejected', 'cancelled', 'withdrawn', 'disabled', 'expired', 'refunded'],
  warning: ['pending', 'partially_paid', 'late', 'due_soon', 'queued', 'trialing', 'past_due', 'under_review', 'incomplete', 'draft', 'partially_refunded', 'invited', 'on_leave'],
  info: ['leave', 'applied', 'enquiry', 'planned', 'online'],
};
const TONE_STYLE = {
  success: { background: '#f0fdf4', color: '#15803d' },
  danger: { background: '#fef2f2', color: '#b91c1c' },
  warning: { background: '#fffbeb', color: '#b45309' },
  info: { background: '#ecfeff', color: '#0e7490' },
  muted: { background: '#f1f5f9', color: '#475569' },
};

export function StatusBadge({ status, label }) {
  if (!status) return <span className="text-muted">—</span>;
  const tone = Object.keys(TONES).find((t) => TONES[t].includes(status)) || 'muted';
  return (
    <span className="status-badge" style={TONE_STYLE[tone]}>
      {label || titleCase(status === 'unpaid' ? 'pending' : status)}
    </span>
  );
}

/* ------------------------------ states ------------------------------ */

export function LoadingState({ rows = 4 }) {
  return (
    <div className="p-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton mb-3" style={{ height: 18, width: `${90 - i * 8}%` }} />
      ))}
    </div>
  );
}

export function EmptyState({ icon = 'inbox', title = 'Nothing here yet', message, action }) {
  return (
    <div className="text-center py-5 px-3">
      <div className="stat-icon tone-muted mx-auto mb-2" style={{ width: 48, height: 48 }}>
        <i className={`bi bi-${icon}`} />
      </div>
      <div className="fw-semibold">{title}</div>
      {message && <div className="text-muted small mt-1">{message}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

const DENIED = ['PERMISSION_DENIED', 'MODULE_NOT_ENABLED', 'SUBSCRIPTION_INACTIVE', 'STAFF_ONLY', 'FORBIDDEN'];

export function ErrorState({ error, onRetry }) {
  if (!error) return null;
  if (DENIED.includes(error.code)) {
    const msg = error.code === 'MODULE_NOT_ENABLED' ? 'This feature is not included in your school’s plan.' : error.code === 'SUBSCRIPTION_INACTIVE' ? 'Your school subscription is not active.' : 'You do not have permission to view this.';
    return <EmptyState icon="shield-lock" title="Access restricted" message={msg} />;
  }
  return (
    <div className="alert alert-danger d-flex align-items-center justify-content-between gap-3 m-3" role="alert">
      <span>
        <i className="bi bi-exclamation-triangle me-2" />
        {error.message || 'Something went wrong.'}
      </span>
      {onRetry && (
        <button type="button" className="btn btn-sm btn-outline-danger" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

/** Renders loading / error / empty / content for a query result. */
export function QueryState({ query, isEmpty, empty, children, rows }) {
  if (query.loading && query.data === undefined) return <LoadingState rows={rows} />;
  if (query.error && query.data === undefined) return <ErrorState error={query.error} onRetry={query.reload} />;
  // A disabled query (e.g. waiting for a session or class to be chosen) has no data yet:
  // never hand `undefined` to the render function.
  if (query.data === undefined || query.data === null) return empty || <EmptyState />;
  if (isEmpty?.(query.data)) return empty || <EmptyState />;
  return children(query.data);
}

/**
 * Catches render errors in a page so one broken screen shows a message instead of blanking the
 * whole app. `resetKey` (the route path) clears the error when the user navigates elsewhere.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, key: props.resetKey };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  static getDerivedStateFromProps(props, state) {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }

  componentDidCatch(error, info) {
    console.error('Page crashed', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="alert alert-danger m-3" role="alert">
        <div className="fw-semibold mb-1"><i className="bi bi-exclamation-triangle me-2" />This page could not be displayed.</div>
        <div className="small mb-2">{String(this.state.error.message || this.state.error)}</div>
        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => this.setState({ error: null })}>Try again</button>
      </div>
    );
  }
}

/* ------------------------------ tables ------------------------------ */

/**
 * Server-paginated table. `columns`: [{ key, label, render?(row), className? }].
 */
export function DataTable({ columns, rows, keyField = '_id', onRowClick, empty, loading }) {
  return (
    <div className="table-responsive">
      <table className={`table ${onRowClick ? 'table-hover' : ''}`}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.className}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && !rows?.length
            ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c.key}>
                      <div className="skeleton" />
                    </td>
                  ))}
                </tr>
              ))
            : rows?.map((r, i) => (
                <tr key={r[keyField] ?? i} onClick={onRowClick ? () => onRowClick(r) : undefined} style={onRowClick ? { cursor: 'pointer' } : undefined}>
                  {columns.map((c) => (
                    <td key={c.key} className={c.className}>
                      {c.render ? c.render(r) : r[c.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
      {!loading && rows?.length === 0 && (empty || <EmptyState title="No records found" message="Try changing the filters." />)}
    </div>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta || !meta.total) return null;
  const { page, totalPages, total, limit } = meta;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 px-3 py-2 border-top">
      <span className="text-muted small">
        Showing {from}–{to} of {total}
      </span>
      <div className="btn-group btn-group-sm">
        <button type="button" className="btn btn-outline-secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <i className="bi bi-chevron-left" /> Previous
        </button>
        <span className="btn btn-outline-secondary disabled">
          {page} / {Math.max(totalPages, 1)}
        </span>
        <button type="button" className="btn btn-outline-secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Next <i className="bi bi-chevron-right" />
        </button>
      </div>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <div className={`input-group ${className}`} style={{ maxWidth: 340 }}>
      <span className="input-group-text bg-white">
        <i className="bi bi-search" />
      </span>
      <input type="search" className="form-control" aria-label={placeholder} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function FilterBar({ children, onReset, hasFilters }) {
  return (
    <div className="d-flex flex-wrap align-items-end gap-2 p-3 border-bottom">
      {children}
      {onReset && hasFilters && (
        <button type="button" className="btn btn-link btn-sm text-decoration-none" onClick={onReset}>
          <i className="bi bi-x-circle me-1" />
          Reset filters
        </button>
      )}
    </div>
  );
}

/* ------------------------------ forms ------------------------------ */

export function FormField({ label, name, error, required, hint, children, className = 'mb-3' }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={name} className={`form-label ${required ? 'required' : ''}`}>
          {label}
        </label>
      )}
      {children}
      {error ? <div className="invalid-feedback d-block">{error}</div> : hint ? <div className="form-text">{hint}</div> : null}
    </div>
  );
}

/** Top-of-form message for an API error (field errors are shown inline by the form). */
export function FormError({ error }) {
  if (!error) return null;
  return (
    <div className="alert alert-danger py-2" role="alert">
      <i className="bi bi-exclamation-circle me-2" />
      {error.code === 'VALIDATION_ERROR' ? 'Please correct the highlighted fields.' : error.message}
    </div>
  );
}

/* ------------------------------ dialogs ------------------------------ */

export function Modal({ title, onClose, children, footer, size = '' }) {
  const ref = useRef(null);
  // Latest onClose without re-running the effect: parents usually pass a new function on every
  // render, and re-running would pull focus out of the field being typed in.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => e.key === 'Escape' && closeRef.current?.();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('modal-open');
      prev?.focus?.();
    };
  }, []);
  return (
    <>
      <div className="modal-backdrop fade show" />
      <div className="modal fade show d-block" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className={`modal-dialog modal-dialog-centered modal-dialog-scrollable ${size}`}>
          <div className="modal-content" style={{ borderRadius: 'var(--erp-radius-card)' }}>
            <div className="modal-header">
              <h2 className="modal-title h5">{title}</h2>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-footer">{footer}</div>}
          </div>
        </div>
      </div>
    </>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', tone = 'primary', pending, onConfirm, onCancel, children }) {
  return (
    <Modal
      title={title}
      onClose={pending ? undefined : onCancel}
      footer={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
          <button type="button" className={`btn btn-${tone}`} onClick={onConfirm} disabled={pending}>
            {pending && <span className="spinner-border spinner-border-sm me-2" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      {message && <p className="mb-0">{message}</p>}
      {children}
    </Modal>
  );
}

/** Small helper for "open a dialog for this row" state. */
export function useDialog() {
  const [item, setItem] = useState(null);
  const open = useCallback((x = true) => setItem(x), []);
  const close = useCallback(() => setItem(null), []);
  return { item, open, close, isOpen: item !== null };
}

/* ------------------------------ charts ------------------------------ */

/** Minimal responsive bar chart (SVG, no dependency). `data`: [{ label, value, tone? }]. */
export function BarChart({ data, format = (v) => v, height = 200, color = 'var(--erp-primary)', title }) {
  if (!data?.length || data.every((d) => !d.value)) return <EmptyState icon="bar-chart" title="No data for this period" />;
  const max = Math.max(...data.map((d) => d.value));
  const w = 100 / data.length;
  return (
    <figure className="mb-0">
      {title && <figcaption className="small text-muted mb-2">{title}</figcaption>}
      <svg className="bar-chart" viewBox={`0 0 100 ${height / 4 + 8}`} preserveAspectRatio="none" style={{ width: '100%', height }} role="img" aria-label={title || 'Bar chart'}>
        {data.map((d, i) => {
          const h = max ? (d.value / max) * (height / 4 - 2) : 0;
          return (
            <g key={d.label}>
              <title>{`${d.label}: ${format(d.value)}`}</title>
              <rect x={i * w + w * 0.18} y={height / 4 - h} width={w * 0.64} height={h} rx="0.8" fill={d.color || color} />
            </g>
          );
        })}
      </svg>
      <div className="d-flex" style={{ marginTop: -4 }}>
        {data.map((d) => (
          <div key={d.label} className="text-center text-muted text-truncate" style={{ width: `${w}%`, fontSize: 11 }} title={d.label}>
            {d.label}
          </div>
        ))}
      </div>
    </figure>
  );
}
