import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api/client.js';
import { useDebounced, useMutation, useQuery } from '../hooks/useApi.js';
import { useToast } from '../components/Toast.jsx';
import { PageHeader, StatusBadge, QueryState, EmptyState, DataTable, Pagination, SearchInput, FilterBar, FormField, FormError, Modal, ConfirmDialog, useDialog } from '../components/ui.jsx';
import { useStructure } from '../components/pickers.jsx';
import { date, dateTime, titleCase } from '../utils/format.js';

const SCOPES = [
  ['everyone', 'Everyone (staff, parents and students)'],
  ['staff', 'All staff'],
  ['families', 'Parents and students'],
  ['parents', 'Parents only'],
  ['students', 'Students only'],
];
const scopeLabel = (s) => SCOPES.find(([k]) => k === s)?.[1] ?? s;
const FAMILY_SCOPES = ['families', 'parents', 'students'];
const CHANNEL_ICON = { in_app: 'app-indicator', email: 'envelope', sms: 'chat-text', whatsapp: 'whatsapp', push: 'phone-vibrate', none: 'slash-circle' };

function audienceText(a) {
  const parts = [scopeLabel(a.audience.scope)];
  const groups = [...(a.audience.classes || []).map((c) => c.name), ...(a.audience.sections || []).map((s) => s.name)];
  if (groups.length) parts.push(`in ${groups.join(', ')}`);
  if (a.campus) parts.push(`· ${a.campus.name}`);
  return parts.join(' ');
}

/** Channel list from /communication/channels: only channels the server can deliver are offered (email may be chosen before Resend is set up). */
function useChannels() {
  return useQuery(() => api.get('/communication/channels'), []);
}

/* ================================ ANNOUNCEMENTS ================================ */

