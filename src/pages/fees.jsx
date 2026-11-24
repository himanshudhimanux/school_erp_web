import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api/client.js';
import { useDebounced, useMutation, useQuery } from '../hooks/useApi.js';
import { useToast } from '../components/Toast.jsx';
import { PageHeader, StatCard, StatusBadge, QueryState, EmptyState, ErrorState, DataTable, Pagination, SearchInput, FilterBar, FormField, FormError, Modal, ConfirmDialog, useDialog, BarChart } from '../components/ui.jsx';
import { StudentPicker, SessionSelect, ClassSectionSelect } from '../components/pickers.jsx';
import { money, date, dateTime, toMinor, fromMinor, todayYmd, titleCase, ymd } from '../utils/format.js';

const METHODS = [
  ['cash', 'Cash'],
  ['upi', 'UPI'],
  ['bank_transfer', 'Bank transfer'],
  ['cheque', 'Cheque'],
  ['card', 'Card'],
  ['other', 'Other'],
];
const NEEDS_REFERENCE = ['cheque', 'bank_transfer', 'upi', 'card'];
const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/* ------------------------------ dashboard ------------------------------ */

export function FeeDashboard() {
  const auth = useAuth();
  const navigate = useNavigate();
  const q = useQuery(() => api.get('/fees/dashboard'), []);
  const d = q.data;
  const c = auth.currency;
  return (
    <>
      <PageHeader
        title="Fee dashboard"
        description="Collections, dues and reminders at a glance"
        actions={
          <>
            {auth.can('fees.collect') && <Link to="/fees/collect" className="btn btn-primary"><i className="bi bi-wallet2 me-1" />Collect fee</Link>}
            {auth.can('fees.create') && <Link to="/fees/setup?tab=assign" className="btn btn-outline-primary">Assign fees</Link>}
          </>
        }
      />
      {q.error && <ErrorState error={q.error} onRetry={q.reload} />}
      <div className="row g-3 mb-3">
        <div className="col-6 col-xl-3"><StatCard label="Today’s collection" value={money(d?.collection.today.amount, c)} hint={d && `${d.collection.today.count} payments`} icon="cash" tone="success" loading={q.loading} /></div>
        <div className="col-6 col-xl-3"><StatCard label="This month (net)" value={money(d?.collection.month.net, c)} hint={d && `${money(d.collection.month.amount, c)} received · ${money(d.collection.month.refunds, c)} refunded`} icon="calendar3" loading={q.loading} /></div>
        <div className="col-6 col-xl-3"><StatCard label="Total outstanding" value={money(d?.outstanding.amount, c)} hint={d && `${d.outstanding.invoices} open invoices`} icon="hourglass-split" tone="warning" loading={q.loading} /></div>
        <div className="col-6 col-xl-3"><StatCard label="Overdue" value={money(d?.overdue.amount, c)} hint={d && `${d.overdue.invoices} invoices · ${d.overdue.students} students`} icon="exclamation-diamond" tone="danger" loading={q.loading} /></div>
      </div>
      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-header">This month by channel</div>
            <div className="card-body">
              {d && (
                <>
                  <div className="d-flex justify-content-between py-2 border-bottom"><span><i className="bi bi-shop me-2 text-muted" />At the counter</span><span className="fw-semibold">{money(d.collection.offline.amount, c)} <span className="text-muted small">({d.collection.offline.count})</span></span></div>
                  <div className="d-flex justify-content-between py-2"><span><i className="bi bi-globe me-2 text-muted" />Online</span><span className="fw-semibold">{money(d.collection.online.amount, c)} <span className="text-muted small">({d.collection.online.count})</span></span></div>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-header d-flex justify-content-between">Reminders (30 days)<Link to="/fees/reminders" className="small fw-normal">Manage</Link></div>
            <div className="card-body">
              {d && Object.keys(d.reminders).length === 0 && <span className="text-muted">No reminders sent recently.</span>}
              {d && Object.entries(d.reminders).map(([k, v]) => <div key={k} className="d-flex justify-content-between py-1"><StatusBadge status={k} /><span className="fw-semibold">{v}</span></div>)}
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-header">Quick links</div>
            <div className="list-group list-group-flush">
              <Link className="list-group-item list-group-item-action" to="/fees/invoices?status=overdue"><i className="bi bi-exclamation-diamond me-2 text-danger" />Overdue invoices</Link>
              <Link className="list-group-item list-group-item-action" to="/fees/defaulters"><i className="bi bi-people me-2" />Defaulters list</Link>
              <Link className="list-group-item list-group-item-action" to="/fees/reports"><i className="bi bi-graph-up me-2" />Collection reports</Link>
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card table-card h-100">
            <div className="card-header">Recent payments</div>
            <QueryState query={q} isEmpty={(x) => !x.recentPayments.length} empty={<EmptyState icon="receipt" title="No payments yet" />}>
              {(x) => <DataTable rows={x.recentPayments} onRowClick={(r) => navigate(`/fees/payments/${r._id}`)} columns={[
                { key: 'receiptNo', label: 'Receipt' },
                { key: 'student', label: 'Student', render: (r) => r.student?.name },
                { key: 'paidAt', label: 'Date', render: (r) => date(r.paidAt) },
                { key: 'amount', label: 'Amount', className: 'num', render: (r) => money(r.amount, c) },
              ]} />}
            </QueryState>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card table-card h-100">
            <div className="card-header">Due in the next 7 days</div>
            <QueryState query={q} isEmpty={(x) => !x.upcomingDue.length} empty={<EmptyState icon="calendar-check" title="Nothing due this week" />}>
              {(x) => <InvoiceTable rows={x.upcomingDue} currency={c} compact />}
            </QueryState>
          </div>
        </div>
      </div>
    </>
  );
}

function InvoiceTable({ rows, currency, compact }) {
  const navigate = useNavigate();
  const cols = [
    { key: 'invoiceNo', label: 'Invoice' },
    { key: 'student', label: 'Student', render: (r) => <><div className="fw-semibold">{r.student?.name}</div><div className="small text-muted">{r.student?.admissionNo}{r.classSection ? ` · ${r.classSection}` : ''}</div></> },
    !compact && { key: 'title', label: 'Fee', render: (r) => r.title },
    !compact && { key: 'total', label: 'Total', className: 'num', render: (r) => money(r.total, currency) },
    !compact && { key: 'paid', label: 'Paid', className: 'num', render: (r) => money(r.paidAmount, currency) },
    { key: 'balance', label: 'Balance', className: 'num', render: (r) => <span className="fw-semibold">{money(r.balance, currency)}</span> },
    { key: 'dueDate', label: 'Due', render: (r) => date(r.dueDate) },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.displayStatus} /> },
  ].filter(Boolean);
  return <DataTable rows={rows} columns={cols} onRowClick={(r) => navigate(`/fees/invoices/${r._id}`)} />;
}

/* ------------------------------ collect fee ------------------------------ */

