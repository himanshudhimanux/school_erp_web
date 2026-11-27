import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api/client.js';
import { useDebounced, useMutation, useQuery } from '../hooks/useApi.js';
import { useToast } from '../components/Toast.jsx';
import { PageHeader, StatCard, StatusBadge, QueryState, EmptyState, ErrorState, DataTable, Pagination, SearchInput, FilterBar, FormField, FormError, Modal, ConfirmDialog, useDialog } from '../components/ui.jsx';
import { StudentPicker, BookPicker } from '../components/pickers.jsx';
import { money, date, dateTime, toMinor, fromMinor, todayYmd, titleCase } from '../utils/format.js';

const Tabs = ({ tabs, tab, setTab }) => (
  <ul className="nav nav-tabs mb-3">{tabs.map(([k, l]) => <li key={k} className="nav-item"><button type="button" className={`nav-link ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button></li>)}</ul>
);

/* ================================ LIBRARY ================================ */

export function Library() {
  const auth = useAuth();
  const [tab, setTab] = useState('loans');
  const summary = useQuery(() => api.get('/library/summary'), [tab]);
  const s = summary.data;
  return (
    <>
      <PageHeader title="Library" description="Books, loans, returns and fines" />
      <div className="row g-3 mb-3">
        <div className="col-6 col-lg-3"><StatCard label="Titles" value={s?.titles ?? '—'} hint={s && `${s.copies} copies`} icon="book" loading={summary.loading} /></div>
        <div className="col-6 col-lg-3"><StatCard label="On loan" value={s?.onLoan ?? '—'} hint={s && `${s.available} available`} icon="journal-arrow-up" tone="info" loading={summary.loading} /></div>
        <div className="col-6 col-lg-3"><StatCard label="Overdue" value={s?.overdue ?? '—'} icon="alarm" tone="danger" loading={summary.loading} /></div>
        <div className="col-6 col-lg-3"><StatCard label="Pending fines" value={money(s?.pendingFines.amount, auth.currency)} hint={s && `${s.pendingFines.count} loans`} icon="cash" tone="warning" loading={summary.loading} /></div>
      </div>
      <Tabs tabs={[['loans', 'Loans'], ['books', 'Books'], auth.can('library.update') && ['settings', 'Settings']].filter(Boolean)} tab={tab} setTab={setTab} />
      {tab === 'loans' && <Loans onChange={summary.reload} />}
      {tab === 'books' && <Books />}
      {tab === 'settings' && <LibrarySettings />}
    </>
  );
}

function Loans({ onChange }) {
  const auth = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ status: 'issued', page: 1 });
  const q = useQuery(() => api.list('/library/issues', { ...f, limit: 25 }), [JSON.stringify(f)]);
  const issue = useDialog();
  const [form, setForm] = useState({ book: null, student: null, staff: '', mode: 'student' });
  const staff = useQuery(() => api.list('/staff', { limit: 100, status: 'active' }), [], { enabled: issue.isOpen && form.mode === 'staff' && auth.can('staff.read') });
  const issueM = useMutation((b) => api.post('/library/issues', b));
  const act = useMutation(({ path, body }) => api.post(path, body));
  const [confirm, setConfirm] = useState(null);
  const done = (msg) => { q.reload(); onChange(); toast.success(msg); };
  const run = (path, body, msg) => act.mutate({ path, body }).then(() => { setConfirm(null); done(msg); }).catch((e) => toast.error(e.message));
  return (
    <div className="card table-card">
      <FilterBar>
        <div className="btn-group btn-group-sm">{[['issued', 'On loan'], ['overdue', 'Overdue'], ['returned', 'Returned'], ['lost', 'Lost']].map(([k, l]) => <button key={k} type="button" className={`btn ${f.status === k ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setF({ status: k, page: 1 })}>{l}</button>)}</div>
        <select className="form-select form-select-sm" style={{ maxWidth: 180 }} aria-label="Fine status" value={f.fineStatus || ''} onChange={(e) => setF({ ...f, fineStatus: e.target.value, page: 1 })}><option value="">Any fine</option><option value="pending">Fine pending</option><option value="charged">Added to fees</option><option value="waived">Waived</option></select>
        {auth.can('library.issue') && <button type="button" className="btn btn-primary btn-sm ms-auto" onClick={() => { issueM.reset(); setForm({ book: null, student: null, staff: '', mode: 'student' }); issue.open(); }}><i className="bi bi-journal-arrow-up me-1" />Issue book</button>}
      </FilterBar>
      {q.error ? <ErrorState error={q.error} onRetry={q.reload} /> : (
        <DataTable loading={q.loading} rows={q.data?.items} empty={<EmptyState icon="book" title="No loans" />} columns={[
          { key: 'book', label: 'Book', render: (r) => <><div className="fw-semibold">{r.book?.title}</div><div className="small text-muted">{r.book?.author}</div></> },
          { key: 'borrower', label: 'Borrower', render: (r) => <>{r.borrower?.name}<div className="small text-muted">{r.borrower?.type === 'student' ? r.borrower.admissionNo : 'Staff'}</div></> },
          { key: 'dates', label: 'Issued / due', render: (r) => <>{date(r.issuedAt)}<div className={`small ${r.overdueDays ? 'text-danger' : 'text-muted'}`}>Due {date(r.dueDate)}{r.overdueDays ? ` · ${r.overdueDays} days late` : ''}</div></> },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.displayStatus} /> },
          { key: 'fine', label: 'Fine', className: 'num', render: (r) => (r.fine ? <>{money(r.fine, auth.currency)}<div className="small"><StatusBadge status={r.fineStatus === 'charged' ? 'completed' : r.fineStatus} label={r.fineStatus === 'charged' ? 'Added to fees' : undefined} /></div></> : '—') },
          { key: 'act', label: '', className: 'text-end text-nowrap', render: (r) => <>
            {r.status === 'issued' && auth.can('library.issue') && <><button className="btn btn-sm btn-outline-success me-1" onClick={() => act.mutate({ path: `/library/issues/${r._id}/return`, body: {} }).then((x) => { q.reload(); onChange(); if (x?.fine) toast.warning(`Book returned ${r.overdueDays} day${r.overdueDays === 1 ? '' : 's'} late. Fine of ${money(x.fine, auth.currency)} recorded — add it to fees or waive it from the Fine column.`); else toast.success('Book returned'); }).catch((e) => toast.error(e.message))}>Return</button><button className="btn btn-sm btn-link text-danger" onClick={() => setConfirm({ kind: 'lost', r, charge: '' })}>Lost</button></>}
            {r.fineStatus === 'pending' && auth.can('library.update') && <>{r.borrower?.type === 'student' && <button className="btn btn-sm btn-outline-primary me-1" onClick={() => run(`/library/issues/${r._id}/charge-fine`, undefined, 'Fine added to the student’s fees')}>Add to fees</button>}<button className="btn btn-sm btn-link" onClick={() => setConfirm({ kind: 'waive', r, reason: '' })}>Waive</button></>}
          </> },
        ]} />
      )}
      <Pagination meta={q.data?.meta} onPage={(p) => setF({ ...f, page: p })} />
      {issue.isOpen && (
        <Modal title="Issue a book" onClose={issue.close} footer={<><button className="btn btn-outline-secondary" onClick={issue.close}>Cancel</button><button className="btn btn-primary" disabled={issueM.pending || !form.book || (form.mode === 'student' ? !form.student : !form.staff)} onClick={() => issueM.mutate({ bookId: form.book._id, ...(form.mode === 'student' ? { studentId: form.student._id } : { membershipId: form.staff }) }).then((r) => { issue.close(); done(`Issued. Due ${date(r.dueDate)}`); }).catch(() => {})}>Issue</button></>}>
          <FormError error={issueM.error} />
          <FormField label="Book" required>
            {form.book
              ? <div className="d-flex justify-content-between align-items-start border rounded p-2 bg-light"><div><div className="fw-semibold"><i className="bi bi-check-circle-fill text-success me-1" />{form.book.title}</div><div className="small text-muted">{form.book.author ? `${form.book.author} · ` : ''}{form.book.availableCopies} available</div></div><button type="button" className="btn btn-link btn-sm p-0" onClick={() => setForm({ ...form, book: null })}>Change</button></div>
              : <BookPicker onSelect={(b) => setForm({ ...form, book: b })} />}
          </FormField>
          <div className="btn-group btn-group-sm mb-2">{['student', 'staff'].map((m) => <button key={m} type="button" className={`btn ${form.mode === m ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setForm({ ...form, mode: m })}>{titleCase(m)}</button>)}</div>
          {form.mode === 'student'
            ? form.student ? <div className="d-flex justify-content-between"><strong>{form.student.fullName}</strong><button className="btn btn-link btn-sm p-0" onClick={() => setForm({ ...form, student: null })}>Change</button></div> : <StudentPicker onSelect={(s) => setForm({ ...form, student: s })} />
            : <select className="form-select" aria-label="Staff member" value={form.staff} onChange={(e) => setForm({ ...form, staff: e.target.value })}><option value="">Choose staff…</option>{staff.data?.items.map((m) => <option key={m.id} value={m.id}>{m.user.name}</option>)}</select>}
        </Modal>
      )}
      {confirm?.kind === 'lost' && (
        <ConfirmDialog title="Mark book as lost?" tone="danger" confirmLabel="Mark lost" pending={act.pending} onCancel={() => setConfirm(null)} onConfirm={() => run(`/library/issues/${confirm.r._id}/lost`, confirm.charge ? { charge: toMinor(confirm.charge) || 0 } : {}, 'Marked as lost')}>
          <p>The copy is removed from the collection.</p>
          <FormField label="Replacement charge (optional)" name="lc" className="mb-0"><input id="lc" className="form-control" inputMode="decimal" value={confirm.charge} onChange={(e) => setConfirm({ ...confirm, charge: e.target.value })} /></FormField>
        </ConfirmDialog>
      )}
      {confirm?.kind === 'waive' && (
        <ConfirmDialog title="Waive fine?" confirmLabel="Waive" pending={act.pending} onCancel={() => setConfirm(null)} onConfirm={() => confirm.reason.length >= 3 && run(`/library/issues/${confirm.r._id}/waive-fine`, { reason: confirm.reason }, 'Fine waived')}>
          <FormField label="Reason" name="wr" required className="mb-0"><input id="wr" className="form-control" value={confirm.reason} onChange={(e) => setConfirm({ ...confirm, reason: e.target.value })} /></FormField>
        </ConfirmDialog>
      )}
    </div>
  );
}

function Books() {
  const auth = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const s = useDebounced(search);
  const q = useQuery(() => api.list('/library/books', { search: s, page, limit: 25 }), [s, page]);
  const d = useDialog();
  const [f, setF] = useState({});
  const save = useMutation((b) => {
    const body = { title: b.title, author: b.author || undefined, isbn: b.isbn || undefined, category: b.category || undefined, shelf: b.shelf || undefined, copies: Number(b.copies) };
    return b._id ? api.patch(`/library/books/${b._id}`, body) : api.post('/library/books', body);
  });
  return (
    <div className="card table-card">
      <FilterBar>
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Title, author or ISBN" />
        {auth.can('library.create') && <button className="btn btn-primary btn-sm ms-auto" onClick={() => { save.reset(); setF({ title: '', author: '', isbn: '', category: '', shelf: '', copies: 1 }); d.open(); }}><i className="bi bi-plus-lg me-1" />Add book</button>}
      </FilterBar>
      {q.error ? <ErrorState error={q.error} onRetry={q.reload} /> : (
        <DataTable loading={q.loading} rows={q.data?.items} onRowClick={auth.can('library.update') ? (r) => { save.reset(); setF({ ...r, copies: r.totalCopies }); d.open(); } : undefined} empty={<EmptyState icon="book" title="No books yet" />} columns={[
          { key: 'title', label: 'Title', render: (r) => <><div className="fw-semibold">{r.title}</div><div className="small text-muted">{r.author}</div></> },
          { key: 'category', label: 'Category', render: (r) => r.category || '—' },
          { key: 'isbn', label: 'ISBN', render: (r) => r.isbn || '—' },
          { key: 'shelf', label: 'Shelf', render: (r) => r.shelf || '—' },
          { key: 'copies', label: 'Available', className: 'num', render: (r) => <span className={r.availableCopies ? '' : 'text-danger'}>{r.availableCopies} / {r.totalCopies}</span> },
        ]} />
      )}
      <Pagination meta={q.data?.meta} onPage={setPage} />
      {d.isOpen && (
        <Modal title={f._id ? 'Edit book' : 'Add book'} onClose={d.close} footer={<><button className="btn btn-outline-secondary" onClick={d.close}>Cancel</button><button className="btn btn-primary" disabled={save.pending || !f.title || f.copies === ''} onClick={() => save.mutate(f).then(() => { d.close(); q.reload(); toast.success('Book saved'); }).catch(() => {})}>Save</button></>}>
          <FormError error={save.error} />
          <FormField label="Title" name="bt" required><input id="bt" className="form-control" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></FormField>
          <div className="row"><div className="col-7"><FormField label="Author" name="ba"><input id="ba" className="form-control" value={f.author || ''} onChange={(e) => setF({ ...f, author: e.target.value })} /></FormField></div><div className="col-5"><FormField label="ISBN" name="bi"><input id="bi" className="form-control" value={f.isbn || ''} onChange={(e) => setF({ ...f, isbn: e.target.value })} /></FormField></div></div>
          <div className="row"><div className="col-5"><FormField label="Category" name="bc"><input id="bc" className="form-control" list="book-cats" value={f.category || ''} onChange={(e) => setF({ ...f, category: e.target.value })} /><datalist id="book-cats">{q.data?.meta?.categories?.map((c) => <option key={c} value={c} />)}</datalist></FormField></div><div className="col-4"><FormField label="Shelf" name="bs"><input id="bs" className="form-control" value={f.shelf || ''} onChange={(e) => setF({ ...f, shelf: e.target.value })} /></FormField></div><div className="col-3"><FormField label="Copies" name="bn" required><input id="bn" type="number" min="0" className="form-control" value={f.copies} onChange={(e) => setF({ ...f, copies: e.target.value })} /></FormField></div></div>
        </Modal>
      )}
    </div>
  );
}

function LibrarySettings() {
  const toast = useToast();
  const q = useQuery(() => api.get('/library/settings'), []);
  const cats = useQuery(() => api.list('/fees/categories', { status: 'active', limit: 100 }), []);
  const [f, setF] = useState(null);
  const save = useMutation((b) => api.patch('/library/settings', b));
  const v = f || (q.data && { ...q.data, fine: fromMinor(q.data.finePerDay), cap: fromMinor(q.data.maxFine) });
  const capInvalid = Boolean(v && String(v.cap ?? '').trim() && !toMinor(v.cap));
  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <div className="card-body">
        <QueryState query={q}>{() => v && (
          <>
            <FormError error={save.error} />
            <div className="row">
              <div className="col-6"><FormField label="Loan period (days)" name="ld"><input id="ld" type="number" min="1" className="form-control" value={v.loanDays} onChange={(e) => setF({ ...v, loanDays: e.target.value })} /></FormField></div>
              <div className="col-6"><FormField label="Fine per late day" name="fd"><input id="fd" className="form-control" inputMode="decimal" value={v.fine} onChange={(e) => setF({ ...v, fine: e.target.value })} /></FormField></div>
              <div className="col-6"><FormField label="Maximum fine per loan" name="mx" hint="Leave empty for no cap" error={capInvalid ? 'Enter an amount, or leave empty' : undefined}><input id="mx" className={`form-control${capInvalid ? ' is-invalid' : ''}`} inputMode="decimal" placeholder="No cap" value={v.cap} onChange={(e) => setF({ ...v, cap: e.target.value })} /></FormField></div>
              <div className="col-6" />
              <div className="col-6"><FormField label="Books per student" name="ms"><input id="ms" type="number" min="1" className="form-control" value={v.maxBooksStudent} onChange={(e) => setF({ ...v, maxBooksStudent: e.target.value })} /></FormField></div>
              <div className="col-6"><FormField label="Books per staff member" name="mf"><input id="mf" type="number" min="1" className="form-control" value={v.maxBooksStaff} onChange={(e) => setF({ ...v, maxBooksStaff: e.target.value })} /></FormField></div>
            </div>
            <FormField label="Fee category for library fines" name="fc" hint="Needed to add student fines to their fees">
              {cats.error ? <div className="small text-muted">Fees module not available.</div> : <select id="fc" className="form-select" value={v.fineCategoryId || ''} onChange={(e) => setF({ ...v, fineCategoryId: e.target.value || null })}><option value="">Not set</option>{cats.data?.items.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select>}
            </FormField>
            <button className="btn btn-primary" disabled={save.pending || !f || capInvalid} onClick={() => save.mutate({ loanDays: Number(v.loanDays), finePerDay: toMinor(v.fine) ?? 0, maxFine: String(v.cap ?? '').trim() ? toMinor(v.cap) : null, maxBooksStudent: Number(v.maxBooksStudent), maxBooksStaff: Number(v.maxBooksStaff), fineCategoryId: v.fineCategoryId || null }).then((r) => { q.setData(r); setF(null); toast.success('Library settings saved'); }).catch(() => {})}>Save</button>
          </>
        )}</QueryState>
      </div>
    </div>
  );
}

/* ================================ INVENTORY ================================ */

export function Inventory() {
  const auth = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('items');
  const [f, setF] = useState({ lowStock: '', page: 1 });
  const [search, setSearch] = useState('');
  const s = useDebounced(search);
  const q = useQuery(() => api.list('/inventory/items', { ...f, search: s, limit: 25 }), [JSON.stringify(f), s]);
  const moves = useQuery(() => api.list('/inventory/movements', { limit: 50 }), [tab], { enabled: tab === 'history' });
  const add = useDialog();
  const [item, setItem] = useState({});
  const save = useMutation((b) => api.post('/inventory/items', { name: b.name, code: b.code, category: b.category || undefined, unit: b.unit || undefined, reorderLevel: Number(b.reorderLevel) || 0, location: b.location || undefined, openingQuantity: Number(b.openingQuantity) || 0 }));
  const move = useDialog();
  const [m, setM] = useState({});
  const moveM = useMutation(({ id, body }) => api.post(`/inventory/items/${id}/movements`, body));
  return (
    <>
      <PageHeader title="Inventory" description="Stock in the store room, what goes out, and what needs reordering" actions={auth.can('inventory.create') && <button className="btn btn-primary" onClick={() => { save.reset(); setItem({ name: '', code: '', unit: 'pcs', reorderLevel: 0, openingQuantity: 0 }); add.open(); }}><i className="bi bi-plus-lg me-1" />Add item</button>} />
      <Tabs tabs={[['items', 'Items'], ['history', 'Stock history']]} tab={tab} setTab={setTab} />
      {tab === 'items' ? (
        <div className="card table-card">
          <FilterBar>
            <SearchInput value={search} onChange={setSearch} placeholder="Name, code or location" />
            <button type="button" className={`btn btn-sm ${f.lowStock ? 'btn-warning' : 'btn-outline-warning'}`} onClick={() => setF({ lowStock: f.lowStock ? '' : 'true', page: 1 })}>Low stock {q.data?.meta?.lowStockCount ? `(${q.data.meta.lowStockCount})` : ''}</button>
          </FilterBar>
          {q.error ? <ErrorState error={q.error} onRetry={q.reload} /> : (
            <DataTable loading={q.loading} rows={q.data?.items} empty={<EmptyState icon="box-seam" title="No items" />} columns={[
              { key: 'name', label: 'Item', render: (r) => <><div className="fw-semibold">{r.name}</div><div className="small text-muted">{r.code}{r.location ? ` · ${r.location}` : ''}</div></> },
              { key: 'category', label: 'Category', render: (r) => r.category || '—' },
              { key: 'qty', label: 'In stock', className: 'num', render: (r) => <span className={r.lowStock ? 'text-danger fw-semibold' : ''}>{r.quantity} {r.unit}</span> },
              { key: 'reorder', label: 'Reorder at', className: 'num', render: (r) => r.reorderLevel },
              { key: 'st', label: '', render: (r) => r.lowStock && <StatusBadge status="pending" label="Reorder" /> },
              auth.can('inventory.update') && { key: 'act', label: '', className: 'text-end', render: (r) => <button className="btn btn-sm btn-outline-primary" onClick={() => { moveM.reset(); setM({ item: r, type: 'out', quantity: '', countedQuantity: r.quantity, issuedTo: '', reference: '', note: '', unitCost: '' }); move.open(); }}>Stock in / out</button> },
            ].filter(Boolean)} />
          )}
          <Pagination meta={q.data?.meta} onPage={(p) => setF({ ...f, page: p })} />
        </div>
      ) : (
        <div className="card table-card">
          <QueryState query={moves} isEmpty={(x) => !x.items.length} empty={<EmptyState icon="clock-history" title="No stock movements yet" />}>
            {(x) => <DataTable rows={x.items} columns={[
              { key: 'when', label: 'When', render: (r) => dateTime(r.createdAt) },
              { key: 'item', label: 'Item', render: (r) => r.item?.name },
              { key: 'type', label: 'Type', render: (r) => <StatusBadge status={r.type === 'in' ? 'active' : r.type === 'out' ? 'pending' : 'draft'} label={r.type === 'in' ? 'Received' : r.type === 'out' ? 'Issued' : 'Adjusted'} /> },
              { key: 'change', label: 'Change', className: 'num', render: (r) => (r.change > 0 ? `+${r.change}` : r.change) },
              { key: 'bal', label: 'Balance', className: 'num', render: (r) => r.balanceAfter },
              { key: 'to', label: 'To / reference', render: (r) => [r.issuedTo, r.reference, r.note].filter(Boolean).join(' · ') || '—' },
              { key: 'by', label: 'By', render: (r) => r.by || '—' },
            ]} />}
          </QueryState>
        </div>
      )}
      {add.isOpen && (
        <Modal title="Add item" onClose={add.close} footer={<><button className="btn btn-outline-secondary" onClick={add.close}>Cancel</button><button className="btn btn-primary" disabled={save.pending || !item.name || !item.code} onClick={() => save.mutate(item).then(() => { add.close(); q.reload(); toast.success('Item added'); }).catch(() => {})}>Save</button></>}>
          <FormError error={save.error} />
          <div className="row g-2">
            <div className="col-8"><FormField label="Name" name="in" required><input id="in" className="form-control" value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} /></FormField></div>
            <div className="col-4"><FormField label="Code" name="ic" required><input id="ic" className="form-control text-uppercase" value={item.code} onChange={(e) => setItem({ ...item, code: e.target.value })} /></FormField></div>
            <div className="col-6"><FormField label="Category" name="ica"><input id="ica" className="form-control" list="inv-cats" value={item.category || ''} onChange={(e) => setItem({ ...item, category: e.target.value })} /><datalist id="inv-cats">{q.data?.meta?.categories?.map((c) => <option key={c} value={c} />)}</datalist></FormField></div>
            <div className="col-3"><FormField label="Unit" name="iu"><input id="iu" className="form-control" value={item.unit} onChange={(e) => setItem({ ...item, unit: e.target.value })} /></FormField></div>
            <div className="col-3"><FormField label="Reorder at" name="ir"><input id="ir" type="number" min="0" className="form-control" value={item.reorderLevel} onChange={(e) => setItem({ ...item, reorderLevel: e.target.value })} /></FormField></div>
            <div className="col-6"><FormField label="Location" name="il" className="mb-0"><input id="il" className="form-control" value={item.location || ''} onChange={(e) => setItem({ ...item, location: e.target.value })} /></FormField></div>
            <div className="col-6"><FormField label="Opening stock" name="io" className="mb-0"><input id="io" type="number" min="0" className="form-control" value={item.openingQuantity} onChange={(e) => setItem({ ...item, openingQuantity: e.target.value })} /></FormField></div>
          </div>
        </Modal>
      )}
      {move.isOpen && (
        <Modal title={`${m.item.name} · ${m.item.quantity} ${m.item.unit} in stock`} onClose={move.close} footer={<><button className="btn btn-outline-secondary" onClick={move.close}>Cancel</button><button className="btn btn-primary" disabled={moveM.pending} onClick={() => moveM.mutate({ id: m.item._id, body: { type: m.type, ...(m.type === 'adjust' ? { countedQuantity: Number(m.countedQuantity) } : { quantity: Number(m.quantity) }), ...(m.type === 'in' && m.unitCost ? { unitCost: toMinor(m.unitCost) } : {}), issuedTo: m.issuedTo || undefined, reference: m.reference || undefined, note: m.note || undefined } }).then((r) => { move.close(); q.reload(); toast.success(`Stock now ${r.item.quantity} ${r.item.unit}`); }).catch(() => {})}>Save</button></>}>
          <FormError error={moveM.error} />
          <div className="btn-group btn-group-sm mb-3">{[['in', 'Receive'], ['out', 'Issue'], ['adjust', 'Count / adjust']].map(([k, l]) => <button key={k} type="button" className={`btn ${m.type === k ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setM({ ...m, type: k })}>{l}</button>)}</div>
          {m.type === 'adjust'
            ? <FormField label="Counted quantity" name="mc" required><input id="mc" type="number" min="0" className="form-control" value={m.countedQuantity} onChange={(e) => setM({ ...m, countedQuantity: e.target.value })} /></FormField>
            : <FormField label="Quantity" name="mq" required><input id="mq" type="number" min="1" className="form-control" value={m.quantity} onChange={(e) => setM({ ...m, quantity: e.target.value })} /></FormField>}
          {m.type === 'out' && <FormField label="Issued to" name="mt"><input id="mt" className="form-control" value={m.issuedTo} onChange={(e) => setM({ ...m, issuedTo: e.target.value })} /></FormField>}
          {m.type === 'in' && <div className="row"><div className="col-6"><FormField label="Unit cost" name="mu"><input id="mu" className="form-control" inputMode="decimal" value={m.unitCost} onChange={(e) => setM({ ...m, unitCost: e.target.value })} /></FormField></div><div className="col-6"><FormField label="Bill / reference" name="mr"><input id="mr" className="form-control" value={m.reference} onChange={(e) => setM({ ...m, reference: e.target.value })} /></FormField></div></div>}
          <FormField label={m.type === 'adjust' ? 'Reason' : 'Note'} name="mn" required={m.type === 'adjust'} className="mb-0"><input id="mn" className="form-control" value={m.note} onChange={(e) => setM({ ...m, note: e.target.value })} /></FormField>
        </Modal>
      )}
    </>
  );
}

