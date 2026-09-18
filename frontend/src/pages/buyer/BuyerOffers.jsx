import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { money, num, fmtDateTime } from '@/lib/format';

export default function BuyerOffers() {
  const [offers, setOffers] = useState(null);
  useEffect(() => { api.get('/offers').then((r) => setOffers(r.data.offers)); }, []);
  if (!offers) return <div className="loading">Loading offers…</div>;
  return (
    <div data-testid="buyer-offers">
      <p className="eyebrow">MY OFFERS</p>
      <h1 style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: 40, color: '#18321d', margin: '6px 0 24px' }}>Every offer, one view.</h1>
      <div className="offers-grid">
        {offers.map((o) => (
          <div key={o.id} className={`offer-card offer-${o.status.toLowerCase()}`} data-testid={`offer-${o.id}`}>
            <div className="offer-head">
              <div><b>Lot {o.lot.code}</b><span>{fmtDateTime(o.createdAt)}</span></div>
              <span className={`status-chip status-${o.status.toLowerCase()}`}>{o.status}</span>
            </div>
            <div className="offer-body">
              <div><span>Farmer</span><b>{o.lot.farmer?.user?.name || '—'}</b></div>
              <div><span>Crop</span><b>{o.lot.crop}</b></div>
              <div><span>Price/q</span><b>{money(o.pricePerQuintal)}</b></div>
              <div><span>Quantity</span><b>{num(o.quantityQuintals)} q</b></div>
              <div><span>Total</span><b>{money(Number(o.pricePerQuintal) * Number(o.quantityQuintals))}</b></div>
              <div><span>Terms</span><b>{o.paymentTerms}</b></div>
            </div>
          </div>
        ))}
        {offers.length === 0 && <div className="empty-inline" data-testid="offers-empty">No offers yet. Create demand and matches will appear.</div>}
      </div>
    </div>
  );
}
