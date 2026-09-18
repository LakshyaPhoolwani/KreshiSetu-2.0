import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Bot, ChevronRight, PackageCheck, ShieldCheck, Truck } from 'lucide-react';
import api from '@/lib/api';
import { money, num, fmtDate, fmtDateTime } from '@/lib/format';

function Breakdown({ b }) {
  const rows = [
    ['Gross revenue', b.grossRevenue, '+'],
    ['Transport', -b.transportCost],
    ['Commission', -b.commissionCost],
    ['Packaging', -b.packagingCost],
    ['Expected loss', -b.spoilageCost],
    ['Other', -b.otherCost],
  ];
  if (Number(b.storageCost) > 0) rows.splice(4, 0, ['Storage', -b.storageCost]);
  return (
    <div className="breakdown">
      {rows.map(([l, v, t]) => (
        <div key={l}><span>{l}</span><b className={t === '+' ? 'plus' : ''}>{t === '+' ? '+' : '−'}{money(Math.abs(v))}</b></div>
      ))}
      <div className="total"><span>Net realisation</span><b>{money(b.netRealisation)}</b></div>
    </div>
  );
}

export default function LotDetail({ onOpenChat }) {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [recs, setRecs] = useState(null);
  const [acting, setActing] = useState(null);
  const [flash, setFlash] = useState('');

  const load = async () => {
    const [{ data: lotData }, { data: recData }] = await Promise.all([
      api.get(`/lots/${id}`),
      api.get(`/recommendations/lot/${id}`),
    ]);
    setData(lotData.lot);
    setRecs(recData);
  };

  useEffect(() => { load().catch(() => {}); }, [id]);

  if (!data || !recs) return <div className="loading">Loading lot…</div>;

  const top = recs.topThree?.[0];

  const offerFromRec = async (rec) => {
    setActing('offer-' + (rec.buyerId || rec.marketId));
    try {
      const payload = { lotId: data.id };
      if (rec.demandId) payload.demandId = rec.demandId;
      if (rec.buyerId) payload.buyerId = rec.buyerId;
      payload.pricePerQuintal = rec.pricePerQuintal;
      payload.quantityQuintals = Number(data.quantityQuintals);
      await api.post('/offers', payload);
      setFlash('Offer created and sent to the buyer.');
      await load();
    } catch (e) {
      setFlash(e.response?.data?.error || 'Could not create offer');
    } finally { setActing(null); }
  };

  const acceptOffer = async (offerId) => {
    setActing('accept-' + offerId);
    try {
      await api.post(`/offers/${offerId}/accept`);
      setFlash('Offer accepted. Shipment + payment initialised.');
      await load();
    } catch (e) {
      setFlash(e.response?.data?.error || 'Could not accept offer');
    } finally { setActing(null); }
  };

  const rejectOffer = async (offerId) => {
    setActing('reject-' + offerId);
    try { await api.post(`/offers/${offerId}/reject`); await load(); } catch (e) { setFlash(e.response?.data?.error || 'Could not reject'); } finally { setActing(null); }
  };

  return (
    <div data-testid="lot-detail">
      <button className="back-btn" onClick={() => nav(-1)} data-testid="lot-back">← Back</button>
      <div className="lot-detail-head">
        <div>
          <p className="eyebrow">LOT {data.code}</p>
          <h1>{data.crop} · {num(data.quantityQuintals)} quintals</h1>
          <p className="muted">{data.pickupLocation} · {data.quality} · {data.timeline}</p>
        </div>
        <div className="score-chip"><b>{data.status.replace(/_/g, ' ')}</b><span>Status</span></div>
      </div>

      {flash && <div className="flash" data-testid="lot-flash">{flash}</div>}

      <section className="section-head">
        <div><p className="eyebrow">DECISION SUPPORT</p><h2>Top 3 selling options</h2></div>
        <button className="outline-btn" onClick={onOpenChat} data-testid="ask-sathi-lot"><Bot size={15} /> Explain with Sathi</button>
      </section>

      <div className="rec-grid" data-testid="rec-grid">
        {recs.topThree.map((r, i) => (
          <div key={i} className="rec-card">
            <div className="rec-card-head">
              <div>
                <span className="tag">{i === 0 ? 'TOP' : `OPTION 0${i + 1}`}</span>
                <h3>{r.marketName}</h3>
                <small>{r.location} · {Math.round(r.distanceKm)} km · {r.demand} demand</small>
              </div>
              <div className="score-chip"><b>{r.confidence}%</b><span>confidence</span></div>
            </div>
            <Breakdown b={r.breakdown} />
            <div className="rec-card-reason"><ShieldCheck size={13} /> {r.reason}</div>
            <button className="primary full" onClick={() => offerFromRec(r)} disabled={acting?.startsWith('offer-')} data-testid={`create-offer-from-rec-${i}`}>
              {acting === 'offer-' + (r.buyerId || r.marketId) ? 'Creating offer…' : 'Create buyer offer'} <ArrowRight size={15} />
            </button>
          </div>
        ))}
      </div>

      {recs.storeOption && (
        <div className="store-panel" data-testid="store-panel">
          <div>
            <span className="tag store-tag">STORE & SELL</span>
            <h3>{recs.storeOption.marketName}</h3>
            <p>Forecast +8%, 30-day storage, 3.5% expected spoilage. Forecast is uncertain.</p>
          </div>
          <div className="score-chip"><b>{money(recs.storeOption.breakdown.netRealisation)}</b><span>net expected</span></div>
        </div>
      )}

      <section className="section-head" style={{ marginTop: 32 }}>
        <div><p className="eyebrow">OFFERS · {data.offers.length}</p><h2>Buyer offers on this lot</h2></div>
      </section>

      {data.offers.length === 0 && <div className="empty-inline" data-testid="offers-empty">No offers yet — create one from a recommendation above, or wait for a buyer to propose.</div>}
      <div className="offers-grid">
        {data.offers.map((o) => (
          <div key={o.id} className={`offer-card offer-${o.status.toLowerCase()}`} data-testid={`offer-card-${o.id}`}>
            <div className="offer-head">
              <div><b>{o.buyer.companyName || o.buyer.user?.name}</b><span>{fmtDateTime(o.createdAt)}</span></div>
              <span className={`status-chip status-${o.status.toLowerCase()}`}>{o.status}</span>
            </div>
            <div className="offer-body">
              <div><span>Price</span><b>{money(o.pricePerQuintal)}/q</b></div>
              <div><span>Quantity</span><b>{num(o.quantityQuintals)} q</b></div>
              <div><span>Total</span><b>{money(Number(o.pricePerQuintal) * Number(o.quantityQuintals))}</b></div>
              <div><span>Net realisation</span><b>{money(o.expectedNetRealisation || 0)}</b></div>
              <div><span>Terms</span><b>{o.paymentTerms}</b></div>
            </div>
            {o.status === 'PENDING' && (
              <div className="offer-actions">
                <button className="primary" onClick={() => acceptOffer(o.id)} disabled={!!acting} data-testid={`accept-offer-${o.id}`}>Accept & start transaction</button>
                <button className="outline-btn" onClick={() => rejectOffer(o.id)} disabled={!!acting} data-testid={`reject-offer-${o.id}`}>Reject</button>
              </div>
            )}
            {o.status === 'ACCEPTED' && (
              <div className="offer-actions">
                <button className="outline-btn" onClick={() => nav('/app/transactions')} data-testid={`view-transaction-${o.id}`}><Truck size={14} /> View transaction</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
