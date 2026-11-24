import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api/client.js';
import { useDebounced, useMutation, useQuery } from '../hooks/useApi.js';
import { useToast } from '../components/Toast.jsx';
import { PageHeader, StatusBadge, QueryState, EmptyState, ErrorState, DataTable, Pagination, SearchInput, FilterBar, FormField, FormError, Modal, ConfirmDialog, useDialog } from '../components/ui.jsx';
import { date, dateTime, money, titleCase, ROLE_LABELS, DAY_NAMES } from '../utils/format.js';

const STAFF_ROLES = ['school_owner', 'school_admin', 'principal', 'accountant', 'teacher', 'staff'];

/* ------------------------------ institution ------------------------------ */

export function School() {
  const auth = useAuth();
  const toast = useToast();
  const q = useQuery(() => api.get('/school'), []);
  const [f, setF] = useState(null);
  const [att, setAtt] = useState(null);
  useEffect(() => {
    if (!q.data) return;
    setF({ name: q.data.name, email: q.data.email || '', phone: q.data.phone || '', timezone: q.data.timezone, city: q.data.address?.city || '', line1: q.data.address?.line1 || '' });
    const a = q.data.settings?.attendance || {};
    setAtt({ weeklyOffDays: a.weeklyOffDays ?? [0], teacherEditDays: a.teacherEditDays ?? 1, absentAlerts: a.absentAlerts ?? true, alertOnLate: a.alertOnLate ?? false, lowAttendanceThreshold: a.lowAttendanceThreshold ?? 75 });
  }, [q.data]);
  const save = useMutation((b) => api.patch('/school', b));
  const saveAtt = useMutation((b) => api.patch('/school/settings', { attendance: b }));
  const canEdit = auth.can('school.update');
  const fe = save.error?.fieldErrors?.() || {};
  return (
    <>
      <PageHeader title="Institution" description="Profile, attendance rules and campuses" />
      <QueryState query={q}>
        {() => f && att && (
          <div className="row g-3">
            <div className="col-lg-6">
              <div className="card">
                <div className="card-header">Profile</div>
                <div className="card-body">
                  <FormError error={save.error} />
                  <FormField label="Name" name="sn" required error={fe.name}><input id="sn" className="form-control" disabled={!canEdit} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></FormField>
                  <div className="row"><div className="col-6"><FormField label="Email" name="se" error={fe.email}><input id="se" type="email" className="form-control" disabled={!canEdit} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></FormField></div><div className="col-6"><FormField label="Phone" name="sp"><input id="sp" className="form-control" disabled={!canEdit} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></FormField></div></div>
                  <FormField label="Address" name="sa"><input id="sa" className="form-control" disabled={!canEdit} value={f.line1} onChange={(e) => setF({ ...f, line1: e.target.value })} /></FormField>
                  <div className="row"><div className="col-6"><FormField label="City" name="sc"><input id="sc" className="form-control" disabled={!canEdit} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></FormField></div><div className="col-6"><FormField label="Timezone" name="tz" error={fe.timezone}><input id="tz" className="form-control" disabled={!canEdit} value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })} /></FormField></div></div>
                  {canEdit && <button className="btn btn-primary" disabled={save.pending} onClick={() => save.mutate({ name: f.name, email: f.email, phone: f.phone || undefined, timezone: f.timezone, address: { line1: f.line1 || undefined, city: f.city || undefined } }).then(() => { toast.success('Profile saved'); auth.reloadContext(); }).catch(() => {})}>Save profile</button>}
                </div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="card">
                <div className="card-header">Attendance rules</div>
                <div className="card-body">
                  <FormError error={saveAtt.error} />
                  <div className="form-label">Weekly days off</div>
                  <div className="d-flex flex-wrap gap-3 mb-3">{DAY_NAMES.map((d, i) => <div className="form-check" key={d}><input id={`wd-${i}`} type="checkbox" className="form-check-input" disabled={!auth.can('settings.update')} checked={att.weeklyOffDays.includes(i)} onChange={(e) => setAtt({ ...att, weeklyOffDays: e.target.checked ? [...att.weeklyOffDays, i] : att.weeklyOffDays.filter((x) => x !== i) })} /><label htmlFor={`wd-${i}`} className="form-check-label">{d.slice(0, 3)}</label></div>)}</div>
                  <div className="row">
                    <div className="col-6"><FormField label="Teachers can edit past days" name="ted" hint="0 = today only"><input id="ted" type="number" min="0" max="30" className="form-control" disabled={!auth.can('settings.update')} value={att.teacherEditDays} onChange={(e) => setAtt({ ...att, teacherEditDays: Number(e.target.value) })} /></FormField></div>
                    <div className="col-6"><FormField label="Low attendance below (%)" name="lat"><input id="lat" type="number" min="1" max="100" className="form-control" disabled={!auth.can('settings.update')} value={att.lowAttendanceThreshold} onChange={(e) => setAtt({ ...att, lowAttendanceThreshold: Number(e.target.value) })} /></FormField></div>
                  </div>
                  <div className="form-check form-switch"><input id="aa" type="checkbox" role="switch" className="form-check-input" disabled={!auth.can('settings.update')} checked={att.absentAlerts} onChange={(e) => setAtt({ ...att, absentAlerts: e.target.checked })} /><label htmlFor="aa" className="form-check-label">Alert parents when a child is marked absent</label></div>
                  <div className="form-check form-switch mb-3"><input id="al" type="checkbox" role="switch" className="form-check-input" disabled={!auth.can('settings.update')} checked={att.alertOnLate} onChange={(e) => setAtt({ ...att, alertOnLate: e.target.checked })} /><label htmlFor="al" className="form-check-label">Also alert when marked late</label></div>
                  {auth.can('settings.update') && <button className="btn btn-primary" disabled={saveAtt.pending} onClick={() => saveAtt.mutate(att).then(() => toast.success('Attendance rules saved')).catch(() => {})}>Save rules</button>}
                </div>
              </div>
            </div>
            <div className="col-12"><Campuses /></div>
          </div>
        )}
      </QueryState>
    </>
  );
}

