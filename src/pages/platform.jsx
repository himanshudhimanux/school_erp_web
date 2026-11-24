import { useState } from 'react';
import { api } from '../api/client.js';
import { useDebounced, useMutation, useQuery } from '../hooks/useApi.js';
import { useToast } from '../components/Toast.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { PageHeader, StatCard, StatusBadge, QueryState, EmptyState, ErrorState, DataTable, Pagination, SearchInput, FilterBar, FormField, FormError, Modal, ConfirmDialog, BarChart, useDialog } from '../components/ui.jsx';
import { date, money, toMinor, fromMinor, titleCase } from '../utils/format.js';

function PlatformOnly({ children }) {
  const auth = useAuth();
  return auth.isPlatformAdmin ? children : <EmptyState icon="shield-lock" title="Platform administrators only" />;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (ym) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
const SUB_LABEL = { trialing: 'Trial', active: 'Paid', past_due: 'Past due', expired: 'Expired', cancelled: 'Cancelled', none: 'No plan' };
const limitText = (v) => (v === null || v === undefined ? 'Unlimited' : v);
const num = (v) => (v === null || v === undefined ? '' : String(v));
const toLimit = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

/* ================================ ANALYTICS ================================ */

export function PlatformAnalytics() {
  const q = useQuery(() => api.get('/platform/analytics'), []);
  const manage = useDialog();
  const [search, setSearch] = useState('');
  return (
    <PlatformOnly>
      <PageHeader title="Platform analytics" description="Schools, people and subscriptions across the whole platform" actions={<button className="btn btn-outline-secondary" onClick={q.reload} disabled={q.loading}><i className="bi bi-arrow-clockwise me-1" />Refresh</button>} />
      <QueryState query={q} rows={6}>
        {(d) => {
          const cur = d.revenue.currency === 'MIXED' ? 'INR' : d.revenue.currency;
          const rows = d.topSchools.filter((s) => !search || `${s.name} ${s.code} ${s.city || ''}`.toLowerCase().includes(search.toLowerCase()));
          return (
            <>
              <div className="row g-3 mb-3">
                <div className="col-6 col-xl-3"><StatCard label="Schools" value={d.schools.total} hint={`${d.schools.byStatus.active || 0} active · ${d.schools.newThisMonth} new this month`} icon="buildings" /></div>
                <div className="col-6 col-xl-3"><StatCard label="Active students" value={d.people.students.toLocaleString('en-IN')} hint={`${d.people.studentLogins.toLocaleString('en-IN')} with app login`} icon="mortarboard" tone="info" /></div>
                <div className="col-6 col-xl-3"><StatCard label="Staff & parents" value={(d.people.staff + d.people.parents).toLocaleString('en-IN')} hint={`${d.people.staff} staff · ${d.people.parents} parents (${d.people.parentLogins} use the app)`} icon="people" tone="success" /></div>
                <div className="col-6 col-xl-3"><StatCard label="Recurring revenue / month" value={money(d.revenue.monthlyRecurring, cur)} hint={`${money(d.revenue.annualRunRate, cur)} a year · from agreed prices`} icon="graph-up-arrow" tone="warning" /></div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-lg-8">
                  <div className="card h-100">
                    <div className="card-header">New schools, last 12 months</div>
                    <div className="card-body"><BarChart data={d.growth.map((g) => ({ label: monthLabel(g.month), value: g.schools }))} format={(v) => `${v} school${v === 1 ? '' : 's'}`} /></div>
                  </div>
                </div>
                <div className="col-lg-4">
                  <div className="card h-100">
                    <div className="card-header">Subscriptions (active schools)</div>
                    <div className="card-body">
                      {Object.keys(d.subscriptions.byStatus).length === 0 ? <span className="text-muted">No active schools.</span> : Object.entries(d.subscriptions.byStatus).map(([k, v]) => (
                        <div key={k} className="d-flex justify-content-between py-1 border-bottom"><StatusBadge status={k} label={SUB_LABEL[k] || titleCase(k)} /><span className="fw-semibold">{v}</span></div>
                      ))}
                      <div className="small text-muted mt-3">People signed in during the last 30 days: <strong>{d.people.activeUsers30d}</strong> of {d.people.users} accounts.</div>
                      {Object.keys(d.schools.byType).length > 0 && <div className="small text-muted mt-1">{Object.entries(d.schools.byType).map(([t, n]) => `${titleCase(t)}: ${n}`).join(' · ')}</div>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-lg-6">
                  <div className="card h-100">
                    <div className="card-header">Plans</div>
                    <div className="table-responsive">
                      <table className="table table-sm mb-0">
                        <thead><tr><th>Plan</th><th className="text-end">Schools</th><th className="text-end">Students</th><th className="text-end">Revenue / month</th></tr></thead>
                        <tbody>
                          {d.plans.map((p) => <tr key={p.planId}><td>{p.name}{!p.isActive && <span className="badge text-bg-secondary ms-1">Inactive</span>}</td><td className="text-end">{p.schools}</td><td className="text-end">{p.students.toLocaleString('en-IN')}</td><td className="text-end">{money(p.monthlyRevenue, cur)}</td></tr>)}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                <div className="col-lg-6">
                  <div className="card h-100">
                    <div className="card-header">Needs attention</div>
                    {d.attention.length === 0 ? <div className="card-body text-muted">Nothing needs attention right now.</div> : (
                      <ul className="list-group list-group-flush">
                        {d.attention.map((a) => (
                          <li key={a.schoolId} className="list-group-item d-flex justify-content-between align-items-center gap-2">
                            <div><div className="fw-semibold">{a.name}</div><div className="small text-muted">{a.reason}{a.plan ? ` · ${a.plan}` : ''}</div></div>
                            <button className="btn btn-sm btn-outline-primary" onClick={() => manage.open(a.schoolId)}>Manage</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              <div className="card table-card">
                <div className="card-header d-flex flex-wrap gap-2 justify-content-between align-items-center"><span>Schools by size</span><div style={{ minWidth: 240 }}><SearchInput value={search} onChange={setSearch} placeholder="Filter schools…" /></div></div>
                <DataTable keyField="schoolId" rows={rows} onRowClick={(r) => manage.open(r.schoolId)} empty={<EmptyState icon="buildings" title="No schools" />} columns={[
                  { key: 'name', label: 'School', render: (r) => <><div className="fw-semibold">{r.name}</div><div className="small text-muted">{r.code}{r.city ? ` · ${r.city}` : ''} · {titleCase(r.type)}</div></> },
                  { key: 'plan', label: 'Plan', render: (r) => <>{r.plan || '—'}<div><StatusBadge status={r.status === 'active' ? r.subscriptionStatus : r.status} label={r.status === 'active' ? SUB_LABEL[r.subscriptionStatus] : undefined} /></div></> },
                  { key: 'students', label: 'Students', className: 'num', render: (r) => <>{r.students.toLocaleString('en-IN')}{r.maxStudents ? <div className="small text-muted">of {r.maxStudents}</div> : null}</> },
                  { key: 'staff', label: 'Staff', className: 'num' },
                  { key: 'parents', label: 'Parents', className: 'num' },
                  { key: 'rev', label: 'Revenue / month', className: 'num', render: (r) => (r.monthlyRevenue ? money(r.monthlyRevenue, cur) : '—') },
                  { key: 'since', label: 'Joined', render: (r) => date(r.createdAt) },
                ]} />
              </div>
              <div className="form-text mt-2">Revenue figures use the price agreed on each paid subscription (yearly prices ÷ 12); trials, expired and suspended schools count as zero. Subscription payments are not collected through the platform.</div>
            </>
          );
        }}
      </QueryState>
      {manage.isOpen && <ManageSchool schoolId={manage.item} onClose={manage.close} onChange={q.reload} />}
    </PlatformOnly>
  );
}

/* ================================ SCHOOLS ================================ */

export function PlatformSchools() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const s = useDebounced(search);
  const q = useQuery(() => api.list('/platform/schools', { search: s, status, page, limit: 25 }), [s, status, page]);
  const plans = useQuery(() => api.get('/platform/plans', { includeInactive: false }), []);
  const d = useDialog();
  const manage = useDialog();
  const [f, setF] = useState({});
  const onboard = useMutation((b) => api.post('/platform/schools', b));
  const fe = onboard.error?.fieldErrors?.() || {};
  return (
    <PlatformOnly>
      <PageHeader title="Schools" description="Institutions on the platform" actions={<button className="btn btn-primary" onClick={() => { onboard.reset(); setF({ name: '', code: '', type: 'school', ownerName: '', ownerEmail: '', planId: plans.data?.[0]?._id || '', trial: true, billingCycle: 'monthly' }); d.open(); }}><i className="bi bi-plus-lg me-1" />Onboard school</button>} />
      <div className="card table-card">
        <FilterBar hasFilters={search || status} onReset={() => { setSearch(''); setStatus(''); }}>
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="School name, code or city" />
          <select className="form-select" style={{ maxWidth: 170 }} aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {['active', 'suspended', 'cancelled'].map((x) => <option key={x} value={x}>{titleCase(x)}</option>)}
          </select>
        </FilterBar>
        {q.error ? <ErrorState error={q.error} onRetry={q.reload} /> : (
          <DataTable loading={q.loading} rows={q.data?.items} onRowClick={(r) => manage.open(r._id)} columns={[
            { key: 'name', label: 'School', render: (r) => <><div className="fw-semibold">{r.name}</div><div className="small text-muted">{r.code} · {titleCase(r.type)}{r.address?.city ? ` · ${r.address.city}` : ''}</div></> },
            { key: 'plan', label: 'Plan', render: (r) => r.subscription?.planName || '—' },
            { key: 'sub', label: 'Subscription', render: (r) => <><StatusBadge status={r.subscription?.status} label={SUB_LABEL[r.subscription?.status]} /><div className="small text-muted">until {date(r.subscription?.currentPeriodEnd)}</div></> },
            { key: 'status', label: 'School', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'created', label: 'Joined', render: (r) => date(r.createdAt) },
            { key: 'x', label: '', className: 'text-end', render: (r) => <button className="btn btn-sm btn-outline-primary" onClick={(e) => { e.stopPropagation(); manage.open(r._id); }}>Manage</button> },
          ]} />
        )}
        <Pagination meta={q.data?.meta} onPage={setPage} />
      </div>
      {d.isOpen && (
        <Modal title="Onboard a school" onClose={d.close} footer={<><button className="btn btn-outline-secondary" onClick={d.close}>Cancel</button><button className="btn btn-primary" disabled={onboard.pending || !f.name || !f.code || !f.ownerEmail || !f.planId} onClick={() => onboard.mutate({ school: { name: f.name, code: f.code, type: f.type }, owner: { name: f.ownerName || f.ownerEmail, email: f.ownerEmail }, planId: f.planId, trial: f.trial, billingCycle: f.billingCycle }).then((r) => { d.close(); q.reload(); toast.added(r.ownerIsNew ? 'School onboarded' : 'School onboarded with an existing account as owner', r); }).catch(() => {})}>{onboard.pending && <span className="spinner-border spinner-border-sm me-2" />}Create</button></>}>
          <FormError error={onboard.error} />
          <div className="row">
            <div className="col-md-8"><FormField label="School name" name="n" required error={fe['school.name']}><input id="n" className="form-control" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></FormField></div>
            <div className="col-md-4"><FormField label="Type" name="ty"><select id="ty" className="form-select" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{['school', 'college', 'coaching', 'preschool', 'other'].map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</select></FormField></div>
          </div>
          <FormField label="Code" name="c" required error={fe['school.code']} hint="Lowercase letters, digits and hyphens"><input id="c" className="form-control" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toLowerCase() })} /></FormField>
          <div className="row"><div className="col-6"><FormField label="Owner name" name="on" error={fe['owner.name']}><input id="on" className="form-control" value={f.ownerName} onChange={(e) => setF({ ...f, ownerName: e.target.value })} /></FormField></div><div className="col-6"><FormField label="Owner email" name="oe" required error={fe['owner.email']}><input id="oe" type="email" className="form-control" value={f.ownerEmail} onChange={(e) => setF({ ...f, ownerEmail: e.target.value })} /></FormField></div></div>
          <div className="row">
            <div className="col-7"><FormField label="Plan" name="p" required><select id="p" className="form-select" value={f.planId} onChange={(e) => setF({ ...f, planId: e.target.value })}>{plans.data?.map((p) => <option key={p._id} value={p._id}>{p.name} · {money(p.priceMonthly, p.currency)}/mo</option>)}</select></FormField></div>
            <div className="col-5"><FormField label="Billing" name="bc"><select id="bc" className="form-select" value={f.billingCycle} onChange={(e) => setF({ ...f, billingCycle: e.target.value })}><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></FormField></div>
          </div>
          <div className="form-check"><input id="tr" type="checkbox" className="form-check-input" checked={f.trial} onChange={(e) => setF({ ...f, trial: e.target.checked })} /><label htmlFor="tr" className="form-check-label">Start with a free trial</label></div>
        </Modal>
      )}
      {manage.isOpen && <ManageSchool schoolId={manage.item} onClose={manage.close} onChange={q.reload} />}
    </PlatformOnly>
  );
}

/** One school: usage against limits, owners, plan change, subscription dates/status and suspension. */
function ManageSchool({ schoolId, onClose, onChange }) {
  const toast = useToast();
  const q = useQuery(() => api.get(`/platform/schools/${schoolId}`), [schoolId]);
  const plans = useQuery(() => api.get('/platform/plans', { includeInactive: false }), []);
  const [tab, setTab] = useState('overview');
  const [planForm, setPlanForm] = useState(null);
  const [subForm, setSubForm] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const changePlan = useMutation((b) => api.put(`/platform/schools/${schoolId}/subscription`, b));
  const updateSub = useMutation((b) => api.patch(`/platform/schools/${schoolId}/subscription`, b));
  const setStatus = useMutation((st) => api.patch(`/platform/schools/${schoolId}/status`, { status: st }));
  const done = (msg) => {
    toast.success(msg);
    q.reload();
    onChange?.();
  };
  const d = q.data;
  return (
    <Modal title={d?.school?.name || 'School'} size="modal-lg" onClose={onClose}>
      <QueryState query={q}>
        {() => {
          const sub = d.subscription;
          const rec = d.subscriptionRecord;
          return (
            <>
              <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
                <StatusBadge status={d.school.status} />
                <StatusBadge status={sub.status} label={`${sub.planName || 'No plan'} · ${SUB_LABEL[sub.status] || sub.status}`} />
                <span className="small text-muted">{d.school.code} · joined {date(d.school.createdAt)}</span>
              </div>
              <ul className="nav nav-tabs mb-3">
                {[['overview', 'Overview'], ['plan', 'Change plan'], ['subscription', 'Subscription']].map(([k, l]) => <li key={k} className="nav-item"><button type="button" className={`nav-link ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button></li>)}
              </ul>

              {tab === 'overview' && (
                <>
                  <h3 className="h6">Usage</h3>
                  <table className="table table-sm mb-3">
                    <thead><tr><th>Limit</th><th className="text-end">Used</th><th className="text-end">Allowed</th></tr></thead>
                    <tbody>
                      {[['maxStudents', 'Students'], ['maxUsers', 'Staff seats'], ['maxCampuses', 'Campuses']].map(([k, l]) => {
                        const used = d.usage[k] ?? 0;
                        const max = sub.limits[k];
                        return <tr key={k}><td>{l}</td><td className={`text-end ${max && used >= max ? 'text-danger fw-semibold' : ''}`}>{used}</td><td className="text-end">{limitText(max)}</td></tr>;
                      })}
                    </tbody>
                  </table>
                  <h3 className="h6">Modules</h3>
                  <p className="small">{sub.modules.length ? sub.modules.map(titleCase).join(', ') : 'Core modules only'}</p>
                  <h3 className="h6">Owners</h3>
                  <ul className="small mb-3">{d.owners.map((o) => <li key={o.membershipId}>{o.user?.name} · {o.user?.email}{o.user?.lastLoginAt ? ` · last sign-in ${date(o.user.lastLoginAt)}` : ' · never signed in'}</li>)}</ul>
                  <div className="d-flex justify-content-end">
                    <button className={`btn ${d.school.status === 'active' ? 'btn-outline-danger' : 'btn-outline-success'}`} onClick={() => setConfirm(true)}>{d.school.status === 'active' ? 'Suspend school' : 'Reactivate school'}</button>
                  </div>
                </>
              )}

              {tab === 'plan' && (() => {
                const form = planForm || { planId: sub.planId || plans.data?.[0]?._id || '', billingCycle: rec?.billingCycle === 'yearly' ? 'yearly' : 'monthly', trial: false };
                const chosen = plans.data?.find((p) => p._id === form.planId);
                return (
                  <>
                    <FormError error={changePlan.error} />
                    <p className="small text-muted">Assigning a plan copies its modules and limits to this school and starts a new period from today. Editing a plan later does not change schools already on it.</p>
                    <div className="row">
                      <div className="col-md-7"><FormField label="Plan" name="cp"><select id="cp" className="form-select" value={form.planId} onChange={(e) => setPlanForm({ ...form, planId: e.target.value })}>{plans.data?.map((p) => <option key={p._id} value={p._id}>{p.name} · {money(p.priceMonthly, p.currency)}/mo</option>)}</select></FormField></div>
                      <div className="col-md-5"><FormField label="Billing" name="cb"><select id="cb" className="form-select" value={form.billingCycle} onChange={(e) => setPlanForm({ ...form, billingCycle: e.target.value })}><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></FormField></div>
                    </div>
                    {chosen && <p className="small">Includes: {chosen.modules.length ? chosen.modules.map(titleCase).join(', ') : 'core modules only'} · students {limitText(chosen.limits?.maxStudents)} · staff {limitText(chosen.limits?.maxUsers)} · campuses {limitText(chosen.limits?.maxCampuses)}</p>}
                    <div className="form-check mb-3"><input id="ct" type="checkbox" className="form-check-input" checked={form.trial} onChange={(e) => setPlanForm({ ...form, trial: e.target.checked })} /><label htmlFor="ct" className="form-check-label">Start as a trial ({chosen?.trialDays ?? 0} days)</label></div>
                    <button className="btn btn-primary" disabled={!form.planId || changePlan.pending} onClick={() => changePlan.mutate(form).then(() => { setPlanForm(null); done('Plan assigned'); }).catch(() => {})}>Assign plan</button>
                  </>
                );
              })()}

              {tab === 'subscription' && (() => {
                const form = subForm || { status: rec?.status || 'active', currentPeriodEnd: rec?.currentPeriodEnd ? String(rec.currentPeriodEnd).slice(0, 10) : '', graceDays: rec?.graceDays ?? 0, notes: rec?.notes || '' };
                return rec ? (
                  <>
                    <FormError error={updateSub.error} />
                    <p className="small text-muted">Use this to record a renewal (extend the period end), mark a payment overdue, or cancel. Access stops after the period end plus grace days.</p>
                    <div className="row">
                      <div className="col-md-4"><FormField label="Status" name="ss"><select id="ss" className="form-select" value={form.status} onChange={(e) => setSubForm({ ...form, status: e.target.value })}>{['trialing', 'active', 'past_due', 'cancelled', 'expired'].map((x) => <option key={x} value={x}>{SUB_LABEL[x] || titleCase(x)}</option>)}</select></FormField></div>
                      <div className="col-md-4"><FormField label="Period ends" name="pe"><input id="pe" type="date" className="form-control" value={form.currentPeriodEnd} onChange={(e) => setSubForm({ ...form, currentPeriodEnd: e.target.value })} /></FormField></div>
                      <div className="col-md-4"><FormField label="Grace days" name="gd"><input id="gd" type="number" min="0" max="60" className="form-control" value={form.graceDays} onChange={(e) => setSubForm({ ...form, graceDays: e.target.value })} /></FormField></div>
                    </div>
                    <FormField label="Notes" name="sn"><textarea id="sn" className="form-control" rows={2} maxLength={1000} value={form.notes} onChange={(e) => setSubForm({ ...form, notes: e.target.value })} placeholder="e.g. Paid by bank transfer, invoice #123" /></FormField>
                    <button className="btn btn-primary" disabled={updateSub.pending || !form.currentPeriodEnd} onClick={() => updateSub.mutate({ status: form.status, currentPeriodEnd: `${form.currentPeriodEnd}T23:59:59.000Z`, graceDays: Number(form.graceDays) || 0, ...(form.notes ? { notes: form.notes } : {}) }).then(() => { setSubForm(null); done('Subscription updated'); }).catch(() => {})}>Save subscription</button>
                  </>
                ) : <EmptyState icon="stars" title="No subscription" message="Assign a plan first." />;
              })()}
            </>
          );
        }}
      </QueryState>
      {confirm && d && (
        <ConfirmDialog title={`${d.school.status === 'active' ? 'Suspend' : 'Reactivate'} ${d.school.name}?`} tone={d.school.status === 'active' ? 'danger' : 'primary'} message={d.school.status === 'active' ? 'All members lose access immediately.' : 'Members regain access.'} confirmLabel="Confirm" pending={setStatus.pending} onCancel={() => setConfirm(false)}
          onConfirm={() => setStatus.mutate(d.school.status === 'active' ? 'suspended' : 'active').then(() => { setConfirm(false); done('School status updated'); }).catch((e) => toast.error(e.message))} />
      )}
    </Modal>
  );
}

/* ================================ PLANS ================================ */

export function PlatformPlans() {
  const toast = useToast();
  const q = useQuery(() => api.get('/platform/plans'), []);
  const modules = useQuery(() => api.get('/platform/modules'), []);
  const edit = useDialog();
  const del = useDialog();
  const [f, setF] = useState(null);
  const save = useMutation((b) => (b.id ? api.patch(`/platform/plans/${b.id}`, b.body) : api.post('/platform/plans', b.body)));
  const remove = useMutation((id) => api.del(`/platform/plans/${id}`));
  const fe = save.error?.fieldErrors?.() || {};

  const openForm = (p) => {
    save.reset();
    setF(p
      ? { id: p._id, name: p.name, code: p.code, description: p.description || '', currency: p.currency, priceMonthly: fromMinor(p.priceMonthly), priceYearly: fromMinor(p.priceYearly), trialDays: p.trialDays, modules: p.modules, maxStudents: num(p.limits?.maxStudents), maxUsers: num(p.limits?.maxUsers), maxCampuses: num(p.limits?.maxCampuses), isActive: p.isActive, sortOrder: p.sortOrder || 0 }
      : { name: '', code: '', description: '', currency: 'INR', priceMonthly: '', priceYearly: '', trialDays: 14, modules: [], maxStudents: '', maxUsers: '', maxCampuses: '1', isActive: true, sortOrder: (q.data?.length || 0) + 1 });
    edit.open(p || {});
  };
  const submit = () => {
    const body = {
      name: f.name,
      description: f.description || undefined,
      currency: f.currency,
      priceMonthly: toMinor(f.priceMonthly) || 0,
      priceYearly: toMinor(f.priceYearly) || 0,
      trialDays: Number(f.trialDays) || 0,
      modules: f.modules,
      limits: { maxStudents: toLimit(f.maxStudents), maxUsers: toLimit(f.maxUsers), maxCampuses: toLimit(f.maxCampuses) },
      isActive: f.isActive,
      sortOrder: Number(f.sortOrder) || 0,
    };
    if (!f.id) body.code = f.code;
    save.mutate({ id: f.id, body }).then(() => { edit.close(); q.reload(); toast.success(f.id ? 'Plan updated' : 'Plan created'); }).catch(() => {});
  };
  const toggleActive = (p) => api.patch(`/platform/plans/${p._id}`, { isActive: !p.isActive }).then(() => { q.reload(); toast.success(p.isActive ? 'Plan deactivated: it can no longer be chosen for new schools' : 'Plan activated'); }).catch((e) => toast.error(e.message));

  return (
    <PlatformOnly>
      <PageHeader title="Plans" description="Subscription plans offered to schools" actions={<button className="btn btn-primary" onClick={() => openForm(null)}><i className="bi bi-plus-lg me-1" />New plan</button>} />
      <div className="alert alert-info small">Changing a plan affects schools that are assigned it from now on. Schools already on the plan keep the modules and limits they were given; change them from the school’s Manage dialog.</div>
      <div className="card table-card">
        <QueryState query={q} isEmpty={(x) => !x.length} empty={<EmptyState icon="stars" title="No plans" action={<button className="btn btn-primary" onClick={() => openForm(null)}>Create a plan</button>} />}>
          {(x) => <DataTable rows={x} onRowClick={openForm} columns={[
            { key: 'name', label: 'Plan', render: (p) => <><div className="fw-semibold">{p.name}</div><div className="small text-muted">{p.code}{p.description ? ` · ${p.description}` : ''}</div></> },
            { key: 'price', label: 'Monthly / yearly', render: (p) => `${money(p.priceMonthly, p.currency)} / ${money(p.priceYearly, p.currency)}` },
            { key: 'trial', label: 'Trial', render: (p) => (p.trialDays ? `${p.trialDays} days` : 'None') },
            { key: 'limits', label: 'Limits', render: (p) => <span className="small">{limitText(p.limits?.maxStudents)} students · {limitText(p.limits?.maxUsers)} staff · {limitText(p.limits?.maxCampuses)} campuses</span> },
            { key: 'modules', label: 'Modules', render: (p) => <span className="small">{p.modules.length} of {modules.data?.plan.length ?? '…'}</span> },
            { key: 'status', label: 'Status', render: (p) => <StatusBadge status={p.isActive ? 'active' : 'disabled'} label={p.isActive ? 'Active' : 'Inactive'} /> },
            { key: 'x', label: '', className: 'text-end text-nowrap', render: (p) => <>
              <button className="btn btn-sm btn-outline-secondary me-1" onClick={(e) => { e.stopPropagation(); toggleActive(p); }}>{p.isActive ? 'Deactivate' : 'Activate'}</button>
              <button className="btn btn-sm btn-outline-danger" aria-label={`Delete ${p.name}`} onClick={(e) => { e.stopPropagation(); remove.reset(); del.open(p); }}><i className="bi bi-trash" /></button>
            </> },
          ]} />}
        </QueryState>
      </div>

      {edit.isOpen && f && (
        <Modal title={f.id ? `Edit plan: ${f.name}` : 'New plan'} size="modal-lg" onClose={edit.close} footer={<><button className="btn btn-outline-secondary" onClick={edit.close}>Cancel</button><button className="btn btn-primary" disabled={save.pending || !f.name || !f.code} onClick={submit}>{save.pending && <span className="spinner-border spinner-border-sm me-2" />}{f.id ? 'Save changes' : 'Create plan'}</button></>}>
          <FormError error={save.error} />
          <div className="row">
            <div className="col-md-6"><FormField label="Name" name="pn" required error={fe.name}><input id="pn" className="form-control" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></FormField></div>
            <div className="col-md-6"><FormField label="Code" name="pc" required error={fe.code} hint={f.id ? 'The code cannot be changed' : 'Lowercase letters, digits and hyphens, e.g. premium'}><input id="pc" className="form-control" value={f.code} disabled={Boolean(f.id)} onChange={(e) => setF({ ...f, code: e.target.value.toLowerCase() })} /></FormField></div>
          </div>
          <FormField label="Description" name="pd" error={fe.description}><input id="pd" className="form-control" maxLength={500} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></FormField>
          <div className="row">
            <div className="col-md-3"><FormField label="Currency" name="cur"><input id="cur" className="form-control text-uppercase" maxLength={3} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} /></FormField></div>
            <div className="col-md-3"><FormField label="Price / month" name="pm" error={fe.priceMonthly}><input id="pm" className="form-control" inputMode="decimal" value={f.priceMonthly} onChange={(e) => setF({ ...f, priceMonthly: e.target.value })} placeholder="0.00" /></FormField></div>
            <div className="col-md-3"><FormField label="Price / year" name="py" error={fe.priceYearly}><input id="py" className="form-control" inputMode="decimal" value={f.priceYearly} onChange={(e) => setF({ ...f, priceYearly: e.target.value })} placeholder="0.00" /></FormField></div>
            <div className="col-md-3"><FormField label="Trial days" name="td" error={fe.trialDays}><input id="td" type="number" min="0" max="365" className="form-control" value={f.trialDays} onChange={(e) => setF({ ...f, trialDays: e.target.value })} /></FormField></div>
          </div>
          <div className="row">
            <div className="col-md-4"><FormField label="Max students" name="ms" hint="Empty = unlimited"><input id="ms" type="number" min="0" className="form-control" value={f.maxStudents} onChange={(e) => setF({ ...f, maxStudents: e.target.value })} /></FormField></div>
            <div className="col-md-4"><FormField label="Max staff seats" name="mu" hint="Empty = unlimited"><input id="mu" type="number" min="1" className="form-control" value={f.maxUsers} onChange={(e) => setF({ ...f, maxUsers: e.target.value })} /></FormField></div>
            <div className="col-md-4"><FormField label="Max campuses" name="mc" hint="Empty = unlimited"><input id="mc" type="number" min="1" className="form-control" value={f.maxCampuses} onChange={(e) => setF({ ...f, maxCampuses: e.target.value })} /></FormField></div>
          </div>
          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center"><span className="form-label mb-0">Modules</span><span className="small"><button type="button" className="btn btn-link btn-sm p-0 me-2" onClick={() => setF({ ...f, modules: modules.data?.plan.map((m) => m.key) || [] })}>Select all</button><button type="button" className="btn btn-link btn-sm p-0" onClick={() => setF({ ...f, modules: [] })}>Clear</button></span></div>
            <div className="small text-muted mb-2">Core features (school profile, users, academics, students, parents, staff) are always included.</div>
            <div className="row">
              {modules.data?.plan.map((m) => (
                <div key={m.key} className="col-md-6"><div className="form-check"><input id={`m-${m.key}`} type="checkbox" className="form-check-input" checked={f.modules.includes(m.key)} onChange={(e) => setF({ ...f, modules: e.target.checked ? [...f.modules, m.key] : f.modules.filter((x) => x !== m.key) })} /><label htmlFor={`m-${m.key}`} className="form-check-label">{m.label}</label></div></div>
              ))}
            </div>
          </div>
          <div className="row align-items-center">
            <div className="col-md-4"><FormField label="Display order" name="so" className="mb-0"><input id="so" type="number" className="form-control" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: e.target.value })} /></FormField></div>
            <div className="col-md-8"><div className="form-check mt-3"><input id="pa" type="checkbox" className="form-check-input" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /><label htmlFor="pa" className="form-check-label">Active (can be chosen for new schools)</label></div></div>
          </div>
        </Modal>
      )}

      {del.isOpen && (
        <ConfirmDialog title={`Delete ${del.item.name}?`} tone="danger" confirmLabel="Delete" pending={remove.pending} onCancel={del.close}
          message="Plans used by any school cannot be deleted; deactivate them instead."
          onConfirm={() => remove.mutate(del.item._id).then(() => { del.close(); q.reload(); toast.success('Plan deleted'); }).catch((e) => { del.close(); toast.error(e.message); })} />
      )}
    </PlatformOnly>
  );
}