export function CollectFee() {
  const auth = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const studentId = params.get('studentId');
  const account = useQuery(() => api.get(`/fees/students/${studentId}`), [studentId], { enabled: Boolean(studentId) });
  const open = useMemo(() => (account.data?.invoices || []).filter((i) => ['unpaid', 'partially_paid'].includes(i.status)), [account.data]);
  const [amounts, setAmounts] = useState({});
  const [form, setForm] = useState({ method: 'cash', reference: '', paidAt: todayYmd(), notes: '' });
  const [key, setKey] = useState(newKey);
  const [review, setReview] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const pay = useMutation((body) => api.post('/fees/payments', body));
  const c = auth.currency;

  const preselect = params.get('invoiceId');
  const selected = open.filter((i) => amounts[i._id] !== undefined ? amounts[i._id] !== '' : preselect ? i._id === preselect : true);
  const amountOf = (i) => (amounts[i._id] !== undefined ? toMinor(amounts[i._id]) : i.balance);
  const allocations = selected.map((i) => ({ invoice: i, amount: amountOf(i) })).filter((a) => a.amount);
  const invalid = selected.some((i) => { const a = amountOf(i); return a === null || a <= 0 || a > i.balance; });
  const total = allocations.reduce((t, a) => t + a.amount, 0);
  const refMissing = NEEDS_REFERENCE.includes(form.method) && !form.reference.trim();

  const pick = (s) => {
    setParams({ studentId: s._id });
    setAmounts({});
    setReceipt(null);
    setKey(newKey());
  };
  const submit = async () => {
    try {
      const r = await pay.mutate({
        studentId,
        allocations: allocations.map((a) => ({ invoiceId: a.invoice._id, amount: a.amount })),
        method: form.method,
        reference: form.reference.trim() || undefined,
        notes: form.notes.trim() || undefined,
        paidAt: form.paidAt === todayYmd() ? undefined : new Date(`${form.paidAt}T12:00:00`).toISOString(),
        idempotencyKey: key,
      });
      setReview(false);
      setReceipt(r);
      account.reload();
      toast.success(r.replayed ? `Payment was already recorded (${r.receiptNo})` : `Payment recorded · ${r.receiptNo}`);
    } catch (e) {
      setReview(false);
      if (e.code === 'BALANCE_CHANGED') account.reload();
    }
  };

  return (
    <>
      <PageHeader title="Collect fee" description="Find the student, choose invoices, confirm and print the receipt" breadcrumbs={[{ label: 'Fees', to: '/fees' }, { label: 'Collect fee' }]} />
      <div className="card mb-3">
        <div className="card-body">
          <StudentPicker onSelect={pick} autoFocus={!studentId} />
        </div>
      </div>
      {receipt && (
        <div className="alert alert-success d-flex flex-wrap justify-content-between align-items-center gap-2">
          <span><i className="bi bi-check-circle me-2" />Payment of <strong>{money(receipt.amount, c)}</strong> recorded. Receipt <strong>{receipt.receiptNo}</strong>.</span>
          <span className="d-flex gap-2">
            <Link className="btn btn-sm btn-success" to={`/fees/payments/${receipt.id}`}><i className="bi bi-printer me-1" />View / print receipt</Link>
            <button type="button" className="btn btn-sm btn-outline-success" onClick={() => { setReceipt(null); setParams({}); }}>Next student</button>
          </span>
        </div>
      )}
      {studentId && (
        <QueryState query={account}>
          {(acc) => (
            <div className="row g-3">
              <div className="col-lg-8">
                <div className="card table-card">
                  <div className="card-header d-flex justify-content-between flex-wrap gap-2">
                    <span>{acc.student.name} <span className="text-muted fw-normal">· {acc.student.admissionNo}</span></span>
                    <span className="fw-normal small">Balance <strong>{money(acc.summary.balance, c)}</strong>{acc.summary.overdue > 0 && <> · <span className="text-danger">Overdue {money(acc.summary.overdue, c)}</span></>}</span>
                  </div>
                  {open.length === 0 ? (
                    <EmptyState icon="check2-circle" title="No dues" message="This student has no unpaid invoices." />
                  ) : (
                    <div className="table-responsive">
                      <table className="table">
                        <thead><tr><th style={{ width: 36 }} /><th>Invoice</th><th>Due</th><th className="num">Balance</th><th style={{ width: 160 }}>Amount now</th></tr></thead>
                        <tbody>
                          {open.map((i) => {
                            const on = selected.includes(i);
                            const a = amountOf(i);
                            const bad = on && (a === null || a <= 0 || a > i.balance);
                            return (
                              <tr key={i._id}>
                                <td><input type="checkbox" className="form-check-input" aria-label={`Pay ${i.invoiceNo}`} checked={on} onChange={(e) => setAmounts({ ...amounts, [i._id]: e.target.checked ? fromMinor(i.balance) : '' })} /></td>
                                <td><div className="fw-semibold">{i.title}</div><div className="small text-muted">{i.invoiceNo} <StatusBadge status={i.displayStatus} /></div></td>
                                <td>{date(i.dueDate)}</td>
                                <td className="num">{money(i.balance, c)}</td>
                                <td>
                                  <input className={`form-control form-control-sm text-end ${bad ? 'is-invalid' : ''}`} inputMode="decimal" disabled={!on} aria-label={`Amount for ${i.invoiceNo}`} value={on ? (amounts[i._id] ?? fromMinor(i.balance)) : ''} onChange={(e) => setAmounts({ ...amounts, [i._id]: e.target.value })} />
                                  {bad && <div className="invalid-feedback">1 to {money(i.balance, c)}</div>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
              <div className="col-lg-4">
                <div className="card">
                  <div className="card-header">Payment</div>
                  <div className="card-body">
                    <FormError error={pay.error} />
                    <FormField label="Payment method" name="method" required>
                      <select id="method" className="form-select" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                        {METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </FormField>
                    {form.method !== 'cash' && (
                      <FormField label={form.method === 'cheque' ? 'Cheque number' : 'Transaction reference'} name="ref" required={NEEDS_REFERENCE.includes(form.method)}>
                        <input id="ref" className="form-control" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
                      </FormField>
                    )}
                    <FormField label="Payment date" name="paidAt" required>
                      <input id="paidAt" type="date" className="form-control" max={todayYmd()} value={form.paidAt} onChange={(e) => setForm({ ...form, paidAt: e.target.value })} />
                    </FormField>
                    <FormField label="Notes" name="notes">
                      <input id="notes" className="form-control" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                    </FormField>
                    <div className="d-flex justify-content-between align-items-center border-top pt-3 mb-3">
                      <span className="text-muted">Collecting</span>
                      <span className="fs-4 fw-semibold">{money(total, c)}</span>
                    </div>
                    <button type="button" className="btn btn-primary w-100" disabled={!allocations.length || invalid || refMissing || pay.pending} onClick={() => setReview(true)}>
                      Review payment
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </QueryState>
      )}
      {review && (
        <ConfirmDialog title="Confirm payment" confirmLabel={`Record ${money(total, c)}`} pending={pay.pending} onCancel={() => setReview(false)} onConfirm={submit}>
          <p className="mb-2">Student: <strong>{account.data?.student.name}</strong> ({account.data?.student.admissionNo})</p>
          <ul className="list-unstyled mb-3">
            {allocations.map((a) => <li key={a.invoice._id} className="d-flex justify-content-between border-bottom py-1"><span>{a.invoice.title} <span className="text-muted small">{a.invoice.invoiceNo}</span></span><span>{money(a.amount, c)}</span></li>)}
          </ul>
          <p className="mb-0">Method: <strong>{METHODS.find((m) => m[0] === form.method)[1]}</strong>{form.reference && ` · Ref ${form.reference}`} · {date(form.paidAt)}</p>
        </ConfirmDialog>
      )}
    </>
  );
}

/* ------------------------------ invoices ------------------------------ */

export function Invoices() {
  const auth = useAuth();
  const [params, setParams] = useSearchParams();
  const f = Object.fromEntries(params);
  const set = (patch) => setParams({ ...f, page: 1, ...patch }, { replace: true });
  const [search, setSearch] = useState(f.search || '');
  const s = useDebounced(search);
  const q = useQuery(() => api.list('/fees/invoices', { ...f, search: s, limit: 25 }), [params.toString(), s]);
  const hasFilters = ['status', 'classId', 'sectionId', 'dueFrom', 'dueTo'].some((k) => f[k]) || s;
  return (
    <>
      <PageHeader title="Fee invoices" description="Search by student, admission number, invoice number or parent" breadcrumbs={[{ label: 'Fees', to: '/fees' }, { label: 'Invoices' }]} actions={auth.can('fees.create') && <NewInvoiceButton />} />
      <div className="card table-card">
        <FilterBar hasFilters={hasFilters} onReset={() => { setSearch(''); setParams({}); }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Student, admission no., invoice no. or parent" />
          <select className="form-select" style={{ maxWidth: 170 }} aria-label="Status" value={f.status || ''} onChange={(e) => set({ status: e.target.value })}>
            <option value="">All statuses</option>
            <option value="outstanding">Outstanding</option>
            <option value="overdue">Overdue</option>
            <option value="pending">Pending (not due)</option>
            <option value="partially_paid">Partially paid</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <ClassSectionSelect classId={f.classId} sectionId={f.sectionId} onChange={(v) => set(v)} />
          <input type="date" className="form-control" style={{ maxWidth: 160 }} aria-label="Due from" value={f.dueFrom || ''} onChange={(e) => set({ dueFrom: e.target.value })} />
          <input type="date" className="form-control" style={{ maxWidth: 160 }} aria-label="Due to" value={f.dueTo || ''} onChange={(e) => set({ dueTo: e.target.value })} />
        </FilterBar>
        {q.data?.meta?.amounts && (
          <div className="d-flex flex-wrap gap-4 px-3 py-2 border-bottom small">
            <span>Total <strong>{money(q.data.meta.amounts.total, auth.currency)}</strong></span>
            <span>Paid <strong className="text-success">{money(q.data.meta.amounts.paid, auth.currency)}</strong></span>
            <span>Balance <strong className="text-danger">{money(q.data.meta.amounts.balance, auth.currency)}</strong></span>
          </div>
        )}
        {q.error ? <ErrorState error={q.error} onRetry={q.reload} /> : <InvoiceTable rows={q.data?.items} currency={auth.currency} />}
        {q.loading && !q.data && <div className="p-3"><div className="skeleton" /></div>}
        <Pagination meta={q.data?.meta} onPage={(p) => setParams({ ...f, page: p })} />
      </div>
    </>
  );
}

function NewInvoiceButton() {
  const d = useDialog();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [form, setForm] = useState({ title: '', dueDate: todayYmd(), categoryId: '', amount: '', description: '' });
  const cats = useQuery(() => api.list('/fees/categories', { status: 'active', limit: 100 }), [], { enabled: d.isOpen });
  const m = useMutation((b) => api.post('/fees/invoices', b));
  const fe = m.error?.fieldErrors?.() || {};
  const amount = toMinor(form.amount);
  return (
    <>
      <button type="button" className="btn btn-outline-primary" onClick={() => d.open()}><i className="bi bi-plus-lg me-1" />One-off invoice</button>
      {d.isOpen && (
        <Modal title="One-off invoice" onClose={d.close} footer={<><button className="btn btn-outline-secondary" onClick={d.close}>Cancel</button><button className="btn btn-primary" disabled={m.pending || !student || !form.title || !form.categoryId || !amount} onClick={() => m.mutate({ studentId: student._id, title: form.title, dueDate: form.dueDate, lines: [{ categoryId: form.categoryId, amount, description: form.description || undefined }] }).then((inv) => navigate(`/fees/invoices/${inv._id}`)).catch(() => {})}>Create invoice</button></>}>
          <FormError error={m.error} />
          <FormField label="Student" required>{student ? <div className="d-flex justify-content-between"><strong>{student.fullName}</strong><button className="btn btn-link btn-sm p-0" onClick={() => setStudent(null)}>Change</button></div> : <StudentPicker onSelect={setStudent} />}</FormField>
          <FormField label="Title" name="t" required error={fe.title}><input id="t" className="form-control" placeholder="e.g. Library fine" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></FormField>
          <div className="row">
            <div className="col-6"><FormField label="Category" name="c" required><select id="c" className="form-select" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}><option value="">Choose…</option>{cats.data?.items.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}</select></FormField></div>
            <div className="col-6"><FormField label="Amount" name="a" required error={form.amount && !amount ? 'Enter an amount like 250 or 250.50' : null}><input id="a" className="form-control" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></FormField></div>
          </div>
          <FormField label="Due date" name="d" required><input id="d" type="date" className="form-control" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></FormField>
        </Modal>
      )}
    </>
  );
}

export function InvoiceDetail() {
  const { id } = useParams();
  const auth = useAuth();
  const toast = useToast();
  const q = useQuery(() => api.get(`/fees/invoices/${id}`), [id]);
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState({ amount: '', reason: '' });
  const act = useMutation(({ path, body }) => api.post(`/fees/invoices/${id}/${path}`, body));
  const c = auth.currency;
  const run = (path, body, msg) => act.mutate({ path, body }).then((r) => { if (r?.invoiceNo) q.setData(r); else q.reload(); setDialog(null); setForm({ amount: '', reason: '' }); toast.success(msg); }).catch((e) => toast.error(e.message));
  return (
    <QueryState query={q}>
      {(inv) => {
        const open = ['unpaid', 'partially_paid'].includes(inv.status);
        return (
          <>
            <PageHeader
              title={inv.invoiceNo}
              description={inv.title}
              breadcrumbs={[{ label: 'Fees', to: '/fees' }, { label: 'Invoices', to: '/fees/invoices' }, { label: inv.invoiceNo }]}
              actions={
                <>
                  {open && auth.can('fees.collect') && <Link className="btn btn-primary" to={`/fees/collect?studentId=${inv.studentId}&invoiceId=${inv._id}`}><i className="bi bi-wallet2 me-1" />Collect payment</Link>}
                  {open && auth.can('fees.update') && <button className="btn btn-outline-secondary" onClick={() => run('remind', {}, 'Reminder sent')} disabled={act.pending}><i className="bi bi-bell me-1" />Send reminder</button>}
                  {open && auth.can('fees.update') && <button className="btn btn-outline-secondary" onClick={() => setDialog('concession')}>Concession</button>}
                  {open && inv.lateFee > 0 && auth.can('fees.update') && <button className="btn btn-outline-secondary" onClick={() => setDialog('waive')}>Waive late fee</button>}
                  {inv.status !== 'cancelled' && inv.paidAmount === 0 && auth.can('fees.delete') && <button className="btn btn-outline-danger" onClick={() => setDialog('cancel')}>Cancel invoice</button>}
                </>
              }
            />
            <div className="row g-3">
              <div className="col-lg-8">
                <div className="card table-card mb-3">
                  <div className="card-header d-flex justify-content-between">Fee details <StatusBadge status={inv.displayStatus} /></div>
                  <div className="table-responsive">
                    <table className="table">
                      <thead><tr><th>Item</th><th className="num">Amount</th><th className="num">Discount</th><th className="num">Net</th></tr></thead>
                      <tbody>
                        {inv.lines.map((l, i) => <tr key={i}><td>{l.name}</td><td className="num">{money(l.amount, c)}</td><td className="num">{l.discount ? `− ${money(l.discount, c)}` : '—'}</td><td className="num">{money(l.net, c)}</td></tr>)}
                        {inv.concession > 0 && <tr><td colSpan={3}>Concession</td><td className="num">− {money(inv.concession, c)}</td></tr>}
                        {(inv.lateFee > 0 || inv.lateFeeWaived) && <tr><td colSpan={3}>Late fee {inv.lateFeeWaived && <span className="text-muted">(waived)</span>}</td><td className="num">{inv.lateFeeWaived ? '—' : money(inv.lateFee, c)}</td></tr>}
                        <tr className="fw-semibold"><td colSpan={3}>Total</td><td className="num">{money(inv.total, c)}</td></tr>
                        <tr><td colSpan={3}>Paid</td><td className="num text-success">{money(inv.paidAmount, c)}</td></tr>
                        <tr className="fw-semibold"><td colSpan={3}>Balance</td><td className="num text-danger">{money(inv.balance, c)}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="card table-card">
                  <div className="card-header">Payments and refunds</div>
                  {inv.payments.length + inv.refunds.length === 0 ? <EmptyState icon="credit-card" title="No payments yet" /> : (
                    <DataTable keyField="id" rows={[...inv.payments.map((p) => ({ ...p, kind: 'Payment', no: p.receiptNo, at: p.paidAt })), ...inv.refunds.map((r) => ({ ...r, kind: 'Refund', no: r.refundNo, at: r.refundedAt }))]} columns={[
                      { key: 'kind', label: 'Type' },
                      { key: 'no', label: 'Number', render: (r) => (r.kind === 'Payment' ? <Link to={`/fees/payments/${r.id}`}>{r.no}</Link> : r.no) },
                      { key: 'at', label: 'Date', render: (r) => date(r.at) },
                      { key: 'method', label: 'Method', render: (r) => titleCase(r.method) },
                      { key: 'amount', label: 'Amount', className: 'num', render: (r) => (r.kind === 'Refund' ? `− ${money(r.amount, c)}` : money(r.amount, c)) },
                    ]} />
                  )}
                </div>
              </div>
              <div className="col-lg-4">
                <div className="card">
                  <div className="card-body">
                    <div className="small text-muted">Student</div>
                    <div className="fw-semibold"><Link to={`/students/${inv.studentId}`}>{inv.student?.name}</Link></div>
                    <div className="small text-muted mb-3">{inv.student?.admissionNo} · {inv.classSection}</div>
                    <div className="small text-muted">Due date</div>
                    <div className="mb-3">{date(inv.dueDate)}</div>
                    {inv.primaryGuardian && <><div className="small text-muted">Primary contact</div><div>{inv.primaryGuardian.name}</div><a href={`tel:${inv.primaryGuardian.phone}`} className="small">{inv.primaryGuardian.phone}</a></>}
                    {inv.cancelReason && <div className="alert alert-secondary small mt-3 mb-0">Cancelled: {inv.cancelReason}</div>}
                  </div>
                </div>
              </div>
            </div>
            {dialog === 'concession' && (
              <ConfirmDialog title="Apply concession" confirmLabel="Apply" pending={act.pending} onCancel={() => setDialog(null)} onConfirm={() => { const a = toMinor(form.amount); if (a) run('concession', { amount: a, reason: form.reason }, 'Concession applied'); }}>
                <FormField label={`Amount (max ${money(inv.balance, c)})`} name="ca" required><input id="ca" className="form-control" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></FormField>
                <FormField label="Reason" name="cr" required className="mb-0"><input id="cr" className="form-control" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></FormField>
              </ConfirmDialog>
            )}
            {dialog === 'waive' && (
              <ConfirmDialog title="Waive late fee" message={`Remove the late fee of ${money(inv.lateFee, c)} from this invoice?`} confirmLabel="Waive" pending={act.pending} onCancel={() => setDialog(null)} onConfirm={() => form.reason && run('waive-late-fee', { reason: form.reason }, 'Late fee waived')}>
                <FormField label="Reason" name="wr" required className="mt-3 mb-0"><input id="wr" className="form-control" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></FormField>
              </ConfirmDialog>
            )}
            {dialog === 'cancel' && (
              <ConfirmDialog title="Cancel invoice" tone="danger" message="The family will no longer owe this invoice. This cannot be undone." confirmLabel="Cancel invoice" pending={act.pending} onCancel={() => setDialog(null)} onConfirm={() => form.reason && run('cancel', { reason: form.reason }, 'Invoice cancelled')}>
                <FormField label="Reason" name="xr" required className="mt-3 mb-0"><input id="xr" className="form-control" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></FormField>
              </ConfirmDialog>
            )}
          </>
        );
      }}
    </QueryState>
  );
}

/* ------------------------------ payments & receipts ------------------------------ */

export function Payments() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ from: '', to: '', method: '', source: '', page: 1 });
  const q = useQuery(() => api.list('/fees/payments', { ...f, limit: 25 }), [JSON.stringify(f)]);
  return (
    <>
      <PageHeader title="Payments" description="Every receipt issued, at the counter or online" breadcrumbs={[{ label: 'Fees', to: '/fees' }, { label: 'Payments' }]} />
      <div className="card table-card">
        <FilterBar hasFilters={f.from || f.to || f.method || f.source} onReset={() => setF({ from: '', to: '', method: '', source: '', page: 1 })}>
          <input type="date" className="form-control" style={{ maxWidth: 160 }} aria-label="From" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value, page: 1 })} />
          <input type="date" className="form-control" style={{ maxWidth: 160 }} aria-label="To" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value, page: 1 })} />
          <select className="form-select" style={{ maxWidth: 160 }} aria-label="Method" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value, page: 1 })}>
            <option value="">All methods</option>
            {[...METHODS, ['online', 'Online']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className="form-select" style={{ maxWidth: 150 }} aria-label="Channel" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value, page: 1 })}>
            <option value="">All channels</option>
            <option value="offline">Counter</option>
            <option value="online">Online</option>
          </select>
        </FilterBar>
        {q.error ? <ErrorState error={q.error} onRetry={q.reload} /> : (
          <DataTable loading={q.loading} rows={q.data?.items} onRowClick={(r) => navigate(`/fees/payments/${r._id}`)} columns={[
            { key: 'receiptNo', label: 'Receipt' },
            { key: 'paidAt', label: 'Date', render: (r) => date(r.paidAt) },
            { key: 'student', label: 'Student', render: (r) => <><div className="fw-semibold">{r.student?.name}</div><div className="small text-muted">{r.student?.admissionNo}</div></> },
            { key: 'method', label: 'Method', render: (r) => titleCase(r.method) },
            { key: 'invoices', label: 'Invoices', render: (r) => r.invoices.join(', ') || '—' },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'amount', label: 'Amount', className: 'num', render: (r) => money(r.amount, auth.currency) },
          ]} />
        )}
        <Pagination meta={q.data?.meta} onPage={(p) => setF({ ...f, page: p })} />
      </div>
    </>
  );
}