function Campuses() {
  const auth = useAuth();
  const toast = useToast();
  const q = useQuery(() => api.list('/campuses', { limit: 50 }), []);
  const d = useDialog();
  const [f, setF] = useState({});
  const save = useMutation((b) => (b._id ? api.patch(`/campuses/${b._id}`, { name: b.name, code: b.code, status: b.status }) : api.post('/campuses', { name: b.name, code: b.code })));
  return (
    <div className="card table-card">
      <div className="card-header d-flex justify-content-between">Campuses{auth.can('campuses.create') && <button className="btn btn-sm btn-primary" onClick={() => { save.reset(); setF({ name: '', code: '' }); d.open(); }}>Add campus</button>}</div>
      <QueryState query={q}>{(x) => <DataTable rows={x.items} onRowClick={auth.can('campuses.update') ? (r) => { save.reset(); setF(r); d.open(); } : undefined} columns={[{ key: 'name', label: 'Name', render: (r) => <>{r.name}{r.isMain && <span className="badge text-bg-light border ms-2">Main</span>}</> }, { key: 'code', label: 'Code' }, { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> }]} />}</QueryState>
      {d.isOpen && (
        <Modal title={f._id ? 'Edit campus' : 'Add campus'} onClose={d.close} footer={<><button className="btn btn-outline-secondary" onClick={d.close}>Cancel</button><button className="btn btn-primary" disabled={save.pending || !f.name || !f.code} onClick={() => save.mutate(f).then(() => { d.close(); q.reload(); toast.success('Campus saved'); }).catch(() => {})}>Save</button></>}>
          <FormError error={save.error} />
          <FormField label="Name" name="cn" required><input id="cn" className="form-control" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></FormField>
          <FormField label="Code" name="cc" required><input id="cc" className="form-control text-uppercase" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></FormField>
          {f._id && <FormField label="Status" name="cs" className="mb-0"><select id="cs" className="form-select" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></FormField>}
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------ members ------------------------------ */

export function Members() {
  const auth = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const s = useDebounced(search);
  const q = useQuery(() => api.list('/members', { search: s, page, limit: 25 }), [s, page]);
  const roles = useQuery(() => api.get('/roles'), [], { enabled: auth.can('roles.read') });
  const d = useDialog();
  const [f, setF] = useState({});
  const save = useMutation((b) => (b.id ? api.patch(`/members/${b.id}`, { roles: b.roles.filter((r) => STAFF_ROLES.includes(r)), status: b.status }) : api.post('/members', { name: b.name, email: b.email, roles: b.roles })));
  const remove = useDialog();
  const removeM = useMutation((id) => api.del(`/members/${id}`));
  const fe = save.error?.fieldErrors?.() || {};
  return (
    <>
      <PageHeader title="Users & roles" description="Who can sign in to this school, and what they can do" actions={auth.can('users.create') && <button className="btn btn-primary" onClick={() => { save.reset(); setF({ name: '', email: '', roles: ['teacher'] }); d.open(); }}><i className="bi bi-plus-lg me-1" />Add user</button>} />
      <div className="card table-card mb-3">
        <FilterBar><SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Name, email or phone" /></FilterBar>
        {q.error ? <ErrorState error={q.error} onRetry={q.reload} /> : (
          <DataTable keyField="id" loading={q.loading} rows={q.data?.items} onRowClick={auth.can('users.update') ? (r) => { save.reset(); setF({ id: r.id, name: r.user.name, roles: r.roles, status: r.status }); d.open(); } : undefined} columns={[
            { key: 'name', label: 'Name', render: (r) => <><div className="fw-semibold">{r.user.name}</div><div className="small text-muted">{r.user.email}</div></> },
            { key: 'roles', label: 'Roles', render: (r) => r.roles.map((x) => ROLE_LABELS[x] || x).join(', ') + (r.customRoleIds?.length ? ` +${r.customRoleIds.length} custom` : '') },
            { key: 'login', label: 'Last sign-in', render: (r) => (r.user.lastLoginAt ? dateTime(r.user.lastLoginAt) : 'Never') },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          ]} />
        )}
        <Pagination meta={q.data?.meta} onPage={setPage} />
      </div>
      {auth.can('roles.read') && (
        <div className="card table-card">
          <div className="card-header">Custom roles</div>
          <QueryState query={roles} isEmpty={(x) => !(x.items || x).length} empty={<EmptyState icon="shield" title="No custom roles" message="Built-in roles cover most schools. Custom roles can be created through the API." />}>
            {(x) => <DataTable rows={x.items || x} columns={[{ key: 'name', label: 'Role' }, { key: 'key', label: 'Key' }, { key: 'permissions', label: 'Permissions', render: (r) => r.permissions?.length }]} />}
          </QueryState>
        </div>
      )}
      {d.isOpen && (
        <Modal title={f.id ? `Edit ${f.name}` : 'Add user'} onClose={d.close} footer={<>
          {f.id && auth.can('users.delete') && <button className="btn btn-outline-danger me-auto" onClick={() => remove.open(f)}>Remove from school</button>}
          <button className="btn btn-outline-secondary" onClick={d.close}>Cancel</button>
          <button className="btn btn-primary" disabled={save.pending || !f.roles.some((r) => STAFF_ROLES.includes(r)) || (!f.id && (!f.name || !f.email))} onClick={() => save.mutate(f).then((r) => { d.close(); q.reload(); toast.success(r?.isNewUser ? 'User added; a set-password email was sent' : 'Saved'); }).catch(() => {})}>Save</button>
        </>}>
          <FormError error={save.error} />
          {!f.id && <>
            <FormField label="Full name" name="mn" required error={fe.name}><input id="mn" className="form-control" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></FormField>
            <FormField label="Email" name="me" required error={fe.email}><input id="me" type="email" className="form-control" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></FormField>
          </>}
          <div className="form-label">Roles</div>
          {STAFF_ROLES.filter((r) => r !== 'school_owner' || auth.tenant.isOwner).map((r) => <div className="form-check" key={r}><input id={`r-${r}`} type="checkbox" className="form-check-input" checked={f.roles.includes(r)} onChange={(e) => setF({ ...f, roles: e.target.checked ? [...f.roles, r] : f.roles.filter((x) => x !== r) })} /><label htmlFor={`r-${r}`} className="form-check-label">{ROLE_LABELS[r]}</label></div>)}
          {f.id && <FormField label="Access" name="ms" className="mt-3 mb-0"><select id="ms" className="form-select" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="active">Active</option><option value="suspended">Suspended (cannot sign in to this school)</option></select></FormField>}
        </Modal>
      )}
      {remove.isOpen && <ConfirmDialog title="Remove from school?" tone="danger" message={`${remove.item.name} will lose access to this school.`} confirmLabel="Remove" pending={removeM.pending} onCancel={remove.close} onConfirm={() => removeM.mutate(remove.item.id).then(() => { remove.close(); d.close(); q.reload(); toast.success('Removed'); }).catch((e) => { remove.close(); toast.error(e.message); })} />}
    </>
  );
}

/* ------------------------------ subscription & audit ------------------------------ */

export function Subscription() {
  const q = useQuery(() => api.get('/subscription'), []);
  const plans = useQuery(() => api.get('/subscription/plans'), []);
  const limitRow = (label, used, max) => <div className="d-flex justify-content-between py-2 border-bottom"><span>{label}</span><span><strong>{used}</strong> / {max ?? 'Unlimited'}</span></div>;
  return (
    <>
      <PageHeader title="Subscription" description="Your plan, usage and included modules" />
      <QueryState query={q}>
        {(s) => (
          <div className="row g-3">
            <div className="col-lg-5">
              <div className="card">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-3"><div><div className="small text-muted">Current plan</div><div className="fs-4 fw-semibold">{s.planName || 'No plan'}</div></div><StatusBadge status={s.status} /></div>
                  <div className="small text-muted mb-3">{s.status === 'trialing' ? `Trial ends ${date(s.trialEndsAt)}` : `Current period ends ${date(s.currentPeriodEnd)}`}</div>
                  {limitRow('Students', s.usage?.maxStudents, s.limits.maxStudents)}
                  {limitRow('Staff users', s.usage?.maxUsers, s.limits.maxUsers)}
                  {limitRow('Campuses', s.usage?.maxCampuses, s.limits.maxCampuses)}
                  <p className="small text-muted mt-3 mb-0">To change your plan, contact the platform administrator.</p>
                </div>
              </div>
            </div>
            <div className="col-lg-7">
              <div className="card table-card mb-3">
                <div className="card-header">Modules</div>
                <DataTable keyField="key" rows={s.modules} columns={[{ key: 'label', label: 'Module' }, { key: 'inc', label: 'In your plan', render: (m) => (m.included ? <StatusBadge status="active" label="Included" /> : <StatusBadge status="draft" label="Not included" />) }]} />
              </div>
              <div className="card table-card">
                <div className="card-header">Available plans</div>
                <QueryState query={plans}>{(p) => <DataTable rows={p} columns={[{ key: 'name', label: 'Plan' }, { key: 'price', label: 'Monthly', className: 'num', render: (x) => money(x.priceMonthly, x.currency) }, { key: 'students', label: 'Students', className: 'num', render: (x) => x.limits?.maxStudents ?? 'Unlimited' }, { key: 'mods', label: 'Modules', render: (x) => x.modules.length }]} />}</QueryState>
              </div>
            </div>
          </div>
        )}
      </QueryState>
    </>
  );
}

export function Audit() {
  const [f, setF] = useState({ action: '', page: 1 });
  const q = useQuery(() => api.list('/audit-logs', { ...f, limit: 50 }), [JSON.stringify(f)]);
  return (
    <>
      <PageHeader title="Audit logs" description="Who changed what, and when" />
      <div className="card table-card">
        <FilterBar><input className="form-control" style={{ maxWidth: 260 }} aria-label="Action" placeholder="Filter by action, e.g. payment.received" value={f.action} onChange={(e) => setF({ action: e.target.value.trim(), page: 1 })} /></FilterBar>
        {q.error ? <ErrorState error={q.error} onRetry={q.reload} /> : (
          <DataTable loading={q.loading} rows={q.data?.items} columns={[
            { key: 'createdAt', label: 'When', render: (r) => dateTime(r.createdAt) },
            { key: 'actor', label: 'Who', render: (r) => r.actorId?.name || 'System' },
            { key: 'action', label: 'Action', render: (r) => <code>{r.action}</code> },
            { key: 'entity', label: 'Record', render: (r) => titleCase(r.entityType) },
            { key: 'ip', label: 'IP', render: (r) => r.ip || '—' },
          ]} />
        )}
        <Pagination meta={q.data?.meta} onPage={(p) => setF({ ...f, page: p })} />
      </div>
    </>
  );
}
