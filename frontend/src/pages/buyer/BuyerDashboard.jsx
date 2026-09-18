import { useEffect, useState } from 'react';
import { Building2, PackageCheck, ShoppingBasket, ChevronRight, Plus } from 'lucide-react';
import api from '@/lib/api';
import { money, num, fmtDate } from '@/lib/format';

export default function BuyerDashboard() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/dashboard').then((r) => setData(r.data)); }, []);
  if (!data) return <div className="loading">Loading buyer dashboard…</div>;
  return (
    <div data-testid="buyer-dashboard">
      <section className="role-hero">
        <p className="eyebrow">BUYER · {data.buyer.companyName}</p>
        <h1>Demand that meets the right supply.</h1>
        <p>{data.stats.matches} lots match your active demand across Maharashtra.</p>
      </section>

      <div className="stat-grid">
        <div className="stat" data-testid="stat-active-demands"><div className="stat-icon green"><ShoppingBasket size={18} /></div><div><span>Active demands</span><strong>{data.stats.activeDemands}</strong><small>Live requirements</small></div></div>
        <div className="stat" data-testid="stat-matches"><div className="stat-icon orange"><PackageCheck size={18} /></div><div><span>Matching lots</span><strong>{data.stats.matches}</strong><small>Deterministically scored</small></div></div>
        <div className="stat" data-testid="stat-pending-offers"><div className="stat-icon blue"><Building2 size={18} /></div><div><span>Pending offers</span><strong>{data.stats.pendingOffers}</strong><small>Awaiting farmer</small></div></div>
        <div className="stat" data-testid="stat-accepted"><div className="stat-icon green"><ChevronRight size={18} /></div><div><span>Accepted</span><strong>{data.stats.accepted}</strong><small>In fulfilment</small></div></div>
      </div>

      <section className="section-head" style={{ marginTop: 32 }}>
        <div><p className="eyebrow">MY DEMANDS</p><h2>What you're buying</h2></div>
        <a className="outline-btn" href="/app/demands" data-testid="manage-demands-link"><Plus size={14} /> Manage demand</a>
      </section>

      <div className="lots-grid">
        {data.demands.slice(0, 6).map((d) => (
          <div key={d.id} className="lot-card" data-testid={`demand-${d.id}`}>
            <div className="lot-card-head">
              <div><b>{d.crop}</b><span>{num(d.quantityQuintals)} q · {d.minQuality}</span></div>
              <span className={`status-chip ${d.active ? '' : 'status-rejected'}`}>{d.active ? 'ACTIVE' : 'PAUSED'}</span>
            </div>
            <div className="lot-card-body">
              <div><span>Offering</span><b>{money(d.pricePerQuintal)}/q</b></div>
              <div><span>Location</span><b>{d.location}</b></div>
              <div><span>Required by</span><b>{fmtDate(d.requiredBy)}</b></div>
            </div>
          </div>
        ))}
      </div>

      <section className="section-head" style={{ marginTop: 32 }}>
        <div><p className="eyebrow">MATCHED LOTS</p><h2>Top {data.matches.length} matches</h2></div>
      </section>
      <div className="lots-grid">
        {data.matches.slice(0, 6).map((m) => (
          <div key={m.id} className="lot-card" data-testid={`match-${m.id}`}>
            <div className="lot-card-head">
              <div><b>{m.lot.code}</b><span>{m.lot.crop} · {m.lot.quality}</span></div>
              <span className="status-chip"><i></i> {Math.round(Number(m.matchScore))}% match</span>
            </div>
            <div className="lot-card-body">
              <div><span>Farmer</span><b>{m.lot.farmer?.user?.name || '—'}</b></div>
              <div><span>Quantity</span><b>{num(m.lot.quantityQuintals)} q</b></div>
              <div><span>Location</span><b>{m.lot.pickupLocation}</b></div>
            </div>
            <div className="rec-card-reason">{m.reason}</div>
          </div>
        ))}
        {data.matches.length === 0 && <div className="empty-inline" data-testid="matches-empty">No matches yet — try relaxing your minimum quality or price.</div>}
      </div>
    </div>
  );
}
