import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageCheck, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { money, num, fmtDate } from '@/lib/format';

export default function FarmerLots() {
  const [lots, setLots] = useState(null);
  useEffect(() => { api.get('/lots').then((r) => setLots(r.data.lots)); }, []);
  if (!lots) return <div className="loading">Loading lots…</div>;
  if (lots.length === 0) return <div className="loading" data-testid="lots-empty">No lots yet. Create one from Sell my produce.</div>;
  return (
    <div data-testid="lots-page">
      <p className="eyebrow">MY LOTS</p>
      <h1 style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: 40, color: '#18321d', margin: '6px 0 24px' }}>Every lot, one place.</h1>
      <div className="lots-grid">
        {lots.map((l) => (
          <Link key={l.id} to={`/app/lots/${l.id}`} className="lot-card" data-testid={`lot-card-${l.code}`}>
            <div className="lot-card-head">
              <div className="brand-mark" style={{ width: 30, height: 30 }}><PackageCheck size={16} /></div>
              <div><b>{l.code}</b><span>{l.crop} · {l.quality}</span></div>
              <span className={`status-chip lot-status-${l.status.toLowerCase()}`}>{l.status.replace(/_/g, ' ')}</span>
            </div>
            <div className="lot-card-body">
              <div><span>Quantity</span><b>{num(l.quantityQuintals)} q</b></div>
              <div><span>Ask price</span><b>{l.askPricePerQuintal ? money(l.askPricePerQuintal) + '/q' : '—'}</b></div>
              <div><span>Offers</span><b>{l._count?.offers ?? 0}</b></div>
              <div><span>Created</span><b>{fmtDate(l.createdAt)}</b></div>
            </div>
            <div className="lot-card-foot">Open <ChevronRight size={14} /></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
