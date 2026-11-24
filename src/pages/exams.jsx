import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api/client.js';
import { useMutation, useQuery } from '../hooks/useApi.js';
import { useToast } from '../components/Toast.jsx';
import { PageHeader, StatusBadge, QueryState, EmptyState, ErrorState, DataTable, FormField, FormError, Modal, ConfirmDialog, useDialog } from '../components/ui.jsx';
import { SessionSelect, useStructure } from '../components/pickers.jsx';
import { date, pct, ymd, titleCase } from '../utils/format.js';

export function Exams() {
  const auth = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [sessionId, setSessionId] = useState('');
  const q = useQuery(() => api.get('/exams', { sessionId }), [sessionId], { enabled: Boolean(sessionId) });
  const s = useStructure(sessionId);
  const d = useDialog();
  const [f, setF] = useState({});
  const create = useMutation((b) => api.post('/exams', b));
  return (
    <>
      <PageHeader title="Examinations" description="Schedules, marks entry, results and report cards" actions={<><SessionSelect value={sessionId} onChange={setSessionId} />{auth.can('exams.create') && <button className="btn btn-primary text-nowrap" onClick={() => { create.reset(); setF({ name: '', type: 'term', classIds: [], startDate: '', endDate: '', weightage: 100 }); d.open(); }}><i className="bi bi-plus-lg me-1" />New exam</button>}</>} />
      <div className="card table-card">
        <QueryState query={q} isEmpty={(x) => !x.items.length} empty={<EmptyState icon="journal-check" title="No exams in this session" />}>
          {(x) => <DataTable rows={x.items} onRowClick={(r) => navigate(`/exams/${r._id}`)} columns={[
            { key: 'name', label: 'Exam', render: (r) => <><div className="fw-semibold">{r.name}</div><div className="small text-muted">{r.classes.map((c) => c.name).join(', ')}</div></> },
            { key: 'type', label: 'Type', render: (r) => titleCase(r.type) },
            { key: 'dates', label: 'Dates', render: (r) => `${date(r.startDate)} – ${date(r.endDate)}` },
            { key: 'papers', label: 'Papers', className: 'num', render: (r) => r.paperCount },
            { key: 'w', label: 'Weightage', className: 'num', render: (r) => `${r.weightage}%` },
            { key: 'status', label: 'Status', render: (r) => <><StatusBadge status={r.status} />{r.marksLocked && r.status === 'draft' && <span className="small text-muted ms-1">· marks locked</span>}</> },
          ]} />}
        </QueryState>
      </div>
      {d.isOpen && (
        <Modal title="New exam" onClose={d.close} footer={<><button className="btn btn-outline-secondary" onClick={d.close}>Cancel</button><button className="btn btn-primary" disabled={create.pending || !f.name || !f.classIds.length || !f.startDate || !f.endDate} onClick={() => create.mutate({ sessionId, name: f.name, type: f.type, classIds: f.classIds, startDate: f.startDate, endDate: f.endDate, weightage: Number(f.weightage) }).then((e) => { toast.success('Exam created'); navigate(`/exams/${e._id}`); }).catch(() => {})}>Create</button></>}>
          <FormError error={create.error} />
          <div className="row g-2">
            <div className="col-8"><FormField label="Name" name="n" required><input id="n" className="form-control" placeholder="e.g. Half Yearly" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></FormField></div>
            <div className="col-4"><FormField label="Type" name="t"><select id="t" className="form-select" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{['unit_test', 'term', 'final', 'other'].map((x) => <option key={x} value={x}>{titleCase(x)}</option>)}</select></FormField></div>
            <div className="col-4"><FormField label="Start" name="sd" required><input id="sd" type="date" className="form-control" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></FormField></div>
            <div className="col-4"><FormField label="End" name="ed" required><input id="ed" type="date" className="form-control" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></FormField></div>
            <div className="col-4"><FormField label="Weightage %" name="w" hint="For the year report card"><input id="w" type="number" min="0" max="100" className="form-control" value={f.weightage} onChange={(e) => setF({ ...f, weightage: e.target.value })} /></FormField></div>
          </div>
          <div className="form-label required">Classes</div>
          <div className="d-flex flex-wrap gap-3">{s.data?.classes.map((c) => <div className="form-check" key={c.id}><input id={`ec-${c.id}`} type="checkbox" className="form-check-input" checked={f.classIds.includes(c.id)} onChange={(e) => setF({ ...f, classIds: e.target.checked ? [...f.classIds, c.id] : f.classIds.filter((x) => x !== c.id) })} /><label htmlFor={`ec-${c.id}`} className="form-check-label">{c.name}</label></div>)}</div>
        </Modal>
      )}
    </>
  );
}