export function PaymentReceipt({ r, currency }) {
  return (
    <div className="card receipt mx-auto">
      <div className="card-body p-4">
        <div className="d-flex justify-content-between align-items-start border-bottom pb-3 mb-3">
          <div>
            <h2 className="h4 mb-1">{r.school?.name}</h2>
            <div className="small text-muted">{[r.school?.address?.line1, r.school?.address?.city].filter(Boolean).join(', ')}{r.school?.phone ? ` · ${r.school.phone}` : ''}</div>
          </div>
          <div className="text-end">
            <div className="fw-semibold">FEE RECEIPT</div>
            <div>{r.receiptNo}</div>
            <div className="small text-muted">{dateTime(r.paidAt)}</div>
          </div>
        </div>
        <div className="row mb-3">
          <div className="col-sm-6"><div className="small text-muted">Student</div><div className="fw-semibold">{r.student?.name}</div><div className="small">{r.student?.admissionNo}{r.student?.classSection ? ` · ${r.student.classSection}` : ''}</div></div>
          <div className="col-sm-6 text-sm-end"><div className="small text-muted">Paid by</div><div>{titleCase(r.method)}{r.reference ? ` · ${r.reference}` : ''}</div><StatusBadge status={r.status} /></div>
        </div>
        <table className="table">
          <thead><tr><th>Description</th><th className="num">Amount</th></tr></thead>
          <tbody>
            {r.items.map((i) => <tr key={i.invoiceId}><td>{i.title} <span className="text-muted small">({i.invoiceNo})</span></td><td className="num">{money(i.amount, currency)}</td></tr>)}
            {r.unallocatedAmount > 0 && <tr><td>Advance (not applied to an invoice)</td><td className="num">{money(r.unallocatedAmount, currency)}</td></tr>}
            <tr className="fw-semibold"><td>Total received</td><td className="num">{money(r.amount, currency)}</td></tr>
            {r.refundedAmount > 0 && <tr className="text-danger"><td>Refunded</td><td className="num">− {money(r.refundedAmount, currency)}</td></tr>}
          </tbody>
        </table>
        <p className="small mb-1"><strong>Amount in words:</strong> {r.amountInWords}</p>
        {r.refunds?.map((x) => <p key={x.refundNo} className="small text-muted mb-1">Refund {x.refundNo} on {date(x.refundedAt)}: {money(x.amount, currency)} ({x.reason})</p>)}
        <div className="d-flex justify-content-between mt-4 small text-muted"><span>Received by: {r.collectedBy || '—'}</span><span>This is a computer-generated receipt.</span></div>
      </div>
    </div>
  );
}

