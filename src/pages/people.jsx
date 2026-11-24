import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api/client.js';
import { useDebounced, useMutation, useQuery } from '../hooks/useApi.js';
import { useToast } from '../components/Toast.jsx';
import { PageHeader, StatCard, StatusBadge, QueryState, EmptyState, ErrorState, DataTable, Pagination, SearchInput, FilterBar, FormField, FormError, Modal, ConfirmDialog, useDialog } from '../components/ui.jsx';
import { ClassSectionSelect, SessionSelect, useStructure } from '../components/pickers.jsx';
import { money, date, pct, titleCase, todayYmd, ROLE_LABELS } from '../utils/format.js';

const RELATIONS = ['father', 'mother', 'guardian', 'grandparent', 'sibling', 'other'];

/* ------------------------------ students ------------------------------ */

export function Students() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ classId: '', sectionId: '', status: 'active', page: 1 });
  const [search, setSearch] = useState('');
  const s = useDebounced(search);
  const q = useQuery(() => api.list('/students', { ...f, search: s, limit: 25 }), [JSON.stringify(f), s]);
  const summary = useQuery(() => api.get('/students/summary'), []);
  return (
    <>
      <PageHeader title="Students" description={summary.data?.session ? `${summary.data.active} active students · ${summary.data.session.name}` : 'All students'} actions={auth.can('students.create') && <Link to="/students/new" className="btn btn-primary"><i className="bi bi-plus-lg me-1" />Add student</Link>} />
      <div className="card table-card">
        <FilterBar hasFilters={f.classId || s || f.status !== 'active'} onReset={() => { setSearch(''); setF({ classId: '', sectionId: '', status: 'active', page: 1 }); }}>
          <SearchInput value={search} onChange={(v) => { setSearch(v); setF({ ...f, page: 1 }); }} placeholder="Name, admission no. or parent phone" />
          <ClassSectionSelect classId={f.classId} sectionId={f.sectionId} onChange={(v) => setF({ ...f, ...v, page: 1 })} />
          <select className="form-select" style={{ maxWidth: 150 }} aria-label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value, page: 1 })}>
            <option value="">Any status</option>
            {['active', 'inactive', 'alumni', 'transferred', 'withdrawn'].map((x) => <option key={x} value={x}>{titleCase(x)}</option>)}
          </select>
        </FilterBar>
        {q.error ? <ErrorState error={q.error} onRetry={q.reload} /> : (
          <DataTable loading={q.loading} rows={q.data?.items} onRowClick={(r) => navigate(`/students/${r._id}`)} empty={<EmptyState icon="mortarboard" title="No students found" />} columns={[
            { key: 'name', label: 'Student', render: (r) => <><div className="fw-semibold">{r.fullName}</div><div className="small text-muted">{titleCase(r.gender)}{r.dateOfBirth ? ` · ${date(r.dateOfBirth)}` : ''}</div></> },
            { key: 'admissionNo', label: 'Admission no.' },
            { key: 'cls', label: 'Class / section', render: (r) => r.enrollment ? <>{r.enrollment.displayName}{r.enrollment.rollNo && <span className="text-muted"> · #{r.enrollment.rollNo}</span>}</> : <span className="text-muted">Not enrolled</span> },
            { key: 'g', label: 'Parent / guardian', render: (r) => r.primaryGuardian ? <>{r.primaryGuardian.name}<div className="small text-muted">{r.primaryGuardian.phone}</div></> : '—' },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          ]} />
        )}
        <Pagination meta={q.data?.meta} onPage={(p) => setF({ ...f, page: p })} />
      </div>
    </>
  );
}