export function ExamDetail() {
  const { id } = useParams();
  const auth = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab = params.get('reportCard') ? 'card' : params.get('tab') || 'schedule';
  const q = useQuery(() => api.get(`/exams/${id}`), [id]);
  const [dialog, setDialog] = useState(null);
  const [reason, setReason] = useState('');
  const act = useMutation(({ path, body }) => api.post(`/exams/${id}/${path}`, body));
  const run = (path, body, msg) => act.mutate({ path, body }).then(() => { setDialog(null); q.reload(); toast.success(msg); }).catch((e) => { if (e.code !== 'MARKS_INCOMPLETE') { setDialog(null); toast.error(e.message); } });
  return (
    <QueryState query={q}>
      {(exam) => (
        <>
          <PageHeader
            title={exam.name}
            description={`${titleCase(exam.type)} · ${date(exam.startDate)} – ${date(exam.endDate)} · ${exam.classes.map((c) => c.name).join(', ')}`}
            breadcrumbs={[{ label: 'Examinations', to: '/exams' }, { label: exam.name }]}
            actions={<>
              <StatusBadge status={exam.status} />
              {exam.status === 'draft' && auth.can('exams.update') && <button className="btn btn-outline-secondary" disabled={act.pending} onClick={() => run(exam.marksLocked ? 'unlock' : 'lock', {}, exam.marksLocked ? 'Marks entry unlocked' : 'Marks entry locked')}>{exam.marksLocked ? 'Unlock marks' : 'Lock marks'}</button>}
              {exam.status === 'draft' && auth.can('exams.publish') && <button className="btn btn-primary" onClick={() => { act.reset(); setDialog('publish'); }}>Publish results</button>}
              {exam.status === 'published' && auth.can('exams.publish') && <button className="btn btn-outline-danger" onClick={() => { setReason(''); setDialog('unpublish'); }}>Unpublish</button>}
            </>}
          />
          <ul className="nav nav-tabs mb-3">{[['schedule', 'Schedule'], ['marks', 'Marks entry'], ['results', 'Results']].map(([k, l]) => <li key={k} className="nav-item"><button className={`nav-link ${tab === k ? 'active' : ''}`} onClick={() => setParams({ tab: k })}>{l}</button></li>)}{tab === 'card' && <li className="nav-item"><span className="nav-link active">Report card</span></li>}</ul>
          {tab === 'schedule' && <Schedule exam={exam} onSaved={q.reload} />}
          {tab === 'marks' && <MarksEntry exam={exam} />}
          {tab === 'results' && <Results exam={exam} />}
          {tab === 'card' && <ReportCard examId={id} studentId={params.get('reportCard')} />}
          {dialog === 'publish' && (
            <ConfirmDialog title="Publish results?" confirmLabel={act.error?.code === 'MARKS_INCOMPLETE' ? 'Publish anyway' : 'Publish'} pending={act.pending} onCancel={() => setDialog(null)} onConfirm={() => run('publish', act.error?.code === 'MARKS_INCOMPLETE' ? { allowIncomplete: true } : {}, 'Results published and families notified')}>
              <p>Results are frozen and become visible to parents and students, who receive a notification. Marks are locked.</p>
              {act.error?.code === 'MARKS_INCOMPLETE' && <div className="alert alert-warning mb-0"><strong>{act.error.message}.</strong><ul className="mb-0 small">{act.error.details.students.slice(0, 8).map((s) => <li key={s.studentId}>{s.name}: {s.missing.join(', ')}</li>)}</ul>Their results will show as incomplete.</div>}
            </ConfirmDialog>
          )}
          {dialog === 'unpublish' && (
            <ConfirmDialog title="Unpublish results?" tone="danger" confirmLabel="Unpublish" pending={act.pending} onCancel={() => setDialog(null)} onConfirm={() => reason.length >= 3 && run('unpublish', { reason }, 'Results unpublished')}>
              <p>Families will no longer see these results until you publish again.</p>
              <FormField label="Reason" name="ur" required className="mb-0"><input id="ur" className="form-control" value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>
            </ConfirmDialog>
          )}
        </>
      )}
    </QueryState>
  );
}

