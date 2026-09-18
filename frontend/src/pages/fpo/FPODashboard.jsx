import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { num, money } from '@/lib/format';
import { PackageCheck, Users } from 'lucide-react';

export default function FPODashboard() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/dashboard').then((r) => setData(r.data)); }, []);
  if (!data) return <div className="loading">Loading FPO dashboard…</div>;
  return (
    <div data-testid="fpo-dashboard">
      <section className="role-hero">
        <p className="eyebrow">FPO · {data.fpo.name}</p>
        <h1>Grow collective value.</h1>
        <p>{data.stats.farmers} farmers · {data.stats.activeLots} active lots · {num(data.stats.aggregatedQuintals)} q aggregated.</p>
      </section>
      <div className="stat-grid">
        <div className="stat" data-testid="stat-farmers"><div className="stat-icon green"><Users size={18} /></div><div><span>Farmers</span><strong>{data.stats.farmers}</strong><small>Onboarded</small></div></div>
        <div className="stat" data-testid="stat-active-lots"><div className="stat-icon orange"><PackageCheck size={18} /></div><div><span>Active lots</span><strong>{data.stats.activeLots}</strong><small>In market</small></div></div>
        <div className="stat" data-testid="stat-aggregated"><div className="stat-icon blue"><PackageCheck size={18} /></div><div><span>Aggregated</span><strong>{num(data.stats.aggregatedQuintals)} q</strong><small>Cumulative</small></div></div>
      </div>

      <section className="section-head" style={{ marginTop: 32 }}><div><p className="eyebrow">FARMERS</p><h2>Members</h2></div></section>
      <div className="lots-grid">
        {data.farmers.map((f) => (
          <div key={f.id} className="lot-card" data-testid={`farmer-${f.id}`}>
            <div className="lot-card-head"><div><b>{f.user.name}</b><span>{f.village}, {f.district}</span></div><span className="status-chip">{f.user.verified ? 'VERIFIED' : 'PENDING'}</span></div>
          </div>
        ))}
      </div>
      <section className="section-head" style={{ marginTop: 32 }}><div><p className="eyebrow">AGGREGATED LOTS</p><h2>{data.lots.length} lots</h2></div></section>
      <div className="lots-grid">
        {data.lots.map((l) => (
          <div key={l.id} className="lot-card" data-testid={`fpo-lot-${l.code}`}>
            <div className="lot-card-head"><div><b>{l.code}</b><span>{l.crop} · {l.quality}</span></div><span className={`status-chip lot-status-${l.status.toLowerCase()}`}>{l.status.replace(/_/g, ' ')}</span></div>
            <div className="lot-card-body">
              <div><span>Quantity</span><b>{num(l.quantityQuintals)} q</b></div>
              <div><span>Ask</span><b>{l.askPricePerQuintal ? money(l.askPricePerQuintal) : '—'}</b></div>
              <div><span>Location</span><b>{l.pickupLocation}</b></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
