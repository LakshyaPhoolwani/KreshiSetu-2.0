import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { money, num, fmtDateTime } from '@/lib/format';
import { PackageCheck, ScrollText, Users, Wallet } from 'lucide-react';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/dashboard').then((r) => setData(r.data)); }, []);
  if (!data) return <div className="loading">Loading admin dashboard…</div>;
  return (
    <div data-testid="admin-dashboard">
      <section className="role-hero">
        <p className="eyebrow">ADMIN</p>
        <h1>Trust at every step.</h1>
        <p>Platform activity is healthy — click any transaction to inspect the audit trail.</p>
      </section>
      <div className="stat-grid">
        <div className="stat" data-testid="stat-total-users"><div className="stat-icon green"><Users size={18} /></div><div><span>Total users</span><strong>{data.stats.totalUsers}</strong><small>All roles</small></div></div>
        <div className="stat" data-testid="stat-total-lots"><div className="stat-icon orange"><PackageCheck size={18} /></div><div><span>Total lots</span><strong>{data.stats.totalLots}</strong><small>All statuses</small></div></div>
        <div className="stat" data-testid="stat-total-offers"><div className="stat-icon blue"><ScrollText size={18} /></div><div><span>Total offers</span><strong>{data.stats.totalOffers}</strong><small>Lifetime</small></div></div>
        <div className="stat" data-testid="stat-recent-tx"><div className="stat-icon green"><Wallet size={18} /></div><div><span>Recent transactions</span><strong>{data.stats.recentTransactions}</strong><small>Last 10</small></div></div>
      </div>
      <section className="section-head" style={{ marginTop: 32 }}><div><p className="eyebrow">RECENT TRANSACTIONS</p><h2>Audit trail</h2></div></section>
      <div className="tx-list">
        {data.recentTransactions.map((tx) => (
          <div key={tx.id} className="tx-card" data-testid={`admin-tx-${tx.code}`}>
            <div className="tx-card-head"><div><b>{tx.code}</b><span>{money(tx.amount)} · {fmtDateTime(tx.createdAt)}</span></div><span className={`status-chip status-${tx.status.toLowerCase()}`}>{tx.status}</span></div>
            <div className="offer-body">
              <div><span>Payment</span><b>{tx.payment?.status || 'Pending'}</b></div>
              <div><span>Ref</span><b>{tx.payment?.reference || '—'}</b></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