function Schedule({ exam, onSaved }) {
  const auth = useAuth();
  const toast = useToast();
  const [classId, setClassId] = useState(String(exam.classIds[0]));
  const subjects = useQuery(() => api.get('/academics/class-subjects', { classId, sessionId: exam.sessionId }), [classId]);
  const [rows, setRows] = useState([]);
  useEffect(() => {
    if (!subjects.data) return;
    setRows(subjects.data.subjects.map((s) => {
      const p = exam.papers.find((x) => String(x.classId) === classId && String(x.subjectId) === String(s.subjectId));
      return { subjectId: String(s.subjectId), name: s.subject?.name, on: Boolean(p), date: ymd(p?.date), startTime: p?.startTime || '', endTime: p?.endTime || '', maxMarks: p?.maxMarks ?? 100, passMarks: p?.passMarks ?? 33 };
    }));
  }, [subjects.data, classId, exam.papers]);
  const save = useMutation((papers) => api.put(`/exams/${exam._id}/papers`, { classId, papers }));
  const canEdit = auth.can('exams.update') && exam.status === 'draft';
  const set = (i, patch) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="card table-card">
      <div className="card-header d-flex gap-2 align-items-center">
        <select className="form-select form-select-sm" style={{ maxWidth: 200 }} aria-label="Class" value={classId} onChange={(e) => setClassId(e.target.value)}>{exam.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        {exam.status === 'published' && <span className="small text-muted">Unpublish results to change the schedule.</span>}
      </div>
      <FormError error={save.error} />
      <QueryState query={subjects} isEmpty={(x) => !x.subjects.length} empty={<EmptyState icon="book" title="This class has no subjects" message="Set the class curriculum first." />}>
        {() => (
          <>
            <div className="table-responsive"><table className="table"><thead><tr><th /><th>Subject</th><th>Date</th><th>Start</th><th>End</th><th>Max</th><th>Pass</th></tr></thead><tbody>
              {rows.map((r, i) => (
                <tr key={r.subjectId}>
                  <td><input type="checkbox" className="form-check-input" aria-label={`Include ${r.name}`} disabled={!canEdit} checked={r.on} onChange={(e) => set(i, { on: e.target.checked })} /></td>
                  <td className="fw-semibold">{r.name}</td>
                  <td><input type="date" className="form-control form-control-sm" aria-label="Date" disabled={!canEdit || !r.on} min={ymd(exam.startDate)} max={ymd(exam.endDate)} value={r.date} onChange={(e) => set(i, { date: e.target.value })} /></td>
                  <td><input type="time" className="form-control form-control-sm" aria-label="Start time" disabled={!canEdit || !r.on} value={r.startTime} onChange={(e) => set(i, { startTime: e.target.value })} /></td>
                  <td><input type="time" className="form-control form-control-sm" aria-label="End time" disabled={!canEdit || !r.on} value={r.endTime} onChange={(e) => set(i, { endTime: e.target.value })} /></td>
                  <td style={{ width: 90 }}><input type="number" min="1" className="form-control form-control-sm" aria-label="Maximum marks" disabled={!canEdit || !r.on} value={r.maxMarks} onChange={(e) => set(i, { maxMarks: e.target.value })} /></td>
                  <td style={{ width: 90 }}><input type="number" min="0" className="form-control form-control-sm" aria-label="Pass marks" disabled={!canEdit || !r.on} value={r.passMarks} onChange={(e) => set(i, { passMarks: e.target.value })} /></td>
                </tr>
              ))}
            </tbody></table></div>
            {canEdit && <div className="p-3"><button className="btn btn-primary" disabled={save.pending || rows.some((r) => r.on && !r.date)} onClick={() => save.mutate(rows.filter((r) => r.on).map((r) => ({ subjectId: r.subjectId, date: r.date, startTime: r.startTime || undefined, endTime: r.endTime || undefined, maxMarks: Number(r.maxMarks), passMarks: Number(r.passMarks) }))).then(() => { onSaved(); toast.success('Schedule saved'); }).catch(() => {})}>Save schedule</button></div>}
          </>
        )}
      </QueryState>
    </div>
  );
}

