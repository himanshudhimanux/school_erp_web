import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api/client.js';
import { useMutation, useQuery } from '../hooks/useApi.js';
import { useToast } from '../components/Toast.jsx';
import { PageHeader, StatusBadge, QueryState, EmptyState, DataTable, FormField, FormError, Modal, ConfirmDialog, useDialog } from '../components/ui.jsx';
import { SessionSelect, useStructure } from '../components/pickers.jsx';
import { date, ymd, titleCase, DAY_NAMES } from '../utils/format.js';

/** Generic "list + add/edit modal" card for simple academic records. */
function SimpleCrud({ title, path, listParams, columns, fields, toBody, canCreate, canEdit, emptyText, initial = {} }) {
  const toast = useToast();
  const q = useQuery(() => api.list(path, { limit: 100, ...listParams }), [JSON.stringify(listParams)]);
  const d = useDialog();
  const [form, setForm] = useState({});
  const save = useMutation((b) => (b._id ? api.patch(`${path}/${b._id}`, toBody(b, true)) : api.post(path, toBody(b, false))));
  const del = useMutation((id) => api.del(`${path}/${id}`));
  const fe = save.error?.fieldErrors?.() || {};
  return (
    <div className="card table-card">
      <div className="card-header d-flex justify-content-between align-items-center">{title}{canCreate && <button className="btn btn-sm btn-primary" onClick={() => { save.reset(); setForm({ ...initial }); d.open(); }}><i className="bi bi-plus-lg me-1" />Add</button>}</div>
      <QueryState query={q} isEmpty={(x) => !x.items.length} empty={<EmptyState title={emptyText} />}>
        {(x) => <DataTable rows={x.items} columns={columns} onRowClick={canEdit ? (r) => { save.reset(); setForm(r); d.open(); } : undefined} />}
      </QueryState>
      {d.isOpen && (
        <Modal title={form._id ? `Edit ${title.toLowerCase()}` : `Add ${title.toLowerCase()}`} onClose={d.close} footer={<>
          {form._id && <button className="btn btn-outline-danger me-auto" disabled={del.pending} onClick={() => del.mutate(form._id).then(() => { d.close(); q.reload(); toast.success('Deleted'); }).catch((e) => toast.error(e.message))}>Delete</button>}
          <button className="btn btn-outline-secondary" onClick={d.close}>Cancel</button>
          <button className="btn btn-primary" disabled={save.pending} onClick={() => save.mutate(form).then(() => { d.close(); q.reload(); toast.success('Saved'); }).catch(() => {})}>Save</button>
        </>}>
          <FormError error={save.error} />
          {fields.map((fl) => (
            <FormField key={fl.key} label={fl.label} name={fl.key} required={fl.required} error={fe[fl.key]} hint={fl.hint}>
              {fl.type === 'select' ? (
                <select id={fl.key} className="form-select" value={form[fl.key] ?? ''} onChange={(e) => setForm({ ...form, [fl.key]: e.target.value })}>{fl.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              ) : (
                <input id={fl.key} type={fl.type || 'text'} className={`form-control ${fe[fl.key] ? 'is-invalid' : ''}`} value={fl.type === 'date' ? ymd(form[fl.key]) : form[fl.key] ?? ''} onChange={(e) => setForm({ ...form, [fl.key]: e.target.value })} />
              )}
            </FormField>
          ))}
        </Modal>
      )}
    </div>
  );
}

export function Academics() {
  const auth = useAuth();
  const [tab, setTab] = useState('sections');
  const C = auth.can('academics.create');
  const U = auth.can('academics.update');
  const tabs = [['sections', 'Sections'], ['classes', 'Classes'], ['subjects', 'Subjects'], ['curriculum', 'Subjects & teachers'], ['sessions', 'Academic sessions']];
  return (
    <>
      <PageHeader title="Classes & sections" description="Academic sessions, classes, sections, subjects and teacher assignments" />
      <ul className="nav nav-tabs mb-3">{tabs.map(([k, l]) => <li key={k} className="nav-item"><button className={`nav-link ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button></li>)}</ul>
      {tab === 'sessions' && <SimpleCrud title="Session" path="/academics/sessions" emptyText="No academic sessions" canCreate={C} canEdit={U}
        columns={[{ key: 'name', label: 'Name', render: (r) => <>{r.name} {r.isCurrent && <span className="badge text-bg-primary ms-1">Current</span>}</> }, { key: 'start', label: 'Dates', render: (r) => `${date(r.startDate)} – ${date(r.endDate)}` }, { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> }]}
        fields={[{ key: 'name', label: 'Name', required: true, hint: 'e.g. 2026-27' }, { key: 'startDate', label: 'Start date', type: 'date', required: true }, { key: 'endDate', label: 'End date', type: 'date', required: true }]}
        toBody={(b) => ({ name: b.name, startDate: ymd(b.startDate) || b.startDate, endDate: ymd(b.endDate) || b.endDate })} />}
      {tab === 'classes' && <SimpleCrud title="Class" path="/academics/classes" emptyText="No classes yet" canCreate={C} canEdit={U} initial={{ order: 0 }}
        columns={[{ key: 'order', label: '#' }, { key: 'name', label: 'Name' }, { key: 'code', label: 'Code' }, { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> }]}
        fields={[{ key: 'name', label: 'Name', required: true }, { key: 'code', label: 'Code', required: true }, { key: 'order', label: 'Order (for sorting and promotion)', type: 'number', required: true }, { key: 'status', label: 'Status', type: 'select', options: [['active', 'Active'], ['inactive', 'Inactive']] }]}
        toBody={(b, edit) => ({ name: b.name, code: b.code, order: Number(b.order), ...(edit || b.status ? { status: b.status || 'active' } : {}) })} />}
      {tab === 'subjects' && <SimpleCrud title="Subject" path="/academics/subjects" emptyText="No subjects yet" canCreate={C} canEdit={U} initial={{ type: 'theory' }}
        columns={[{ key: 'name', label: 'Name' }, { key: 'code', label: 'Code' }, { key: 'type', label: 'Type', render: (r) => titleCase(r.type) }, { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> }]}
        fields={[{ key: 'name', label: 'Name', required: true }, { key: 'code', label: 'Code', required: true }, { key: 'type', label: 'Type', type: 'select', options: [['theory', 'Theory'], ['practical', 'Practical'], ['theory_practical', 'Theory + practical'], ['activity', 'Activity']] }]}
        toBody={(b) => ({ name: b.name, code: b.code, type: b.type || 'theory' })} />}
      {tab === 'sections' && <Sections />}
      {tab === 'curriculum' && <Curriculum />}
    </>
  );
}

function Sections() {
  const auth = useAuth();
  const toast = useToast();
  const [sessionId, setSessionId] = useState('');
  const s = useStructure(sessionId);
  const staff = useQuery(() => api.list('/staff', { role: 'teacher', limit: 100, status: 'active' }), [], { enabled: auth.can('staff.read') });
  const campuses = useQuery(() => api.list('/campuses', { limit: 50 }), []);
  const d = useDialog();
  const [form, setForm] = useState({});
  const save = useMutation((b) => (b.id ? api.patch(`/academics/sections/${b.id}`, { name: b.name, capacity: b.capacity ? Number(b.capacity) : null, classTeacherId: b.classTeacherId || null }) : api.post('/academics/sections', { sessionId, classId: b.classId, campusId: b.campusId, name: b.name, capacity: b.capacity ? Number(b.capacity) : undefined, classTeacherId: b.classTeacherId || undefined })));
  return (
    <div className="card">
      <div className="card-header d-flex flex-wrap gap-2 justify-content-between align-items-center">
        <span>Sections</span>
        <div className="d-flex gap-2"><SessionSelect value={sessionId} onChange={setSessionId} className="form-select form-select-sm" />{auth.can('academics.create') && <button className="btn btn-sm btn-primary text-nowrap" onClick={() => { save.reset(); setForm({ name: '', classId: '', campusId: campuses.data?.items[0]?._id || '', capacity: '', classTeacherId: '' }); d.open(); }}>Add section</button>}</div>
      </div>
      <QueryState query={s} isEmpty={(x) => !x.classes.length} empty={<EmptyState icon="diagram-3" title="No classes yet" message="Add classes first." />}>
        {(x) => (
          <div className="table-responsive"><table className="table"><thead><tr><th>Class</th><th>Sections</th><th>Subjects</th></tr></thead><tbody>
            {x.classes.map((c) => <tr key={c.id}><td className="fw-semibold">{c.name}</td><td>{c.sections.length ? c.sections.map((sec) => <button key={sec.id} className="btn btn-sm btn-light border me-1 mb-1" onClick={() => auth.can('academics.update') && (save.reset(), setForm({ id: sec.id, name: sec.name, capacity: sec.capacity ?? '', classTeacherId: sec.classTeacher?.id || '' }), d.open())}>{sec.name}{sec.classTeacher && <span className="text-muted small"> · {sec.classTeacher.name}</span>}</button>) : <span className="text-muted">None</span>}</td><td>{c.subjectCount}</td></tr>)}
          </tbody></table></div>
        )}
      </QueryState>
      {d.isOpen && (
        <Modal title={form.id ? 'Edit section' : 'Add section'} onClose={d.close} footer={<><button className="btn btn-outline-secondary" onClick={d.close}>Cancel</button><button className="btn btn-primary" disabled={save.pending || !form.name || (!form.id && (!form.classId || !form.campusId))} onClick={() => save.mutate(form).then(() => { d.close(); s.reload(); toast.success('Section saved'); }).catch(() => {})}>Save</button></>}>
          <FormError error={save.error} />
          {!form.id && <>
            <FormField label="Class" name="c" required><select id="c" className="form-select" value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}><option value="">Choose…</option>{s.data?.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></FormField>
            {campuses.data?.items.length > 1 && <FormField label="Campus" name="cp" required><select id="cp" className="form-select" value={form.campusId} onChange={(e) => setForm({ ...form, campusId: e.target.value })}>{campuses.data.items.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></FormField>}
          </>}
          <div className="row"><div className="col-6"><FormField label="Section name" name="n" required><input id="n" className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FormField></div><div className="col-6"><FormField label="Capacity" name="cap"><input id="cap" type="number" min="1" className="form-control" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></FormField></div></div>
          <FormField label="Class teacher" name="ct" className="mb-0"><select id="ct" className="form-select" value={form.classTeacherId} onChange={(e) => setForm({ ...form, classTeacherId: e.target.value })}><option value="">None</option>{staff.data?.items.map((t) => <option key={t.id} value={t.id}>{t.user.name}</option>)}</select></FormField>
        </Modal>
      )}
    </div>
  );
}

function Curriculum() {
  const auth = useAuth();
  const toast = useToast();
  const [sessionId, setSessionId] = useState('');
  const [classId, setClassId] = useState('');
  const s = useStructure(sessionId);
  const subjects = useQuery(() => api.list('/academics/subjects', { limit: 100, status: 'active' }), []);
  const cs = useQuery(() => api.get('/academics/class-subjects', { classId, sessionId }), [classId, sessionId], { enabled: Boolean(classId && sessionId) });
  const assignments = useQuery(() => api.list('/academics/teaching-assignments', { sessionId, limit: 100 }), [sessionId, classId], { enabled: Boolean(sessionId && classId) });
  const staff = useQuery(() => api.list('/staff', { limit: 100, status: 'active' }), [], { enabled: auth.can('staff.read') });
  const [picked, setPicked] = useState([]);
  useEffect(() => setPicked(cs.data?.subjects.map((x) => String(x.subjectId)) || []), [cs.data]);
  const save = useMutation(() => api.put('/academics/class-subjects', { sessionId, classId, subjects: picked.map((id, i) => ({ subjectId: id, order: i })) }));
  const assign = useMutation((b) => api.post('/academics/teaching-assignments', b));
  const unassign = useMutation((id) => api.del(`/academics/teaching-assignments/${id}`));
  const sections = s.data?.classes.find((c) => c.id === classId)?.sections || [];
  const [a, setA] = useState({ sectionId: '', subjectId: '', teacherId: '' });
  const canEdit = auth.can('academics.update');
  const classAssignments = (assignments.data?.items || []).filter((x) => sections.some((sec) => sec.id === String(x.sectionId)));
  return (
    <div className="row g-3">
      <div className="col-12 d-flex flex-wrap gap-2"><SessionSelect value={sessionId} onChange={setSessionId} className="form-select" /><select className="form-select" style={{ maxWidth: 220 }} aria-label="Class" value={classId} onChange={(e) => setClassId(e.target.value)}><option value="">Choose class…</option>{s.data?.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      {!classId ? <div className="col-12"><div className="card"><EmptyState icon="book" title="Choose a class" /></div></div> : <>
        <div className="col-lg-5">
          <div className="card">
            <div className="card-header">Subjects taught</div>
            <div className="card-body">
              <FormError error={save.error} />
              {subjects.data?.items.map((sub) => <div className="form-check" key={sub._id}><input id={`s-${sub._id}`} type="checkbox" className="form-check-input" disabled={!canEdit} checked={picked.includes(sub._id)} onChange={(e) => setPicked(e.target.checked ? [...picked, sub._id] : picked.filter((x) => x !== sub._id))} /><label htmlFor={`s-${sub._id}`} className="form-check-label">{sub.name} <span className="text-muted small">{sub.code}</span></label></div>)}
              {canEdit && <button className="btn btn-primary btn-sm mt-3" disabled={save.pending} onClick={() => save.mutate().then((r) => { cs.reload(); assignments.reload(); toast.success(`Subjects saved${r.assignmentsRemoved ? ` · ${r.assignmentsRemoved} teacher assignments removed` : ''}`); }).catch(() => {})}>Save subjects</button>}
            </div>
          </div>
        </div>
        <div className="col-lg-7">
          <div className="card table-card">
            <div className="card-header">Teacher assignments</div>
            {canEdit && auth.can('staff.read') && (
              <div className="d-flex flex-wrap gap-2 p-3 border-bottom">
                <select className="form-select form-select-sm" style={{ maxWidth: 120 }} aria-label="Section" value={a.sectionId} onChange={(e) => setA({ ...a, sectionId: e.target.value })}><option value="">Section…</option>{sections.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                <select className="form-select form-select-sm" style={{ maxWidth: 170 }} aria-label="Subject" value={a.subjectId} onChange={(e) => setA({ ...a, subjectId: e.target.value })}><option value="">Subject…</option>{cs.data?.subjects.map((x) => <option key={x.subjectId} value={x.subjectId}>{x.subject?.name}</option>)}</select>
                <select className="form-select form-select-sm" style={{ maxWidth: 190 }} aria-label="Teacher" value={a.teacherId} onChange={(e) => setA({ ...a, teacherId: e.target.value })}><option value="">Teacher…</option>{staff.data?.items.map((t) => <option key={t.id} value={t.id}>{t.user.name}</option>)}</select>
                <button className="btn btn-sm btn-primary" disabled={!a.sectionId || !a.subjectId || !a.teacherId || assign.pending} onClick={() => assign.mutate(a).then(() => { assignments.reload(); toast.success('Teacher assigned'); }).catch((e) => toast.error(e.message))}>Assign</button>
              </div>
            )}
            <DataTable rows={classAssignments} empty={<EmptyState icon="person-badge" title="No teachers assigned" />} columns={[
              { key: 'section', label: 'Section', render: (r) => r.section?.displayName },
              { key: 'subject', label: 'Subject', render: (r) => r.subject?.name },
              { key: 'teacher', label: 'Teacher', render: (r) => r.teacher?.name },
              canEdit && { key: 'x', label: '', className: 'text-end', render: (r) => <button className="btn btn-sm btn-link text-danger" onClick={() => unassign.mutate(r._id).then(() => { assignments.reload(); toast.success('Assignment removed'); }).catch((e) => toast.error(e.message))}>Remove</button> },
            ].filter(Boolean)} />
          </div>
        </div>
      </>}
    </div>
  );
}

/* ------------------------------ timetable ------------------------------ */

export function Timetable() {
  const auth = useAuth();
  const toast = useToast();
  const [sessionId, setSessionId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const s = useStructure(sessionId);
  const mine = useQuery(() => api.get('/timetable/my'), [], { enabled: auth.roles.includes('teacher') });
  const tt = useQuery(() => api.get(`/timetable/sections/${sectionId}`), [sectionId], { enabled: Boolean(sectionId) });
  const [cells, setCells] = useState({});
  const [editing, setEditing] = useState(false);
  const save = useMutation((entries) => api.put(`/timetable/sections/${sectionId}`, { entries }));
  const cls = s.data?.classes.find((c) => c.sections.some((x) => x.id === sectionId));
  const subjects = useQuery(() => api.get('/academics/class-subjects', { classId: cls?.id, sessionId }), [cls?.id, sessionId], { enabled: Boolean(cls) });
  const teachers = useQuery(() => api.list('/academics/teaching-assignments', { sectionId, limit: 100 }), [sectionId], { enabled: Boolean(sectionId) });
  useEffect(() => setCells(Object.fromEntries((tt.data?.entries || []).map((e) => [`${e.day}:${e.periodNumber}`, e.subject?.id || '']))), [tt.data]);
  const canEdit = auth.can('timetable.update');
  return (
    <>
      <PageHeader title="Timetable" description="Weekly class timetables" />
      {mine.data?.entries?.length > 0 && (
        <div className="card table-card mb-3">
          <div className="card-header">My week</div>
          <DataTable rows={mine.data.entries} columns={[{ key: 'day', label: 'Day', render: (e) => e.dayName }, { key: 'p', label: 'Period', render: (e) => `P${e.periodNumber}${e.period ? ` · ${e.period.startTime}–${e.period.endTime}` : ''}` }, { key: 'sec', label: 'Class', render: (e) => e.section?.displayName }, { key: 'sub', label: 'Subject', render: (e) => e.subject?.name }]} />
        </div>
      )}
      <div className="card">
        <div className="card-header d-flex flex-wrap gap-2 align-items-center">
          <SessionSelect value={sessionId} onChange={setSessionId} className="form-select form-select-sm" />
          <select className="form-select form-select-sm" style={{ maxWidth: 200 }} aria-label="Section" value={sectionId} onChange={(e) => { setSectionId(e.target.value); setEditing(false); }}><option value="">Choose section…</option>{s.data?.classes.flatMap((c) => c.sections.map((x) => <option key={x.id} value={x.id}>{c.name} - {x.name}</option>))}</select>
          {canEdit && tt.data?.schedule && !editing && <button className="btn btn-sm btn-outline-primary ms-auto" onClick={() => setEditing(true)}>Edit timetable</button>}
        </div>
        {!sectionId ? <EmptyState icon="clock" title="Choose a section" /> : (
          <QueryState query={tt}>
            {(t) => !t.schedule ? <EmptyState icon="bell" title="No bell schedule for this session" message="An administrator needs to set up the periods of the school day first." /> : (
              <>
                <FormError error={save.error} />
                <div className="table-responsive"><table className="table table-bordered mb-0"><thead><tr><th>Period</th>{t.schedule.workingDays.map((d) => <th key={d}>{DAY_NAMES[d].slice(0, 3)}</th>)}</tr></thead><tbody>
                  {t.schedule.periods.map((p) => (
                    <tr key={p.number} className={p.isBreak ? 'table-light' : ''}>
                      <td className="text-nowrap"><div className="fw-semibold">{p.label || `P${p.number}`}</div><div className="small text-muted">{p.startTime}–{p.endTime}</div></td>
                      {t.schedule.workingDays.map((d) => {
                        if (p.isBreak) return <td key={d} className="text-muted small">Break</td>;
                        const e = t.entries.find((x) => x.day === d && x.periodNumber === p.number);
                        return <td key={d} style={{ minWidth: 120 }}>{editing ? <select className="form-select form-select-sm" aria-label={`${DAY_NAMES[d]} period ${p.number}`} value={cells[`${d}:${p.number}`] || ''} onChange={(ev) => setCells({ ...cells, [`${d}:${p.number}`]: ev.target.value })}><option value="">—</option>{subjects.data?.subjects.map((x) => <option key={x.subjectId} value={x.subjectId}>{x.subject?.name}</option>)}</select> : e ? <><div className="fw-semibold small">{e.subject?.name}</div><div className="small text-muted">{e.teacher?.name || ''}</div></> : ''}</td>;
                      })}
                    </tr>
                  ))}
                </tbody></table></div>
                {editing && <div className="d-flex gap-2 p-3"><button className="btn btn-primary" disabled={save.pending} onClick={() => {
                  // Keep the teacher of unchanged periods; otherwise use the teacher assigned to that subject in this section.
                  const teacherOf = (day, period, subjectId) => t.entries.find((x) => x.day === day && x.periodNumber === period && x.subject?.id === subjectId)?.teacher?.id || teachers.data?.items.find((a) => String(a.subjectId) === subjectId)?.teacherId;
                  const entries = Object.entries(cells).filter(([, v]) => v).map(([k, v]) => { const [day, periodNumber] = k.split(':').map(Number); return { day, periodNumber, subjectId: v, teacherId: teacherOf(day, periodNumber, v) || undefined }; });
                  save.mutate(entries).then((r) => { tt.setData(r); setEditing(false); toast.success('Timetable saved'); }).catch(() => {});
                }}>Save</button><button className="btn btn-outline-secondary" onClick={() => { setEditing(false); tt.reload(); }}>Cancel</button><span className="small text-muted align-self-center">Each period gets the teacher assigned to that subject in this section. Teacher clashes are checked when you save.</span></div>}
              </>
            )}
          </QueryState>
        )}
      </div>
    </>
  );
}

/* ------------------------------ calendar ------------------------------ */

export function Calendar() {
  const auth = useAuth();
  const toast = useToast();
  const q = useQuery(() => api.get('/calendar'), []);
  const d = useDialog();
  const [form, setForm] = useState({});
  const save = useMutation((b) => api.post('/calendar', b));
  const del = useDialog();
  const delM = useMutation((id) => api.del(`/calendar/${id}`));
  return (
    <>
      <PageHeader title="Academic calendar" description={q.data?.session ? q.data.session.name : ''} actions={auth.can('calendar.create') && <button className="btn btn-primary" onClick={() => { save.reset(); setForm({ title: '', type: 'holiday', startDate: '', endDate: '' }); d.open(); }}><i className="bi bi-plus-lg me-1" />Add event</button>} />
      <div className="card table-card">
        <QueryState query={q} isEmpty={(x) => !x.items.length} empty={<EmptyState icon="calendar-event" title="No events in this session" />}>
          {(x) => <DataTable rows={x.items} columns={[
            { key: 'date', label: 'Date', render: (r) => (ymd(r.startDate) === ymd(r.endDate) ? date(r.startDate) : `${date(r.startDate)} – ${date(r.endDate)}`) },
            { key: 'title', label: 'Event', render: (r) => <span className="fw-semibold">{r.title}</span> },
            { key: 'type', label: 'Type', render: (r) => <StatusBadge status={r.isNonWorking ? 'leave' : 'draft'} label={titleCase(r.type)} /> },
            { key: 'nw', label: 'School closed', render: (r) => (r.isNonWorking ? 'Yes' : 'No') },
            auth.can('calendar.delete') && { key: 'x', label: '', className: 'text-end', render: (r) => <button className="btn btn-sm btn-link text-danger" onClick={() => del.open(r)}>Delete</button> },
          ].filter(Boolean)} />}
        </QueryState>
      </div>
      {d.isOpen && (
        <Modal title="Add event" onClose={d.close} footer={<><button className="btn btn-outline-secondary" onClick={d.close}>Cancel</button><button className="btn btn-primary" disabled={save.pending || !form.title || !form.startDate} onClick={() => save.mutate({ sessionId: q.data.session.id, title: form.title, type: form.type, startDate: form.startDate, endDate: form.endDate || undefined }).then(() => { d.close(); q.reload(); toast.success('Event added'); }).catch(() => {})}>Save</button></>}>
          <FormError error={save.error} />
          <FormField label="Title" name="t" required><input id="t" className="form-control" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></FormField>
          <FormField label="Type" name="ty"><select id="ty" className="form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{['holiday', 'vacation', 'event', 'exam', 'ptm', 'other'].map((x) => <option key={x} value={x}>{x === 'ptm' ? 'Parent-teacher meeting' : titleCase(x)}</option>)}</select></FormField>
          <div className="row"><div className="col-6"><FormField label="Start" name="s" required className="mb-0"><input id="s" type="date" className="form-control" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></FormField></div><div className="col-6"><FormField label="End" name="e" className="mb-0"><input id="e" type="date" className="form-control" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></FormField></div></div>
        </Modal>
      )}
      {del.isOpen && <ConfirmDialog title="Delete event?" message={del.item.title} tone="danger" confirmLabel="Delete" pending={delM.pending} onCancel={del.close} onConfirm={() => delM.mutate(del.item._id).then(() => { del.close(); q.reload(); toast.success('Event deleted'); }).catch((e) => toast.error(e.message))} />}
    </>
  );
}
