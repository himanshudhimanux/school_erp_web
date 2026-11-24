import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api/client.js';
import { useMutation, useQuery } from '../hooks/useApi.js';
import { useToast } from '../components/Toast.jsx';
import { PageHeader, StatCard, QueryState, EmptyState, BarChart, FormField, FormError, Modal, useDialog } from '../components/ui.jsx';
import { ClassSectionSelect } from '../components/pickers.jsx';
import { money, date, pct, todayYmd, titleCase } from '../utils/format.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (ym) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
const firstOfMonth = () => `${todayYmd().slice(0, 8)}01`;

/**
 * Reports & analytics. Each card is shown only when the API includes it (the caller holds the
 * permission for that area); every number comes from the overview endpoint.
 */
export function Reports() {
  const auth = useAuth();
  const q = useQuery(() => api.get('/reports/overview'), []);
  const exp = useDialog();
  return (
    <>
      <PageHeader title="Reports & analytics" description="Your school at a glance, and downloadable reports" />
      <QueryState query={q} rows={6}>
        {(d) => (
          <>
            <div className="small text-muted mb-3">As of {date(d.asOf)}{d.session ? ` · ${d.session.name}` : ' · no current academic session'}</div>
            <div className="row g-3 mb-3">
              {d.students && <div className="col-6 col-xl-3"><StatCard label="Active students" value={d.students.active} hint={d.students.activeNotEnrolled ? `${d.students.activeNotEnrolled} not enrolled this session` : undefined} icon="mortarboard" /></div>}
              {d.staff && <div className="col-6 col-xl-3"><StatCard label="Active staff" value={d.staff.active} icon="person-badge" tone="info" /></div>}
              {d.attendance && <div className="col-6 col-xl-3"><StatCard label="Attendance (30 days)" value={pct(d.attendance.average)} hint={d.attendance.today ? `Today ${pct(d.attendance.today.percentage)}` : 'Not marked today'} icon="calendar-check" tone="success" /></div>}
              {d.fees && <div className="col-6 col-xl-3"><StatCard label="Fees outstanding" value={money(d.fees.outstanding.balance, auth.currency)} hint={`${money(d.fees.outstanding.overdue, auth.currency)} overdue`} icon="cash-stack" tone="warning" /></div>}
            </div>

            <div className="row g-3">
              {d.fees && (
                <div className="col-lg-8">
                  <div className="card h-100">
                    <div className="card-header d-flex justify-content-between">Fee collection, last 12 months<span className="small text-muted fw-normal">{money(d.fees.totals.received, auth.currency)} received · {money(d.fees.totals.refunded, auth.currency)} refunded</span></div>
                    <div className="card-body">
                      <BarChart title="Receipts per month" data={d.fees.months.map((m) => ({ label: monthLabel(m.month), value: m.amount }))} format={(v) => money(v, auth.currency)} />
                    </div>
                  </div>
                </div>
              )}
              {d.students && (
                <div className="col-lg-4">
                  <div className="card h-100">
                    <div className="card-header">Students by class</div>
                    <div className="card-body">
                      {d.students.byClass.length === 0 ? <EmptyState icon="diagram-3" title="No enrollments this session" /> : (
                        <table className="table table-sm mb-0">
                          <tbody>
                            {d.students.byClass.map((c) => <tr key={c.classId}><td>{c.name}</td><td className="text-end fw-semibold">{c.students}</td></tr>)}
                          </tbody>
                        </table>
                      )}
                      {Object.keys(d.students.byGender).length > 0 && <div className="small text-muted mt-2">{Object.entries(d.students.byGender).map(([g, n]) => `${titleCase(g)}: ${n}`).join(' · ')}</div>}
                    </div>
                  </div>
                </div>
              )}
              {d.attendance && (
                <div className="col-lg-8">
                  <div className="card h-100">
                    <div className="card-header">Daily attendance, last 30 days</div>
                    <div className="card-body">
                      <BarChart title="Present or late, % of students marked (days with registers only)" data={d.attendance.days.map((x) => ({ label: x.date.slice(8, 10), value: x.percentage ?? 0, color: x.percentage !== null && x.percentage < 75 ? 'var(--bs-danger)' : undefined }))} format={(v) => `${v}%`} />
                    </div>
                  </div>
                </div>
              )}
              {d.exams && (
                <div className="col-lg-4">
                  <div className="card h-100">
                    <div className="card-header">Recent exam results</div>
                    <div className="card-body">
                      {d.exams.exams.length === 0 ? <EmptyState icon="journal-check" title="No published results this session" /> : (
                        <table className="table table-sm mb-0">
                          <thead><tr><th>Exam</th><th className="text-end">Pass rate</th><th className="text-end">Average</th></tr></thead>
                          <tbody>{d.exams.exams.map((e) => <tr key={e.examId}><td>{e.name}<div className="small text-muted">{e.students} students</div></td><td className="text-end">{pct(e.passRate)}</td><td className="text-end">{pct(e.average)}</td></tr>)}</tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {d.fees && d.fees.outstandingByClass.length > 0 && (
                <div className="col-lg-6">
                  <div className="card h-100">
                    <div className="card-header">Outstanding fees by class</div>
                    <div className="card-body">
                      <table className="table table-sm mb-0">
                        <thead><tr><th>Class</th><th className="text-end">Students</th><th className="text-end">Balance</th><th className="text-end">Overdue</th></tr></thead>
                        <tbody>{d.fees.outstandingByClass.map((r) => <tr key={String(r.classId)}><td>{r.name}</td><td className="text-end">{r.students}</td><td className="text-end">{money(r.balance, auth.currency)}</td><td className="text-end text-danger">{money(r.overdue, auth.currency)}</td></tr>)}</tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              {(d.library || d.hostel || d.staff) && (
                <div className="col-lg-6">
                  <div className="card h-100">
                    <div className="card-header">Campus services & staff</div>
                    <div className="card-body">
                      <table className="table table-sm mb-0">
                        <tbody>
                          {d.library && <tr><td>Library books on loan</td><td className="text-end">{d.library.onLoan} <span className="text-muted small">({d.library.overdue} overdue)</span></td></tr>}
                          {d.library && <tr><td>Library copies available</td><td className="text-end">{d.library.available} of {d.library.copies}</td></tr>}
                          {d.hostel && <tr><td>Hostel occupancy</td><td className="text-end">{d.hostel.beds ? `${d.hostel.occupied} of ${d.hostel.beds} beds (${pct(d.hostel.occupancy)})` : 'No rooms set up'}</td></tr>}
                          {d.staff?.byRole.map((r) => <tr key={r.role}><td>{r.label}</td><td className="text-end">{r.count}</td></tr>)}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              {d.communication && (
                <div className="col-12">
                  <div className="card">
                    <div className="card-header">Messages sent, last 30 days</div>
                    <div className="card-body">
                      {Object.keys(d.communication.byChannel).length === 0 ? <span className="text-muted">No messages in the last 30 days.</span> : (
                        <div className="table-responsive">
                          <table className="table table-sm mb-0">
                            <thead><tr><th>Channel</th>{['queued', 'sent', 'delivered', 'failed', 'cancelled'].map((s) => <th key={s} className="text-end">{titleCase(s)}</th>)}</tr></thead>
                            <tbody>{Object.entries(d.communication.byChannel).map(([ch, s]) => <tr key={ch}><td>{ch === 'none' ? 'Unreachable' : ch === 'in_app' ? 'App inbox' : titleCase(ch)}</td>{['queued', 'sent', 'delivered', 'failed', 'cancelled'].map((k) => <td key={k} className="text-end">{s[k] || 0}</td>)}</tr>)}</tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </QueryState>

      <h2 className="h5 mt-4 mb-3">Download reports</h2>
      <ExportList onPick={exp.open} />
      {exp.isOpen && <ExportDialog report={exp.item} onClose={exp.close} />}
    </>
  );
}

function ExportList({ onPick }) {
  const q = useQuery(() => api.get('/reports/exports'), []);
  return (
    <QueryState query={q}>
      {(list) => (
        <div className="row g-3">
          {list.filter((r) => r.available).map((r) => (
            <div key={r.key} className="col-md-6 col-xl-4">
              <div className="card h-100">
                <div className="card-body d-flex flex-column">
                  <div className="fw-semibold"><i className="bi bi-filetype-csv me-2 text-primary" />{r.label}</div>
                  <div className="small text-muted flex-grow-1 mb-2">{r.description}</div>
                  <button className="btn btn-sm btn-outline-primary align-self-start" onClick={() => onPick(r)}>Download CSV…</button>
                </div>
              </div>
            </div>
          ))}
          {list.every((r) => !r.available) && <div className="col-12"><EmptyState icon="filetype-csv" title="No reports available for your role" /></div>}
        </div>
      )}
    </QueryState>
  );
}

const NEEDS_RANGE = ['attendance', 'fee-payments'];

function ExportDialog({ report, onClose }) {
  const toast = useToast();
  const [f, setF] = useState({ from: firstOfMonth(), to: todayYmd(), classId: '', sectionId: '', status: '', examId: '' });
  const exams = useQuery(() => (report.key === 'exam-results' ? api.get('/exams') : Promise.resolve([])), [report.key]);
  const run = useMutation((params) => api.download(`/reports/exports/${report.key}`, params));
  const params = () => {
    const p = {};
    if (NEEDS_RANGE.includes(report.key)) Object.assign(p, { from: f.from, to: f.to });
    if (['students', 'attendance', 'fee-defaulters', 'exam-results'].includes(report.key)) Object.assign(p, { classId: report.key === 'exam-results' ? undefined : f.classId, sectionId: f.sectionId });
    if (report.key === 'students' && f.status) p.status = f.status;
    if (report.key === 'exam-results') p.examId = f.examId;
    return p;
  };
  const examList = Array.isArray(exams.data) ? exams.data : exams.data?.items || [];
  return (
    <Modal title={`Download: ${report.label}`} onClose={onClose} footer={<><button className="btn btn-outline-secondary" onClick={onClose}>Close</button><button className="btn btn-primary" disabled={run.pending || (report.key === 'exam-results' && (!f.examId || !f.sectionId))} onClick={() => run.mutate(params()).then((name) => { toast.success(`Downloaded ${name}`); onClose(); }).catch(() => {})}>{run.pending && <span className="spinner-border spinner-border-sm me-2" />}Download CSV</button></>}>
      <FormError error={run.error} />
      <p className="small text-muted">{report.description} Opens in Excel, Google Sheets or any spreadsheet app.</p>
      {NEEDS_RANGE.includes(report.key) && (
        <div className="row g-2 mb-3">
          <div className="col"><FormField label="From" name="from" className="mb-0"><input id="from" type="date" className="form-control" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></FormField></div>
          <div className="col"><FormField label="To" name="to" className="mb-0"><input id="to" type="date" className="form-control" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></FormField></div>
        </div>
      )}
      {report.key === 'exam-results' && (
        <FormField label="Exam" name="exam" required>
          <select id="exam" className="form-select" value={f.examId} onChange={(e) => setF({ ...f, examId: e.target.value })}>
            <option value="">Choose exam…</option>
            {examList.map((x) => <option key={x._id} value={x._id}>{x.name}{x.status !== 'published' ? ' (draft)' : ''}</option>)}
          </select>
        </FormField>
      )}
      {['students', 'attendance', 'fee-defaulters', 'exam-results'].includes(report.key) && (
        <div className="mb-3">
          <div className="form-label">{report.key === 'exam-results' ? 'Section' : 'Class / section (optional)'}</div>
          <div className="d-flex gap-2"><ClassSectionSelect classId={f.classId} sectionId={f.sectionId} sectionRequired={report.key === 'exam-results'} allowAll={report.key !== 'exam-results'} onChange={(v) => setF({ ...f, ...v })} /></div>
        </div>
      )}
      {report.key === 'students' && (
        <FormField label="Student status" name="st">
          <select id="st" className="form-select" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="">Any status</option>
            {['active', 'inactive', 'alumni', 'transferred', 'withdrawn'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </select>
        </FormField>
      )}
    </Modal>
  );
}