function MarksEntry({ exam }) {
  const toast = useToast();
  const progress = useQuery(() => api.get(`/exams/${exam._id}/progress`), [exam._id]);
  const [sel, setSel] = useState({ sectionId: '', paperId: '' });
  const sheet = useQuery(() => api.get(`/exams/${exam._id}/papers/${sel.paperId}/marks`, { sectionId: sel.sectionId }), [sel.paperId, sel.sectionId], { enabled: Boolean(sel.paperId && sel.sectionId) });
  const [vals, setVals] = useState({});
  useEffect(() => setVals(Object.fromEntries((sheet.data?.students || []).map((s) => [s.studentId, { marks: s.marks ?? '', status: s.status || 'present' }]))), [sheet.data]);
  const save = useMutation((entries) => api.put(`/exams/${exam._id}/papers/${sel.paperId}/marks`, { sectionId: sel.sectionId, entries }));
  const section = progress.data?.sections.find((s) => s.sectionId === sel.sectionId);
  const max = sheet.data?.paper.maxMarks;
  const invalid = (v) => v.status === 'present' && v.marks !== '' && (Number.isNaN(Number(v.marks)) || Number(v.marks) < 0 || Number(v.marks) > max);
  const entries = Object.entries(vals).filter(([, v]) => v.status !== 'present' || v.marks !== '').map(([studentId, v]) => ({ studentId, status: v.status, ...(v.status === 'present' ? { marks: Number(v.marks) } : {}) }));
  return (
    <div className="row g-3">
      <div className="col-lg-4">
        <div className="card table-card">
          <div className="card-header">Progress</div>
          <QueryState query={progress} isEmpty={(x) => !x.sections.length} empty={<EmptyState title="No sections" />}>
            {(x) => x.sections.map((s) => (
              <div key={s.sectionId} className="px-3 py-2 border-bottom">
                <div className="d-flex justify-content-between"><span className="fw-semibold">{s.displayName}</span>{s.complete ? <StatusBadge status="completed" label="Complete" /> : <StatusBadge status="pending" label="In progress" />}</div>
                <div className="d-flex flex-wrap gap-1 mt-1">{s.papers.map((p) => <button key={p.paperId} type="button" className={`btn btn-sm ${sel.paperId === p.paperId && sel.sectionId === s.sectionId ? 'btn-primary' : p.entered >= p.total ? 'btn-outline-success' : 'btn-outline-secondary'}`} onClick={() => setSel({ sectionId: s.sectionId, paperId: p.paperId })}>{p.subject?.code} {p.entered}/{p.total}</button>)}</div>
              </div>
            ))}
          </QueryState>
        </div>
      </div>
      <div className="col-lg-8">
        {!sel.paperId ? <div className="card"><EmptyState icon="pencil-square" title="Choose a section and subject" message="You can enter marks for subjects you teach." /></div> : (
          <QueryState query={sheet}>
            {(s) => (
              <div className="card">
                <div className="card-header d-flex justify-content-between">{section?.displayName} · {s.paper.subject?.name}<span className="small fw-normal">Max {s.paper.maxMarks} · Pass {s.paper.passMarks}</span></div>
                {!s.canEdit && <div className="alert alert-warning rounded-0 border-0 border-bottom mb-0">{{ MARKS_LOCKED: 'Marks entry is locked.', EXAM_PUBLISHED: 'Results are published.', NOT_SUBJECT_TEACHER: 'You can view but only the subject teacher can enter these marks.' }[s.lockedReason] || 'Read only.'}</div>}
                <FormError error={save.error} />
                <div className="table-responsive"><table className="table"><thead><tr><th>Roll</th><th>Student</th><th style={{ width: 140 }}>Attendance</th><th style={{ width: 120 }}>Marks</th></tr></thead><tbody>
                  {s.students.filter((x) => x.inSection).map((st) => {
                    const v = vals[st.studentId] || { marks: '', status: 'present' };
                    return (
                      <tr key={st.studentId}>
                        <td>{st.rollNo ?? '—'}</td><td>{st.name}</td>
                        <td><select className="form-select form-select-sm" aria-label={`Status for ${st.name}`} disabled={!s.canEdit} value={v.status} onChange={(e) => setVals({ ...vals, [st.studentId]: { status: e.target.value, marks: e.target.value === 'present' ? v.marks : '' } })}><option value="present">Present</option><option value="absent">Absent</option><option value="exempt">Exempt</option></select></td>
                        <td><input className={`form-control form-control-sm text-end ${invalid(v) ? 'is-invalid' : ''}`} inputMode="decimal" aria-label={`Marks for ${st.name}`} disabled={!s.canEdit || v.status !== 'present'} value={v.marks} onChange={(e) => setVals({ ...vals, [st.studentId]: { ...v, marks: e.target.value } })} /></td>
                      </tr>
                    );
                  })}
                </tbody></table></div>
                {s.canEdit && <div className="d-flex justify-content-between align-items-center p-3"><span className="small text-muted">{entries.length} of {s.total} entered</span><button className="btn btn-primary" disabled={save.pending || !entries.length || Object.values(vals).some(invalid)} onClick={() => save.mutate(entries).then((r) => { sheet.setData(r); progress.reload(); toast.success('Marks saved'); }).catch(() => {})}>Save marks</button></div>}
              </div>
            )}
          </QueryState>
        )}
      </div>
    </div>
  );
}

