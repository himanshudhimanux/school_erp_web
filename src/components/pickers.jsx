import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useDebounced, useQuery } from '../hooks/useApi.js';

/** Academic structure (classes → sections) of a session, cached per session for the page. */
export function useStructure(sessionId) {
  return useQuery(() => api.get('/academics/structure', { sessionId }), [sessionId]);
}

export function SessionSelect({ value, onChange, className = 'form-select', id = 'session', allowEmpty = false }) {
  const q = useQuery(() => api.list('/academics/sessions', { limit: 50 }), []);
  useEffect(() => {
    if (!value && !allowEmpty && q.data?.items?.length) onChange(q.data.items.find((s) => s.isCurrent)?._id || q.data.items[0]._id);
  }, [q.data, value, allowEmpty, onChange]);
  return (
    <select id={id} className={className} value={value || ''} onChange={(e) => onChange(e.target.value)} aria-label="Academic session">
      {allowEmpty && <option value="">Current session</option>}
      {q.data?.items?.map((s) => (
        <option key={s._id} value={s._id}>
          {s.name}
          {s.isCurrent ? ' (current)' : ''}
        </option>
      ))}
    </select>
  );
}

/** Class + section selects driven by /academics/structure. */
export function ClassSectionSelect({ sessionId, classId, sectionId, onChange, allowAll = true, sectionRequired = false }) {
  const s = useStructure(sessionId);
  const classes = s.data?.classes || [];
  const sections = classes.find((c) => c.id === classId)?.sections || [];
  return (
    <>
      <select className="form-select" aria-label="Class" style={{ maxWidth: 180 }} value={classId || ''} onChange={(e) => onChange({ classId: e.target.value, sectionId: '' })}>
        <option value="">{allowAll ? 'All classes' : 'Choose class…'}</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select className="form-select" aria-label="Section" style={{ maxWidth: 160 }} value={sectionId || ''} disabled={!classId} onChange={(e) => onChange({ classId, sectionId: e.target.value })}>
        <option value="">{sectionRequired ? 'Choose section…' : 'All sections'}</option>
        {sections.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
    </>
  );
}

/** Search-as-you-type student picker (name, admission number or parent phone). */
export function StudentPicker({ onSelect, placeholder = 'Search student by name, admission no. or parent phone…', autoFocus }) {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const q = useDebounced(term.trim());
  const res = useQuery(() => api.list('/students', { search: q, limit: 8, status: 'active' }), [q], { enabled: q.length >= 2 });
  const ref = useRef(null);
  useEffect(() => {
    const fn = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);
  return (
    <div className="position-relative" ref={ref}>
      <div className="input-group">
        <span className="input-group-text bg-white">
          <i className="bi bi-search" />
        </span>
        <input className="form-control" placeholder={placeholder} aria-label="Search student" value={term} autoFocus={autoFocus} onChange={(e) => { setTerm(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} />
      </div>
      {open && q.length >= 2 && (
        <div className="list-group position-absolute w-100 shadow-sm mt-1" style={{ zIndex: 20, maxHeight: 320, overflowY: 'auto' }}>
          {res.loading && <div className="list-group-item small text-muted">Searching…</div>}
          {!res.loading && res.data?.items?.length === 0 && <div className="list-group-item small text-muted">No students found</div>}
          {res.data?.items?.map((s) => (
            <button
              key={s._id}
              type="button"
              className="list-group-item list-group-item-action"
              onClick={() => {
                onSelect(s);
                setTerm('');
                setOpen(false);
              }}
            >
              <div className="fw-semibold">{s.fullName}</div>
              <div className="small text-muted">
                {s.admissionNo} · {s.enrollment?.displayName || 'Not enrolled'}
                {s.primaryGuardian && ` · ${s.primaryGuardian.name} (${s.primaryGuardian.phone})`}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Pick one available library book: type to search, click a result. Shows the first available
 * titles before anything is typed. The parent shows the chosen book (and a "Change" link).
 */
export function BookPicker({ onSelect }) {
  const [term, setTerm] = useState('');
  const q = useDebounced(term.trim());
  const res = useQuery(() => api.list('/library/books', { search: q || undefined, available: 'true', status: 'active', limit: 8 }), [q]);
  const items = res.data?.items || [];
  return (
    <div>
      <div className="input-group mb-2">
        <span className="input-group-text bg-white"><i className="bi bi-search" /></span>
        <input className="form-control" placeholder="Search by title, author or ISBN…" aria-label="Search books" value={term} autoFocus onChange={(e) => setTerm(e.target.value)} />
      </div>
      <div className="list-group" style={{ maxHeight: 260, overflowY: 'auto' }}>
        {res.loading && !items.length && <div className="list-group-item small text-muted">Loading books…</div>}
        {res.error && <div className="list-group-item small text-danger">{res.error.message}</div>}
        {!res.loading && !res.error && !items.length && <div className="list-group-item small text-muted">{q ? 'No available books match.' : 'No books are available to issue.'}</div>}
        {items.map((b) => (
          <button key={b._id} type="button" className="list-group-item list-group-item-action" onClick={() => onSelect(b)}>
            <div className="fw-semibold">{b.title}</div>
            <div className="small text-muted">{[b.author, b.isbn && `ISBN ${b.isbn}`].filter(Boolean).join(' · ')}{b.author || b.isbn ? ' · ' : ''}{b.availableCopies} available</div>
          </button>
        ))}
      </div>
    </div>
  );
}
