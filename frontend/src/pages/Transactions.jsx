import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Truck, Wallet, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';
import { money, num, fmtDateTime } from '@/lib/format';

const SHIPMENT_STEPS = ['PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'];

export default function Transactions() {
  const [txs, setTxs] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = () => api.get('/transactions').then((r) => setTxs(r.data.transactions));
  useEffect(() => { load(); }, []);

  if (!txs) return <div className="loading">Loading transactions…</div>;

  const advanceShipment = async (id) => {
    setBusy('ship-' + id);
    try { await api.post(`/transactions/${id}/shipment/advance`); await load(); } finally { setBusy(null); }
  };
  const settlePayment = async (id) => {
    setBusy('pay-' + id);
    try { await api.post(`/transactions/${id}/payment/settle`); await load(); } finally { setBusy(null); }
  };

  if (txs.length === 0) return <div className="loading" data-testid="tx-empty">No transactions yet. Accept an offer to start one.</div>;

  return (
    <div data-testid="transactions-page">
      <p className="eyebrow">TRANSACTIONS</p>
      <h1 style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: 40, color: '#18321d', margin: '6px 0 24px' }}>Every step, auditable.</h1>

      <div className="tx-list">
        {txs.map((tx) => {
          const stepIdx = SHIPMENT_STEPS.indexOf(tx.shipment?.status || 'PENDING');
          return (
            <div key={tx.id} className="tx-card" data-testid={`tx-card-${tx.code}`}>
              <div className="tx-card-head">
                <div><b>{tx.code}</b><span>{tx.lot.crop} · {num(tx.lot.quantityQuintals)} q · {money(tx.amount)}</span></div>
                <span className={`status-chip status-${tx.status.toLowerCase()}`}>{tx.status.replace(/_/g, ' ')}</span>
              </div>

              <div className="tx-timeline">
                {SHIPMENT_STEPS.map((s, i) => (
                  <div key={s} className={i <= stepIdx ? 'done' : ''}>
                    {i <= stepIdx ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                    <span>{s.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>

              <div className="tx-grid">
                <div>
                  <p className="eyebrow"><Truck size={12} /> SHIPMENT</p>
                  <b>{tx.shipment?.status || 'Pending'}</b>
                  <small>{tx.shipment?.pickupLocation} → {tx.shipment?.destination} · {Math.round(Number(tx.shipment?.distanceKm || 0))} km</small>
                  {tx.shipment && tx.shipment.status !== 'DELIVERED' && (
                    <button className="outline-btn" onClick={() => advanceShipment(tx.id)} disabled={busy === 'ship-' + tx.id} data-testid={`advance-shipment-${tx.code}`}>
                      {busy === 'ship-' + tx.id ? 'Advancing…' : 'Advance shipment'}
                    </button>
                  )}
                </div>
                <div>
                  <p className="eyebrow"><Wallet size={12} /> PAYMENT (MOCK)</p>
                  <b>{tx.payment?.status || 'Pending'}</b>
                  <small>{tx.payment?.reference || 'Not yet settled'} · {money(tx.payment?.amount || tx.amount)}</small>
                  {tx.payment && tx.payment.status !== 'SUCCESS' && (
                    <button className="outline-btn" onClick={() => settlePayment(tx.id)} disabled={busy === 'pay-' + tx.id} data-testid={`settle-payment-${tx.code}`}>
                      {busy === 'pay-' + tx.id ? 'Settling…' : 'Settle mock payment'}
                    </button>
                  )}
                </div>
                <div>
                  <p className="eyebrow"><ShieldCheck size={12} /> AUDIT EVENTS · {tx.blockchainEvents?.length || 0}</p>
                  <ul className="audit-log" data-testid={`audit-${tx.code}`}>
                    {(tx.blockchainEvents || []).slice(-5).map((e) => (
                      <li key={e.id}>
                        <b>{e.eventType}</b>
                        <span>{fmtDateTime(e.createdAt)}</span>
                        <em>{e.isDemo ? 'MOCK CHAIN' : 'LIVE CHAIN'}</em>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="demo-notice" data-testid={`tx-demo-notice-${tx.code}`}>
                <ShieldCheck size={12} /> Shipment status, payment settlement and blockchain audit are MOCK providers. Wire real transporter/Razorpay/EVM RPC to switch to live.
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