function Results({ exam }) {
  const auth = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const progress = useQuery(() => api.get(`/exams/${exam._id}/progress`), [exam._id]);
  const [sectionId, setSectionId] = useState('');
  const q = useQuery(() => api.get(`/exams/${exam._id}/results`, { sectionId }), [sectionId, exam.status], { enabled: Boolean(sectionId) });
  const [remarks, setRemarks] = useState({});
  const saveRemarks = useMutation((entries) => api.put(`/exams/${exam._id}/remarks`, { sectionId, entries }));
  useEffect(() => setRemarks(Object.fromEntries((q.data?.results || []).map((r) => [r.studentId, r.remark || '']))), [q.data]);
  return (
    <div className="card table-card">
      <div className="card-header d-flex flex-wrap gap-2 align-items-center">
        <select className="form-select form-select-sm" style={{ maxWidth: 220 }} aria-label="Section" value={sectionId} onChange={(e) => setSectionId(e.target.value)}><option value="">Choose section…</option>{progress.data?.sections.map((s) => <option key={s.sectionId} value={s.sectionId}>{s.displayName}</option>)}</select>
        {q.data && <span className="small">{q.data.preview ? <StatusBadge status="draft" label="Preview (not published)" /> : <StatusBadge status="published" />} · Pass {q.data.summary.pass} · Fail {q.data.summary.fail}{q.data.summary.incomplete ? ` · Incomplete ${q.data.summary.incomplete}` : ''} · Average {pct(q.data.summary.average)}</span>}
      </div>
      {!sectionId ? <EmptyState icon="trophy" title="Choose a section" /> : (
        <QueryState query={q}>
          {(r) => (
            <>
              <DataTable keyField="studentId" rows={r.results} columns={[
                { key: 'rank', label: 'Rank', render: (x) => x.rankInSection ?? '—' },
                { key: 'name', label: 'Student', render: (x) => <button type="button" className="btn btn-link p-0" onClick={() => navigate(`/exams/${exam._id}?reportCard=${x.studentId}`)}>{x.student?.name}</button> },
                ...r.results[0]?.subjects.map((s, i) => ({ key: `s${i}`, label: s.code || s.name, className: 'num', render: (x) => { const sub = x.subjects[i]; if (!sub) return '—'; if (sub.status === 'absent') return <span className="text-danger">AB</span>; if (sub.status === 'exempt') return 'EX'; if (sub.status === 'missing') return <span className="text-warning">—</span>; return <span className={sub.passed ? '' : 'text-danger fw-semibold'}>{sub.marks}</span>; } })) || [],
                { key: 'total', label: 'Total', className: 'num', render: (x) => `${x.total}/${x.maxTotal}` },
                { key: 'pct', label: '%', className: 'num', render: (x) => pct(x.percentage) },
                { key: 'grade', label: 'Grade', render: (x) => x.grade || '—' },
                { key: 'result', label: 'Result', render: (x) => <StatusBadge status={x.result} /> },
                { key: 'remark', label: 'Remark', render: (x) => (r.preview && auth.canAny('exams.marks', 'exams.update') ? <input className="form-control form-control-sm" style={{ minWidth: 180 }} aria-label={`Remark for ${x.student?.name}`} value={remarks[x.studentId] ?? ''} onChange={(e) => setRemarks({ ...remarks, [x.studentId]: e.target.value })} /> : x.remark || '—') },
              ]} />
              {r.preview && auth.canAny('exams.marks', 'exams.update') && r.results.length > 0 && (
                <div className="p-3 d-flex gap-2 align-items-center"><button className="btn btn-outline-primary btn-sm" disabled={saveRemarks.pending} onClick={() => saveRemarks.mutate(Object.entries(remarks).map(([studentId, remark]) => ({ studentId, remark }))).then(() => toast.success('Remarks saved')).catch((e) => toast.error(e.message))}>Save remarks</button><span className="small text-muted">Class teachers write report card remarks before publication.</span></div>
              )}
            </>
          )}
        </QueryState>
      )}
    </div>
  );
}

