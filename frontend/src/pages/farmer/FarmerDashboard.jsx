import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bot, ChevronRight, Leaf, MapPin, PackageCheck, Scale, ShieldCheck, Sparkles, Truck, Users, Wallet } from 'lucide-react';
import api from '@/lib/api';
import { money, num } from '@/lib/format';

function Stat({ icon: Icon, label, value, note, tone = 'green' }) {
  return (
    <div className="stat" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className={`stat-icon ${tone}`}><Icon size={18} /></div>
      <div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
    </div>
  );
}

function Breakdown({ option }) {
  const b = option.breakdown;
  const rows = [
    ['Gross sale revenue', b.grossRevenue, '+'],
    ['Transport to market', -b.transportCost],
    ['Commission · 1.2%', -b.commissionCost],
    ['Packaging', -b.packagingCost],
    ['Expected loss', -b.spoilageCost],
    ['Other (insurance, handling)', -b.otherCost],
  ];
  if (b.storageCost > 0) rows.splice(4, 0, ['Storage', -b.storageCost]);
  return (
    <div className="breakdown" data-testid="net-realisation-breakdown">
      {rows.map(([l, v, t]) => (
        <div key={l}><span>{l}</span><b className={t === '+' ? 'plus' : ''}>{t === '+' ? '+' : '−'}{money(Math.abs(v))}</b></div>
      ))}
      <div className="total"><span>Expected net realisation</span><b>{money(b.netRealisation)}</b></div>
    </div>
  );
}