export function StudentForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const [sessionId, setSessionId] = useState('');
  const [f, setF] = useState({ firstName: '', lastName: '', gender: '', dateOfBirth: '', admissionNo: '', admissionDate: todayYmd(), classId: '', sectionId: '', phone: '', email: '', guardianName: '', guardianPhone: '', guardianEmail: '', relation: 'father', allowDuplicate: false });
  const [duplicate, setDuplicate] = useState(null);
  const m = useMutation((b) => api.post('/students', b));
  const fe = m.error?.fieldErrors?.() || {};
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = (e, existingGuardianId) => {
    e?.preventDefault();
    const guardian = existingGuardianId
      ? { guardianId: existingGuardianId, relation: f.relation, isPrimary: true }
      : f.guardianName && f.guardianPhone ? { guardian: { name: f.guardianName, phone: f.guardianPhone, email: f.guardianEmail || undefined, allowDuplicate: f.allowDuplicate || undefined }, relation: f.relation, isPrimary: true } : null;
    const body = {
      firstName: f.firstName,
      lastName: f.lastName || undefined,
      gender: f.gender,
      dateOfBirth: f.dateOfBirth || undefined,
      admissionNo: f.admissionNo || undefined,
      admissionDate: f.admissionDate || undefined,
      phone: f.phone || undefined,
      email: f.email || undefined,
      ...(f.sectionId ? { enrollment: { sectionId: f.sectionId } } : {}),
      ...(guardian ? { guardians: [guardian] } : {}),
    };
    m.mutate(body).then((s) => { toast.success(`${s.fullName} added (${s.admissionNo})`); navigate(`/students/${s._id}`); }).catch((err) => { if (err.code === 'DUPLICATE_GUARDIAN') setDuplicate(err.details); });
  };
  return (
    <>
      <PageHeader title="Add student" breadcrumbs={[{ label: 'Students', to: '/students' }, { label: 'New' }]} />
      <form onSubmit={submit} noValidate>
        <FormError error={m.error?.code === 'DUPLICATE_GUARDIAN' ? null : m.error} />
        <div className="card mb-3">
          <div className="card-header">Student details</div>
          <div className="card-body row g-3">
            <div className="col-md-4"><FormField label="First name" name="fn" required error={fe.firstName} className="mb-0"><input id="fn" className={`form-control ${fe.firstName ? 'is-invalid' : ''}`} value={f.firstName} onChange={set('firstName')} /></FormField></div>
            <div className="col-md-4"><FormField label="Last name" name="ln" className="mb-0"><input id="ln" className="form-control" value={f.lastName} onChange={set('lastName')} /></FormField></div>
            <div className="col-md-4"><FormField label="Gender" name="g" required error={fe.gender} className="mb-0"><select id="g" className="form-select" value={f.gender} onChange={set('gender')}><option value="">Choose…</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></FormField></div>
            <div className="col-md-4"><FormField label="Date of birth" name="dob" className="mb-0"><input id="dob" type="date" className="form-control" value={f.dateOfBirth} onChange={set('dateOfBirth')} /></FormField></div>
            <div className="col-md-4"><FormField label="Admission number" name="adm" hint="Leave empty to generate one" error={fe.admissionNo} className="mb-0"><input id="adm" className="form-control" value={f.admissionNo} onChange={set('admissionNo')} /></FormField></div>
            <div className="col-md-4"><FormField label="Admission date" name="admd" className="mb-0"><input id="admd" type="date" className="form-control" value={f.admissionDate} onChange={set('admissionDate')} /></FormField></div>
          </div>
        </div>
        <div className="card mb-3">
          <div className="card-header">Class</div>
          <div className="card-body d-flex flex-wrap gap-2 align-items-end">
            <FormField label="Session" name="ses" className="mb-0"><SessionSelect id="ses" value={sessionId} onChange={setSessionId} /></FormField>
            <ClassSectionSelect sessionId={sessionId} classId={f.classId} sectionId={f.sectionId} allowAll={false} sectionRequired onChange={(v) => setF({ ...f, ...v })} />
          </div>
        </div>
        <div className="card mb-3">
          <div className="card-header">Parent / guardian</div>
          <div className="card-body row g-3">
            <div className="col-md-4"><FormField label="Name" name="gn" className="mb-0"><input id="gn" className="form-control" value={f.guardianName} onChange={set('guardianName')} /></FormField></div>
            <div className="col-md-3"><FormField label="Phone" name="gp" error={fe['guardians.0.guardian.phone']} className="mb-0"><input id="gp" className="form-control" inputMode="tel" value={f.guardianPhone} onChange={set('guardianPhone')} /></FormField></div>
            <div className="col-md-3"><FormField label="Email" name="ge" className="mb-0"><input id="ge" type="email" className="form-control" value={f.guardianEmail} onChange={set('guardianEmail')} /></FormField></div>
            <div className="col-md-2"><FormField label="Relation" name="gr" className="mb-0"><select id="gr" className="form-select" value={f.relation} onChange={set('relation')}>{RELATIONS.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}</select></FormField></div>
          </div>
        </div>
        <div className="d-flex gap-2"><button className="btn btn-primary" disabled={m.pending || !f.firstName || !f.gender || !f.sectionId}>{m.pending && <span className="spinner-border spinner-border-sm me-2" />}Save student</button><Link to="/students" className="btn btn-outline-secondary">Cancel</Link></div>
        {!f.sectionId && <div className="form-text">Choose a class and section to enrol the student.</div>}
      </form>
      {duplicate && (
        <Modal title="Parent already registered" onClose={() => setDuplicate(null)} footer={<button className="btn btn-outline-secondary" onClick={() => { setDuplicate(null); setF({ ...f, allowDuplicate: true }); }}>It’s a different person</button>}>
          <p>A parent with phone {f.guardianPhone} already exists. If this is a sibling, link the existing parent:</p>
          {duplicate.matches.map((g) => <button key={g.id} className="btn btn-outline-primary w-100 mb-2 text-start" onClick={() => { setDuplicate(null); submit(null, g.id); }}><strong>{g.name}</strong> · {g.phone}{g.email ? ` · ${g.email}` : ''}</button>)}
        </Modal>
      )}
    </>
  );
}