/** Printable report card. Used by staff and (through /portal) by families. */
export function ReportCardView({ card }) {
  return (
    <div className="card receipt mx-auto">
      <div className="card-body p-4">
        <div className="text-center border-bottom pb-3 mb-3">
          <h2 className="h4 mb-0">{card.school?.name}</h2>
          <div className="small text-muted">{card.session?.name} · Report card{card.exam ? `: ${card.exam.name}` : ' (whole year)'}</div>
          {card.preview && <div className="badge text-bg-warning mt-2">Preview: not published</div>}
        </div>
        <div className="row mb-3 small">
          <div className="col-6"><div className="text-muted">Student</div><div className="fw-semibold fs-6">{card.student?.name}</div><div>{card.student?.admissionNo} · {card.student?.classSection}</div></div>
          <div className="col-6 text-end"><div className="text-muted">Attendance</div><div className="fw-semibold">{pct(card.attendance?.percentage)}</div><div>{card.attendance?.present} of {card.attendance?.daysMarked} days</div></div>
        </div>
        <table className="table">
          <thead><tr><th>Subject</th>{card.exam ? <><th className="num">Marks</th><th className="num">Max</th></> : <th className="num">Score</th>}<th>Grade</th></tr></thead>
          <tbody>{card.subjects.map((s) => <tr key={s.subjectId}><td>{s.name}</td>{card.exam ? <><td className="num">{s.status === 'absent' ? 'Absent' : s.status === 'exempt' ? 'Exempt' : s.status === 'missing' ? '—' : s.marks}</td><td className="num">{s.maxMarks}</td></> : <td className="num">{pct(s.percentage)}</td>}<td>{s.grade || '—'}</td></tr>)}</tbody>
        </table>
        <div className="d-flex flex-wrap gap-4 mb-3">
          {card.exam && <span>Total <strong>{card.total} / {card.maxTotal}</strong></span>}
          <span>Percentage <strong>{pct(card.percentage)}</strong></span>
          <span>Grade <strong>{card.grade || '—'}</strong></span>
          {card.rankInSection && <span>Rank in section <strong>{card.rankInSection}</strong></span>}
          {card.result && <StatusBadge status={card.result} />}
        </div>
        {card.exams && <p className="small text-muted">Combined from: {card.exams.map((e) => `${e.name} (${e.weightage}%)`).join(', ')}</p>}
        {card.remark && <p className="mb-3"><strong>Class teacher’s remark:</strong> {card.remark}</p>}
        {card.gradingScale?.length > 0 && <p className="small text-muted mb-0">Grades: {card.gradingScale.map((b) => `${b.grade} ≥ ${b.minPercent}%`).join(' · ')}</p>}
      </div>
    </div>
  );
}

function ReportCard({ examId, studentId }) {
  const q = useQuery(() => api.get(`/exams/${examId}/report-cards/${studentId}`), [examId, studentId]);
  return (
    <>
      <div className="d-flex gap-2 mb-3 no-print"><button className="btn btn-primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />Print</button><Link className="btn btn-outline-secondary" to={`/students/${studentId}`}>Student profile</Link></div>
      <QueryState query={q}>{(c) => <ReportCardView card={c} />}</QueryState>
      {q.error && <ErrorState error={q.error} />}
    </>
  );
}