export function ReceiptPage() {
  const { id } = useParams();
  const auth = useAuth();
  const toast = useToast();
  const q = useQuery(() => api.get(`/fees/payments/${id}/receipt`), [id]);
  const d = useDialog();
  const [form, setForm] = useState({ amount: '', reason: '', method: 'cash', reference: '' });
  const refund = useMutation((b) => api.post(`/fees/payments/${id}/refund`, b));
  return (
    <QueryState query={q}>
      {(r) => (
        <>
          <PageHeader
            title={`Receipt ${r.receiptNo}`}
            breadcrumbs={[{ label: 'Fees', to: '/fees' }, { label: 'Payments', to: '/fees/payments' }, { label: r.receiptNo }]}
            actions={
              <>
                <button className="btn btn-primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />Print</button>
                {auth.can('fees.refund') && r.refundedAmount < r.amount && <button className="btn btn-outline-danger" onClick={() => d.open()}>Refund</button>}
              </>
            }
          />
          <PaymentReceipt r={r} currency={auth.currency} />
          {d.isOpen && (
            <ConfirmDialog
              title="Refund payment"
              tone="danger"
              confirmLabel="Record refund"
              pending={refund.pending}
              onCancel={d.close}
              onConfirm={() => {
                const amount = toMinor(form.amount);
                if (!amount || !form.reason) return;
                refund.mutate({ amount, reason: form.reason, ...(r.source === 'online' ? {} : { method: form.method, reference: form.reference || undefined }) })
                  .then((x) => { q.setData(x.receipt); d.close(); toast.success(`Refund ${x.refund.refundNo} recorded`); })
                  .catch(() => {});
              }}
            >
              <FormError error={refund.error} />
              <p className="small text-muted">{r.source === 'online' ? 'The money will be returned to the payer through the payment gateway.' : 'Record money returned to the family. The affected invoices become payable again.'}</p>
              <FormField label={`Amount (max ${money(r.amount - r.refundedAmount, auth.currency)})`} name="ra" required><input id="ra" className="form-control" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></FormField>
              <FormField label="Reason" name="rr" required><input id="rr" className="form-control" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></FormField>
              {r.source !== 'online' && (
                <div className="row">
                  <div className="col-6"><FormField label="Returned by" name="rm" className="mb-0"><select id="rm" className="form-select" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>{METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></FormField></div>
                  <div className="col-6"><FormField label="Reference" name="rf" className="mb-0"><input id="rf" className="form-control" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></FormField></div>
                </div>
              )}
            </ConfirmDialog>
          )}
        </>
      )}
    </QueryState>
  );
}

/* ------------------------------ defaulters ------------------------------ */

export function Defaulters() {
  const auth = useAuth();
  const [f, setF] = useState({ classId: '', sectionId: '', page: 1 });
  const q = useQuery(() => api.list('/fees/defaulters', { ...f, limit: 25 }), [JSON.stringify(f)]);
  return (
    <>
      <PageHeader title="Defaulters" description="Students with overdue balances, largest first" breadcrumbs={[{ label: 'Fees', to: '/fees' }, { label: 'Defaulters' }]} />
      <div className="card table-card">
        <FilterBar hasFilters={f.classId} onReset={() => setF({ classId: '', sectionId: '', page: 1 })}>
          <ClassSectionSelect classId={f.classId} sectionId={f.sectionId} onChange={(v) => setF({ ...f, ...v, page: 1 })} />
          {q.data?.meta && <span className="ms-auto small">Total overdue <strong className="text-danger">{money(q.data.meta.totalOverdue, auth.currency)}</strong></span>}
        </FilterBar>
        {q.error ? <ErrorState error={q.error} onRetry={q.reload} /> : (
          <DataTable keyField="studentId" loading={q.loading} rows={q.data?.items} empty={<EmptyState icon="check2-circle" title="No overdue fees" />} columns={[
            { key: 'name', label: 'Student', render: (r) => <><Link to={`/fees/collect?studentId=${r.studentId}`} className="fw-semibold">{r.name}</Link><div className="small text-muted">{r.admissionNo} · {r.classSection}</div></> },
            { key: 'contact', label: 'Primary contact', render: (r) => (r.primaryGuardian ? <><div>{r.primaryGuardian.name}</div><a className="small" href={`tel:${r.primaryGuardian.phone}`}>{r.primaryGuardian.phone}</a></> : '—') },
            { key: 'inv', label: 'Invoices', render: (r) => r.overdueInvoices },
            { key: 'days', label: 'Oldest due', render: (r) => <>{date(r.oldestDueDate)}<div className="small text-muted">{r.daysOverdue} days</div></> },
            { key: 'amt', label: 'Overdue', className: 'num', render: (r) => <span className="fw-semibold text-danger">{money(r.overdueAmount, auth.currency)}</span> },
          ]} />
        )}
        <Pagination meta={q.data?.meta} onPage={(p) => setF({ ...f, page: p })} />
      </div>
    </>
  );
}

/* ------------------------------ reminders ------------------------------ */

const daysList = (s) => [...new Set(String(s).split(/[,\s]+/).map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0))];

