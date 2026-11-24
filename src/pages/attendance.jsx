import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api/client.js';
import { useMutation, useQuery } from '../hooks/useApi.js';
import { useToast } from '../components/Toast.jsx';
import { PageHeader, StatCard, StatusBadge, QueryState, EmptyState, ErrorState, DataTable, Pagination, FilterBar, FormField, FormError, ConfirmDialog, Modal, useDialog } from '../components/ui.jsx';
import { StudentPicker } from '../components/pickers.jsx';
import { date, dateTime, pct, todayYmd, titleCase } from '../utils/format.js';

const STATUSES = [
  ['present', 'P', 'Present'],
  ['absent', 'A', 'Absent'],
  ['late', 'L', 'Late'],
  ['leave', 'LV', 'Leave'],
];

/* ------------------------------ today ------------------------------ */

export function AttendanceToday() {
  const auth = useAuth();
  const [day, setDay] = useState(todayYmd());
  const q = useQuery(() => api.get('/attendance/daily', { date: day }), [day]);
  const alerts = useQuery(() => api.list('/attendance/alerts', { date: day, limit: 10 }), [day]);
  const d = q.data;
  return (
    <>
      <PageHeader
        title="Attendance"
        description={d?.session ? `${d.session.name} · ${date(day)}` : date(day)}
        actions={
          <>
            <input type="date" className="form-control" aria-label="Date" max={todayYmd()} value={day} onChange={(e) => setDay(e.target.value)} />
            {auth.canAny('attendance.mark', 'attendance.update') && <Link to="/attendance/mark" className="btn btn-primary text-nowrap"><i className="bi bi-check2-square me-1" />Mark attendance</Link>}
          </>
        }
      />
      {q.error && <ErrorState error={q.error} onRetry={q.reload} />}
      {d && d.session && !d.day?.isWorkingDay && <div className="alert alert-info"><i className="bi bi-calendar-x me-2" />{d.day?.title ? `Holiday: ${d.day.title}` : 'Weekly day off'}: attendance is not taken.</div>}
      <div className="row g-3 mb-3">
        <div className="col-6 col-xl-3"><StatCard label="Students" value={d?.totals.enrolled ?? '—'} hint={d && `${d.totals.markedSections}/${d.totals.sections} sections marked`} icon="people" loading={q.loading} /></div>
        <div className="col-6 col-xl-3"><StatCard label="Present" value={d ? d.totals.present + d.totals.late : '—'} hint={d && `${d.totals.late} late`} icon="person-check" tone="success" loading={q.loading} /></div>
        <div className="col-6 col-xl-3"><StatCard label="Absent" value={d?.totals.absent ?? '—'} hint={d && `${d.totals.leave} on approved leave`} icon="person-x" tone="danger" loading={q.loading} /></div>
        <div className="col-6 col-xl-3"><StatCard label="Attendance" value={pct(d?.totals.percentage)} icon="percent" tone="info" loading={q.loading} /></div>
      </div>
      <div className="row g-3">
        <div className="col-lg-8">
          <div className="card table-card">
            <div className="card-header">Sections</div>
            <QueryState query={q} isEmpty={(x) => !x.sections.length} empty={<EmptyState icon="diagram-3" title="No sections to show" />}>
              {(x) => <DataTable keyField="sectionId" rows={x.sections} columns={[
                { key: 'displayName', label: 'Section' },
                { key: 'enrolled', label: 'Students', className: 'num' },
                { key: 'p', label: 'Present', className: 'num', render: (r) => (r.counts ? r.counts.present + r.counts.late : '—') },
                { key: 'a', label: 'Absent', className: 'num', render: (r) => (r.counts ? <span className={r.counts.absent ? 'text-danger fw-semibold' : ''}>{r.counts.absent}</span> : '—') },
                { key: 'pct', label: '%', className: 'num', render: (r) => pct(r.percentage) },
                { key: 'st', label: 'Status', render: (r) => (r.marked ? <StatusBadge status="completed" label="Marked" /> : r.enrolled ? <StatusBadge status="pending" label="Not marked" /> : '—') },
                { key: 'act', label: '', className: 'text-end', render: (r) => auth.canAny('attendance.mark', 'attendance.update') && r.enrolled > 0 && <Link className="btn btn-sm btn-outline-primary" to={`/attendance/mark?sectionId=${r.sectionId}&date=${day}`}>{r.marked ? 'View / edit' : 'Mark'}</Link> },
              ]} />}
            </QueryState>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card table-card">
            <div className="card-header">Parent alerts</div>
            <div className="px-3 pt-2 small">{d && Object.entries(d.alerts).map(([k, v]) => <span key={k} className="me-3"><StatusBadge status={k} /> {v}</span>)}</div>
            <QueryState query={alerts} isEmpty={(x) => !x.items.length} empty={<EmptyState icon="bell" title="No absence alerts for this day" />}>
              {(x) => x.items.map((n) => (
                <div key={n._id} className="px-3 py-2 border-bottom">
                  <div className="d-flex justify-content-between"><span className="fw-semibold">{n.student?.name}</span><StatusBadge status={n.status} /></div>
                  <div className="small text-muted">{n.recipient?.name || 'No reachable parent'} · {n.channel === 'in_app' ? 'App' : n.channel === 'none' ? (n.error ? titleCase(n.error.toLowerCase()) : '—') : titleCase(n.channel)}</div>
                </div>
              ))}
            </QueryState>
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------ marking ------------------------------ */

export function MarkAttendance() {
  const auth = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const sectionId = params.get('sectionId') || '';
  const day = params.get('date') || todayYmd();
  const sections = useQuery(() => api.get('/attendance/daily', { date: day }), [day]);
  const sheet = useQuery(() => api.get(`/attendance/sections/${sectionId}`, { date: day }), [sectionId, day], { enabled: Boolean(sectionId) });
  const [marks, setMarks] = useState({});
  const [confirm, setConfirm] = useState(false);
  const save = useMutation((b) => api.put(`/attendance/sections/${sectionId}`, b));

  useEffect(() => {
    if (!sheet.data) return;
    setMarks(Object.fromEntries(sheet.data.students.filter((s) => s.inSection).map((s) => [s.studentId, s.status || s.suggestedStatus || null])));
  }, [sheet.data]);

  const students = useMemo(() => sheet.data?.students.filter((s) => s.inSection) || [], [sheet.data]);
  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, leave: 0, unmarked: 0 };
    for (const s of students) c[marks[s.studentId] || 'unmarked'] += 1;
    return c;
  }, [students, marks]);
  const canEdit = sheet.data?.canEdit;
  const markAll = () => setMarks(Object.fromEntries(students.map((s) => [s.studentId, marks[s.studentId] && marks[s.studentId] !== 'present' ? marks[s.studentId] : s.onApprovedLeave ? 'leave' : 'present'])));
  const submit = () =>
    save
      .mutate({ date: day, entries: students.map((s) => ({ studentId: s.studentId, status: marks[s.studentId] })) })
      .then((r) => {
        setConfirm(false);
        sheet.setData(r);
        sections.reload();
        toast.success(`${r.result.created ? 'Attendance submitted' : 'Attendance updated'}${r.result.alertsQueued ? ` · ${r.result.alertsQueued} parent alerts queued` : ''}`);
      })
      .catch(() => setConfirm(false));
  const lockedMsg = { ATTENDANCE_LOCKED: 'This day is locked for teachers. Ask an administrator to make changes.', NON_WORKING_DAY: 'This is not a working day.', FUTURE_DATE: 'Attendance cannot be marked for a future date.', SESSION_CLOSED: 'This academic session is closed.' };

  return (
    <>
      <PageHeader title="Mark attendance" breadcrumbs={[{ label: 'Attendance', to: '/attendance' }, { label: 'Mark' }]} />
      <div className="card mb-3">
        <div className="card-body d-flex flex-wrap gap-2 align-items-end">
          <FormField label="Section" name="sec" className="mb-0">
            <select id="sec" className="form-select" style={{ minWidth: 220 }} value={sectionId} onChange={(e) => setParams({ sectionId: e.target.value, date: day })}>
              <option value="">Choose section…</option>
              {sections.data?.sections.filter((s) => s.enrolled > 0).map((s) => <option key={s.sectionId} value={s.sectionId}>{s.displayName}{s.marked ? ' ✓' : ''}</option>)}
            </select>
          </FormField>
          <FormField label="Date" name="dt" className="mb-0">
            <input id="dt" type="date" className="form-control" max={todayYmd()} value={day} onChange={(e) => setParams({ sectionId, date: e.target.value })} />
          </FormField>
        </div>
      </div>
      {!sectionId ? (
        <div className="card"><EmptyState icon="check2-square" title="Choose a section to begin" message="You will see only the sections you teach." /></div>
      ) : (
        <QueryState query={sheet}>
          {(s) => (
            <div className="card">
              <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
                <span>{s.section.displayName} · {date(s.date)}</span>
                <span className="small fw-normal text-muted">{s.sheet ? `Marked by ${s.sheet.markedBy || '—'} · ${dateTime(s.sheet.markedAt)}${s.sheet.submissions > 1 ? ` · updated by ${s.sheet.updatedBy}` : ''}` : 'Not marked yet'}</span>
              </div>
              {!canEdit && <div className="alert alert-warning rounded-0 border-0 border-bottom mb-0">{lockedMsg[s.lockedReason] || 'You can view but not change this register.'}</div>}
              {canEdit && (
                <div className="d-flex flex-wrap gap-2 align-items-center p-3 border-bottom">
                  <button type="button" className="btn btn-success" onClick={markAll}><i className="bi bi-check-all me-1" />Mark all present</button>
                  <span className="small text-muted">Then tap A, L or LV for students who are absent, late or on leave.</span>
                </div>
              )}
              <FormError error={save.error} />
              {students.length === 0 && <EmptyState icon="people" title="No active students in this section" />}
              {students.map((st) => (
                <div key={st.studentId} className="att-row">
                  <span className="text-muted fw-semibold">{st.rollNo ?? '—'}</span>
                  <span className="min-w-0">
                    <span className="fw-semibold d-block text-truncate">{st.name}</span>
                    <span className="small text-muted">{st.admissionNo}{st.onApprovedLeave && <span className="ms-2 text-info">· approved leave</span>}</span>
                  </span>
                  <div className="att-toggle btn-group" role="radiogroup" aria-label={`Attendance for ${st.name}`}>
                    {STATUSES.map(([v, short, label]) => (
                      <button key={v} type="button" role="radio" aria-checked={marks[st.studentId] === v} title={label} disabled={!canEdit} className={`btn btn-outline-secondary att-${v} ${marks[st.studentId] === v ? 'active' : ''}`} onClick={() => setMarks({ ...marks, [st.studentId]: v })}>
                        {short}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {students.length > 0 && (
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 p-3">
                  <div className="d-flex flex-wrap gap-3 small">
                    <span className="text-success">Present {counts.present}</span><span className="text-danger">Absent {counts.absent}</span><span className="text-warning">Late {counts.late}</span><span className="text-info">Leave {counts.leave}</span>
                    {counts.unmarked > 0 && <span className="fw-semibold">Not marked {counts.unmarked}</span>}
                  </div>
                  {canEdit && <button type="button" className="btn btn-primary btn-lg" disabled={counts.unmarked > 0 || save.pending} onClick={() => setConfirm(true)}>{s.sheet ? 'Update attendance' : 'Submit attendance'}</button>}
                </div>
              )}
            </div>
          )}
        </QueryState>
      )}
      {confirm && (
        <ConfirmDialog title="Submit attendance?" confirmLabel="Submit" pending={save.pending} onCancel={() => setConfirm(false)} onConfirm={submit}>
          <p className="mb-2">{sheet.data?.section.displayName} · {date(day)}</p>
          <p className="mb-2">Present {counts.present} · Absent {counts.absent} · Late {counts.late} · Leave {counts.leave}</p>
          {day === todayYmd() && counts.absent > 0 && <p className="small text-muted mb-0">Parents of newly absent students will be alerted. Re-submitting never sends the same alert twice.</p>}
        </ConfirmDialog>
      )}
      {!auth.canAny('attendance.mark', 'attendance.update') && <ErrorState error={{ code: 'PERMISSION_DENIED' }} />}
    </>
  );
}

/* ------------------------------ leave ------------------------------ */

export function LeaveRequests() {
  const toast = useToast();
  const [f, setF] = useState({ status: 'pending', page: 1 });
  const q = useQuery(() => api.list('/attendance/leave-requests', { ...f, limit: 25 }), [JSON.stringify(f)]);
  const review = useDialog();
  const [note, setNote] = useState('');
  const act = useMutation(({ id, status }) => api.post(`/attendance/leave-requests/${id}/review`, { status, note: note || undefined }));
  const create = useDialog();
  const [form, setForm] = useState({ student: null, fromDate: todayYmd(), toDate: todayYmd(), reason: '' });
  const add = useMutation((b) => api.post('/attendance/leave-requests', b));
  return (
    <>
      <PageHeader title="Leave requests" description="Requests from parents, and leave recorded by staff" breadcrumbs={[{ label: 'Attendance', to: '/attendance' }, { label: 'Leave' }]} actions={<button className="btn btn-outline-primary" onClick={() => { add.reset(); create.open(); }}><i className="bi bi-plus-lg me-1" />Record leave</button>} />
      <div className="card table-card">
        <FilterBar>
          <div className="btn-group btn-group-sm">
            {['pending', 'approved', 'rejected', ''].map((s) => <button key={s || 'all'} type="button" className={`btn ${f.status === s ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setF({ status: s, page: 1 })}>{s ? titleCase(s) : 'All'}</button>)}
          </div>
        </FilterBar>
        {q.error ? <ErrorState error={q.error} onRetry={q.reload} /> : (
          <DataTable loading={q.loading} rows={q.data?.items} empty={<EmptyState icon="envelope-paper" title="No leave requests" />} columns={[
            { key: 'student', label: 'Student', render: (r) => <><div className="fw-semibold">{r.student?.name}</div><div className="small text-muted">{r.student?.classSection}</div></> },
            { key: 'dates', label: 'Dates', render: (r) => (r.fromDate === r.toDate ? date(r.fromDate) : `${date(r.fromDate)} – ${date(r.toDate)}`) },
            { key: 'reason', label: 'Reason' },
            { key: 'by', label: 'Requested', render: (r) => <>{r.requestedBy}<div className="small text-muted">{r.requestedVia === 'portal' ? 'Parent portal' : 'Staff'}</div></> },
            { key: 'status', label: 'Status', render: (r) => <><StatusBadge status={r.status} />{r.reviewNote && <div className="small text-muted">{r.reviewNote}</div>}</> },
            { key: 'act', label: '', className: 'text-end', render: (r) => r.status === 'pending' && <button className="btn btn-sm btn-outline-primary" onClick={() => { setNote(''); review.open(r); }}>Review</button> },
          ]} />
        )}
        <Pagination meta={q.data?.meta} onPage={(p) => setF({ ...f, page: p })} />
      </div>
      {review.isOpen && (
        <Modal title="Review leave request" onClose={review.close} footer={<>
          <button className="btn btn-outline-danger" disabled={act.pending} onClick={() => act.mutate({ id: review.item._id, status: 'rejected' }).then(() => { review.close(); q.reload(); toast.success('Leave rejected'); }).catch((e) => toast.error(e.message))}>Reject</button>
          <button className="btn btn-success" disabled={act.pending} onClick={() => act.mutate({ id: review.item._id, status: 'approved' }).then((r) => { review.close(); q.reload(); toast.success(`Leave approved${r.recordsConverted ? ` · ${r.recordsConverted} absences changed to leave` : ''}`); }).catch((e) => toast.error(e.message))}>Approve</button>
        </>}>
          <p><strong>{review.item.student?.name}</strong> · {date(review.item.fromDate)} – {date(review.item.toDate)}</p>
          <p className="text-muted">{review.item.reason}</p>
          <FormField label="Note to parent (optional)" name="note" className="mb-0"><input id="note" className="form-control" value={note} onChange={(e) => setNote(e.target.value)} /></FormField>
        </Modal>
      )}
      {create.isOpen && (
        <Modal title="Record leave" onClose={create.close} footer={<><button className="btn btn-outline-secondary" onClick={create.close}>Cancel</button><button className="btn btn-primary" disabled={add.pending || !form.student || form.reason.length < 3} onClick={() => add.mutate({ studentId: form.student._id, fromDate: form.fromDate, toDate: form.toDate, reason: form.reason }).then(() => { create.close(); q.reload(); toast.success('Leave recorded and approved'); }).catch(() => {})}>Save</button></>}>
          <FormError error={add.error} />
          <FormField label="Student" required>{form.student ? <div className="d-flex justify-content-between"><strong>{form.student.fullName}</strong><button className="btn btn-link btn-sm p-0" onClick={() => setForm({ ...form, student: null })}>Change</button></div> : <StudentPicker onSelect={(s) => setForm({ ...form, student: s })} />}</FormField>
          <div className="row"><div className="col-6"><FormField label="From" name="lf" required><input id="lf" type="date" className="form-control" value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} /></FormField></div><div className="col-6"><FormField label="To" name="lt" required><input id="lt" type="date" className="form-control" value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} /></FormField></div></div>
          <FormField label="Reason" name="lr" required className="mb-0"><input id="lr" className="form-control" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></FormField>
        </Modal>
      )}
    </>
  );
}

/* ------------------------------ reports ------------------------------ */

export function AttendanceReports() {
  const [tab, setTab] = useState('low');
  return (
    <>
      <PageHeader title="Attendance reports" breadcrumbs={[{ label: 'Attendance', to: '/attendance' }, { label: 'Reports' }]} />
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item"><button className={`nav-link ${tab === 'low' ? 'active' : ''}`} onClick={() => setTab('low')}>Low attendance</button></li>
        <li className="nav-item"><button className={`nav-link ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>Monthly register</button></li>
      </ul>
      {tab === 'low' ? <LowAttendance /> : <MonthlyRegister />}
    </>
  );
}

function LowAttendance() {
  const [f, setF] = useState({ threshold: '', page: 1 });
  const q = useQuery(() => api.list('/attendance/reports/low', { ...f, limit: 25 }), [JSON.stringify(f)]);
  return (
    <div className="card table-card">
      <FilterBar>
        <FormField label="Below (%)" name="th" className="mb-0"><input id="th" type="number" min="1" max="100" className="form-control" style={{ maxWidth: 120 }} placeholder={q.data?.meta?.threshold} value={f.threshold} onChange={(e) => setF({ threshold: e.target.value, page: 1 })} /></FormField>
      </FilterBar>
      {q.error ? <ErrorState error={q.error} onRetry={q.reload} /> : (
        <DataTable keyField="studentId" loading={q.loading} rows={q.data?.items} empty={<EmptyState icon="check2-circle" title="No students below the threshold" />} columns={[
          { key: 'name', label: 'Student', render: (r) => <><Link to={`/students/${r.studentId}`} className="fw-semibold">{r.name}</Link><div className="small text-muted">{r.admissionNo} · {r.classSection}</div></> },
          { key: 'days', label: 'Days marked', className: 'num', render: (r) => r.daysMarked },
          { key: 'absent', label: 'Absent', className: 'num' },
          { key: 'leave', label: 'Leave', className: 'num' },
          { key: 'pct', label: 'Attendance', className: 'num', render: (r) => <span className="fw-semibold text-danger">{pct(r.percentage)}</span> },
          { key: 'g', label: 'Contact', render: (r) => (r.primaryGuardian ? <><div>{r.primaryGuardian.name}</div><a className="small" href={`tel:${r.primaryGuardian.phone}`}>{r.primaryGuardian.phone}</a></> : '—') },
        ]} />
      )}
      <Pagination meta={q.data?.meta} onPage={(p) => setF({ ...f, page: p })} />
    </div>
  );
}

function MonthlyRegister() {
  const daily = useQuery(() => api.get('/attendance/daily'), []);
  const [sectionId, setSectionId] = useState('');
  const [month, setMonth] = useState(todayYmd().slice(0, 7));
  const q = useQuery(() => api.get(`/attendance/sections/${sectionId}/register`, { month }), [sectionId, month], { enabled: Boolean(sectionId) });
  const code = { present: 'P', absent: 'A', late: 'L', leave: 'LV' };
  const color = { present: 'text-success', absent: 'text-danger fw-semibold', late: 'text-warning', leave: 'text-info' };
  return (
    <div className="card table-card">
      <FilterBar>
        <select className="form-select" style={{ maxWidth: 220 }} aria-label="Section" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
          <option value="">Choose section…</option>
          {daily.data?.sections.map((s) => <option key={s.sectionId} value={s.sectionId}>{s.displayName}</option>)}
        </select>
        <input type="month" className="form-control" style={{ maxWidth: 170 }} aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </FilterBar>
      {!sectionId ? <EmptyState icon="table" title="Choose a section" /> : (
        <QueryState query={q}>
          {(r) => (
            <div className="table-responsive">
              <table className="table table-sm" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Roll</th><th>Student</th>
                    {r.days.map((d) => <th key={d.date} className={`text-center ${d.isWorkingDay ? '' : 'text-muted'}`} title={d.isWorkingDay ? '' : 'Holiday / day off'}>{d.date.slice(8)}</th>)}
                    <th className="num">%</th>
                  </tr>
                </thead>
                <tbody>
                  {r.students.map((s) => (
                    <tr key={s.studentId}>
                      <td>{s.rollNo ?? '—'}</td>
                      <td className="text-nowrap">{s.name}</td>
                      {r.days.map((d) => <td key={d.date} className={`text-center ${color[s.days[d.date]] || ''} ${d.isWorkingDay ? '' : 'bg-light'}`}>{code[s.days[d.date]] || ''}</td>)}
                      <td className="num">{pct(s.totals.percentage)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryState>
      )}
    </div>
  );
}
