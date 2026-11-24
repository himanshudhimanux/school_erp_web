import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api/client.js';
import { useMutation, useQuery } from '../hooks/useApi.js';
import { useToast } from '../components/Toast.jsx';
import { PageHeader, StatCard, StatusBadge, QueryState, EmptyState, DataTable, Pagination, FormField, FormError, Modal, ConfirmDialog, useDialog } from '../components/ui.jsx';
import { PaymentReceipt } from './fees.jsx';
import { ReportCardView } from './exams.jsx';
import { FamilyLibraryCard, FamilyHostelCard } from './services.jsx';
import { money, date, dateTime, pct, todayYmd, DAY_NAMES } from '../utils/format.js';

/** Children of the signed-in parent (or the student themself) and the selected child id. */
function useChild() {
  const auth = useAuth();
  const [params, setParams] = useSearchParams();
  const kids = useQuery(() => (auth.isParent ? api.get('/portal/children').then((d) => d.children) : api.get('/portal/student').then((d) => [d.student])), []);
  const studentId = params.get('studentId') || kids.data?.[0]?.studentId;
  const picker = kids.data?.length > 1 && (
    <div className="btn-group mb-3 flex-wrap" role="tablist" aria-label="Choose child">
      {kids.data.map((k) => <button key={k.studentId} type="button" role="tab" aria-selected={k.studentId === studentId} className={`btn ${k.studentId === studentId ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setParams({ studentId: k.studentId })}>{k.firstName || k.name}</button>)}
    </div>
  );
  return { kids, studentId, picker, child: kids.data?.find((k) => k.studentId === studentId), sid: auth.isParent ? studentId : undefined };
}

/** Loads Razorpay Checkout on demand (only when a parent chooses to pay online). */
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load the payment window. Check your connection.'));
    document.body.appendChild(s);
  });
}

export function MyFees() {
  const auth = useAuth();
  const toast = useToast();
  const { kids, studentId, picker, sid } = useChild();
  const q = useQuery(() => api.get('/portal/fees', { studentId: sid }), [studentId], { enabled: Boolean(studentId) });
  const [selected, setSelected] = useState([]);
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const receiptQ = useDialog();
  const open = (q.data?.invoices || []).filter((i) => ['unpaid', 'partially_paid'].includes(i.status));
  useEffect(() => setSelected(open.filter((i) => i.displayStatus === 'overdue' || i === open[0]).map((i) => i._id)), [q.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = open.filter((i) => selected.includes(i._id)).reduce((t, i) => t + i.balance, 0);
  const c = auth.currency;

  const payOnline = async () => {
    setPaying(true);
    try {
      const order = await api.post('/portal/fees/orders', { studentId: sid, invoiceIds: selected });
      await loadRazorpay();
      await new Promise((resolve) => {
        const rz = new window.Razorpay({
          key: order.keyId,
          order_id: order.orderId,
          amount: order.amount,
          currency: order.currency,
          name: order.schoolName,
          description: order.invoices.map((i) => i.invoiceNo).join(', '),
          prefill: { email: auth.user.email, name: auth.user.name },
          handler: async (resp) => {
            try {
              const r = await api.post('/portal/fees/orders/verify', { orderId: resp.razorpay_order_id, paymentId: resp.razorpay_payment_id, signature: resp.razorpay_signature });
              setReceipt(r);
              toast.success(`Payment successful · receipt ${r.receiptNo}`);
              q.reload();
            } catch (e) {
              toast.error(`We could not confirm the payment yet (${e.message}). If money was deducted it will be recorded automatically; please check again shortly.`);
            }
            resolve();
          },
          modal: { ondismiss: resolve },
        });
        rz.on('payment.failed', (resp) => toast.error(resp.error?.description || 'Payment failed'));
        rz.open();
      });
    } catch (e) {
      toast.error(e.code === 'PAYMENTS_NOT_CONFIGURED' ? 'Online payment is not available. Please pay at the school office.' : e.message);
    } finally {
      setPaying(false);
    }
  };

  return (
    <>
      <PageHeader title="Fees" description="Invoices, payments and receipts" />
      {picker}
      {receipt && <div className="alert alert-success d-flex justify-content-between align-items-center">Payment of {money(receipt.amount, c)} received. Receipt {receipt.receiptNo}.<button className="btn btn-sm btn-success" onClick={() => receiptQ.open(receipt)}>View receipt</button></div>}
      {kids.data?.length === 0 && <EmptyState icon="people" title="No student linked to your account" />}
      {studentId && (
        <QueryState query={q}>
          {(a) => (
            <>
              <div className="row g-3 mb-3">
                <div className="col-6 col-lg-3"><StatCard label="Balance due" value={money(a.summary.balance, c)} tone={a.summary.balance ? 'warning' : 'success'} icon="cash-stack" /></div>
                <div className="col-6 col-lg-3"><StatCard label="Overdue" value={money(a.summary.overdue, c)} tone={a.summary.overdue ? 'danger' : 'success'} icon="exclamation-diamond" /></div>
                <div className="col-6 col-lg-3"><StatCard label="Next due" value={a.summary.nextDue ? date(a.summary.nextDue.dueDate) : '—'} hint={a.summary.nextDue && money(a.summary.nextDue.balance, c)} icon="calendar-event" /></div>
                <div className="col-6 col-lg-3"><StatCard label="Paid so far" value={money(a.summary.paid, c)} tone="success" icon="check2-circle" /></div>
              </div>
              {open.length > 0 && (
                <div className="card mb-3">
                  <div className="card-header">Pending fees</div>
                  <div className="list-group list-group-flush">
                    {open.map((i) => (
                      <label key={i._id} className="list-group-item d-flex gap-3 align-items-center">
                        <input type="checkbox" className="form-check-input mt-0" checked={selected.includes(i._id)} onChange={(e) => setSelected(e.target.checked ? [...selected, i._id] : selected.filter((x) => x !== i._id))} />
                        <span className="flex-grow-1"><span className="fw-semibold d-block">{i.title}</span><span className="small text-muted">Due {date(i.dueDate)} · {i.invoiceNo}</span></span>
                        <StatusBadge status={i.displayStatus} />
                        <span className="fw-semibold">{money(i.balance, c)}</span>
                      </label>
                    ))}
                  </div>
                  <div className="card-body d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <span>Selected: <strong className="fs-5">{money(total, c)}</strong></span>
                    {a.onlinePayment.available ? <button className="btn btn-primary btn-lg" disabled={!selected.length || paying} onClick={payOnline}>{paying && <span className="spinner-border spinner-border-sm me-2" />}Pay online</button> : <span className="small text-muted">Online payment is not set up. Please pay at the school office.</span>}
                  </div>
                </div>
              )}
              <div className="card table-card">
                <div className="card-header">Payment history</div>
                <DataTable rows={a.payments} empty={<EmptyState icon="receipt" title="No payments yet" />} onRowClick={(p) => api.get(`/portal/fees/payments/${p._id}/receipt`).then((r) => receiptQ.open(r)).catch((e) => toast.error(e.message))} columns={[
                  { key: 'receiptNo', label: 'Receipt' }, { key: 'paidAt', label: 'Date', render: (p) => date(p.paidAt) }, { key: 'method', label: 'Paid by', render: (p) => (p.source === 'online' ? 'Online' : p.method.replace('_', ' ')) },
                  { key: 'status', label: 'Status', render: (p) => <StatusBadge status={p.status} /> }, { key: 'amount', label: 'Amount', className: 'num', render: (p) => money(p.amount, c) },
                ]} />
              </div>
            </>
          )}
        </QueryState>
      )}
      {receiptQ.isOpen && <Modal title={`Receipt ${receiptQ.item.receiptNo}`} size="modal-lg" onClose={receiptQ.close} footer={<button className="btn btn-primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />Print</button>}><PaymentReceipt r={receiptQ.item} currency={c} /></Modal>}
    </>
  );
}

export function MyAttendance() {
  const { studentId, picker, sid } = useChild();
  const q = useQuery(() => api.get('/portal/attendance', { studentId: sid }), [studentId], { enabled: Boolean(studentId) });
  return (
    <>
      <PageHeader title="Attendance" />
      {picker}
      <QueryState query={q}>
        {(a) => (
          <>
            <div className="row g-3 mb-3">
              <div className="col-6 col-lg-3"><StatCard label="Attendance" value={pct(a.summary.percentage)} tone={a.summary.percentage !== null && a.summary.percentage < a.threshold ? 'danger' : 'success'} icon="percent" hint={a.summary.percentage !== null && a.summary.percentage < a.threshold ? `Below the school’s ${a.threshold}% requirement` : null} /></div>
              <div className="col-6 col-lg-3"><StatCard label="Present" value={a.summary.present + a.summary.late} hint={`${a.summary.late} late`} tone="success" icon="person-check" /></div>
              <div className="col-6 col-lg-3"><StatCard label="Absent" value={a.summary.absent} tone="danger" icon="person-x" /></div>
              <div className="col-6 col-lg-3"><StatCard label="Leave" value={a.summary.leave} tone="info" icon="envelope-paper" /></div>
            </div>
            <div className="card table-card"><DataTable keyField="date" rows={a.records} empty={<EmptyState icon="calendar" title="No attendance recorded yet" />} columns={[{ key: 'date', label: 'Date', render: (r) => `${DAY_NAMES[new Date(r.date).getUTCDay()].slice(0, 3)}, ${date(r.date)}` }, { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { key: 'remark', label: 'Note', render: (r) => r.remark || '' }]} /></div>
          </>
        )}
      </QueryState>
    </>
  );
}

export function MyResults() {
  const { studentId, picker, sid } = useChild();
  const q = useQuery(() => api.get('/portal/results', { studentId: sid }), [studentId], { enabled: Boolean(studentId) });
  const schedule = useQuery(() => api.get('/portal/exams', { studentId: sid }), [studentId], { enabled: Boolean(studentId) });
  const year = useQuery(() => api.get('/portal/report-card', { studentId: sid }), [studentId], { enabled: Boolean(studentId) });
  const card = useDialog();
  const upcoming = (schedule.data?.exams || []).filter((e) => new Date(e.endDate) >= new Date(todayYmd()));
  return (
    <>
      <PageHeader title="Exams & results" />
      {picker}
      {upcoming.length > 0 && (
        <div className="card table-card mb-3">
          <div className="card-header">Upcoming exams</div>
          {upcoming.map((e) => <div key={e.id} className="px-3 py-2 border-bottom"><div className="fw-semibold">{e.name} <span className="text-muted small">{date(e.startDate)} – {date(e.endDate)}</span></div><div className="small text-muted">{e.papers.map((p) => `${p.subject?.name} ${date(p.date, { day: '2-digit', month: 'short', year: undefined })}`).join(' · ')}</div></div>)}
        </div>
      )}
      <div className="card table-card mb-3">
        <div className="card-header">Published results</div>
        <QueryState query={q} isEmpty={(r) => !r.results.length} empty={<EmptyState icon="journal" title="No results published yet" />}>
          {(r) => <DataTable keyField="examId" rows={r.results} onRowClick={(x) => api.get(`/portal/results/${x.examId}`, { studentId: sid }).then(card.open)} columns={[{ key: 'exam', label: 'Exam', render: (x) => x.exam?.name }, { key: 'marks', label: 'Marks', render: (x) => `${x.total} / ${x.maxTotal}` }, { key: 'pct', label: '%', render: (x) => pct(x.percentage) }, { key: 'grade', label: 'Grade' }, { key: 'rank', label: 'Rank', render: (x) => x.rankInSection ?? '—' }, { key: 'result', label: 'Result', render: (x) => <StatusBadge status={x.result} /> }]} />}
        </QueryState>
      </div>
      {year.data?.exams?.length > 1 && <button className="btn btn-outline-primary" onClick={() => card.open(year.data)}>View whole-year report card</button>}
      {card.isOpen && <Modal title="Report card" size="modal-lg" onClose={card.close} footer={<button className="btn btn-primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />Print</button>}><ReportCardView card={card.item} /></Modal>}
    </>
  );
}

export function MyTimetable() {
  const { studentId, picker, sid } = useChild();
  const q = useQuery(() => api.get('/portal/timetable', { studentId: sid }), [studentId], { enabled: Boolean(studentId) });
  return (
    <>
      <PageHeader title="Timetable" />
      {picker}
      <QueryState query={q} isEmpty={(t) => !t.schedule} empty={<EmptyState icon="clock" title="No timetable published yet" />}>
        {(t) => (
          <div className="card table-card"><div className="card-header">{t.section?.displayName}</div><div className="table-responsive"><table className="table table-bordered mb-0"><thead><tr><th>Period</th>{t.schedule.workingDays.map((d) => <th key={d}>{DAY_NAMES[d].slice(0, 3)}</th>)}</tr></thead><tbody>
            {t.schedule.periods.map((p) => <tr key={p.number} className={p.isBreak ? 'table-light' : ''}><td className="text-nowrap"><div className="fw-semibold">{p.label || `P${p.number}`}</div><div className="small text-muted">{p.startTime}–{p.endTime}</div></td>{t.schedule.workingDays.map((d) => { const e = t.entries.find((x) => x.day === d && x.periodNumber === p.number); return <td key={d} className="small">{p.isBreak ? 'Break' : e ? <><div className="fw-semibold">{e.subject?.name}</div><div className="text-muted">{e.teacher?.name || ''}</div></> : ''}</td>; })}</tr>)}
          </tbody></table></div></div>
        )}
      </QueryState>
    </>
  );
}

export function MyLeave() {
  const toast = useToast();
  const { studentId, picker, sid, child } = useChild();
  const q = useQuery(() => api.list('/portal/leave-requests', { studentId: sid, limit: 20 }), [studentId], { enabled: Boolean(studentId) });
  const d = useDialog();
  const [f, setF] = useState({ fromDate: todayYmd(), toDate: todayYmd(), reason: '' });
  const add = useMutation((b) => api.post('/portal/leave-requests', b));
  const cancel = useDialog();
  const cancelM = useMutation((id) => api.post(`/portal/leave-requests/${id}/cancel`));
  return (
    <>
      <PageHeader title="Leave requests" description="Tell the school in advance when your child will be away" actions={<button className="btn btn-primary" onClick={() => { add.reset(); d.open(); }}><i className="bi bi-plus-lg me-1" />Request leave</button>} />
      {picker}
      <div className="card table-card">
        <QueryState query={q} isEmpty={(x) => !x.items.length} empty={<EmptyState icon="envelope-paper" title="No leave requests" />}>
          {(x) => <DataTable rows={x.items} columns={[{ key: 'dates', label: 'Dates', render: (r) => `${date(r.fromDate)} – ${date(r.toDate)}` }, { key: 'reason', label: 'Reason' }, { key: 'status', label: 'Status', render: (r) => <><StatusBadge status={r.status} />{r.reviewNote && <div className="small text-muted">{r.reviewNote}</div>}</> }, { key: 'x', label: '', className: 'text-end', render: (r) => (r.status === 'pending' || (r.status === 'approved' && new Date(r.fromDate) > new Date())) && <button className="btn btn-sm btn-link text-danger" onClick={() => cancel.open(r)}>Cancel</button> }]} />}
        </QueryState>
        <Pagination meta={q.data?.meta} onPage={() => {}} />
      </div>
      {d.isOpen && (
        <Modal title={`Request leave${child ? ` for ${child.firstName || child.name}` : ''}`} onClose={d.close} footer={<><button className="btn btn-outline-secondary" onClick={d.close}>Cancel</button><button className="btn btn-primary" disabled={add.pending || f.reason.length < 3} onClick={() => add.mutate({ studentId, ...f }).then(() => { d.close(); q.reload(); toast.success('Leave request sent to the school'); }).catch(() => {})}>Send request</button></>}>
          <FormError error={add.error} />
          <div className="row"><div className="col-6"><FormField label="From" name="lf" required><input id="lf" type="date" className="form-control" min={todayYmd()} value={f.fromDate} onChange={(e) => setF({ ...f, fromDate: e.target.value })} /></FormField></div><div className="col-6"><FormField label="To" name="lt" required><input id="lt" type="date" className="form-control" min={f.fromDate} value={f.toDate} onChange={(e) => setF({ ...f, toDate: e.target.value })} /></FormField></div></div>
          <FormField label="Reason" name="lr" required className="mb-0"><textarea id="lr" className="form-control" rows="3" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></FormField>
        </Modal>
      )}
      {cancel.isOpen && <ConfirmDialog title="Cancel this leave request?" tone="danger" confirmLabel="Cancel request" pending={cancelM.pending} onCancel={cancel.close} onConfirm={() => cancelM.mutate(cancel.item._id).then(() => { cancel.close(); q.reload(); toast.success('Request cancelled'); }).catch((e) => { cancel.close(); toast.error(e.message); })} />}
    </>
  );
}

export function Notifications() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const q = useQuery(() => api.list('/portal/notifications', { page, limit: 20 }), [page]);
  const readAll = useMutation(() => api.post('/portal/notifications/read-all'));
  return (
    <>
      <PageHeader title="Notifications" actions={q.data?.meta?.unread > 0 && <button className="btn btn-outline-primary" disabled={readAll.pending} onClick={() => readAll.mutate().then(() => { q.reload(); toast.success('All marked as read'); })}>Mark all as read</button>} />
      <div className="card">
        <QueryState query={q} isEmpty={(x) => !x.items.length} empty={<EmptyState icon="bell" title="No notifications yet" />}>
          {(x) => x.items.map((n) => (
            <div key={n._id} className={`px-3 py-3 border-bottom ${n.readAt ? '' : 'bg-light'}`}>
              <div className="d-flex justify-content-between gap-2"><span className="fw-semibold">{!n.readAt && <span className="badge text-bg-primary me-2">New</span>}{n.title}</span><span className="small text-muted text-nowrap">{dateTime(n.createdAt)}</span></div>
              <div className="text-muted mt-1">{n.body}</div>
              {n.type?.startsWith('fees.') && <Link to="/my/fees" className="small">Go to fees</Link>}
            </div>
          ))}
        </QueryState>
        <Pagination meta={q.data?.meta} onPage={setPage} />
      </div>
    </>
  );
}

export function MyLibrary() {
  const auth = useAuth();
  const { studentId, picker, sid } = useChild();
  return (
    <>
      <PageHeader title="Library & hostel" />
      {picker}
      {studentId && (
        <div className="d-grid gap-3">
          {auth.can('hostel.read') && <FamilyHostelCard studentId={sid} />}
          {auth.can('library.read') && <FamilyLibraryCard studentId={sid} />}
        </div>
      )}
    </>
  );
}
