import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api/client.js';
import { useQuery } from '../hooks/useApi.js';
import { PageHeader, StatCard, StatusBadge, QueryState, EmptyState, ErrorState, BarChart, DataTable } from '../components/ui.jsx';
import { money, date, pct, dateTime, DAY_NAMES } from '../utils/format.js';

/* ------------------------------ shared blocks ------------------------------ */

function FeeOverview({ fees, currency }) {
  const d = fees.data;
  return (
    <div className="card h-100">
      <div className="card-header d-flex justify-content-between">
        Fee collection
        <Link to="/fees" className="small fw-normal">Open fee dashboard</Link>
      </div>
      <div className="card-body">
        {fees.error ? (
          <ErrorState error={fees.error} />
        ) : (
          <div className="row g-3">
            {[
              ['Today', d?.collection.today.amount],
              ['This month (net)', d?.collection.month.net],
              ['Outstanding', d?.outstanding.amount],
              ['Overdue', d?.overdue.amount],
            ].map(([label, v]) => (
              <div className="col-6" key={label}>
                <div className="small text-muted">{label}</div>
                <div className="fs-5 fw-semibold">{fees.loading && !d ? <div className="skeleton" style={{ width: 80 }} /> : money(v, currency)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AttendanceOverview({ att }) {
  const t = att.data?.totals;
  return (
    <div className="card h-100">
      <div className="card-header d-flex justify-content-between">
        Attendance today
        <Link to="/attendance" className="small fw-normal">Details</Link>
      </div>
      <div className="card-body">
        {att.error ? (
          <ErrorState error={att.error} />
        ) : att.data && !att.data.day?.isWorkingDay && att.data.session ? (
          <EmptyState icon="calendar-x" title="Not a working day" message={att.data.day?.title || 'Weekly day off'} />
        ) : (
          <>
            <div className="row g-3 mb-3">
              {[
                ['Present', t?.present, 'success'],
                ['Absent', t?.absent, 'danger'],
                ['Late', t?.late, 'warning'],
                ['Leave', t?.leave, 'info'],
              ].map(([label, v, tone]) => (
                <div className="col-3" key={label}>
                  <div className="small text-muted">{label}</div>
                  <div className={`fs-5 fw-semibold text-${tone}`}>{v ?? '—'}</div>
                </div>
              ))}
            </div>
            <div className="small text-muted">
              {t ? `${t.markedSections} of ${t.sections} sections marked · ${pct(t.percentage)} attendance` : 'Loading…'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ClassAttendanceChart({ att }) {
  const classes = att.data?.classes?.filter((c) => c.total > 0) || [];
  return (
    <div className="card h-100">
      <div className="card-header">Class-wise attendance (today)</div>
      <div className="card-body">
        {att.loading && !att.data ? <div className="skeleton" style={{ height: 180 }} /> : <BarChart data={classes.map((c) => ({ label: c.name, value: c.percentage ?? 0, color: (c.percentage ?? 0) < 75 ? 'var(--erp-warning)' : 'var(--erp-success)' }))} format={(v) => `${v}%`} />}
      </div>
    </div>
  );
}

function RecentPayments({ fees, currency }) {
  return (
    <div className="card table-card h-100">
      <div className="card-header">Recent payments</div>
      <QueryState query={fees} isEmpty={(d) => !d.recentPayments.length} empty={<EmptyState icon="receipt" title="No payments yet" />}>
        {(d) => (
          <DataTable
            rows={d.recentPayments}
            columns={[
              { key: 'receiptNo', label: 'Receipt', render: (r) => <Link to={`/fees/payments/${r._id}`}>{r.receiptNo}</Link> },
              { key: 'student', label: 'Student', render: (r) => r.student?.name },
              { key: 'method', label: 'Method', render: (r) => <span className="text-capitalize">{r.method.replace('_', ' ')}</span> },
              { key: 'amount', label: 'Amount', className: 'num', render: (r) => money(r.amount, currency) },
            ]}
          />
        )}
      </QueryState>
    </div>
  );
}

function Defaulters({ currency }) {
  const q = useQuery(() => api.list('/fees/defaulters', { limit: 5 }), []);
  return (
    <div className="card table-card h-100">
      <div className="card-header d-flex justify-content-between">
        Students with overdue fees
        <Link to="/fees/defaulters" className="small fw-normal">View all</Link>
      </div>
      <QueryState query={q} isEmpty={(d) => !d.items.length} empty={<EmptyState icon="check2-circle" title="No overdue fees" />}>
        {(d) => (
          <DataTable
            keyField="studentId"
            rows={d.items}
            columns={[
              { key: 'name', label: 'Student', render: (r) => <><div className="fw-semibold">{r.name}</div><div className="small text-muted">{r.classSection}</div></> },
              { key: 'days', label: 'Overdue', render: (r) => `${r.daysOverdue} days` },
              { key: 'amt', label: 'Amount', className: 'num', render: (r) => <span className="text-danger fw-semibold">{money(r.overdueAmount, currency)}</span> },
            ]}
          />
        )}
      </QueryState>
    </div>
  );
}

/* ------------------------------ role dashboards ------------------------------ */

function AdminDashboard() {
  const auth = useAuth();
  const canFees = auth.can('fees.read');
  const canAtt = auth.canAny('attendance.reports', 'attendance.mark', 'attendance.update');
  const students = useQuery(() => api.get('/students/summary'), [], { enabled: auth.can('students.read') });
  const fees = useQuery(() => api.get('/fees/dashboard'), [], { enabled: canFees });
  const att = useQuery(() => api.get('/attendance/daily'), [], { enabled: canAtt });
  const exams = useQuery(() => api.get('/exams', { status: 'draft' }), [], { enabled: auth.can('exams.read') });
  const upcoming = (exams.data?.items || []).filter((e) => new Date(e.endDate) >= new Date(new Date().toDateString())).slice(0, 4);
  return (
    <>
      <PageHeader
        title="Dashboard"
        description={auth.tenant.school.name}
        actions={
          <>
            {auth.can('fees.collect') && <Link to="/fees/collect" className="btn btn-primary"><i className="bi bi-wallet2 me-1" /> Collect fee</Link>}
            {auth.canAny('attendance.mark', 'attendance.update') && <Link to="/attendance/mark" className="btn btn-outline-primary"><i className="bi bi-check2-square me-1" /> Mark attendance</Link>}
          </>
        }
      />
      <div className="row g-3 mb-3">
        <div className="col-6 col-xl-3"><StatCard label="Total students" value={students.data?.active ?? '—'} icon="mortarboard" loading={students.loading} hint={students.data?.activeNotEnrolled ? `${students.data.activeNotEnrolled} not enrolled in a section` : null} /></div>
        <div className="col-6 col-xl-3"><StatCard label="Present today" value={att.data?.totals?.present ?? '—'} icon="person-check" tone="success" loading={canAtt && att.loading} /></div>
        <div className="col-6 col-xl-3"><StatCard label="Absent today" value={att.data?.totals?.absent ?? '—'} icon="person-x" tone="danger" loading={canAtt && att.loading} /></div>
        <div className="col-6 col-xl-3"><StatCard label="Overdue fees" value={canFees ? money(fees.data?.overdue.amount, auth.currency) : '—'} icon="exclamation-diamond" tone="warning" loading={canFees && fees.loading} hint={fees.data ? `${fees.data.overdue.students} students` : null} /></div>
      </div>
      <div className="row g-3 mb-3">
        {canFees && <div className="col-lg-6"><FeeOverview fees={fees} currency={auth.currency} /></div>}
        {canAtt && <div className="col-lg-6"><AttendanceOverview att={att} /></div>}
      </div>
      <div className="row g-3">
        {canAtt && <div className="col-lg-6"><ClassAttendanceChart att={att} /></div>}
        {canFees && <div className="col-lg-6"><RecentPayments fees={fees} currency={auth.currency} /></div>}
        {auth.can('fees.reports') && <div className="col-lg-6"><Defaulters currency={auth.currency} /></div>}
        {auth.can('exams.read') && (
          <div className="col-lg-6">
            <div className="card h-100">
              <div className="card-header">Upcoming exams</div>
              <div className="card-body">
                {upcoming.length === 0 ? <EmptyState icon="journal" title="No upcoming exams" /> : upcoming.map((e) => (
                  <Link key={e._id} to={`/exams/${e._id}`} className="d-flex justify-content-between py-2 border-bottom text-decoration-none text-body">
                    <span className="fw-semibold">{e.name}</span>
                    <span className="text-muted small">{date(e.startDate)} – {date(e.endDate)}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function AccountantDashboard() {
  const auth = useAuth();
  const fees = useQuery(() => api.get('/fees/dashboard'), []);
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const trend = useQuery(() => api.get('/fees/reports/collections', { from, to, groupBy: 'day' }), [], { enabled: auth.can('fees.reports') });
  const methods = useQuery(() => api.get('/fees/reports/collections', { from, to, groupBy: 'method' }), [], { enabled: auth.can('fees.reports') });
  const d = fees.data;
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Fee collection and follow-up"
        actions={
          <>
            {auth.can('fees.collect') && <Link to="/fees/collect" className="btn btn-primary"><i className="bi bi-wallet2 me-1" /> Collect fee</Link>}
            <Link to="/fees/defaulters" className="btn btn-outline-primary">View defaulters</Link>
            <Link to="/fees/reminders" className="btn btn-outline-secondary">Configure reminders</Link>
          </>
        }
      />
      <div className="row g-3 mb-3">
        <div className="col-6 col-xl-3"><StatCard label="Today’s collection" value={money(d?.collection.today.amount, auth.currency)} icon="cash" tone="success" loading={fees.loading} hint={d ? `${d.collection.today.count} payments` : null} /></div>
        <div className="col-6 col-xl-3"><StatCard label="This month" value={money(d?.collection.month.net, auth.currency)} icon="calendar3" loading={fees.loading} hint={d?.collection.month.refunds ? `after ${money(d.collection.month.refunds, auth.currency)} refunds` : null} /></div>
        <div className="col-6 col-xl-3"><StatCard label="Total outstanding" value={money(d?.outstanding.amount, auth.currency)} icon="hourglass-split" tone="warning" loading={fees.loading} /></div>
        <div className="col-6 col-xl-3"><StatCard label="Overdue invoices" value={d?.overdue.invoices ?? '—'} icon="exclamation-diamond" tone="danger" loading={fees.loading} hint={d ? money(d.overdue.amount, auth.currency) : null} /></div>
      </div>
      {fees.error && <ErrorState error={fees.error} onRetry={fees.reload} />}
      <div className="row g-3">
        <div className="col-lg-8">
          <div className="card h-100">
            <div className="card-header">Collection trend (last 30 days)</div>
            <div className="card-body">
              <QueryState query={trend}>{(t) => <BarChart data={t.rows.map((r) => ({ label: r.key.slice(5), value: r.amount }))} format={(v) => money(v, auth.currency)} />}</QueryState>
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-header">Payment methods (30 days)</div>
            <div className="card-body">
              <QueryState query={methods} isEmpty={(m) => !m.rows.length} empty={<EmptyState icon="pie-chart" title="No payments in this period" />}>
                {(m) => m.rows.map((r) => (
                  <div key={r.key} className="d-flex justify-content-between py-2 border-bottom">
                    <span className="text-capitalize">{String(r.key).replace('_', ' ')}</span>
                    <span className="fw-semibold">{money(r.amount, auth.currency)} <span className="text-muted small">({r.count})</span></span>
                  </div>
                ))}
              </QueryState>
            </div>
          </div>
        </div>
        <div className="col-lg-6"><RecentPayments fees={fees} currency={auth.currency} /></div>
        <div className="col-lg-6"><Defaulters currency={auth.currency} /></div>
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header d-flex justify-content-between">Reminder delivery (30 days)<Link to="/fees/reminders" className="small fw-normal">Details</Link></div>
            <div className="card-body d-flex flex-wrap gap-3">
              {d && Object.keys(d.reminders).length === 0 && <span className="text-muted">No reminders sent in the last 30 days.</span>}
              {d && Object.entries(d.reminders).map(([k, v]) => <div key={k}><StatusBadge status={k} /> <span className="fw-semibold ms-1">{v}</span></div>)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function TeacherDashboard() {
  const auth = useAuth();
  const mine = useQuery(() => api.get('/academics/my-assignments'), []);
  const today = useQuery(() => api.get('/timetable/my', { day: 'today' }), [], { enabled: auth.can('timetable.read') });
  const att = useQuery(() => api.get('/attendance/daily'), [], { enabled: auth.canAny('attendance.mark', 'attendance.update') });
  return (
    <>
      <PageHeader title={`Good day, ${auth.user.name.split(' ')[0]}`} description={`${DAY_NAMES[new Date().getDay()]}, ${date(new Date())}`} actions={auth.canAny('attendance.mark') && <Link to="/attendance/mark" className="btn btn-primary btn-lg"><i className="bi bi-check2-square me-2" />Mark attendance</Link>} />
      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header">Attendance pending today</div>
            <div className="card-body">
              <QueryState query={att}>
                {(d) => !d.day?.isWorkingDay ? <EmptyState icon="calendar-x" title="No school today" message={d.day?.title} /> : d.unmarked.length === 0 ? <EmptyState icon="check2-circle" title="All your sections are marked" /> : d.unmarked.map((s) => (
                  <Link key={s.sectionId} to={`/attendance/mark?sectionId=${s.sectionId}`} className="d-flex justify-content-between align-items-center py-2 border-bottom text-decoration-none text-body">
                    <span className="fw-semibold">{s.displayName}</span>
                    <span className="btn btn-sm btn-outline-primary">Mark now</span>
                  </Link>
                ))}
              </QueryState>
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header">Today’s timetable</div>
            <div className="card-body">
              <QueryState query={today} isEmpty={(d) => !d.entries.length} empty={<EmptyState icon="clock" title="No classes scheduled today" />}>
                {(d) => d.entries.map((e) => (
                  <div key={e._id} className="d-flex justify-content-between py-2 border-bottom">
                    <span><span className="text-muted me-2">P{e.periodNumber}</span><span className="fw-semibold">{e.subject?.name}</span> · {e.section?.displayName}</span>
                    <span className="text-muted small">{e.period ? `${e.period.startTime}–${e.period.endTime}` : ''}</span>
                  </div>
                ))}
              </QueryState>
            </div>
          </div>
        </div>
        <div className="col-12">
          <div className="card">
            <div className="card-header">My classes and subjects</div>
            <div className="card-body">
              <QueryState query={mine} isEmpty={(d) => !d.classTeacherOf.length && !d.subjects.length} empty={<EmptyState icon="diagram-3" title="No classes assigned yet" />}>
                {(d) => (
                  <div className="d-flex flex-wrap gap-2">
                    {d.classTeacherOf.map((s) => <span key={s._id} className="badge text-bg-primary fs-6 fw-normal">{s.displayName} · Class teacher</span>)}
                    {d.subjects.map((a) => <span key={a._id} className="badge text-bg-light border fs-6 fw-normal">{a.section?.displayName} · {a.subject?.name}</span>)}
                  </div>
                )}
              </QueryState>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ChildCard({ child, auth }) {
  const fees = useQuery(() => api.get('/portal/fees', { studentId: child.studentId }), [child.studentId], { enabled: auth.isParent && auth.can('fees.read') });
  const att = useQuery(() => api.get('/portal/attendance', { studentId: child.studentId }), [child.studentId], { enabled: auth.can('attendance.read') });
  const todayRec = att.data?.records?.[0];
  const isToday = todayRec && new Date(todayRec.date).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
  return (
    <div className="card h-100">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div>
            <h2 className="h5 mb-0">{child.name}</h2>
            <div className="text-muted small">{child.currentEnrollment?.displayName || 'Not enrolled'} · {child.admissionNo}</div>
          </div>
          {isToday ? <StatusBadge status={todayRec.status} label={`Today: ${todayRec.status}`} /> : <span className="small text-muted">Today not marked yet</span>}
        </div>
        <div className="row g-3">
          <div className="col-6">
            <div className="small text-muted">Attendance</div>
            <div className="fs-5 fw-semibold">{pct(att.data?.summary?.percentage)}</div>
          </div>
          {auth.isParent && (
            <div className="col-6">
              <div className="small text-muted">Fee due</div>
              <div className={`fs-5 fw-semibold ${fees.data?.summary.overdue ? 'text-danger' : ''}`}>{money(fees.data?.summary.balance, auth.currency)}</div>
              {fees.data?.summary.nextDue && <div className="small text-muted">Next due {date(fees.data.summary.nextDue.dueDate)}</div>}
            </div>
          )}
        </div>
        <div className="d-flex flex-wrap gap-2 mt-3">
          {auth.isParent && fees.data?.summary.balance > 0 && <Link to={`/my/fees?studentId=${child.studentId}`} className="btn btn-primary btn-sm"><i className="bi bi-credit-card me-1" />Pay fee</Link>}
          <Link to={`/my/attendance?studentId=${child.studentId}`} className="btn btn-outline-secondary btn-sm">Attendance</Link>
          <Link to={`/my/results?studentId=${child.studentId}`} className="btn btn-outline-secondary btn-sm">Results</Link>
        </div>
      </div>
    </div>
  );
}

function FamilyDashboard() {
  const auth = useAuth();
  const children = useQuery(() => (auth.isParent ? api.get('/portal/children').then((d) => d.children) : api.get('/portal/student').then((d) => [d.student])), []);
  const inbox = useQuery(() => api.list('/portal/notifications', { limit: 5 }), []);
  return (
    <>
      <PageHeader title={`Welcome, ${auth.user.name.split(' ')[0]}`} description={auth.tenant.school.name} />
      <QueryState query={children} isEmpty={(d) => !d.length} empty={<EmptyState icon="people" title="No student linked to your account" message="Please contact the school office." />}>
        {(kids) => (
          <div className="row g-3 mb-3">
            {kids.map((c) => (
              <div className="col-lg-6" key={c.studentId}>
                <ChildCard child={c} auth={auth} />
              </div>
            ))}
          </div>
        )}
      </QueryState>
      <div className="card">
        <div className="card-header d-flex justify-content-between">Notices and alerts<Link to="/notifications" className="small fw-normal">View all</Link></div>
        <div className="card-body">
          <QueryState query={inbox} isEmpty={(d) => !d.items.length} empty={<EmptyState icon="bell" title="No notifications" />}>
            {(d) => d.items.map((n) => (
              <div key={n._id} className="py-2 border-bottom">
                <div className="fw-semibold">{n.title}</div>
                <div className="small text-muted">{n.body} · {dateTime(n.createdAt)}</div>
              </div>
            ))}
          </QueryState>
        </div>
      </div>
    </>
  );
}

export default function Dashboard() {
  const auth = useAuth();
  if (!auth.tenant && auth.isPlatformAdmin) return <Navigate to="/platform/analytics" replace />;
  if (!auth.tenant) return <EmptyState icon="building" title="No school selected" />;
  if (!auth.isStaff) return <FamilyDashboard />;
  const roles = auth.roles;
  if (roles.some((r) => ['school_owner', 'school_admin', 'principal'].includes(r))) return <AdminDashboard />;
  if (roles.includes('accountant')) return <AccountantDashboard />;
  if (roles.includes('teacher')) return <TeacherDashboard />;
  return <AdminDashboard />;
}