export function Announcements() {
  const auth = useAuth();
  const [filters, setFilters] = useState({ status: '', kind: '', search: '' });
  const [page, setPage] = useState(1);
  const search = useDebounced(filters.search);
  const q = useQuery(() => api.list('/communication/announcements', { page, limit: 20, status: filters.status, kind: filters.kind, search }), [page, filters.status, filters.kind, search]);
  const compose = useDialog();
  const detail = useDialog();
  const set = (k) => (e) => {
    setPage(1);
    setFilters({ ...filters, [k]: e.target.value });
  };
  return (
    <>
      <PageHeader
        title="Announcements & notices"
        description="Messages to staff, parents and students. Notices also stay on the notice board."
        actions={auth.can('communication.create') && <button className="btn btn-primary" onClick={() => compose.open({})}><i className="bi bi-megaphone me-1" />New announcement</button>}
      />
      <div className="card">
        <div className="card-body pb-0">
          <FilterBar hasFilters={filters.status || filters.kind || filters.search} onReset={() => setFilters({ status: '', kind: '', search: '' })}>
            <SearchInput value={filters.search} onChange={(v) => { setPage(1); setFilters({ ...filters, search: v }); }} placeholder="Search by title…" />
            <select className="form-select" style={{ maxWidth: 170 }} aria-label="Status" value={filters.status} onChange={set('status')}>
              <option value="">All statuses</option>
              {['draft', 'scheduled', 'sent', 'cancelled'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
            </select>
            <select className="form-select" style={{ maxWidth: 170 }} aria-label="Type" value={filters.kind} onChange={set('kind')}>
              <option value="">Announcements & notices</option>
              <option value="announcement">Announcements</option>
              <option value="notice">Notices</option>
            </select>
          </FilterBar>
        </div>
        <DataTable loading={q.loading} rows={q.data?.items} onRowClick={(r) => detail.open(r._id)} empty={<EmptyState icon="megaphone" title="No announcements yet" message={auth.can('communication.create') ? 'Write your first announcement to staff or families.' : undefined} />} columns={[
          { key: 'title', label: 'Message', render: (r) => <><div className="fw-semibold">{r.pinned && <i className="bi bi-pin-angle-fill text-primary me-1" title="Pinned" />}{r.title}</div><div className="small text-muted text-truncate" style={{ maxWidth: 380 }}>{r.body}</div></> },
          { key: 'kind', label: 'Type', render: (r) => titleCase(r.kind) },
          { key: 'audience', label: 'Audience', render: (r) => <span className="small">{audienceText(r)}</span> },
          { key: 'status', label: 'Status', render: (r) => <><StatusBadge status={r.status} />{r.status === 'scheduled' && <div className="small text-muted">{dateTime(r.scheduledAt)}</div>}</> },
          { key: 'when', label: 'Sent', render: (r) => (r.sentAt ? <>{dateTime(r.sentAt)}<div className="small text-muted">{r.stats.recipients} recipient{r.stats.recipients === 1 ? '' : 's'}</div></> : '—') },
        ]} />
        <Pagination meta={q.data?.meta} onPage={setPage} />
      </div>
      {compose.isOpen && <ComposeDialog initial={compose.item} onClose={compose.close} onSaved={(a) => { compose.close(); q.reload(); detail.open(a._id); }} />}
      {detail.isOpen && <AnnouncementDetail id={detail.item} onClose={detail.close} onEdit={(a) => { detail.close(); compose.open(a); }} onChange={q.reload} />}
    </>
  );
}

function ComposeDialog({ initial, onClose, onSaved }) {
  const auth = useAuth();
  const toast = useToast();
  const channels = useChannels();
  const structure = useStructure();
  const campuses = useQuery(() => api.list('/campuses', { limit: 50 }), []);
  const restricted = auth.tenant.campusIds?.length > 0;
  const [f, setF] = useState({
    kind: initial.kind || 'announcement',
    title: initial.title || '',
    body: initial.body || '',
    scope: initial.audience?.scope || 'everyone',
    classIds: (initial.audience?.classIds || []).map(String),
    sectionIds: (initial.audience?.sectionIds || []).map(String),
    campusId: initial.campusId || (restricted ? auth.tenant.campusIds[0] : ''),
    channels: initial.channels || ['in_app'],
    expiresAt: initial.expiresAt ? String(initial.expiresAt).slice(0, 10) : '',
    pinned: Boolean(initial.pinned),
  });
  const save = useMutation((body) => (initial._id ? api.patch(`/communication/announcements/${initial._id}`, body) : api.post('/communication/announcements', body)));
  const errors = save.error?.fieldErrors?.() || {};
  const toggle = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const classes = structure.data?.classes || [];
  const visibleCampuses = (campuses.data?.items || []).filter((c) => !restricted || auth.tenant.campusIds.includes(c._id));

  const submit = (e) => {
    e.preventDefault();
    const family = FAMILY_SCOPES.includes(f.scope);
    save
      .mutate({
        kind: f.kind,
        title: f.title,
        body: f.body,
        audience: { scope: f.scope, classIds: family ? f.classIds : [], sectionIds: family ? f.sectionIds : [] },
        campusId: f.campusId || null,
        channels: f.channels,
        expiresAt: f.kind === 'notice' && f.expiresAt ? `${f.expiresAt}T23:59:59` : null,
        pinned: f.kind === 'notice' && f.pinned,
      })
      .then((a) => {
        toast.success('Draft saved. Review it, then send or schedule.');
        onSaved(a);
      })
      .catch(() => {});
  };

  return (
    <Modal title={initial._id ? 'Edit draft' : 'New announcement'} size="modal-lg" onClose={onClose} footer={<><button className="btn btn-outline-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" form="compose" disabled={save.pending}>{save.pending && <span className="spinner-border spinner-border-sm me-2" />}Save draft</button></>}>
      <form id="compose" onSubmit={submit}>
        <FormError error={save.error} />
        <div className="btn-group mb-3" role="group" aria-label="Type">
          {[['announcement', 'Announcement', 'Sent once to inboxes'], ['notice', 'Notice', 'Also stays on the notice board']].map(([k, l, hint]) => (
            <button key={k} type="button" className={`btn ${f.kind === k ? 'btn-primary' : 'btn-outline-primary'}`} title={hint} onClick={() => setF({ ...f, kind: k })}>{l}</button>
          ))}
        </div>
        <FormField label="Title" name="title" required error={errors.title}><input id="title" className="form-control" maxLength={200} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required /></FormField>
        <FormField label="Message" name="body" required error={errors.body} hint={`${f.body.length}/2000 · SMS and WhatsApp receive this text as-is`}><textarea id="body" className="form-control" rows={5} maxLength={2000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} required /></FormField>
        <div className="row g-3">
          <div className="col-md-6">
            <FormField label="Who should receive it?" name="scope" required>
              <select id="scope" className="form-select" value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })}>{SCOPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </FormField>
          </div>
          <div className="col-md-6">
            <FormField label="Campus" name="campus" hint={restricted ? 'You can send only to your campuses' : 'Leave as “All campuses” to include everyone'}>
              <select id="campus" className="form-select" value={f.campusId} onChange={(e) => setF({ ...f, campusId: e.target.value })}>
                {!restricted && <option value="">All campuses</option>}
                {visibleCampuses.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </FormField>
          </div>
        </div>
        {FAMILY_SCOPES.includes(f.scope) && (
          <div className="mb-3">
            <div className="form-label">Limit to classes or sections <span className="text-muted small">(optional: none selected = the whole school)</span></div>
            <div className="border rounded p-2" style={{ maxHeight: 200, overflowY: 'auto' }}>
              {classes.length === 0 && <span className="small text-muted">No classes in the current session.</span>}
              {classes.map((c) => (
                <div key={c.id} className="mb-1">
                  <div className="form-check form-check-inline fw-semibold"><input className="form-check-input" type="checkbox" id={`c-${c.id}`} checked={f.classIds.includes(c.id)} onChange={() => setF({ ...f, classIds: toggle(f.classIds, c.id) })} /><label className="form-check-label" htmlFor={`c-${c.id}`}>{c.name} (all sections)</label></div>
                  {!f.classIds.includes(c.id) && c.sections.map((s) => (
                    <div key={s.id} className="form-check form-check-inline small"><input className="form-check-input" type="checkbox" id={`s-${s.id}`} checked={f.sectionIds.includes(s.id)} onChange={() => setF({ ...f, sectionIds: toggle(f.sectionIds, s.id) })} /><label className="form-check-label" htmlFor={`s-${s.id}`}>{s.name}</label></div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mb-3">
          <div className="form-label">Send through</div>
          <QueryState query={channels} rows={1}>
            {(d) => d.channels.filter((c) => c.available || c.channel === 'email').map((c) => (
              <div className="form-check form-check-inline" key={c.channel}>
                <input className="form-check-input" type="checkbox" id={`ch-${c.channel}`} checked={c.channel === 'in_app' || f.channels.includes(c.channel)} disabled={c.channel === 'in_app'} onChange={() => setF({ ...f, channels: toggle(f.channels, c.channel) })} />
                <label className="form-check-label" htmlFor={`ch-${c.channel}`}><i className={`bi bi-${CHANNEL_ICON[c.channel]} me-1`} />{c.label}{!c.available && <span className="text-warning small"> (not set up: will fail)</span>}</label>
              </div>
            ))}
          </QueryState>
          <div className="form-text">The app inbox is always included. People are reached only on channels they have (an email address, a phone number, or the app on their phone).</div>
        </div>
        {f.kind === 'notice' && (
          <div className="row g-3">
            <div className="col-md-6"><FormField label="Show on the notice board until" name="exp" hint="Leave empty to keep it until you remove it"><input id="exp" type="date" className="form-control" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} /></FormField></div>
            <div className="col-md-6 d-flex align-items-center"><div className="form-check"><input id="pin" type="checkbox" className="form-check-input" checked={f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} /><label htmlFor="pin" className="form-check-label">Pin to the top of the notice board</label></div></div>
          </div>
        )}
      </form>
    </Modal>
  );
}

function AnnouncementDetail({ id, onClose, onEdit, onChange }) {
  const auth = useAuth();
  const toast = useToast();
  const q = useQuery(() => api.get(`/communication/announcements/${id}`), [id]);
  const [confirm, setConfirm] = useState(null);
  const [scheduleAt, setScheduleAt] = useState('');
  const act = useMutation(({ path, body, method = 'post' }) => (method === 'del' ? api.del(path) : method === 'patch' ? api.patch(path, body) : api.post(path, body)));
  const run = (args, message, close = false) =>
    act
      .mutate(args)
      .then(() => {
        toast.success(message);
        setConfirm(null);
        onChange();
        if (close) onClose();
        else q.reload();
      })
      .catch((e) => toast.error(e.message));
  const a = q.data;
  const canSend = auth.can('communication.send');
  const canEdit = auth.can('communication.create');
  const delivery = a ? Object.entries(a.delivery) : [];

  return (
    <Modal title={a?.title || 'Announcement'} size="modal-lg" onClose={onClose}>
      <QueryState query={q}>
        {() => (
          <>
            <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
              <StatusBadge status={a.status} />
              <span className="badge text-bg-light border">{titleCase(a.kind)}</span>
              {a.pinned && <span className="badge text-bg-light border"><i className="bi bi-pin-angle me-1" />Pinned</span>}
              <span className="small text-muted">{audienceText(a)}</span>
            </div>
            <div className="border rounded p-3 mb-3 bg-light" style={{ whiteSpace: 'pre-wrap' }}>{a.body}</div>
            <dl className="row small mb-3">
              <dt className="col-sm-3">Channels</dt><dd className="col-sm-9">{a.channels.map((c) => titleCase(c === 'in_app' ? 'app inbox' : c)).join(', ')}</dd>
              <dt className="col-sm-3">Written by</dt><dd className="col-sm-9">{a.createdByName || '—'} · {dateTime(a.createdAt)}</dd>
              {a.status === 'scheduled' && <><dt className="col-sm-3">Scheduled for</dt><dd className="col-sm-9">{dateTime(a.scheduledAt)}</dd></>}
              {a.sentAt && <><dt className="col-sm-3">Sent</dt><dd className="col-sm-9">{dateTime(a.sentAt)}{a.sentByName ? ` by ${a.sentByName}` : ''} · {a.stats.recipients} recipient(s){a.stats.unreachable ? `, ${a.stats.unreachable} unreachable` : ''}</dd></>}
              {a.kind === 'notice' && <><dt className="col-sm-3">On notice board until</dt><dd className="col-sm-9">{a.expiresAt ? date(a.expiresAt) : 'Removed manually'}</dd></>}
            </dl>

            {a.status === 'sent' && (
              <>
                <h3 className="h6">Delivery</h3>
                {delivery.length === 0 ? <p className="text-muted small">No one was in this audience.</p> : (
                  <div className="table-responsive mb-3">
                    <table className="table table-sm">
                      <thead><tr><th>Channel</th><th className="text-end">Total</th><th className="text-end">Queued</th><th className="text-end">Sent</th><th className="text-end">Delivered</th><th className="text-end">Failed</th><th className="text-end">Read</th></tr></thead>
                      <tbody>
                        {delivery.map(([ch, c]) => (
                          <tr key={ch}>
                            <td><i className={`bi bi-${CHANNEL_ICON[ch]} me-1`} />{ch === 'none' ? 'Unreachable' : titleCase(ch === 'in_app' ? 'app inbox' : ch)}</td>
                            <td className="text-end">{c.total}</td>
                            <td className="text-end">{c.queued || 0}</td>
                            <td className="text-end">{c.sent || 0}</td>
                            <td className="text-end">{ch === 'sms' || ch === 'whatsapp' ? c.delivered || 0 : '—'}</td>
                            <td className={`text-end ${c.failed ? 'text-danger fw-semibold' : ''}`}>{c.failed || 0}</td>
                            <td className="text-end">{ch === 'in_app' ? c.read : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="form-text">“Delivered” is shown only when the SMS/WhatsApp provider confirms it. Failed messages can be retried from Notification history.</div>
                  </div>
                )}
              </>
            )}

            <div className="d-flex flex-wrap gap-2 border-top pt-3">
              {a.status === 'draft' && canEdit && <button className="btn btn-outline-secondary" onClick={() => onEdit(a)}><i className="bi bi-pencil me-1" />Edit</button>}
              {a.status === 'draft' && canSend && <button className="btn btn-primary" onClick={() => setConfirm('send')}><i className="bi bi-send me-1" />Send now</button>}
              {a.status === 'draft' && canSend && <button className="btn btn-outline-primary" onClick={() => setConfirm('schedule')}><i className="bi bi-clock me-1" />Schedule…</button>}
              {a.status === 'scheduled' && canSend && <button className="btn btn-outline-secondary" disabled={act.pending} onClick={() => run({ path: `/communication/announcements/${id}/unschedule` }, 'Moved back to draft')}>Unschedule</button>}
              {['draft', 'scheduled'].includes(a.status) && canSend && <button className="btn btn-outline-danger" onClick={() => setConfirm('cancel')}>Cancel</button>}
              {['draft', 'cancelled'].includes(a.status) && canEdit && <button className="btn btn-outline-danger ms-auto" onClick={() => setConfirm('delete')}><i className="bi bi-trash me-1" />Delete</button>}
              {a.status === 'sent' && a.kind === 'notice' && canEdit && (
                <>
                  <button className="btn btn-outline-secondary" disabled={act.pending} onClick={() => run({ path: `/communication/announcements/${id}`, method: 'patch', body: { pinned: !a.pinned } }, a.pinned ? 'Unpinned' : 'Pinned')}>{a.pinned ? 'Unpin' : 'Pin to top'}</button>
                  {(!a.expiresAt || new Date(a.expiresAt) > new Date()) && <button className="btn btn-outline-danger" onClick={() => setConfirm('expire')}>Remove from notice board</button>}
                </>
              )}
            </div>
            {!canSend && a.status === 'draft' && <div className="form-text">Someone with permission to send (for example the principal) needs to send this draft.</div>}
          </>
        )}
      </QueryState>
      {confirm === 'send' && <ConfirmDialog title="Send this announcement now?" message={`It goes to: ${audienceText(a)}, through ${a.channels.length} channel(s). This cannot be undone.`} confirmLabel="Send now" pending={act.pending} onCancel={() => setConfirm(null)} onConfirm={() => run({ path: `/communication/announcements/${id}/send`, body: {} }, 'Announcement sent')} />}
      {confirm === 'schedule' && (
        <ConfirmDialog title="Schedule announcement" confirmLabel="Schedule" pending={act.pending} onCancel={() => setConfirm(null)} onConfirm={() => (scheduleAt ? run({ path: `/communication/announcements/${id}/send`, body: { scheduledAt: new Date(scheduleAt).toISOString() } }, 'Announcement scheduled') : toast.error('Choose a date and time'))}>
          <FormField label="Send at (your local time)" name="at" hint="Sent within a minute of this time while the server is running"><input id="at" type="datetime-local" className="form-control" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} /></FormField>
        </ConfirmDialog>
      )}
      {confirm === 'cancel' && <ConfirmDialog title="Cancel this announcement?" tone="danger" message="It will not be sent. You can still delete it afterwards." confirmLabel="Cancel announcement" pending={act.pending} onCancel={() => setConfirm(null)} onConfirm={() => run({ path: `/communication/announcements/${id}/cancel` }, 'Announcement cancelled')} />}
      {confirm === 'delete' && <ConfirmDialog title="Delete this draft?" tone="danger" message="This cannot be undone." confirmLabel="Delete" pending={act.pending} onCancel={() => setConfirm(null)} onConfirm={() => run({ path: `/communication/announcements/${id}`, method: 'del' }, 'Deleted', true)} />}
      {confirm === 'expire' && <ConfirmDialog title="Remove from the notice board?" tone="danger" message="People will no longer see it on the notice board. Messages already delivered are not affected." confirmLabel="Remove" pending={act.pending} onCancel={() => setConfirm(null)} onConfirm={() => run({ path: `/communication/announcements/${id}`, method: 'patch', body: { expiresAt: new Date().toISOString() } }, 'Removed from the notice board')} />}
    </Modal>
  );
}

/* ================================ NOTICE BOARD ================================ */

export function NoticeBoard() {
  const [page, setPage] = useState(1);
  const q = useQuery(() => api.list('/communication/notices', { page, limit: 20 }), [page]);
  return (
    <>
      <PageHeader title="Notice board" description="Current notices from the school" />
      <QueryState query={q} isEmpty={(d) => !d.items.length} empty={<div className="card"><EmptyState icon="pin-angle" title="No notices right now" /></div>}>
        {(d) => (
          <div className="d-grid gap-3">
            {d.items.map((n) => (
              <div key={n._id} className={`card ${n.pinned ? 'border-primary' : ''}`}>
                <div className="card-body">
                  <div className="d-flex justify-content-between gap-2 mb-1">
                    <h2 className="h6 mb-0">{n.pinned && <i className="bi bi-pin-angle-fill text-primary me-1" title="Pinned" />}{n.title}</h2>
                    <span className="small text-muted text-nowrap">{date(n.sentAt)}</span>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{n.body}</div>
                  {n.expiresAt && <div className="small text-muted mt-2">Until {date(n.expiresAt)}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </QueryState>
      <Pagination meta={q.data?.meta} onPage={setPage} />
    </>
  );
}

/* ================================ NOTIFICATION HISTORY ================================ */

const TYPE_OPTIONS = [
  ['', 'All types'],
  ['attendance.*', 'Attendance alerts'],
  ['fees.reminder', 'Fee reminders'],
  ['exam.results', 'Exam results'],
  ['announcement', 'Announcements'],
  ['notice', 'Notices'],
];
const typeLabel = (t) => ({ 'attendance.absent': 'Absent alert', 'attendance.late': 'Late alert', 'fees.reminder': 'Fee reminder', 'exam.results': 'Exam results', announcement: 'Announcement', notice: 'Notice' })[t] || titleCase(t);

export function NotificationHistory() {
  const toast = useToast();
  const [f, setF] = useState({ type: '', channel: '', status: '', from: '', to: '', search: '' });
  const [page, setPage] = useState(1);
  const search = useDebounced(f.search);
  const q = useQuery(() => api.list('/communication/notifications', { page, limit: 25, ...f, search }), [page, f.type, f.channel, f.status, f.from, f.to, search]);
  const retry = useMutation((id) => api.post(`/communication/notifications/${id}/retry`));
  const view = useDialog();
  const set = (k) => (e) => {
    setPage(1);
    setF({ ...f, [k]: e.target.value });
  };
  const by = q.data?.meta?.byStatus || {};
  return (
    <>
      <PageHeader title="Notification history" description="Every alert, reminder and announcement the school has sent, with its real delivery status" />
      <div className="d-flex flex-wrap gap-2 mb-3">
        {['queued', 'sent', 'delivered', 'failed', 'cancelled'].map((s) => (
          <button key={s} type="button" className={`btn btn-sm ${f.status === s ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => { setPage(1); setF({ ...f, status: f.status === s ? '' : s }); }}>
            {titleCase(s)} <span className="badge text-bg-light ms-1">{by[s] || 0}</span>
          </button>
        ))}
      </div>
      <div className="card">
        <div className="card-body pb-0">
          <FilterBar hasFilters={Object.values(f).some(Boolean)} onReset={() => setF({ type: '', channel: '', status: '', from: '', to: '', search: '' })}>
            <SearchInput value={f.search} onChange={(v) => { setPage(1); setF({ ...f, search: v }); }} placeholder="Recipient name…" />
            <select className="form-select" style={{ maxWidth: 170 }} aria-label="Type" value={f.type} onChange={set('type')}>{TYPE_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <select className="form-select" style={{ maxWidth: 150 }} aria-label="Channel" value={f.channel} onChange={set('channel')}>
              <option value="">All channels</option>
              {['in_app', 'email', 'sms', 'whatsapp', 'push', 'none'].map((c) => <option key={c} value={c}>{c === 'none' ? 'Unreachable' : c === 'in_app' ? 'App inbox' : titleCase(c)}</option>)}
            </select>
            <select className="form-select" style={{ maxWidth: 140 }} aria-label="Status" value={f.status} onChange={set('status')}>
              <option value="">Any status</option>
              {['queued', 'retrying', 'sent', 'delivered', 'failed', 'cancelled'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
            </select>
            <input type="date" className="form-control" style={{ maxWidth: 160 }} aria-label="From" value={f.from} onChange={set('from')} />
            <input type="date" className="form-control" style={{ maxWidth: 160 }} aria-label="To" value={f.to} onChange={set('to')} />
          </FilterBar>
        </div>
        <DataTable loading={q.loading} rows={q.data?.items} onRowClick={(r) => view.open(r)} empty={<EmptyState icon="bell" title="No notifications match" />} columns={[
          { key: 'when', label: 'Created', render: (r) => <span className="text-nowrap small">{dateTime(r.createdAt)}</span> },
          { key: 'type', label: 'Type', render: (r) => typeLabel(r.type) },
          { key: 'recipient', label: 'Recipient', render: (r) => <>{r.recipient?.name || <span className="text-muted">—</span>}<div className="small text-muted">{r.channel === 'email' ? r.recipient?.email : ['sms', 'whatsapp'].includes(r.channel) ? r.recipient?.phone : ''}</div></> },
          { key: 'channel', label: 'Channel', render: (r) => <span className="text-nowrap"><i className={`bi bi-${CHANNEL_ICON[r.channel]} me-1`} />{r.channel === 'none' ? 'Unreachable' : r.channel === 'in_app' ? 'App inbox' : titleCase(r.channel)}</span> },
          { key: 'status', label: 'Status', render: (r) => <><StatusBadge status={r.status === 'queued' && r.attempts > 0 ? 'queued' : r.status} label={r.status === 'queued' && r.attempts > 0 ? `Retrying (${r.attempts})` : undefined} />{r.error && <div className="small text-danger text-truncate" style={{ maxWidth: 220 }} title={r.error}>{r.error}</div>}</> },
          { key: 'actions', label: '', className: 'text-end', render: (r) => r.status === 'failed' && ['email', 'sms', 'whatsapp', 'push'].includes(r.channel) && (
            <button className="btn btn-sm btn-outline-primary" disabled={retry.pending} onClick={(e) => { e.stopPropagation(); retry.mutate(r._id).then((n) => { toast[n.status === 'failed' ? 'error' : 'success'](n.status === 'failed' ? `Failed again: ${n.error}` : `Retried: ${titleCase(n.status)}`); q.reload(); }).catch((err) => toast.error(err.message)); }}>Retry</button>
          ) },
        ]} />
        <Pagination meta={q.data?.meta} onPage={setPage} />
      </div>
      {view.isOpen && (
        <Modal title={view.item.title} onClose={view.close}>
          <div className="d-flex gap-2 mb-2"><StatusBadge status={view.item.status} /><span className="small text-muted">{typeLabel(view.item.type)} · {view.item.channel === 'in_app' ? 'App inbox' : titleCase(view.item.channel)}</span></div>
          <div className="border rounded p-3 bg-light mb-3" style={{ whiteSpace: 'pre-wrap' }}>{view.item.body}</div>
          <dl className="row small mb-0">
            <dt className="col-4">Recipient</dt><dd className="col-8">{view.item.recipient?.name || '—'} {view.item.recipient?.email || view.item.recipient?.phone || ''}</dd>
            <dt className="col-4">Created</dt><dd className="col-8">{dateTime(view.item.createdAt)}</dd>
            {view.item.sentAt && <><dt className="col-4">Sent</dt><dd className="col-8">{dateTime(view.item.sentAt)}</dd></>}
            {view.item.deliveredAt && <><dt className="col-4">Delivered</dt><dd className="col-8">{dateTime(view.item.deliveredAt)}</dd></>}
            {view.item.readAt && <><dt className="col-4">Read</dt><dd className="col-8">{dateTime(view.item.readAt)}</dd></>}
            <dt className="col-4">Attempts</dt><dd className="col-8">{view.item.attempts}{view.item.nextAttemptAt && view.item.status === 'queued' ? ` · next ${dateTime(view.item.nextAttemptAt)}` : ''}</dd>
            {view.item.error && <><dt className="col-4">Error</dt><dd className="col-8 text-danger">{view.item.error}</dd></>}
          </dl>
        </Modal>
      )}
    </>
  );
}

/* ================================ CHANNELS & TEMPLATES ================================ */

export function CommunicationSettings() {
  const auth = useAuth();
  const toast = useToast();
  const canEdit = auth.can('settings.update');
  const channels = useChannels();
  const templates = useQuery(() => api.get('/communication/templates'), []);
  const saveChannels = useMutation((alertChannels) => api.patch('/communication/channels', { alertChannels }));
  const edit = useDialog();
  const [draft, setDraft] = useState(null);
  const saveTpl = useMutation(({ key, title, body }) => api.put(`/communication/templates/${key}`, { title, body }));
  const resetTpl = useMutation((key) => api.del(`/communication/templates/${key}`));

  const toggleAlert = (d, ch) => {
    const next = d.alertChannels.includes(ch) ? d.alertChannels.filter((c) => c !== ch) : [...d.alertChannels, ch];
    saveChannels.mutate(next).then((r) => { channels.setData(r); toast.success('Alert channels saved'); }).catch((e) => toast.error(e.message));
  };

  return (
    <>
      <PageHeader title="Channels & templates" description="How the school reaches people, and the wording of automatic messages" />
      <div className="row g-3">
        <div className="col-lg-5">
          <div className="card h-100">
            <div className="card-header">Delivery channels</div>
            <div className="card-body">
              <QueryState query={channels}>
                {(d) => (
                  <>
                    <ul className="list-unstyled mb-3">
                      {d.channels.map((c) => (
                        <li key={c.channel} className="d-flex justify-content-between align-items-start py-2 border-bottom">
                          <div>
                            <i className={`bi bi-${CHANNEL_ICON[c.channel]} me-2`} />{c.label}
                            <div className="small text-muted">
                              {c.channel === 'in_app' && 'Always on. Read receipts available.'}
                              {c.channel === 'email' && (c.available ? 'Resend configured.' : 'Email (Resend) is not configured on the server; email notifications are recorded as failed.')}
                              {['sms', 'whatsapp'].includes(c.channel) && (c.available ? (c.deliveryReceipts ? 'Configured. Delivery receipts on.' : 'Configured. Set PUBLIC_API_URL on the server for delivery receipts.') : 'Not configured on the server (Twilio).')}
                              {c.channel === 'push' && (c.available ? 'Configured. Reaches people who have the mobile app installed and signed in.' : 'Not configured on the server (Firebase).')}
                            </div>
                          </div>
                          <span className={`badge ${c.available ? 'text-bg-success' : 'text-bg-secondary'}`}>{c.available ? 'Available' : 'Not set up'}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="form-label">Use for automatic alerts (absences, exam results)</div>
                    {d.channels.filter((c) => c.channel !== 'in_app' && (c.available || c.channel === 'email' || d.alertChannels.includes(c.channel))).map((c) => (
                      <div className="form-check" key={c.channel}>
                        <input id={`al-${c.channel}`} type="checkbox" className="form-check-input" checked={d.alertChannels.includes(c.channel)} disabled={!canEdit || saveChannels.pending} onChange={() => toggleAlert(d, c.channel)} />
                        <label className="form-check-label" htmlFor={`al-${c.channel}`}>{c.label}</label>
                      </div>
                    ))}
                    <div className="form-text">Fee reminders have their own channel choice on the Automated Reminders page. SMS and WhatsApp messages are charged by the provider.</div>
                  </>
                )}
              </QueryState>
            </div>
          </div>
        </div>
        <div className="col-lg-7">
          <div className="card h-100">
            <div className="card-header">Message templates</div>
            <QueryState query={templates}>
              {(list) => (
                <ul className="list-group list-group-flush">
                  {list.map((t) => (
                    <li key={t.key} className="list-group-item">
                      <div className="d-flex justify-content-between gap-2">
                        <div>
                          <div className="fw-semibold">{t.label} {t.customized && <span className="badge text-bg-info ms-1">Customised</span>}</div>
                          <div className="small text-muted">{t.description}</div>
                        </div>
                        {canEdit && <button className="btn btn-sm btn-outline-secondary align-self-start" onClick={() => { saveTpl.reset(); setDraft({ key: t.key, title: t.title, body: t.body }); edit.open(t); }}>Edit</button>}
                      </div>
                      <div className="small border rounded bg-light p-2 mt-2"><div className="fw-semibold">{t.preview.title}</div>{t.preview.body}</div>
                    </li>
                  ))}
                </ul>
              )}
            </QueryState>
          </div>
        </div>
      </div>
      {edit.isOpen && draft && (
        <Modal title={`Edit: ${edit.item.label}`} size="modal-lg" onClose={edit.close} footer={<>
          {edit.item.customized && <button className="btn btn-outline-danger me-auto" disabled={resetTpl.pending} onClick={() => resetTpl.mutate(edit.item.key).then(() => { toast.success('Reset to the default wording'); edit.close(); templates.reload(); }).catch((e) => toast.error(e.message))}>Reset to default</button>}
          <button className="btn btn-outline-secondary" onClick={edit.close}>Cancel</button>
          <button className="btn btn-primary" disabled={saveTpl.pending} onClick={() => saveTpl.mutate(draft).then(() => { toast.success('Template saved'); edit.close(); templates.reload(); }).catch(() => {})}>Save template</button>
        </>}>
          <FormError error={saveTpl.error} />
          <p className="small text-muted">Placeholders you can use: {edit.item.variables.map((v) => <code key={v} className="me-2">{`{{${v}}}`}</code>)}</p>
          <FormField label="Title (inbox, email subject, push title)" name="tt"><input id="tt" className="form-control" maxLength={200} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></FormField>
          <FormField label="Message (also the SMS / WhatsApp text)" name="tb" hint={`${draft.body.length}/1000`}><textarea id="tb" className="form-control" rows={4} maxLength={1000} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></FormField>
          <div className="small text-muted">Default: <em>{edit.item.defaultBody}</em></div>
        </Modal>
      )}
    </>
  );
}