export function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const toast = useToast();
  const q = useQuery(() => api.get(`/students/${id}`), [id]);
  const fees = useQuery(() => api.get(`/fees/students/${id}`), [id], { enabled: auth.can('fees.read') });
  const att = useQuery(() => api.get(`/attendance/students/${id}`), [id], { enabled: auth.can('attendance.read') });
  const results = useQuery(() => api.get(`/exams/students/${id}/results`), [id], { enabled: auth.can('exams.read') });
  const [tab, setTab] = useState('overview');
  const status = useDialog();
  const [newStatus, setNewStatus] = useState('withdrawn');
  const upd = useMutation((b) => api.patch(`/students/${id}`, b));
  const portal = useMutation((b) => api.post(`/students/${id}/portal-access`, b));
  return (
    <QueryState query={q}>
      {(s) => (
        <>
          <PageHeader
            title={s.fullName}
            description={`${s.admissionNo} · ${s.currentEnrollment?.displayName || 'Not enrolled'} · admitted ${date(s.admissionDate)}`}
            breadcrumbs={[{ label: 'Students', to: '/students' }, { label: s.fullName }]}
            actions={
              <>
                <StatusBadge status={s.status} />
                {auth.can('fees.collect') && <Link className="btn btn-primary" to={`/fees/collect?studentId=${s._id}`}>Collect fee</Link>}
                {auth.can('students.update') && <button className="btn btn-outline-secondary" onClick={() => status.open()}>Change status</button>}
              </>
            }
          />
          <ul className="nav nav-tabs mb-3">
            {[['overview', 'Overview'], ['guardians', 'Parents / guardians'], ['enrollment', 'Enrollment'], auth.can('fees.read') && ['fees', 'Fees'], auth.can('attendance.read') && ['attendance', 'Attendance'], auth.can('exams.read') && ['results', 'Results']].filter(Boolean).map(([k, l]) => <li key={k} className="nav-item"><button className={`nav-link ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button></li>)}
          </ul>
          {tab === 'overview' && (
            <div className="row g-3">
              <div className="col-md-4"><StatCard label="Attendance (session)" value={pct(att.data?.summary?.percentage)} icon="calendar-check" tone="success" loading={att.loading} /></div>
              <div className="col-md-4"><StatCard label="Fee balance" value={money(fees.data?.summary?.balance, auth.currency)} hint={fees.data?.summary?.overdue ? `${money(fees.data.summary.overdue, auth.currency)} overdue` : null} icon="cash-stack" tone={fees.data?.summary?.overdue ? 'danger' : 'primary'} loading={fees.loading} /></div>
              <div className="col-md-4"><StatCard label="Latest result" value={results.data?.results?.at(-1)?.grade || '—'} hint={results.data?.results?.at(-1)?.exam?.name} icon="journal-check" tone="info" loading={results.loading} /></div>
              <div className="col-12">
                <div className="card"><div className="card-body row g-3">
                  {[['Gender', titleCase(s.gender)], ['Date of birth', date(s.dateOfBirth)], ['Blood group', s.bloodGroup || '—'], ['Campus', s.campus?.name], ['Phone', s.phone || '—'], ['Email', s.email || '—'], ['Previous school', s.previousSchool || '—'], ['Student login', s.portal.enabled ? `Enabled (${s.portal.email})` : 'Not enabled']].map(([k, v]) => <div className="col-sm-6 col-lg-3" key={k}><div className="small text-muted">{k}</div><div>{v}</div></div>)}
                  {auth.can('students.update', 'users.create') && !s.portal.enabled && s.status === 'active' && (
                    <div className="col-12"><button className="btn btn-sm btn-outline-primary" disabled={portal.pending || !s.email} title={s.email ? '' : 'Add an email address first'} onClick={() => portal.mutate({}).then((r) => { q.setData(r.student); toast.added(r.isNewUser ? 'Student login created' : 'Student login enabled', r); }).catch((e) => toast.error(e.message))}>Give student portal access</button></div>
                  )}
                </div></div>
              </div>
            </div>
          )}
          {tab === 'guardians' && <GuardiansTab student={s} onChange={() => q.reload()} />}
          {tab === 'enrollment' && (
            <div className="card table-card"><DataTable rows={s.enrollments} empty={<EmptyState icon="diagram-3" title="Not enrolled in any session" />} columns={[
              { key: 'session', label: 'Session', render: (r) => r.session?.name },
              { key: 'displayName', label: 'Class / section' },
              { key: 'rollNo', label: 'Roll no.', render: (r) => r.rollNo ?? '—' },
              { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
              { key: 'enrolledOn', label: 'Enrolled', render: (r) => date(r.enrolledOn) },
            ]} /></div>
          )}
          {tab === 'fees' && (
            <QueryState query={fees}>{(a) => (
              <div className="card table-card">
                <div className="card-header">Invoices · balance {money(a.summary.balance, auth.currency)}</div>
                <DataTable rows={a.invoices} onRowClick={(r) => navigate(`/fees/invoices/${r._id}`)} empty={<EmptyState icon="receipt" title="No invoices" />} columns={[
                  { key: 'invoiceNo', label: 'Invoice' }, { key: 'title', label: 'Fee' }, { key: 'dueDate', label: 'Due', render: (r) => date(r.dueDate) },
                  { key: 'total', label: 'Total', className: 'num', render: (r) => money(r.total, auth.currency) }, { key: 'balance', label: 'Balance', className: 'num', render: (r) => money(r.balance, auth.currency) },
                  { key: 'st', label: 'Status', render: (r) => <StatusBadge status={r.displayStatus} /> },
                ]} />
              </div>
            )}</QueryState>
          )}
          {tab === 'attendance' && (
            <QueryState query={att}>{(a) => (
              <div className="card table-card">
                <div className="card-header">Present {a.summary.present} · Absent {a.summary.absent} · Late {a.summary.late} · Leave {a.summary.leave} · {pct(a.summary.percentage)}</div>
                <DataTable keyField="date" rows={a.records.slice(0, 60)} empty={<EmptyState icon="calendar" title="No attendance recorded" />} columns={[{ key: 'date', label: 'Date', render: (r) => date(r.date) }, { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { key: 'remark', label: 'Remark', render: (r) => r.remark || '—' }]} />
              </div>
            )}</QueryState>
          )}
          {tab === 'results' && (
            <QueryState query={results}>{(r) => (
              <div className="card table-card"><DataTable keyField="examId" rows={r.results} empty={<EmptyState icon="journal" title="No published results" />} columns={[
                { key: 'exam', label: 'Exam', render: (x) => <Link to={`/exams/${x.examId}?reportCard=${id}`}>{x.exam?.name}</Link> },
                { key: 'marks', label: 'Marks', render: (x) => `${x.total} / ${x.maxTotal}` }, { key: 'percentage', label: '%', render: (x) => pct(x.percentage) },
                { key: 'grade', label: 'Grade' }, { key: 'rank', label: 'Rank', render: (x) => x.rankInSection ?? '—' }, { key: 'result', label: 'Result', render: (x) => <StatusBadge status={x.result} /> },
              ]} /></div>
            )}</QueryState>
          )}
          {status.isOpen && (
            <ConfirmDialog title="Change student status" tone={['withdrawn', 'transferred'].includes(newStatus) ? 'danger' : 'primary'} confirmLabel="Save" pending={upd.pending} onCancel={status.close} onConfirm={() => upd.mutate({ status: newStatus }).then((r) => { q.setData(r); status.close(); toast.success('Status updated'); }).catch((e) => toast.error(e.message))}>
              <select className="form-select" aria-label="New status" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>{['active', 'inactive', 'alumni', 'transferred', 'withdrawn'].map((x) => <option key={x} value={x}>{titleCase(x)}</option>)}</select>
              <p className="small text-muted mt-2 mb-0">Leaving statuses end the student’s current enrollment and free the seat. Reactivating counts against the plan’s student limit.</p>
            </ConfirmDialog>
          )}
        </>
      )}
    </QueryState>
  );
}

function GuardiansTab({ student, onChange }) {
  const auth = useAuth();
  const toast = useToast();
  const d = useDialog();
  const [f, setF] = useState({ name: '', phone: '', email: '', relation: 'mother' });
  const add = useMutation((b) => api.post(`/students/${student._id}/guardians`, b));
  const unlink = useMutation((gid) => api.del(`/students/${student._id}/guardians/${gid}`));
  const primary = useMutation((gid) => api.patch(`/students/${student._id}/guardians/${gid}`, { isPrimary: true }));
  const canEdit = auth.can('students.update', 'parents.update');
  return (
    <div className="card table-card">
      <div className="card-header d-flex justify-content-between">Parents and guardians{canEdit && <button className="btn btn-sm btn-primary" onClick={() => { add.reset(); d.open(); }}>Add parent</button>}</div>
      <DataTable keyField="guardianId" rows={student.guardians} empty={<EmptyState icon="people" title="No parent linked" />} columns={[
        { key: 'name', label: 'Name', render: (g) => <>{g.name} {g.isPrimary && <span className="badge text-bg-primary ms-1">Primary</span>}</> },
        { key: 'relation', label: 'Relation', render: (g) => titleCase(g.relation) },
        { key: 'phone', label: 'Phone', render: (g) => <a href={`tel:${g.phone}`}>{g.phone}</a> },
        { key: 'email', label: 'Email', render: (g) => g.email || '—' },
        { key: 'alerts', label: 'Alerts', render: (g) => (g.receivesAlerts ? 'Yes' : 'No') },
        { key: 'portal', label: 'App login', render: (g) => (g.hasPortalAccess ? <StatusBadge status="active" label="Yes" /> : 'No') },
        canEdit && { key: 'act', label: '', className: 'text-end text-nowrap', render: (g) => <>
          {!g.isPrimary && <button className="btn btn-sm btn-link" onClick={() => primary.mutate(g.guardianId).then(onChange).catch((e) => toast.error(e.message))}>Make primary</button>}
          <button className="btn btn-sm btn-link text-danger" onClick={() => unlink.mutate(g.guardianId).then(onChange).catch((e) => toast.error(e.message))}>Unlink</button>
        </> },
      ].filter(Boolean)} />
      {d.isOpen && (
        <Modal title="Add parent" onClose={d.close} footer={<><button className="btn btn-outline-secondary" onClick={d.close}>Cancel</button><button className="btn btn-primary" disabled={add.pending || !f.name || !f.phone} onClick={() => add.mutate({ guardian: { name: f.name, phone: f.phone, email: f.email || undefined, allowDuplicate: f.allowDuplicate }, relation: f.relation }).then(() => { d.close(); onChange(); toast.success('Parent linked'); }).catch(() => {})}>Save</button></>}>
          {add.error?.code === 'DUPLICATE_GUARDIAN' ? (
            <div className="alert alert-warning">
              A parent with this phone exists:
              {add.error.details.matches.map((m) => <button key={m.id} className="btn btn-sm btn-outline-primary d-block mt-2" onClick={() => add.mutate({ guardianId: m.id, relation: f.relation }).then(() => { d.close(); onChange(); toast.success('Existing parent linked'); }).catch(() => {})}>Link {m.name} ({m.phone})</button>)}
              <button className="btn btn-sm btn-link px-0 mt-2" onClick={() => { setF({ ...f, allowDuplicate: true }); add.reset(); }}>It’s a different person</button>
            </div>
          ) : <FormError error={add.error} />}
          <FormField label="Name" name="pn" required><input id="pn" className="form-control" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></FormField>
          <div className="row"><div className="col-6"><FormField label="Phone" name="pp" required><input id="pp" className="form-control" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></FormField></div><div className="col-6"><FormField label="Relation" name="pr"><select id="pr" className="form-select" value={f.relation} onChange={(e) => setF({ ...f, relation: e.target.value })}>{RELATIONS.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}</select></FormField></div></div>
          <FormField label="Email" name="pe" className="mb-0"><input id="pe" type="email" className="form-control" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></FormField>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------ parents ------------------------------ */

export function Parents() {
  const auth = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const s = useDebounced(search);
  const q = useQuery(() => api.list('/parents', { search: s, page, limit: 25 }), [s, page]);
  const portal = useMutation((id) => api.post(`/parents/${id}/portal-access`, {}));
  return (
    <>
      <PageHeader title="Parents" description="A parent can be linked to several children" />
      <div className="card table-card">
        <FilterBar><SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Name, phone or email" /></FilterBar>
        {q.error ? <ErrorState error={q.error} onRetry={q.reload} /> : (
          <DataTable loading={q.loading} rows={q.data?.items} empty={<EmptyState icon="people" title="No parents found" />} columns={[
            { key: 'name', label: 'Parent', render: (r) => <><div className="fw-semibold">{r.name}</div><div className="small text-muted">{r.occupation || ''}</div></> },
            { key: 'phone', label: 'Contact', render: (r) => <><a href={`tel:${r.phone}`}>{r.phone}</a><div className="small text-muted">{r.email || ''}</div></> },
            { key: 'children', label: 'Children', render: (r) => r.children.length ? r.children.map((c) => <div key={c.studentId}><Link to={`/students/${c.studentId}`}>{c.name}</Link> <span className="small text-muted">{c.classSection?.displayName} · {titleCase(c.relation)}</span></div>) : <span className="text-muted">None linked</span> },
            { key: 'portal', label: 'App login', render: (r) => r.portal.enabled ? <StatusBadge status="active" label="Enabled" /> : auth.can('parents.update', 'users.create') && r.email ? <button className="btn btn-sm btn-outline-primary" disabled={portal.pending} onClick={() => portal.mutate(r._id).then((x) => { q.reload(); toast.added(x.isNewUser ? 'Parent login created' : 'Parent login enabled', x); }).catch((e) => toast.error(e.message))}>Enable</button> : <span className="small text-muted">{r.email ? 'Not enabled' : 'Needs email'}</span> },
          ]} />
        )}
        <Pagination meta={q.data?.meta} onPage={setPage} />
      </div>
    </>
  );
}

/* ------------------------------ admissions ------------------------------ */

const NEXT = { enquiry: ['applied', 'rejected', 'withdrawn'], applied: ['under_review', 'approved', 'rejected', 'withdrawn'], under_review: ['approved', 'rejected', 'withdrawn'], approved: ['under_review', 'rejected', 'withdrawn'], rejected: ['applied'], withdrawn: ['applied'], enrolled: [] };

export function Admissions() {
  const auth = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ status: '', page: 1 });
  const [search, setSearch] = useState('');
  const s = useDebounced(search);
  const q = useQuery(() => api.list('/admissions', { ...f, search: s, limit: 25 }), [JSON.stringify(f), s]);
  const summary = useQuery(() => api.get('/admissions/summary'), []);
  const create = useDialog();
  const act = useDialog();
  const [form, setForm] = useState({});
  const [sessionId, setSessionId] = useState('');
  const structure = useStructure(sessionId);
  const add = useMutation((b) => api.post('/admissions', b));
  const status = useMutation(({ id, body }) => api.post(`/admissions/${id}/status`, body));
  const enroll = useMutation(({ id, body }) => api.post(`/admissions/${id}/enroll`, body));
  const [enrollSection, setEnrollSection] = useState('');
  const campuses = useQuery(() => api.list('/campuses', { limit: 50 }), [], { enabled: create.isOpen });
  return (
    <>
      <PageHeader title="Admissions" description="Enquiries and applications through to enrolment" actions={auth.can('admissions.create') && <button className="btn btn-primary" onClick={() => { add.reset(); setForm({ firstName: '', gender: '', classId: '', campusId: '', guardianName: '', phone: '', relation: 'father', source: 'walk_in', status: 'enquiry' }); create.open(); }}><i className="bi bi-plus-lg me-1" />New enquiry</button>} />
      {summary.data && <div className="d-flex flex-wrap gap-2 mb-3">{Object.entries(summary.data.byStatus).map(([k, v]) => <button key={k} className={`btn btn-sm ${f.status === k ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setF({ status: f.status === k ? '' : k, page: 1 })}>{titleCase(k)} <span className="badge text-bg-light ms-1">{v}</span></button>)}</div>}
      <div className="card table-card">
        <FilterBar><SearchInput value={search} onChange={setSearch} placeholder="Applicant, application no. or parent phone" /></FilterBar>
        {q.error ? <ErrorState error={q.error} onRetry={q.reload} /> : (
          <DataTable loading={q.loading} rows={q.data?.items} empty={<EmptyState icon="person-plus" title="No applications" />} columns={[
            { key: 'applicationNo', label: 'Application' },
            { key: 'applicant', label: 'Applicant', render: (r) => <><div className="fw-semibold">{r.applicantName}</div><div className="small text-muted">{r.class?.name} · {r.session?.name}</div></> },
            { key: 'guardian', label: 'Parent', render: (r) => <>{r.guardian.name}<div className="small text-muted">{r.guardian.phone}</div></> },
            { key: 'source', label: 'Source', render: (r) => titleCase(r.source) },
            { key: 'follow', label: 'Follow-up', render: (r) => date(r.followUpDate) },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'act', label: '', className: 'text-end', render: (r) => auth.can('admissions.update') && r.status !== 'enrolled' && <button className="btn btn-sm btn-outline-primary" onClick={() => { status.reset(); enroll.reset(); setEnrollSection(''); act.open(r); }}>Update</button> },
          ]} />
        )}
        <Pagination meta={q.data?.meta} onPage={(p) => setF({ ...f, page: p })} />
      </div>
      {create.isOpen && (
        <Modal title="New enquiry" size="modal-lg" onClose={create.close} footer={<><button className="btn btn-outline-secondary" onClick={create.close}>Cancel</button><button className="btn btn-primary" disabled={add.pending || !form.firstName || !form.gender || !form.classId || !form.campusId || !form.guardianName || !form.phone} onClick={() => add.mutate({ sessionId, classId: form.classId, campusId: form.campusId, applicant: { firstName: form.firstName, lastName: form.lastName || undefined, gender: form.gender }, guardian: { name: form.guardianName, phone: form.phone, relation: form.relation }, source: form.source, status: form.status }).then((r) => { create.close(); q.reload(); summary.reload(); toast.success(`Application ${r.applicationNo} created`); }).catch(() => {})}>Save</button></>}>
          <FormError error={add.error} />
          <div className="row g-2">
            <div className="col-md-6"><FormField label="Applicant first name" name="af" required><input id="af" className="form-control" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></FormField></div>
            <div className="col-md-3"><FormField label="Last name" name="al"><input id="al" className="form-control" value={form.lastName || ''} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></FormField></div>
            <div className="col-md-3"><FormField label="Gender" name="ag" required><select id="ag" className="form-select" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}><option value="">Choose…</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></FormField></div>
            <div className="col-md-4"><FormField label="Session" name="as"><SessionSelect id="as" value={sessionId} onChange={setSessionId} /></FormField></div>
            <div className="col-md-4"><FormField label="Class applied for" name="ac" required><select id="ac" className="form-select" value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}><option value="">Choose…</option>{structure.data?.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></FormField></div>
            <div className="col-md-4"><FormField label="Campus" name="acp" required><select id="acp" className="form-select" value={form.campusId} onChange={(e) => setForm({ ...form, campusId: e.target.value })}><option value="">Choose…</option>{campuses.data?.items.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></FormField></div>
            <div className="col-md-5"><FormField label="Parent name" name="gn" required><input id="gn" className="form-control" value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} /></FormField></div>
            <div className="col-md-4"><FormField label="Phone" name="gp" required><input id="gp" className="form-control" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></FormField></div>
            <div className="col-md-3"><FormField label="Relation" name="gr"><select id="gr" className="form-select" value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })}>{RELATIONS.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}</select></FormField></div>
            <div className="col-md-6"><FormField label="Source" name="src" className="mb-0"><select id="src" className="form-select" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>{['walk_in', 'phone', 'website', 'referral', 'advertisement', 'other'].map((x) => <option key={x} value={x}>{titleCase(x)}</option>)}</select></FormField></div>
            <div className="col-md-6"><FormField label="Stage" name="stg" className="mb-0"><select id="stg" className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="enquiry">Enquiry</option><option value="applied">Applied</option></select></FormField></div>
          </div>
        </Modal>
      )}
      {act.isOpen && (
        <Modal title={`${act.item.applicationNo} · ${act.item.applicantName}`} onClose={act.close}>
          <p>Current status: <StatusBadge status={act.item.status} /></p>
          <FormError error={status.error || enroll.error} />
          <div className="d-flex flex-wrap gap-2 mb-3">
            {NEXT[act.item.status].map((s2) => <button key={s2} className="btn btn-sm btn-outline-secondary" disabled={status.pending} onClick={() => status.mutate({ id: act.item._id, body: { status: s2 } }).then(() => { act.close(); q.reload(); summary.reload(); toast.success(`Moved to ${titleCase(s2)}`); }).catch(() => {})}>{titleCase(s2)}</button>)}
          </div>
          {act.item.status === 'approved' && auth.can('students.create') && <EnrollBlock app={act.item} sectionId={enrollSection} setSectionId={setEnrollSection} pending={enroll.pending} onEnroll={(body) => enroll.mutate({ id: act.item._id, body }).then((r) => { act.close(); q.reload(); summary.reload(); toast.success(`Enrolled as ${r.student.admissionNo}`); }).catch(() => {})} error={enroll.error} />}
        </Modal>
      )}
    </>
  );
}