/* ================================ HOSTEL ================================ */

export function Hostels() {
  const auth = useAuth();
  const toast = useToast();
  const q = useQuery(() => api.get('/hostels'), []);
  const allocs = useQuery(() => api.list('/hostels/allocations/list', { limit: 100 }), []);
  const staff = useQuery(() => api.list('/staff', { limit: 100, status: 'active' }), [], { enabled: auth.can('staff.read') });
  const [dlg, setDlg] = useState(null);
  const [f, setF] = useState({});
  const act = useMutation(({ method, path, body }) => api[method](path, body));
  const run = (method, path, body, msg) => act.mutate({ method, path, body }).then(() => { setDlg(null); q.reload(); allocs.reload(); toast.success(msg); }).catch(() => {});
  const rooms = (q.data || []).flatMap((h) => h.rooms.filter((r) => r.status === 'active').map((r) => ({ ...r, hostel: h })));
  return (
    <>
      <PageHeader title="Hostel" description="Hostels, rooms and student allocations" actions={<>{auth.can('hostel.update') && <button className="btn btn-primary" onClick={() => { act.reset(); setF({ student: null, roomId: '' }); setDlg('allocate'); }}><i className="bi bi-person-plus me-1" />Allocate room</button>}{auth.can('hostel.create') && <button className="btn btn-outline-primary" onClick={() => { act.reset(); setF({ name: '', type: 'boys', wardenId: '' }); setDlg('hostel'); }}>Add hostel</button>}</>} />
      <QueryState query={q} isEmpty={(x) => !x.length} empty={<div className="card"><EmptyState icon="buildings" title="No hostels yet" /></div>}>
        {(hostels) => (
          <div className="row g-3 mb-3">
            {hostels.map((h) => (
              <div className="col-lg-6" key={h._id}>
                <div className="card h-100">
                  <div className="card-header d-flex justify-content-between align-items-center"><span>{h.name} <span className="text-muted fw-normal small">· {titleCase(h.type)}{h.warden ? ` · Warden ${h.warden.name}` : ''}</span></span><span className="small fw-normal">{h.occupied}/{h.capacity} beds</span></div>
                  <div className="card-body d-flex flex-wrap gap-2">
                    {h.rooms.length === 0 && <span className="text-muted small">No rooms yet.</span>}
                    {h.rooms.map((r) => <span key={r._id} className={`badge border ${r.occupied >= r.capacity ? 'text-bg-light text-danger' : 'text-bg-light'}`} title={r.floor ? `Floor ${r.floor}` : ''}>Room {r.number} · {r.occupied}/{r.capacity}</span>)}
                    {auth.can('hostel.create') && <button className="btn btn-sm btn-link" onClick={() => { act.reset(); setF({ hostelId: h._id, number: '', floor: '', capacity: 2 }); setDlg('room'); }}>+ Add room</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </QueryState>
      <div className="card table-card">
        <div className="card-header">Current residents</div>
        <QueryState query={allocs} isEmpty={(x) => !x.items.length} empty={<EmptyState icon="people" title="No students allocated" />}>
          {(x) => <DataTable rows={x.items} columns={[
            { key: 'student', label: 'Student', render: (r) => <><div className="fw-semibold">{r.student?.name}</div><div className="small text-muted">{r.student?.admissionNo} · {r.student?.classSection || '—'}</div></> },
            { key: 'room', label: 'Room', render: (r) => `${r.hostel?.name} · ${r.room?.number}` },
            { key: 'from', label: 'Since', render: (r) => date(r.fromDate) },
            auth.can('hostel.update') && { key: 'x', label: '', className: 'text-end', render: (r) => <button className="btn btn-sm btn-outline-danger" onClick={() => { act.reset(); setDlg({ vacate: r }); }}>Vacate</button> },
          ].filter(Boolean)} />}
        </QueryState>
      </div>
      {dlg === 'hostel' && (
        <Modal title="Add hostel" onClose={() => setDlg(null)} footer={<><button className="btn btn-outline-secondary" onClick={() => setDlg(null)}>Cancel</button><button className="btn btn-primary" disabled={act.pending || !f.name} onClick={() => run('post', '/hostels', { name: f.name, type: f.type, wardenId: f.wardenId || null }, 'Hostel added')}>Save</button></>}>
          <FormError error={act.error} />
          <FormField label="Name" name="hn" required><input id="hn" className="form-control" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></FormField>
          <FormField label="For" name="ht"><select id="ht" className="form-select" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="boys">Boys</option><option value="girls">Girls</option><option value="mixed">Mixed</option></select></FormField>
          <FormField label="Warden" name="hw" className="mb-0"><select id="hw" className="form-select" value={f.wardenId} onChange={(e) => setF({ ...f, wardenId: e.target.value })}><option value="">None</option>{staff.data?.items.map((s) => <option key={s.id} value={s.id}>{s.user.name}</option>)}</select></FormField>
        </Modal>
      )}
      {dlg === 'room' && (
        <Modal title="Add room" onClose={() => setDlg(null)} footer={<><button className="btn btn-outline-secondary" onClick={() => setDlg(null)}>Cancel</button><button className="btn btn-primary" disabled={act.pending || !f.number} onClick={() => run('post', `/hostels/${f.hostelId}/rooms`, { number: f.number, floor: f.floor || undefined, capacity: Number(f.capacity) }, 'Room added')}>Save</button></>}>
          <FormError error={act.error} />
          <div className="row"><div className="col-4"><FormField label="Room no." name="rn" required><input id="rn" className="form-control" value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} /></FormField></div><div className="col-4"><FormField label="Floor" name="rf"><input id="rf" className="form-control" value={f.floor} onChange={(e) => setF({ ...f, floor: e.target.value })} /></FormField></div><div className="col-4"><FormField label="Beds" name="rc" required><input id="rc" type="number" min="1" className="form-control" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} /></FormField></div></div>
        </Modal>
      )}
      {dlg === 'allocate' && (
        <Modal title="Allocate a room" onClose={() => setDlg(null)} footer={<><button className="btn btn-outline-secondary" onClick={() => setDlg(null)}>Cancel</button><button className="btn btn-primary" disabled={act.pending || !f.student || !f.roomId} onClick={() => run('post', '/hostels/allocations', { studentId: f.student._id, roomId: f.roomId }, 'Room allocated')}>Allocate</button></>}>
          <FormError error={act.error} />
          <FormField label="Student" required>{f.student ? <div className="d-flex justify-content-between"><strong>{f.student.fullName}</strong><button className="btn btn-link btn-sm p-0" onClick={() => setF({ ...f, student: null })}>Change</button></div> : <StudentPicker onSelect={(s) => setF({ ...f, student: s })} />}</FormField>
          <FormField label="Room" name="ar" required className="mb-0"><select id="ar" className="form-select" value={f.roomId} onChange={(e) => setF({ ...f, roomId: e.target.value })}><option value="">Choose…</option>{rooms.map((r) => <option key={r._id} value={r._id} disabled={r.occupied >= r.capacity}>{r.hostel.name} · Room {r.number} ({r.capacity - r.occupied} free){r.hostel.type !== 'mixed' ? ` · ${r.hostel.type}` : ''}</option>)}</select></FormField>
        </Modal>
      )}
      {dlg?.vacate && <ConfirmDialog title="Vacate room?" message={`${dlg.vacate.student?.name} leaves ${dlg.vacate.hostel?.name} room ${dlg.vacate.room?.number}.`} tone="danger" confirmLabel="Vacate" pending={act.pending} onCancel={() => setDlg(null)} onConfirm={() => run('post', `/hostels/allocations/${dlg.vacate._id}/vacate`, {}, 'Room vacated')} />}
    </>
  );
}

/* ================================ HR ================================ */

export function HR() {
  const auth = useAuth();
  const tabs = [auth.can('hr.read') && ['leave', 'Staff leave'], auth.can('hr.payroll') && ['payroll', 'Payroll'], auth.can('hr.payroll') && ['salaries', 'Salaries'], auth.can('hr.update') && ['policy', 'Leave policy']].filter(Boolean);
  const [tab, setTab] = useState(tabs[0]?.[0]);
  return (
    <>
      <PageHeader title="HR & payroll" description="Staff leave, salaries and monthly payroll" />
      <Tabs tabs={tabs} tab={tab} setTab={setTab} />
      {tab === 'leave' && <StaffLeaves />}
      {tab === 'payroll' && <Payroll />}
      {tab === 'salaries' && <Salaries />}
      {tab === 'policy' && <LeavePolicy />}
    </>
  );
}

function StaffLeaves() {
  const auth = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ status: 'pending', page: 1 });
  const q = useQuery(() => api.list('/hr/leaves', { ...f, limit: 25 }), [JSON.stringify(f)]);
  const act = useMutation(({ id, status }) => api.post(`/hr/leaves/${id}/review`, { status }));
  return (
    <div className="card table-card">
      <FilterBar><div className="btn-group btn-group-sm">{['pending', 'approved', 'rejected', ''].map((s) => <button key={s || 'all'} type="button" className={`btn ${f.status === s ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setF({ status: s, page: 1 })}>{s ? titleCase(s) : 'All'}</button>)}</div></FilterBar>
      {q.error ? <ErrorState error={q.error} onRetry={q.reload} /> : (
        <DataTable loading={q.loading} rows={q.data?.items} empty={<EmptyState icon="calendar2-x" title="No leave requests" />} columns={[
          { key: 'staff', label: 'Staff', render: (r) => r.staff?.name },
          { key: 'type', label: 'Type', render: (r) => titleCase(r.type) },
          { key: 'dates', label: 'Dates', render: (r) => `${date(r.fromDate)} – ${date(r.toDate)}` },
          { key: 'days', label: 'Days', className: 'num' },
          { key: 'reason', label: 'Reason' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          auth.can('hr.update') && { key: 'act', label: '', className: 'text-end text-nowrap', render: (r) => r.status === 'pending' && <><button className="btn btn-sm btn-outline-danger me-1" disabled={act.pending} onClick={() => act.mutate({ id: r._id, status: 'rejected' }).then(() => { q.reload(); toast.success('Leave rejected'); }).catch((e) => toast.error(e.message))}>Reject</button><button className="btn btn-sm btn-success" disabled={act.pending} onClick={() => act.mutate({ id: r._id, status: 'approved' }).then(() => { q.reload(); toast.success('Leave approved'); }).catch((e) => toast.error(e.message))}>Approve</button></> },
        ].filter(Boolean)} />
      )}
      <Pagination meta={q.data?.meta} onPage={(p) => setF({ ...f, page: p })} />
    </div>
  );
}

function Salaries() {
  const auth = useAuth();
  const toast = useToast();
  const q = useQuery(() => api.get('/hr/salaries'), []);
  const d = useDialog();
  const [f, setF] = useState({});
  const save = useMutation((b) => api.put(`/hr/salaries/${b.membershipId}`, { basic: toMinor(b.basic) ?? 0, allowances: b.allowances.filter((x) => x.name && toMinor(x.amount) !== null).map((x) => ({ name: x.name, amount: toMinor(x.amount) })), deductions: b.deductions.filter((x) => x.name && toMinor(x.amount) !== null).map((x) => ({ name: x.name, amount: toMinor(x.amount) })), bankAccount: b.bankAccount || undefined }));
  // A render function (not a nested component) so inputs keep focus while typing.
  const lineEditor = (k, label) => (
    <div className="mb-3">
      <div className="form-label">{label}</div>
      {f[k].map((x, i) => (
        <div key={i} className="d-flex gap-2 mb-1">
          <input className="form-control form-control-sm" placeholder="Name" aria-label={`${label} name`} value={x.name} onChange={(e) => setF({ ...f, [k]: f[k].map((y, j) => (j === i ? { ...y, name: e.target.value } : y)) })} />
          <input className="form-control form-control-sm text-end" style={{ maxWidth: 130 }} inputMode="decimal" placeholder="Amount" aria-label={`${label} amount`} value={x.amount} onChange={(e) => setF({ ...f, [k]: f[k].map((y, j) => (j === i ? { ...y, amount: e.target.value } : y)) })} />
          <button type="button" className="btn btn-sm btn-link text-danger" aria-label="Remove" onClick={() => setF({ ...f, [k]: f[k].filter((_, j) => j !== i) })}>×</button>
        </div>
      ))}
      <button type="button" className="btn btn-sm btn-link px-0" onClick={() => setF({ ...f, [k]: [...f[k], { name: '', amount: '' }] })}>+ Add</button>
    </div>
  );
  return (
    <div className="card table-card">
      <QueryState query={q} isEmpty={(x) => !x.length} empty={<EmptyState icon="people" title="No staff" />}>
        {(rows) => <DataTable keyField="membershipId" rows={rows} onRowClick={(r) => { save.reset(); setF({ membershipId: r.membershipId, name: r.name, basic: fromMinor(r.salary?.basic ?? 0), allowances: (r.salary?.allowances || []).map((x) => ({ name: x.name, amount: fromMinor(x.amount) })), deductions: (r.salary?.deductions || []).map((x) => ({ name: x.name, amount: fromMinor(x.amount) })), bankAccount: r.salary?.bankAccount || '' }); d.open(); }} columns={[
          { key: 'name', label: 'Staff', render: (r) => <><div className="fw-semibold">{r.name}</div><div className="small text-muted">{r.profile?.employeeCode || ''} {r.profile?.designation || ''}</div></> },
          { key: 'gross', label: 'Monthly gross', className: 'num', render: (r) => (r.monthlyGross === null ? <span className="text-muted">Not set</span> : money(r.monthlyGross, auth.currency)) },
          { key: 'net', label: 'Net', className: 'num', render: (r) => (r.monthlyNet === null ? '—' : money(r.monthlyNet, auth.currency)) },
        ]} />}
      </QueryState>
      {d.isOpen && (
        <Modal title={`Salary · ${f.name}`} onClose={d.close} footer={<><button className="btn btn-outline-secondary" onClick={d.close}>Cancel</button><button className="btn btn-primary" disabled={save.pending || toMinor(f.basic) === null} onClick={() => save.mutate(f).then(() => { d.close(); q.reload(); toast.success('Salary saved'); }).catch(() => {})}>Save</button></>}>
          <FormError error={save.error} />
          <FormField label="Basic (monthly)" name="sb" required><input id="sb" className="form-control" inputMode="decimal" value={f.basic} onChange={(e) => setF({ ...f, basic: e.target.value })} /></FormField>
          {lineEditor('allowances', 'Allowances')}
          {lineEditor('deductions', 'Deductions')}
          <FormField label="Bank account" name="sk" className="mb-0"><input id="sk" className="form-control" value={f.bankAccount} onChange={(e) => setF({ ...f, bankAccount: e.target.value })} /></FormField>
        </Modal>
      )}
    </div>
  );
}

function Payroll() {
  const auth = useAuth();
  const toast = useToast();
  const runs = useQuery(() => api.get('/hr/payroll'), []);
  const [month, setMonth] = useState(todayYmd().slice(0, 7));
  const [openId, setOpenId] = useState(null);
  const run = useQuery(() => api.get(`/hr/payroll/${openId}`), [openId], { enabled: Boolean(openId) });
  const act = useMutation(({ path, body, method = 'post' }) => api[method](path, body));
  const [pay, setPay] = useState(null);
  const c = auth.currency;
  const doAct = (path, body, msg, after) => act.mutate({ path, body }).then((r) => { runs.reload(); if (r?._id) run.setData(r); after?.(r); toast.success(msg); }).catch((e) => toast.error(e.message));
  return (
    <div className="row g-3">
      <div className="col-lg-4">
        <div className="card table-card">
          <div className="card-header d-flex gap-2 align-items-center"><input type="month" className="form-control form-control-sm" aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value)} /><button className="btn btn-sm btn-primary text-nowrap" disabled={act.pending} onClick={() => doAct('/hr/payroll', { month }, 'Payroll prepared', (r) => setOpenId(r._id))}>Prepare</button></div>
          <QueryState query={runs} isEmpty={(x) => !x.length} empty={<EmptyState icon="cash-coin" title="No payroll yet" />}>
            {(x) => x.map((r) => <button key={r._id} type="button" className={`list-group-item list-group-item-action px-3 py-2 border-bottom w-100 text-start ${openId === r._id ? 'bg-light' : ''}`} onClick={() => setOpenId(r._id)}><div className="d-flex justify-content-between"><strong>{r.month}</strong><StatusBadge status={r.status === 'finalized' ? 'pending' : r.status === 'paid' ? 'paid' : 'draft'} label={titleCase(r.status)} /></div><div className="small text-muted">{r.totals.staff} staff · {money(r.totals.net, c)} net</div></button>)}
          </QueryState>
        </div>
      </div>
      <div className="col-lg-8">
        {!openId ? <div className="card"><EmptyState icon="cash-stack" title="Choose or prepare a payroll month" /></div> : (
          <QueryState query={run}>
            {(r) => (
              <div className="card table-card">
                <div className="card-header d-flex flex-wrap gap-2 justify-content-between align-items-center">
                  <span>Payroll {r.month} · {money(r.totals.net, c)} net</span>
                  <span className="d-flex gap-2">
                    {r.status === 'draft' && <><button className="btn btn-sm btn-outline-secondary" disabled={act.pending} onClick={() => doAct(`/hr/payroll/${r._id}/recalculate`, undefined, 'Recalculated')}>Recalculate</button><button className="btn btn-sm btn-primary" disabled={act.pending || !r.totals.staff} onClick={() => doAct(`/hr/payroll/${r._id}/finalize`, undefined, 'Payroll finalized; staff can now see their payslips')}>Finalize</button></>}
                    {r.status === 'finalized' && <button className="btn btn-sm btn-success" onClick={() => setPay({ method: 'bank_transfer', reference: '' })}>Mark as paid</button>}
                    {r.status === 'paid' && <span className="small text-muted">Paid {date(r.paidAt)} · {titleCase(r.paymentMethod)} · {r.voucherNo}</span>}
                  </span>
                </div>
                <DataTable rows={r.payslips} empty={<EmptyState icon="people" title="No staff with a salary" message="Set salaries first, then recalculate." />} columns={[
                  { key: 'name', label: 'Staff', render: (p) => <><div className="fw-semibold">{p.employee.name}</div><div className="small text-muted">{p.employee.designation || ''}</div></> },
                  { key: 'gross', label: 'Gross', className: 'num', render: (p) => money(p.gross, c) },
                  { key: 'ded', label: 'Deductions', className: 'num', render: (p) => <>{money(p.totalDeductions, c)}{p.unpaidLeaveDays > 0 && <div className="small text-warning">{p.unpaidLeaveDays} unpaid days</div>}</> },
                  { key: 'net', label: 'Net pay', className: 'num', render: (p) => <strong>{money(p.net, c)}</strong> },
                ]} />
                {r.status === 'draft' && <div className="p-3 small text-muted">Draft payslips are not visible to staff. Recalculate after changing salaries or approving unpaid leave.</div>}
              </div>
            )}
          </QueryState>
        )}
      </div>
      {pay && (
        <ConfirmDialog title={`Mark ${run.data?.month} payroll as paid?`} confirmLabel={`Record ${money(run.data?.totals.net, c)} paid`} pending={act.pending} onCancel={() => setPay(null)} onConfirm={() => doAct(`/hr/payroll/${openId}/pay`, { method: pay.method, reference: pay.reference || undefined }, 'Payroll marked as paid', () => setPay(null))}>
          <p className="small text-muted">This records the salary payment in the accounts. It cannot be undone.</p>
          <div className="row"><div className="col-6"><FormField label="Paid by" name="pm" className="mb-0"><select id="pm" className="form-select" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}><option value="bank_transfer">Bank transfer</option><option value="cheque">Cheque</option><option value="cash">Cash</option></select></FormField></div><div className="col-6"><FormField label="Reference" name="pr" className="mb-0"><input id="pr" className="form-control" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></FormField></div></div>
        </ConfirmDialog>
      )}
    </div>
  );
}

function LeavePolicy() {
  const toast = useToast();
  const q = useQuery(() => api.get('/hr/settings'), []);
  const [f, setF] = useState(null);
  const save = useMutation((b) => api.patch('/hr/settings', { leaveQuota: b }));
  const v = f || q.data?.leaveQuota;
  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <div className="card-body">
        <QueryState query={q}>{() => v && (
          <>
            <p className="small text-muted">Days per year (academic session) for each leave type. Unpaid leave has no limit and is deducted in payroll.</p>
            {['casual', 'sick', 'earned', 'other'].map((k) => <FormField key={k} label={titleCase(k)} name={`q-${k}`}><input id={`q-${k}`} type="number" min="0" className="form-control" value={v[k] ?? ''} placeholder="No limit" onChange={(e) => setF({ ...v, [k]: e.target.value })} /></FormField>)}
            <button className="btn btn-primary" disabled={save.pending || !f} onClick={() => save.mutate(Object.fromEntries(Object.entries(v).filter(([, x]) => x !== '' && x !== null && x !== undefined).map(([k, x]) => [k, Number(x)]))).then((r) => { q.setData(r); setF(null); toast.success('Leave policy saved'); }).catch(() => {})}>Save</button>
          </>
        )}</QueryState>
      </div>
    </div>
  );
}

/* ---------------------- every staff member: my leave & payslips ---------------------- */

export function MyHR() {
  const auth = useAuth();
  const toast = useToast();
  const bal = useQuery(() => api.get('/hr/my/leave-balance'), []);
  const leaves = useQuery(() => api.list('/hr/my/leaves', { limit: 20 }), []);
  const slips = useQuery(() => api.get('/hr/my/payslips'), []);
  const apply = useDialog();
  const [f, setF] = useState({ type: 'casual', fromDate: todayYmd(), toDate: todayYmd(), reason: '' });
  const applyM = useMutation((b) => api.post('/hr/my/leaves', b));
  const cancelM = useMutation((id) => api.post(`/hr/my/leaves/${id}/cancel`));
  const view = useDialog();
  const reload = () => { bal.reload(); leaves.reload(); };
  return (
    <>
      <PageHeader title="My leave & payslips" description={auth.user.name} actions={<button className="btn btn-primary" onClick={() => { applyM.reset(); apply.open(); }}><i className="bi bi-calendar-plus me-1" />Apply for leave</button>} />
      <QueryState query={bal}>
        {(b) => <div className="row g-3 mb-3">{b.types.filter((t) => t.quota !== null || t.taken).map((t) => <div className="col-6 col-lg-3" key={t.type}><StatCard label={`${titleCase(t.type)} leave`} value={t.available === null ? `${t.taken} taken` : `${t.available} left`} hint={t.quota !== null ? `of ${t.quota} · ${t.pending} pending` : null} tone={t.available === 0 ? 'danger' : 'primary'} /></div>)}</div>}
      </QueryState>
      <div className="row g-3">
        <div className="col-lg-7">
          <div className="card table-card">
            <div className="card-header">My leave requests</div>
            <QueryState query={leaves} isEmpty={(x) => !x.items.length} empty={<EmptyState icon="calendar2" title="No leave requests" />}>
              {(x) => <DataTable rows={x.items} columns={[
                { key: 'type', label: 'Type', render: (r) => titleCase(r.type) },
                { key: 'dates', label: 'Dates', render: (r) => `${date(r.fromDate)} – ${date(r.toDate)}` },
                { key: 'days', label: 'Days', className: 'num' },
                { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                { key: 'x', label: '', className: 'text-end', render: (r) => ['pending', 'approved'].includes(r.status) && new Date(r.fromDate) > new Date() && <button className="btn btn-sm btn-link text-danger" disabled={cancelM.pending} onClick={() => cancelM.mutate(r._id).then(() => { reload(); toast.success('Leave cancelled'); }).catch((e) => toast.error(e.message))}>Cancel</button> },
              ]} />}
            </QueryState>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="card table-card">
            <div className="card-header">Payslips</div>
            <QueryState query={slips} isEmpty={(x) => !x.length} empty={<EmptyState icon="file-earmark-text" title="No payslips yet" />}>
              {(x) => <DataTable rows={x} onRowClick={view.open} columns={[{ key: 'month', label: 'Month' }, { key: 'net', label: 'Net pay', className: 'num', render: (p) => money(p.net, auth.currency) }, { key: 'status', label: '', render: (p) => <StatusBadge status={p.status === 'paid' ? 'paid' : 'pending'} label={p.status === 'paid' ? 'Paid' : 'Finalized'} /> }]} />}
            </QueryState>
          </div>
        </div>
      </div>
      {apply.isOpen && (
        <Modal title="Apply for leave" onClose={apply.close} footer={<><button className="btn btn-outline-secondary" onClick={apply.close}>Cancel</button><button className="btn btn-primary" disabled={applyM.pending || f.reason.length < 3} onClick={() => applyM.mutate(f).then((r) => { apply.close(); reload(); toast.success(`Leave request sent (${r.days} working days)`); }).catch(() => {})}>Send</button></>}>
          <FormError error={applyM.error} />
          <FormField label="Type" name="lt"><select id="lt" className="form-select" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{['casual', 'sick', 'earned', 'unpaid', 'other'].map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</select></FormField>
          <div className="row"><div className="col-6"><FormField label="From" name="lf"><input id="lf" type="date" className="form-control" value={f.fromDate} onChange={(e) => setF({ ...f, fromDate: e.target.value })} /></FormField></div><div className="col-6"><FormField label="To" name="lto"><input id="lto" type="date" className="form-control" min={f.fromDate} value={f.toDate} onChange={(e) => setF({ ...f, toDate: e.target.value })} /></FormField></div></div>
          <FormField label="Reason" name="lr" className="mb-0"><textarea id="lr" className="form-control" rows="2" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></FormField>
        </Modal>
      )}
      {view.isOpen && (
        <Modal title={`Payslip ${view.item.month}`} onClose={view.close} footer={<button className="btn btn-primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />Print</button>}>
          <div className="small text-muted mb-2">{view.item.employee.name} · {view.item.employee.employeeCode || ''} {view.item.employee.designation || ''}</div>
          <table className="table table-sm">
            <tbody>
              {view.item.earnings.map((e, i) => <tr key={`e${i}`}><td>{e.name}</td><td className="num">{money(e.amount, auth.currency)}</td></tr>)}
              <tr className="fw-semibold"><td>Gross</td><td className="num">{money(view.item.gross, auth.currency)}</td></tr>
              {view.item.deductions.map((d, i) => <tr key={`d${i}`}><td>{d.name}</td><td className="num">− {money(d.amount, auth.currency)}</td></tr>)}
              <tr className="fw-semibold fs-6"><td>Net pay</td><td className="num">{money(view.item.net, auth.currency)}</td></tr>
            </tbody>
          </table>
        </Modal>
      )}
    </>
  );
}

/* ---------------------- family views ---------------------- */

export function FamilyLibraryCard({ studentId }) {
  const q = useQuery(() => api.get('/portal/library', { studentId }), [studentId], { enabled: Boolean(studentId) });
  if (q.error?.code === 'MODULE_NOT_ENABLED' || q.error?.code === 'PERMISSION_DENIED') return null;
  return (
    <div className="card table-card">
      <div className="card-header">Library books</div>
      <QueryState query={q} isEmpty={(x) => !x.current.length && !x.history.length} empty={<EmptyState icon="book" title="No library books borrowed" />}>
        {(x) => <DataTable rows={[...x.current, ...x.history.slice(0, 5)]} columns={[{ key: 'book', label: 'Book', render: (r) => r.book?.title }, { key: 'due', label: 'Due / returned', render: (r) => (r.status === 'issued' ? `Due ${date(r.dueDate)}` : date(r.returnedAt)) }, { key: 'st', label: 'Status', render: (r) => <StatusBadge status={r.displayStatus} /> }]} />}
      </QueryState>
    </div>
  );
}

export function FamilyHostelCard({ studentId }) {
  const q = useQuery(() => api.get('/portal/hostel', { studentId }), [studentId], { enabled: Boolean(studentId) });
  if (q.error || !q.data?.allocation) return null;
  const a = q.data.allocation;
  return (
    <div className="card"><div className="card-body"><div className="small text-muted">Hostel</div><div className="fw-semibold">{a.hostel?.name} · Room {a.room?.number}</div><div className="small text-muted">Since {date(a.fromDate)}{a.warden ? ` · Warden ${a.warden}` : ''}</div></div></div>
  );
}
