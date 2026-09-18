// Scrolling mandi-price ticker. Uses the anonymous /api/market-ticker endpoint.
import { useEffect, useState } from 'react';
import { legacyApi } from '@/lib/api';
import { TrendingUp } from 'lucide-react';

export default function MarketTicker() {
  const [items, setItems] = useState([]);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      legacyApi.get('/market-ticker').then((r) => {
        if (cancelled) return;
        setItems(r.data.items || []);
        setNotice(r.data.notice || '');
      }).catch(() => {});
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  if (items.length === 0) return null;
  // Duplicate items for a seamless marquee loop.
  const loop = [...items, ...items];

  return (
    <div className="market-ticker" data-testid="market-ticker" aria-label="Live mandi price ticker">
      <div className="ticker-label">
        <TrendingUp size={14} />
        <span>MANDI TICKER</span>
        <em className="ticker-demo" data-testid="ticker-demo-label">DEMO DATA</em>
      </div>
      <div className="ticker-viewport">
        <div className="ticker-track">
          {loop.map((it, i) => (
            <span key={i} className="ticker-item" data-testid={i < items.length ? `ticker-item-${i}` : undefined}>
              <b>{it.market}</b>
              <span>{it.crop}·{it.grade}</span>
              <strong>₹{Math.round(it.pricePerQuintal).toLocaleString('en-IN')}<em>/q</em></strong>
            </span>
          ))}
        </div>
      </div>
      {notice && <div className="ticker-notice" data-testid="ticker-notice" title={notice}>i</div>}
    </div>
  );
}