export default function FarmerDashboard({ onOpenChat }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const nav = useNavigate();

  useEffect(() => {
    api.get('/dashboard').then((r) => setData(r.data)).catch((e) => setError(e.response?.data?.error || 'Failed to load'));
  }, []);

  if (error) return <div className="loading" data-testid="farmer-error">{error}</div>;
  if (!data) return <div className="loading" data-testid="farmer-loading">Loading your live market brief…</div>;

  const analysis = data.analysis;
  const top = analysis?.topThree?.[0];
  const secondary = analysis?.topThree?.[1];
  const store = analysis?.storeOption;

  if (!top) {
    return (
      <div className="empty-state" data-testid="farmer-empty">
        <div className="empty-card">
          <div className="brand-mark" style={{ marginBottom: 20 }}><Leaf size={22} /></div>
          <h2>Let's create your first lot</h2>
          <p>Once your produce is listed, KrishiSetu will fetch live prices, compare buyers, and compute the transparent net realisation.</p>
          <button className="primary" onClick={() => nav('/app/sell')} data-testid="empty-start-selling">
            Start selling journey <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="welcome">
        <div>
          <p className="eyebrow"><span className="pulse"></span> Your live market brief · {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
          <h1>Sell with clarity,<br /><em>not guesswork.</em></h1>
          <p className="intro">Every number below comes from the KrishiSetu net-realisation engine. Sathi explains — it never sells for you.</p>
          <div className="welcome-actions">
            <button className="primary" onClick={() => nav('/app/sell')} data-testid="start-selling-button">
              <Sparkles size={17} /> Update lot & rerun <ChevronRight size={16} />
            </button>
            <button className="text-btn" onClick={onOpenChat} data-testid="ask-sathi-link">Ask Sathi a question ↗</button>
          </div>
        </div>
        <div className="welcome-art">
          <img src="https://images.unsplash.com/photo-1738992765917-15d0b7d36683?crop=entropy&cs=srgb&fm=jpg&q=80&w=900" alt="Farmer in field" />
          <div className="art-note">
            <span>Top option</span>
            <b>{top.marketName}</b>
            <small>{money(top.breakdown.netRealisation)} expected net</small>
          </div>
        </div>
      </section>

      <div className="stat-grid">
        <Stat icon={Leaf} label="Active lot" value={`${num(data.activeLot.quantityQuintals)} q`} note={`${data.activeLot.crop} · ${data.activeLot.quality}`} />
        <Stat icon={Wallet} label="Best net realisation" value={money(top.breakdown.netRealisation)} note="After all costs" />
        <Stat icon={Users} label="Matched buyers" value={String(data.stats.offers + analysis.topThree.filter((o) => o.channel === 'buyer').length)} note={`${data.stats.offers} pending offer${data.stats.offers === 1 ? '' : 's'}`} tone="orange" />
        <Stat icon={Truck} label="Payment pending" value={money(data.stats.paymentPendingAmount || 0)} note={`${data.stats.shipments} shipment${data.stats.shipments === 1 ? '' : 's'}`} tone="blue" />
      </div>

      <section className="section-head">
        <div><p className="eyebrow">DECISION SUPPORT</p><h2>What should you do with your {data.activeLot.crop.toLowerCase()}?</h2></div>
        <button className="outline-btn" onClick={() => nav('/app/sell')} data-testid="compare-options-button">Compare all options <ChevronRight size={15} /></button>
      </section>

      <div className="decision-grid">
        <div className="featured-option">
          <div className="option-top">
            <div>
              <span className="tag recommended">TOP RECOMMENDATION</span>
              <h3>{top.marketName}</h3>
              <p><MapPin size={14} /> {top.location} · {top.travelTime}</p>
            </div>
            <div className="score"><b>{top.confidence}%</b><span>confidence</span></div>
          </div>
          <div className="realisation">
            <span>Expected net realisation</span>
            <strong>{money(top.breakdown.netRealisation)}</strong>
            <small>for {num(data.activeLot.quantityQuintals)} q · {top.timing}</small>
          </div>
          <Breakdown option={top} />
          <button className="primary full" onClick={() => nav(`/app/lots/${data.activeLot.id}`)} data-testid="recommended-option-button">
            Open lot & offers <ChevronRight size={16} />
          </button>
        </div>
        <div className="side-options">
          {secondary && (
            <div className="mini-option" data-testid="secondary-option">
              <div>
                <span className="tag">SECOND BEST</span>
                <h3>{secondary.marketName}</h3>
                <p>{secondary.demand} demand · {Math.round(secondary.distanceKm)} km</p>
              </div>
              <strong>{money(secondary.breakdown.netRealisation)}</strong>
              <div className="line"><span style={{ width: `${Math.min(100, (secondary.breakdown.netRealisation / top.breakdown.netRealisation) * 100)}%` }}></span></div>
              <small>{secondary.confidence}% confidence</small>
            </div>
          )}
          {store && (
            <div className="mini-option store" data-testid="store-option">
              <div>
                <span className="tag store-tag">STORE & SELL</span>
                <h3>Wait 30 days</h3>
                <p>Forecast +8%, {money(store.breakdown.storageCost)} storage, 3.5% loss</p>
              </div>
              <strong>{money(store.breakdown.netRealisation)}</strong>
              <div className="line"><span style={{ width: `${Math.min(100, (store.breakdown.netRealisation / top.breakdown.netRealisation) * 100)}%` }}></span></div>
              <small>{store.confidence}% confidence · forecast</small>
            </div>
          )}
          <button className="ask-card" onClick={onOpenChat} data-testid="decision-help-button">
            <Bot size={22} />
            <div><b>Not sure yet?</b><span>Ask Sathi to compare</span></div>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <section className="lower-grid">
        <div className="panel alerts" data-testid="alerts-panel">
          <div className="panel-title">
            <div><p className="eyebrow">ALERTS</p><h3>Worth knowing today</h3></div>
          </div>
          {(data.alerts || []).map((a, i) => (
            <div key={i} className="alert-row" data-testid={`alert-${i}`}>
              <div className={`alert-icon ${a.type === 'demand' ? 'green-bg' : 'orange-bg'}`}><Scale size={16} /></div>
              <div><b>{a.title}</b><span>{a.text}</span></div>
              <time>now</time>
            </div>
          ))}
          {(!data.alerts || data.alerts.length === 0) && <div className="alert-row" data-testid="alert-empty"><div><b>Nothing urgent.</b><span>Your lot is running smoothly.</span></div></div>}
        </div>
        <div className="panel lot-panel" data-testid="lot-panel">
          <div className="panel-title">
            <div><p className="eyebrow">ACTIVE LOT · {data.activeLot.code}</p><h3>Your journey</h3></div>
            <span className="status-chip"><i></i> {data.activeLot.status}</span>
          </div>
          <div className="timeline">
            <div className="done"><i>✓</i><span>Lot created<small>{new Date(data.activeLot.createdAt).toLocaleDateString('en-IN')}</small></span></div>
            <div className={data.activeLot.qualityConfidence >= 80 ? 'done' : ''}><i>{data.activeLot.qualityConfidence >= 80 ? '✓' : '2'}</i><span>Quality verified<small>{data.activeLot.quality} · {Math.round(data.activeLot.qualityConfidence)}% confidence</small></span></div>
            <div className={data.stats.offers > 0 ? 'current' : ''}><i>{data.stats.offers > 0 ? data.stats.offers : '3'}</i><span>Choose your buyer<small>{data.stats.offers} pending offer{data.stats.offers === 1 ? '' : 's'}</small></span></div>
            <div><i>4</i><span>Ship & get paid<small>{data.stats.shipments} shipment{data.stats.shipments === 1 ? '' : 's'}</small></span></div>
          </div>
          <Link to={`/app/lots/${data.activeLot.id}`} className="text-btn" data-testid="open-lot-detail" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 18 }}>
            Open full lot detail <ChevronRight size={14} />
          </Link>
        </div>
      </section>

      <div className="demo-notice" data-testid="demo-notice">
        <ShieldCheck size={14} /> {data.demoNotice}
      </div>
    </>
  );
}