function EnrollBlock({ app, sectionId, setSectionId, pending, onEnroll, error }) {
  const structure = useStructure(app.sessionId);
  const sections = structure.data?.classes.find((c) => c.id === app.classId)?.sections || [];
  return (
    <div className="border-top pt-3">
      <div className="fw-semibold mb-2">Enrol as student</div>
      <select className="form-select mb-2" aria-label="Section" value={sectionId} onChange={(e) => setSectionId(e.target.value)}><option value="">Choose section ({app.class?.name})…</option>{sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      {error?.code === 'DUPLICATE_GUARDIAN' && error.details.matches.map((m) => <button key={m.id} className="btn btn-sm btn-outline-primary w-100 mb-2" onClick={() => onEnroll({ sectionId: sectionId || undefined, guardianId: m.id })}>Link existing parent {m.name} ({m.phone})</button>)}
      <button className="btn btn-success w-100" disabled={pending} onClick={() => onEnroll({ sectionId: sectionId || undefined })}>Enrol student</button>
    </div>
  );
}

/* ------------------------------ staff ------------------------------ */

export function Staff() {
  const auth = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const s = useDebounced(search);
  const q = useQuery(() => api.list('/staff', { search: s, page, limit: 25 }), [s, page]);
  const d = useDialog();
  const [f, setF] = useState({});
  const add = useMutation((b) => api.post('/staff', b));
  const fe = add.error?.fieldErrors?.() || {};
  return (
    <>
      <PageHeader title="Teachers & staff" description="Employee records, roles and teaching assignments" actions={auth.can('staff.create', 'users.create') && <button className="btn btn-primary" onClick={() => { add.reset(); setF({ name: '', email: '', phone: '', role: 'teacher', department: '', designation: '', joiningDate: '' }); d.open(); }}><i className="bi bi-plus-lg me-1" />Add staff</button>} />
      <div className="card table-card">
        <FilterBar><SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Name, email, employee code" /></FilterBar>
        {q.error ? <ErrorState error={q.error} onRetry={q.reload} /> : (
          <DataTable keyField="id" loading={q.loading} rows={q.data?.items} columns={[
            { key: 'name', label: 'Name', render: (r) => <><div className="fw-semibold">{r.user.name}</div><div className="small text-muted">{r.user.email}</div></> },
            { key: 'code', label: 'Employee code', render: (r) => r.profile?.employeeCode || '—' },
            { key: 'role', label: 'Role', render: (r) => r.roles.map((x) => ROLE_LABELS[x]).join(', ') || 'Custom role' },
            { key: 'dept', label: 'Department / designation', render: (r) => (r.profile ? `${r.profile.department || '—'} · ${r.profile.designation || '—'}` : '—') },
            { key: 'phone', label: 'Phone', render: (r) => r.user.phone || '—' },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.profile?.employmentStatus === 'exited' ? 'withdrawn' : r.status} label={r.profile?.employmentStatus === 'exited' ? 'Exited' : undefined} /> },
          ]} />
        )}
        <Pagination meta={q.data?.meta} onPage={setPage} />
      </div>
      {d.isOpen && (
        <Modal title="Add staff member" size="modal-lg" onClose={d.close} footer={<><button className="btn btn-outline-secondary" onClick={d.close}>Cancel</button><button className="btn btn-primary" disabled={add.pending || !f.name || !f.email} onClick={() => add.mutate({ name: f.name, email: f.email, phone: f.phone || undefined, roles: [f.role], profile: { department: f.department || undefined, designation: f.designation || undefined, joiningDate: f.joiningDate || undefined } }).then((r) => { d.close(); q.reload(); toast.added('Staff added', r); }).catch(() => {})}>Add</button></>}>
          <FormError error={add.error} />
          <div className="row g-2">
            <div className="col-md-6"><FormField label="Full name" name="sn" required error={fe.name}><input id="sn" className="form-control" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></FormField></div>
            <div className="col-md-6"><FormField label="Email (login)" name="se" required error={fe.email}><input id="se" type="email" className="form-control" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></FormField></div>
            <div className="col-md-4"><FormField label="Phone" name="sp" error={fe.phone}><input id="sp" className="form-control" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></FormField></div>
            <div className="col-md-4"><FormField label="Role" name="sr"><select id="sr" className="form-select" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{['teacher', 'staff', 'accountant', 'principal', 'school_admin'].map((x) => <option key={x} value={x}>{ROLE_LABELS[x]}</option>)}</select></FormField></div>
            <div className="col-md-4"><FormField label="Joining date" name="sj"><input id="sj" type="date" className="form-control" value={f.joiningDate} onChange={(e) => setF({ ...f, joiningDate: e.target.value })} /></FormField></div>
            <div className="col-md-6"><FormField label="Department" name="sd" className="mb-0"><input id="sd" className="form-control" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} /></FormField></div>
            <div className="col-md-6"><FormField label="Designation" name="sg" className="mb-0"><input id="sg" className="form-control" value={f.designation} onChange={(e) => setF({ ...f, designation: e.target.value })} /></FormField></div>
          </div>
        </Modal>
      )}
    </>
  );
}
