import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import api from '@/lib/api';
import { money, num, fmtDate } from '@/lib/format';

export default function BuyerDemands() {
  const [demands, setDemands] = useState(null);
  const [form, setForm] = useState({ crop: 'Onion', quantityQuintals: 60, minQuality: 'Grade A', location: 'Nashik, Maharashtra', requiredBy: '', pricePerQuintal: 2500, notes: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = () => api.get('/buyers/demand').then((r) => setDemands(r.data.demands));
  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const payload = { ...form, quantityQuintals: Number(form.quantityQuintals), pricePerQuintal: Number(form.pricePerQuintal), requiredBy: new Date(form.requiredBy || Date.now() + 5 * 86400 * 1000).toISOString() };
      await api.post('/buyers/demand', payload);
      await load();
    } catch (e) { setErr(e.response?.data?.error || 'Failed'); } finally { setBusy(false); }
  };

  return (
    <div data-testid="buyer-demands">
      <p className="eyebrow">MANAGE DEMAND</p>
      <h1 style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: 40, color: '#18321d', margin: '6px 0 24px' }}>Tell farmers what you need.</h1>
      <div className="journey-grid">
        <form onSubmit={submit} className="form-panel" data-testid="demand-form">
          <div className="form-panel-head"><div className="step-count"><Plus size={22} /></div><div><h3>New demand</h3><p>Farmers see matches automatically.</p></div></div>
          <label>Crop<input value={form.crop} onChange={(e) => set('crop', e.target.value)} data-testid="demand-crop" required /></label>
          <div className="two-col">
            <label>Quantity (q)<input type="number" min="1" value={form.quantityQuintals} onChange={(e) => set('quantityQuintals', e.target.value)} data-testid="demand-qty" required /></label>
            <label>Min quality
              <select value={form.minQuality} onChange={(e) => set('minQuality', e.target.value)} data-testid="demand-quality">
                <option>Grade A</option><option>Grade B</option><option>Mixed lot</option>
              </select>
            </label>
          </div>
          <label>Delivery location<input value={form.location} onChange={(e) => set('location', e.target.value)} data-testid="demand-location" required /></label>
          <div className="two-col">
            <label>Price / q<input type="number" min="1" value={form.pricePerQuintal} onChange={(e) => set('pricePerQuintal', e.target.value)} data-testid="demand-price" required /></label>
            <label>Required by<input type="date" value={form.requiredBy} onChange={(e) => set('requiredBy', e.target.value)} data-testid="demand-required-by" required /></label>
          </div>
          <label>Notes (optional)<input value={form.notes} onChange={(e) => set('notes', e.target.value)} data-testid="demand-notes" /></label>
          {err && <div className="auth-error">{err}</div>}
          <button type="submit" className="primary full" disabled={busy} data-testid="submit-demand">{busy ? 'Creating…' : 'Post demand'}</button>
        </form>

        <div className="results-panel">
          <div className="result-head"><div><p className="eyebrow">YOUR DEMANDS</p><h3>{demands?.length || 0} listed</h3></div></div>
          {(demands || []).map((d) => (
            <div key={d.id} className="offer-card" data-testid={`demand-row-${d.id}`}>
              <div className="offer-head"><div><b>{d.crop}</b><span>{num(d.quantityQuintals)} q at {money(d.pricePerQuintal)}/q</span></div><span className={`status-chip ${d.active ? '' : 'status-rejected'}`}>{d.active ? 'ACTIVE' : 'PAUSED'}</span></div>
              <div className="offer-body">
                <div><span>Location</span><b>{d.location}</b></div>
                <div><span>Required by</span><b>{fmtDate(d.requiredBy)}</b></div>
                <div><span>Min quality</span><b>{d.minQuality}</b></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