export function Reminders() {
  const auth = useAuth();
  const toast = useToast();
  const q = useQuery(() => api.get('/fees/reminders'), []);
  const [edit, setEdit] = useState(null);
  const [confirmOff, setConfirmOff] = useState(false);
  const save = useMutation((b) => api.patch('/fees/reminders/settings', b));
  const run = useMutation(() => api.post('/fees/reminders/run'));
  const canEdit = auth.can('fees.update');
  const persist = (body) => save.mutate(body).then(() => { q.reload(); setEdit(null); setConfirmOff(false); toast.success('Reminder settings saved'); }).catch(() => {});
  return (
    <>
      <PageHeader title="Automated fee reminders" description="Parents are reminded before, on and after the due date until the fee is paid" breadcrumbs={[{ label: 'Fees', to: '/fees' }, { label: 'Reminders' }]}
        actions={canEdit && q.data?.settings.enabled && <button className="btn btn-outline-primary" disabled={run.pending} onClick={() => run.mutate().then((r) => { toast.success(`Processed ${r.invoices} invoices · ${r.notificationsQueued} new notifications`); q.reload(); }).catch((e) => toast.error(e.message))}><i className="bi bi-play me-1" />Run today’s reminders now</button>} />
      <QueryState query={q}>
        {(d) => {
          const s = d.settings;
          return (
            <div className="row g-3">
              <div className="col-lg-5">
                <div className="card mb-3">
                  <div className="card-body d-flex justify-content-between align-items-center">
                    <div>
                      <div className="fw-semibold">Automatic reminders are {s.enabled ? 'on' : 'off'}</div>
                      <div className="small text-muted">{s.enabled ? `Checked hourly, sent from ${String(s.sendHour).padStart(2, '0')}:00 (${s.timezone})` : 'No reminders are sent automatically.'}</div>
                    </div>
                    {canEdit && <div className="form-check form-switch fs-4 mb-0"><input className="form-check-input" type="checkbox" role="switch" aria-label="Automatic reminders" checked={s.enabled} disabled={save.pending} onChange={(e) => (e.target.checked ? persist({ enabled: true }) : setConfirmOff(true))} /></div>}
                  </div>
                </div>
                <div className="card">
                  <div className="card-header d-flex justify-content-between">Reminder rules {canEdit && !edit && <button className="btn btn-sm btn-outline-secondary" onClick={() => setEdit({ before: s.beforeDays.join(', '), on: s.onDueDate, after: s.afterDays.join(', '), channels: s.channels, sendHour: s.sendHour })}>Edit</button>}</div>
                  <div className="card-body">
                    {!edit ? (
                      <ul className="list-unstyled mb-0">
                        <li className="py-1"><i className="bi bi-calendar-minus me-2 text-muted" />Before due date: {s.beforeDays.length ? s.beforeDays.map((x) => `${x} day${x > 1 ? 's' : ''}`).join(', ') : 'none'}</li>
                        <li className="py-1"><i className="bi bi-calendar-event me-2 text-muted" />On the due date: {s.onDueDate ? 'yes' : 'no'}</li>
                        <li className="py-1"><i className="bi bi-calendar-plus me-2 text-muted" />After due date (while unpaid): {s.afterDays.length ? s.afterDays.map((x) => `${x} days`).join(', ') : 'none'}</li>
                        <li className="py-1"><i className="bi bi-send me-2 text-muted" />Channels: {s.channels.map((ch) => d.channels.find((x) => x.channel === ch)?.label || ch).join(', ')}</li>
                      </ul>
                    ) : (
                      <>
                        <FormError error={save.error} />
                        <FormField label="Days before the due date" name="b" hint="Comma-separated, e.g. 7, 3, 1"><input id="b" className="form-control" value={edit.before} onChange={(e) => setEdit({ ...edit, before: e.target.value })} /></FormField>
                        <div className="form-check mb-3"><input id="on" type="checkbox" className="form-check-input" checked={edit.on} onChange={(e) => setEdit({ ...edit, on: e.target.checked })} /><label htmlFor="on" className="form-check-label">Remind on the due date</label></div>
                        <FormField label="Days after the due date" name="a" hint="Sent only while the invoice is unpaid, e.g. 3, 7, 15"><input id="a" className="form-control" value={edit.after} onChange={(e) => setEdit({ ...edit, after: e.target.value })} /></FormField>
                        <div className="mb-3">
                          <div className="form-label">Channels</div>
                          {/* SMS, WhatsApp and push appear only when the server can deliver them. */}
                          {d.channels.filter((ch) => ch.available || ch.channel === 'email' || edit.channels.includes(ch.channel)).map((ch) => (
                            <div className="form-check" key={ch.channel}>
                              <input id={`ch-${ch.channel}`} type="checkbox" className="form-check-input" checked={edit.channels.includes(ch.channel)} onChange={(e) => setEdit({ ...edit, channels: e.target.checked ? [...edit.channels, ch.channel] : edit.channels.filter((x) => x !== ch.channel) })} />
                              <label htmlFor={`ch-${ch.channel}`} className="form-check-label">{ch.label} {!ch.available && <span className="text-warning small">(not configured on the server: will show as failed)</span>}</label>
                            </div>
                          ))}
                        </div>
                        <FormField label="Send from (hour, school time)" name="h"><input id="h" type="number" min="0" max="23" className="form-control" style={{ maxWidth: 120 }} value={edit.sendHour} onChange={(e) => setEdit({ ...edit, sendHour: Number(e.target.value) })} /></FormField>
                        <div className="d-flex gap-2">
                          <button className="btn btn-primary" disabled={save.pending || !edit.channels.length} onClick={() => persist({ beforeDays: daysList(edit.before), onDueDate: edit.on, afterDays: daysList(edit.after), channels: edit.channels, sendHour: edit.sendHour })}>Save rules</button>
                          <button className="btn btn-outline-secondary" onClick={() => setEdit(null)}>Cancel</button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="col-lg-7">
                <div className="row g-3 mb-3">
                  {['sent', 'queued', 'failed', 'cancelled'].map((k) => <div className="col-6 col-md-3" key={k}><StatCard label={`${titleCase(k)} (30 days)`} value={d.last30Days.byStatus[k] || 0} tone={k === 'failed' ? 'danger' : k === 'sent' ? 'success' : k === 'queued' ? 'warning' : 'muted'} /></div>)}
                </div>
                <div className="card mb-3">
                  <div className="card-header">Coming up (next 7 days)</div>
                  <div className="card-body">
                    {!s.enabled ? <span className="text-muted">Turn reminders on to see what will be sent.</span> : d.upcoming.length === 0 ? <span className="text-muted">No reminders due in the next 7 days.</span> : d.upcoming.map((u, i) => <div key={i} className="d-flex justify-content-between py-1 border-bottom"><span>{date(u.date)} · {u.rule.replace('_', ' ').replace('before', 'before due').replace('after', 'after due').replace('due', 'due')}</span><span>{u.invoices} invoice{u.invoices > 1 ? 's' : ''}</span></div>)}
                  </div>
                </div>
                <div className="card table-card">
                  <div className="card-header">Recent activity</div>
                  <DataTable rows={d.recent} empty={<EmptyState icon="bell" title="No reminders sent yet" />} columns={[
                    { key: 'createdAt', label: 'When', render: (r) => dateTime(r.createdAt) },
                    { key: 'to', label: 'To', render: (r) => r.recipient?.name || '—' },
                    { key: 'channel', label: 'Channel', render: (r) => (r.channel === 'in_app' ? 'App inbox' : r.channel === 'none' ? 'No channel' : titleCase(r.channel)) },
                    { key: 'title', label: 'Message', render: (r) => r.title },
                    { key: 'status', label: 'Status', render: (r) => <><StatusBadge status={r.status} />{r.error && <div className="small text-muted">{titleCase(r.error.toLowerCase())}</div>}</> },
                  ]} />
                </div>
              </div>
            </div>
          );
        }}
      </QueryState>
      {confirmOff && <ConfirmDialog title="Turn off automatic reminders?" tone="danger" message="Parents will stop receiving fee reminders until you turn this back on." confirmLabel="Turn off" pending={save.pending} onCancel={() => setConfirmOff(false)} onConfirm={() => persist({ enabled: false })} />}
    </>
  );
}

/* ------------------------------ setup ------------------------------ */

export function FeeSetup() {
  const auth = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'structures';
  const tabs = [['structures', 'Fee structures'], ['categories', 'Categories'], ['discounts', 'Discounts & scholarships'], auth.can('fees.create') && ['assign', 'Assign fees'], ['gateway', 'Online payments']].filter(Boolean);
  return (
    <>
      <PageHeader title="Fee setup" description="Categories, structures with instalments, discounts and online payments" breadcrumbs={[{ label: 'Fees', to: '/fees' }, { label: 'Setup' }]} />
      <ul className="nav nav-tabs mb-3">
        {tabs.map(([k, l]) => <li className="nav-item" key={k}><button type="button" className={`nav-link ${tab === k ? 'active' : ''}`} onClick={() => setParams({ tab: k })}>{l}</button></li>)}
      </ul>
      {tab === 'structures' && <Structures />}
      {tab === 'categories' && <Categories />}
      {tab === 'discounts' && <Discounts />}
      {tab === 'assign' && <AssignFees />}
      {tab === 'gateway' && <Gateway />}
    </>
  );
}

function Categories() {
  const auth = useAuth();
  const toast = useToast();
  const q = useQuery(() => api.list('/fees/categories', { limit: 100 }), []);
  const d = useDialog();
  const [form, setForm] = useState({});
  const save = useMutation((b) => (b._id ? api.patch(`/fees/categories/${b._id}`, { name: b.name, code: b.code, status: b.status }) : api.post('/fees/categories', { name: b.name, code: b.code })));
  const fe = save.error?.fieldErrors?.() || {};
  return (
    <div className="card table-card">
      <div className="card-header d-flex justify-content-between align-items-center">Fee categories{auth.can('fees.create') && <button className="btn btn-sm btn-primary" onClick={() => { setForm({ name: '', code: '' }); save.reset(); d.open(); }}><i className="bi bi-plus-lg me-1" />Add category</button>}</div>
      <QueryState query={q} isEmpty={(x) => !x.items.length} empty={<EmptyState icon="tags" title="No fee categories" message="Add categories like Tuition, Admission or Exam fee." />}>
        {(x) => <DataTable rows={x.items} onRowClick={auth.can('fees.update') ? (r) => { setForm(r); save.reset(); d.open(); } : undefined} columns={[{ key: 'name', label: 'Name' }, { key: 'code', label: 'Code' }, { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> }]} />}
      </QueryState>
      {d.isOpen && (
        <Modal title={form._id ? 'Edit category' : 'Add category'} onClose={d.close} footer={<><button className="btn btn-outline-secondary" onClick={d.close}>Cancel</button><button className="btn btn-primary" disabled={save.pending || !form.name || !form.code} onClick={() => save.mutate(form).then(() => { d.close(); q.reload(); toast.success('Category saved'); }).catch(() => {})}>Save</button></>}>
          <FormError error={save.error} />
          <FormField label="Name" name="n" required error={fe.name}><input id="n" className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FormField>
          <FormField label="Code" name="c" required error={fe.code} hint="Short code such as TUITION"><input id="c" className="form-control text-uppercase" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></FormField>
          {form._id && <FormField label="Status" name="s"><select id="s" className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></FormField>}
        </Modal>
      )}
    </div>
  );
}

function Discounts() {
  const auth = useAuth();
  const toast = useToast();
  const q = useQuery(() => api.list('/fees/discounts', { limit: 100 }), []);
  const cats = useQuery(() => api.list('/fees/categories', { limit: 100 }), []);
  const d = useDialog();
  const [form, setForm] = useState({});
  const save = useMutation((b) => {
    const body = { name: b.name, type: b.type, value: b.type === 'fixed' ? toMinor(b.valueText) : Number(b.valueText), categoryIds: b.categoryIds };
    return b._id ? api.patch(`/fees/discounts/${b._id}`, body) : api.post('/fees/discounts', body);
  });
  const catName = (id) => cats.data?.items.find((c) => c._id === id)?.name;
  return (
    <div className="card table-card">
      <div className="card-header d-flex justify-content-between align-items-center">Discounts and scholarships{auth.can('fees.create') && <button className="btn btn-sm btn-primary" onClick={() => { setForm({ name: '', type: 'percent', valueText: '', categoryIds: [] }); save.reset(); d.open(); }}><i className="bi bi-plus-lg me-1" />Add discount</button>}</div>
      <QueryState query={q} isEmpty={(x) => !x.items.length} empty={<EmptyState icon="percent" title="No discounts yet" />}>
        {(x) => <DataTable rows={x.items} onRowClick={auth.can('fees.update') ? (r) => { setForm({ ...r, valueText: r.type === 'fixed' ? fromMinor(r.value) : String(r.value) }); save.reset(); d.open(); } : undefined} columns={[
          { key: 'name', label: 'Name' },
          { key: 'value', label: 'Discount', render: (r) => (r.type === 'percent' ? `${r.value}%` : `${money(r.value, auth.currency)} per instalment`) },
          { key: 'cats', label: 'Applies to', render: (r) => (r.categoryIds.length ? r.categoryIds.map(catName).join(', ') : 'All categories') },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
        ]} />}
      </QueryState>
      {d.isOpen && (
        <Modal title={form._id ? 'Edit discount' : 'Add discount'} onClose={d.close} footer={<><button className="btn btn-outline-secondary" onClick={d.close}>Cancel</button><button className="btn btn-primary" disabled={save.pending || !form.name || !form.valueText} onClick={() => save.mutate(form).then(() => { d.close(); q.reload(); toast.success('Discount saved'); }).catch(() => {})}>Save</button></>}>
          <FormError error={save.error} />
          <FormField label="Name" name="n" required><input id="n" className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FormField>
          <div className="row">
            <div className="col-6"><FormField label="Type" name="t"><select id="t" className="form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="percent">Percentage</option><option value="fixed">Fixed amount</option></select></FormField></div>
            <div className="col-6"><FormField label={form.type === 'percent' ? 'Percent' : 'Amount per instalment'} name="v" required><input id="v" className="form-control" inputMode="decimal" value={form.valueText} onChange={(e) => setForm({ ...form, valueText: e.target.value })} /></FormField></div>
          </div>
          <div className="form-label">Applies to (none selected = all categories)</div>
          {cats.data?.items.map((c) => <div className="form-check" key={c._id}><input id={`dc-${c._id}`} type="checkbox" className="form-check-input" checked={form.categoryIds.includes(c._id)} onChange={(e) => setForm({ ...form, categoryIds: e.target.checked ? [...form.categoryIds, c._id] : form.categoryIds.filter((x) => x !== c._id) })} /><label htmlFor={`dc-${c._id}`} className="form-check-label">{c.name}</label></div>)}
        </Modal>
      )}
    </div>
  );
}

function Structures() {
  const auth = useAuth();
  const [sessionId, setSessionId] = useState('');
  const q = useQuery(() => api.get('/fees/structures', { sessionId }), [sessionId], { enabled: Boolean(sessionId) });
  const [editing, setEditing] = useState(null);
  if (editing) return <StructureForm initial={editing} sessionId={sessionId} onDone={() => { setEditing(null); q.reload(); }} />;
  return (
    <div className="card table-card">
      <div className="card-header d-flex flex-wrap gap-2 justify-content-between align-items-center">
        <span>Fee structures</span>
        <div className="d-flex gap-2">
          <SessionSelect value={sessionId} onChange={setSessionId} className="form-select form-select-sm" />
          {auth.can('fees.create') && <button className="btn btn-sm btn-primary text-nowrap" onClick={() => setEditing({})}><i className="bi bi-plus-lg me-1" />New structure</button>}
        </div>
      </div>
      <QueryState query={q} isEmpty={(x) => !x.items.length} empty={<EmptyState icon="layers" title="No fee structures in this session" message="Create a structure with instalments, then assign it to classes." />}>
        {(x) => <DataTable rows={x.items} onRowClick={auth.can('fees.update') ? setEditing : undefined} columns={[
          { key: 'name', label: 'Structure', render: (r) => <><div className="fw-semibold">{r.name}</div><div className="small text-muted">{r.classes.map((c) => c.name).join(', ')}</div></> },
          { key: 'inst', label: 'Instalments', render: (r) => r.installments.length },
          { key: 'late', label: 'Late fee', render: (r) => (r.lateFee?.type === 'none' ? 'None' : r.lateFee.type === 'fixed' ? money(r.lateFee.amount, auth.currency) : `${money(r.lateFee.amount, auth.currency)}/day`) },
          { key: 'students', label: 'Students', render: (r) => r.assignedStudents },
          { key: 'total', label: 'Total per student', className: 'num', render: (r) => money(r.totalAmount, auth.currency) },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
        ]} />}
      </QueryState>
    </div>
  );
}

function StructureForm({ initial, sessionId, onDone }) {
  const auth = useAuth();
  const toast = useToast();
  const structure = useQuery(() => api.get('/academics/structure', { sessionId }), [sessionId]);
  const cats = useQuery(() => api.list('/fees/categories', { status: 'active', limit: 100 }), []);
  const [f, setF] = useState(() => ({
    name: initial.name || '',
    classIds: initial.classIds?.map(String) || [],
    status: initial.status || 'active',
    lateFee: { type: initial.lateFee?.type || 'none', amount: fromMinor(initial.lateFee?.amount || 0), graceDays: initial.lateFee?.graceDays || 0, maxAmount: fromMinor(initial.lateFee?.maxAmount || 0) },
    installments: initial.installments?.map((i) => ({ name: i.name, dueDate: ymd(i.dueDate), items: i.items.map((x) => ({ categoryId: String(x.categoryId), amount: fromMinor(x.amount) })) })) || [{ name: 'Term 1', dueDate: '', items: [{ categoryId: '', amount: '' }] }],
  }));
  const save = useMutation((b) => (initial._id ? api.patch(`/fees/structures/${initial._id}`, b) : api.post('/fees/structures', { ...b, sessionId })));
  const setInst = (i, patch) => setF({ ...f, installments: f.installments.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const bad = f.installments.some((i) => !i.name || !i.dueDate || i.items.some((x) => !x.categoryId || !toMinor(x.amount)));
  const total = f.installments.reduce((t, i) => t + i.items.reduce((s, x) => s + (toMinor(x.amount) || 0), 0), 0);
  const submit = () => {
    const body = {
      name: f.name,
      classIds: f.classIds,
      status: f.status,
      installments: f.installments.map((i) => ({ name: i.name, dueDate: i.dueDate, items: i.items.map((x) => ({ categoryId: x.categoryId, amount: toMinor(x.amount) })) })),
      lateFee: { type: f.lateFee.type, amount: toMinor(f.lateFee.amount) || 0, graceDays: Number(f.lateFee.graceDays) || 0, maxAmount: toMinor(f.lateFee.maxAmount) || 0 },
    };
    save.mutate(body).then(() => { toast.success('Fee structure saved'); onDone(); }).catch(() => {});
  };
  return (
    <div className="card">
      <div className="card-header">{initial._id ? `Edit ${initial.name}` : 'New fee structure'}</div>
      <div className="card-body">
        <FormError error={save.error} />
        {initial._id && initial.assignedStudents > 0 && <div className="alert alert-info small">Changes apply to students assigned from now on. Invoices already issued keep their amounts.</div>}
        <div className="row">
          <div className="col-md-6"><FormField label="Name" name="sn" required><input id="sn" className="form-control" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Primary fees 2026-27" /></FormField></div>
          <div className="col-md-3"><FormField label="Status" name="ss"><select id="ss" className="form-select" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></FormField></div>
        </div>
        <div className="mb-3">
          <div className="form-label required">Classes</div>
          <div className="d-flex flex-wrap gap-3">
            {structure.data?.classes.map((c) => <div className="form-check" key={c.id}><input id={`cl-${c.id}`} type="checkbox" className="form-check-input" checked={f.classIds.includes(c.id)} onChange={(e) => setF({ ...f, classIds: e.target.checked ? [...f.classIds, c.id] : f.classIds.filter((x) => x !== c.id) })} /><label htmlFor={`cl-${c.id}`} className="form-check-label">{c.name}</label></div>)}
          </div>
        </div>
        <h3 className="mt-4">Instalments</h3>
        {f.installments.map((inst, i) => (
          <div key={i} className="border rounded p-3 mb-3">
            <div className="row g-2 align-items-end">
              <div className="col-md-5"><FormField label="Name" name={`in-${i}`} className="mb-0"><input id={`in-${i}`} className="form-control" value={inst.name} onChange={(e) => setInst(i, { name: e.target.value })} /></FormField></div>
              <div className="col-md-4"><FormField label="Due date" name={`id-${i}`} className="mb-0"><input id={`id-${i}`} type="date" className="form-control" value={inst.dueDate} onChange={(e) => setInst(i, { dueDate: e.target.value })} /></FormField></div>
              <div className="col-md-3 text-end">{f.installments.length > 1 && <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setF({ ...f, installments: f.installments.filter((_, j) => j !== i) })}>Remove</button>}</div>
            </div>
            {inst.items.map((it, k) => (
              <div key={k} className="row g-2 mt-1 align-items-center">
                <div className="col-6"><select className="form-select form-select-sm" aria-label="Category" value={it.categoryId} onChange={(e) => setInst(i, { items: inst.items.map((x, m) => (m === k ? { ...x, categoryId: e.target.value } : x)) })}><option value="">Category…</option>{cats.data?.items.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
                <div className="col-4"><input className="form-control form-control-sm text-end" inputMode="decimal" aria-label="Amount" placeholder="Amount" value={it.amount} onChange={(e) => setInst(i, { items: inst.items.map((x, m) => (m === k ? { ...x, amount: e.target.value } : x)) })} /></div>
                <div className="col-2">{inst.items.length > 1 && <button type="button" className="btn btn-sm btn-link text-danger" aria-label="Remove item" onClick={() => setInst(i, { items: inst.items.filter((_, m) => m !== k) })}><i className="bi bi-x-lg" /></button>}</div>
              </div>
            ))}
            <button type="button" className="btn btn-sm btn-link px-0 mt-1" onClick={() => setInst(i, { items: [...inst.items, { categoryId: '', amount: '' }] })}>+ Add item</button>
          </div>
        ))}
        <button type="button" className="btn btn-sm btn-outline-primary mb-4" onClick={() => setF({ ...f, installments: [...f.installments, { name: `Term ${f.installments.length + 1}`, dueDate: '', items: [{ categoryId: '', amount: '' }] }] })}>+ Add instalment</button>
        <h3>Late fee</h3>
        <div className="row g-2 mb-3">
          <div className="col-md-3"><FormField label="Type" name="lt" className="mb-0"><select id="lt" className="form-select" value={f.lateFee.type} onChange={(e) => setF({ ...f, lateFee: { ...f.lateFee, type: e.target.value } })}><option value="none">No late fee</option><option value="fixed">Fixed amount</option><option value="per_day">Per day</option></select></FormField></div>
          {f.lateFee.type !== 'none' && <>
            <div className="col-md-3"><FormField label={f.lateFee.type === 'per_day' ? 'Amount per day' : 'Amount'} name="la" className="mb-0"><input id="la" className="form-control" inputMode="decimal" value={f.lateFee.amount} onChange={(e) => setF({ ...f, lateFee: { ...f.lateFee, amount: e.target.value } })} /></FormField></div>
            <div className="col-md-3"><FormField label="Grace days" name="lg" className="mb-0"><input id="lg" type="number" min="0" className="form-control" value={f.lateFee.graceDays} onChange={(e) => setF({ ...f, lateFee: { ...f.lateFee, graceDays: e.target.value } })} /></FormField></div>
            {f.lateFee.type === 'per_day' && <div className="col-md-3"><FormField label="Maximum (0 = no cap)" name="lm" className="mb-0"><input id="lm" className="form-control" inputMode="decimal" value={f.lateFee.maxAmount} onChange={(e) => setF({ ...f, lateFee: { ...f.lateFee, maxAmount: e.target.value } })} /></FormField></div>}
          </>}
        </div>
        <div className="d-flex flex-wrap justify-content-between align-items-center border-top pt-3 gap-2">
          <span>Total per student: <strong>{money(total, auth.currency)}</strong></span>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={onDone}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={save.pending || !f.name || !f.classIds.length || bad} onClick={submit}>Save structure</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssignFees() {
  const toast = useToast();
  const [sessionId, setSessionId] = useState('');
  const structures = useQuery(() => api.get('/fees/structures', { sessionId, status: 'active' }), [sessionId], { enabled: Boolean(sessionId) });
  const discounts = useQuery(() => api.list('/fees/discounts', { status: 'active', limit: 100 }), []);
  const [f, setF] = useState({ structureId: '', classId: '', sectionId: '', discountIds: [] });
  const [students, setStudents] = useState([]);
  const [mode, setMode] = useState('section');
  const [result, setResult] = useState(null);
  const m = useMutation((b) => api.post('/fees/assignments', b));
  const ready = f.structureId && (mode === 'section' ? f.sectionId : students.length);
  return (
    <div className="row g-3">
      <div className="col-lg-7">
        <div className="card">
          <div className="card-header">Assign a fee structure</div>
          <div className="card-body">
            <FormError error={m.error} />
            <div className="row g-2 mb-3">
              <div className="col-md-5"><FormField label="Session" name="as" className="mb-0"><SessionSelect id="as" value={sessionId} onChange={setSessionId} /></FormField></div>
              <div className="col-md-7"><FormField label="Fee structure" name="st" required className="mb-0"><select id="st" className="form-select" value={f.structureId} onChange={(e) => setF({ ...f, structureId: e.target.value })}><option value="">Choose…</option>{structures.data?.items.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.classes.map((c) => c.name).join(', ')})</option>)}</select></FormField></div>
            </div>
            <div className="btn-group mb-3" role="group">
              <button type="button" className={`btn btn-sm ${mode === 'section' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setMode('section')}>Whole section</button>
              <button type="button" className={`btn btn-sm ${mode === 'students' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setMode('students')}>Selected students</button>
            </div>
            {mode === 'section' ? (
              <div className="d-flex gap-2 mb-3"><ClassSectionSelect sessionId={sessionId} classId={f.classId} sectionId={f.sectionId} allowAll={false} sectionRequired onChange={(v) => setF({ ...f, ...v })} /></div>
            ) : (
              <div className="mb-3">
                <StudentPicker onSelect={(s) => !students.some((x) => x._id === s._id) && setStudents([...students, s])} />
                <div className="d-flex flex-wrap gap-2 mt-2">{students.map((s) => <span key={s._id} className="badge text-bg-light border">{s.fullName} <button type="button" className="btn btn-link btn-sm p-0 ms-1" aria-label={`Remove ${s.fullName}`} onClick={() => setStudents(students.filter((x) => x._id !== s._id))}>×</button></span>)}</div>
              </div>
            )}
            <div className="form-label">Discounts (optional)</div>
            {discounts.data?.items.length === 0 && <div className="small text-muted mb-2">No active discounts.</div>}
            {discounts.data?.items.map((dsc) => <div className="form-check" key={dsc._id}><input id={`ad-${dsc._id}`} type="checkbox" className="form-check-input" checked={f.discountIds.includes(dsc._id)} onChange={(e) => setF({ ...f, discountIds: e.target.checked ? [...f.discountIds, dsc._id] : f.discountIds.filter((x) => x !== dsc._id) })} /><label htmlFor={`ad-${dsc._id}`} className="form-check-label">{dsc.name}</label></div>)}
            <button type="button" className="btn btn-primary mt-3" disabled={!ready || m.pending} onClick={() => m.mutate({ structureId: f.structureId, discountIds: f.discountIds, ...(mode === 'section' ? { sectionId: f.sectionId } : { studentIds: students.map((s) => s._id) }) }).then((r) => { setResult(r); toast.success(`Assigned to ${r.assigned} students`); }).catch(() => {})}>
              {m.pending && <span className="spinner-border spinner-border-sm me-2" />}Generate invoices
            </button>
          </div>
        </div>
      </div>
      <div className="col-lg-5">
        {result && (
          <div className="card">
            <div className="card-header">Result</div>
            <div className="card-body">
              <p className="mb-2"><strong>{result.assigned}</strong> students assigned · <strong>{result.invoicesCreated}</strong> invoices created</p>
              {result.skipped.length > 0 && <><div className="fw-semibold small mb-1">Skipped ({result.skipped.length})</div><ul className="small mb-0">{Object.entries(result.skipped.reduce((a, s) => ({ ...a, [s.reason]: (a[s.reason] || 0) + 1 }), {})).map(([k, v]) => <li key={k}>{titleCase(k.toLowerCase())}: {v}</li>)}</ul></>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Gateway() {
  const auth = useAuth();
  const toast = useToast();
  const q = useQuery(() => api.get('/fees/gateway'), []);
  const [f, setF] = useState({ keyId: '', keySecret: '', webhookSecret: '' });
  const save = useMutation((b) => api.put('/fees/gateway', b));
  const canEdit = auth.can('fees.update', 'settings.update');
  const fe = save.error?.fieldErrors?.() || {};
  return (
    <div className="row g-3">
      <div className="col-lg-7">
        <div className="card">
          <div className="card-header">Razorpay</div>
          <div className="card-body">
            <QueryState query={q}>
              {(g) => (
                <>
                  <p className="text-muted small">Connect your school’s own Razorpay account so parents can pay online and money goes directly to the school. Secrets are stored encrypted and are never shown again.</p>
                  <div className="mb-3">Status: {g.configured ? <StatusBadge status={g.enabled ? 'active' : 'disabled'} label={g.enabled ? `Connected (${g.keyId})` : 'Disabled'} /> : <StatusBadge status="draft" label="Not connected" />}</div>
                  {canEdit ? (
                    <>
                      <FormError error={save.error} />
                      <FormField label="Key ID" name="k" error={fe.keyId}><input id="k" className="form-control" placeholder={g.keyId || 'rzp_live_…'} value={f.keyId} onChange={(e) => setF({ ...f, keyId: e.target.value })} /></FormField>
                      <FormField label="Key secret" name="s" error={fe.keySecret} hint={g.configured ? 'Leave empty to keep the current secret' : null}><input id="s" type="password" className="form-control" autoComplete="off" value={f.keySecret} onChange={(e) => setF({ ...f, keySecret: e.target.value })} /></FormField>
                      <FormField label="Webhook secret" name="w" hint={`Webhook URL: ${window.location.origin}${g.webhookPath || '/api/v1/webhooks/razorpay/<school>'} · events payment.captured, order.paid`}><input id="w" type="password" className="form-control" autoComplete="off" value={f.webhookSecret} onChange={(e) => setF({ ...f, webhookSecret: e.target.value })} /></FormField>
                      <div className="d-flex gap-2">
                        <button className="btn btn-primary" disabled={save.pending || (!g.configured && (!f.keyId || !f.keySecret))} onClick={() => save.mutate(Object.fromEntries(Object.entries(f).filter(([, v]) => v))).then((r) => { q.setData(r); setF({ keyId: '', keySecret: '', webhookSecret: '' }); toast.success('Payment gateway saved'); }).catch(() => {})}>Save</button>
                        {g.configured && <button className="btn btn-outline-secondary" disabled={save.pending} onClick={() => save.mutate({ enabled: !g.enabled }).then((r) => { q.setData(r); toast.success(r.enabled ? 'Online payments enabled' : 'Online payments disabled'); }).catch(() => {})}>{g.enabled ? 'Disable' : 'Enable'}</button>}
                      </div>
                    </>
                  ) : <p className="small text-muted mb-0">Only school administrators can change payment gateway settings.</p>}
                </>
              )}
            </QueryState>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ reports ------------------------------ */

export function FeeReports() {
  const auth = useAuth();
  const monthStart = todayYmd().slice(0, 8) + '01';
  const [f, setF] = useState({ from: monthStart, to: todayYmd(), groupBy: 'day' });
  const col = useQuery(() => api.get('/fees/reports/collections', f), [JSON.stringify(f)], { enabled: Boolean(f.from && f.to) });
  const out = useQuery(() => api.get('/fees/reports/outstanding'), []);
  const c = auth.currency;
  return (
    <>
      <PageHeader title="Fee reports" description="Collections, outstanding balances and the day book" breadcrumbs={[{ label: 'Fees', to: '/fees' }, { label: 'Reports' }]} />
      <div className="card mb-3">
        <div className="card-header d-flex flex-wrap gap-2 align-items-center">
          <span className="me-auto">Collections</span>
          <input type="date" className="form-control form-control-sm" style={{ maxWidth: 150 }} aria-label="From" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
          <input type="date" className="form-control form-control-sm" style={{ maxWidth: 150 }} aria-label="To" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
          <select className="form-select form-select-sm" style={{ maxWidth: 150 }} aria-label="Group by" value={f.groupBy} onChange={(e) => setF({ ...f, groupBy: e.target.value })}>
            <option value="day">By day</option><option value="method">By method</option><option value="category">By category</option><option value="class">By class</option>
          </select>
        </div>
        <div className="card-body">
          <QueryState query={col}>
            {(r) => (
              <>
                <div className="d-flex flex-wrap gap-4 mb-3">
                  <span>Received <strong>{money(r.totals.received, c)}</strong> ({r.totals.payments})</span>
                  <span>Refunded <strong className="text-danger">{money(r.totals.refunded, c)}</strong></span>
                  <span>Net <strong className="text-success">{money(r.totals.net, c)}</strong></span>
                </div>
                {f.groupBy === 'day' && <BarChart data={r.rows.map((x) => ({ label: x.key.slice(5), value: x.amount }))} format={(v) => money(v, c)} />}
                <DataTable keyField="key" rows={r.rows} columns={[
                  { key: 'label', label: titleCase(f.groupBy), render: (x) => (f.groupBy === 'day' ? date(x.key) : titleCase(String(x.label))) },
                  ...(f.groupBy === 'category'
                    ? [{ key: 'received', label: 'Received', className: 'num', render: (x) => money(x.received, c) }, { key: 'refunded', label: 'Refunded', className: 'num', render: (x) => money(x.refunded, c) }, { key: 'net', label: 'Net', className: 'num', render: (x) => money(x.net, c) }]
                    : [{ key: 'count', label: 'Payments', className: 'num' }, { key: 'amount', label: 'Amount', className: 'num', render: (x) => money(x.amount, c) }]),
                ]} />
              </>
            )}
          </QueryState>
        </div>
      </div>
      <div className="card table-card">
        <div className="card-header">Outstanding by class</div>
        <QueryState query={out}>
          {(r) => <DataTable keyField="name" rows={r.rows} columns={[
            { key: 'name', label: 'Class' },
            { key: 'students', label: 'Students', className: 'num' },
            { key: 'invoices', label: 'Open invoices', className: 'num' },
            { key: 'overdue', label: 'Overdue', className: 'num', render: (x) => <span className="text-danger">{money(x.overdue, c)}</span> },
            { key: 'balance', label: 'Outstanding', className: 'num', render: (x) => <strong>{money(x.balance, c)}</strong> },
          ]} />}
        </QueryState>
      </div>
    </>
  );
}
