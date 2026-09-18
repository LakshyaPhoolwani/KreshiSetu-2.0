import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, MapPin, Mic, ShieldCheck, Sparkles, Bot } from 'lucide-react';
import api from '@/lib/api';
import { money, num } from '@/lib/format';

const QUALITY = ['Grade A', 'Grade B', 'Mixed lot'];
const TIMELINES = ['Within 7 days', 'Within 14 days', 'I can store for 30 days'];

function OptionCard({ o, idx, onSelect }) {
  return (
    <div className={`result-card ${idx === 0 ? 'winner' : ''}`} data-testid={`option-card-${idx}`}>
      <div>
        <span className="tag">{idx === 0 ? 'TOP RECOMMENDATION' : `OPTION 0${idx + 1}`}</span>
        <h4>{o.marketName}</h4>
        <small>{o.location} · {Math.round(o.distanceKm)} km · {o.demand} demand</small>
      </div>
      <div className="result-value">
        <b>{money(o.breakdown.netRealisation)}</b>
        <span>net expected · {o.confidence}%</span>
      </div>
      <button onClick={() => onSelect(o)} data-testid={`select-option-${idx + 1}-button`}>
        Select <ChevronRight size={14} />
      </button>
    </div>
  );
}

export default function SellingJourney({ onOpenChat }) {
  const nav = useNavigate();
  const [form, setForm] = useState({
    crop: 'Onion',
    variety: 'Pimpalgaon Red',
    quantityQuintals: 120,
    quality: 'Grade A',
    pickupLocation: 'Pimpalgaon, Nashik, Maharashtra',
    timeline: 'Within 7 days',
  });
  const [result, setResult] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [createdLotId, setCreatedLotId] = useState(null);

  // Prefetch current active lot analysis so returning users see something immediately
  useEffect(() => {
    api.get('/dashboard').then((r) => {
      if (r.data.analysis) {
        setResult(r.data.analysis);
        setCreatedLotId(r.data.activeLot?.id || null);
      }
    }).catch(() => {});
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const run = async () => {
    setCreating(true); setError('');
    try {
      const { data } = await api.post('/lots', form);
      setCreatedLotId(data.lot.id);
      setResult(data.recommendations);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to compute options');
    } finally { setCreating(false); }
  };

  const select = (option) => {
    if (!createdLotId) return;
    nav(`/app/lots/${createdLotId}?option=${encodeURIComponent(option.marketId || option.demandId || option.type)}`);
  };

  return (
    <div className="journey" data-testid="selling-journey">
      <div className="journey-head">
        <button className="back-btn" onClick={() => nav('/app')} data-testid="journey-back-button">← Back to overview</button>
        <span className="journey-status"><i></i> Farmer decides</span>
      </div>
      <div className="journey-title">
        <p className="eyebrow">SELLING JOURNEY · STEP 1 OF 3</p>
        <h1>Let's find your best<br /><em>way to sell.</em></h1>
        <p>Sathi compares markets, buyers, transport, storage and every cost. You approve every next step.</p>
      </div>
      <div className="journey-grid">
        <div className="form-panel">
          <div className="form-panel-head">
            <div className="step-count">01</div>
            <div><h3>Tell us about your lot</h3><p>Every field feeds the transparent calculation.</p></div>
          </div>
          <label>What are you selling?
            <input value={form.crop} onChange={(e) => set('crop', e.target.value)} data-testid="crop-input" />
          </label>
          <label>Variety (optional)
            <input value={form.variety} onChange={(e) => set('variety', e.target.value)} data-testid="variety-input" />
          </label>
          <div className="two-col">
            <label>Quantity (quintals)
              <input type="number" min="1" value={form.quantityQuintals} onChange={(e) => set('quantityQuintals', Number(e.target.value))} data-testid="quantity-input" />
            </label>
            <label>Quality
              <select value={form.quality} onChange={(e) => set('quality', e.target.value)} data-testid="quality-select">
                {QUALITY.map((q) => <option key={q}>{q}</option>)}
              </select>
            </label>
          </div>
          <label>Pickup location
            <div className="input-icon"><MapPin size={16} /><input value={form.pickupLocation} onChange={(e) => set('pickupLocation', e.target.value)} data-testid="location-input" /></div>
          </label>
          <label>Selling timeline
            <select value={form.timeline} onChange={(e) => set('timeline', e.target.value)} data-testid="timeline-select">
              {TIMELINES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          {error && <div className="auth-error" data-testid="journey-error">{error}</div>}
          <button className="primary full" onClick={run} disabled={creating} data-testid="calculate-options-button">
            {creating ? 'Computing…' : 'Create lot & compare options'} <ChevronRight size={16} />
          </button>
          <div className="privacy"><ShieldCheck size={14} /> Your lot is persisted and only visible to matched buyers.</div>
        </div>

        <div className="results-panel">
          <div className="result-head">
            <div><p className="eyebrow">SATHI'S FIRST READ</p><h3>Three paths, one clear picture</h3></div>
            <div className="voice-pill"><Mic size={14} /> Voice ready</div>
          </div>
          {!result && (
            <div className="empty-inline" data-testid="journey-empty">
              <Sparkles size={22} />
              <p>Fill in your lot on the left, then Sathi will pull matched buyers, mandi prices and full net-realisation math.</p>
            </div>
          )}
          {result && (
            <>
              {result.topThree?.[0] && (
                <div className="compare-callout" data-testid="callout">
                  <div className="callout-icon"><Sparkles size={18} /></div>
                  <p>
                    <b>Best today: {result.topThree[0].marketName}</b>
                    <span>Expected net realisation <strong>{money(result.topThree[0].breakdown.netRealisation)}</strong> after transport, commission, packaging and expected loss.</span>
                  </p>
                </div>
              )}
              <div className="result-cards" data-testid="result-cards">
                {result.topThree?.map((o, i) => <OptionCard key={i} o={o} idx={i} onSelect={select} />)}
                {result.storeOption && (
                  <div className="result-card store-card" data-testid="store-result-card">
                    <div>
                      <span className="tag store-tag">STORE & SELL</span>
                      <h4>{result.storeOption.marketName}</h4>
                      <small>Forecast price {money(result.storeOption.pricePerQuintal)}/q · 30d · 3.5% loss</small>
                    </div>
                    <div className="result-value">
                      <b>{money(result.storeOption.breakdown.netRealisation)}</b>
                      <span>net expected · forecast</span>
                    </div>
                    <button onClick={() => select(result.storeOption)} data-testid="select-store-option-button">Review <ChevronRight size={14} /></button>
                  </div>
                )}
              </div>
              {result.comparison && (
                <div className="comparison-note" data-testid="comparison-note">
                  <strong>{result.comparison.preferred === 'sell_now' ? 'Sell now looks stronger today.' : 'Storing may pay off.'}</strong>
                  <span>Sell-now: {money(result.comparison.sellNowNet)} · Store: {money(result.comparison.storeNet)} · Difference: {money(Math.abs(result.comparison.difference))}. Forecast prices are estimates, not guarantees.</span>
                </div>
              )}
              <div className="explain">
                <Bot size={18} />
                <span>Want to understand each cost? <button onClick={onOpenChat} data-testid="explain-costs-button">Ask Sathi</button></span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
