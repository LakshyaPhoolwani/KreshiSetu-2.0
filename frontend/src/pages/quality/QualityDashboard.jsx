import { useEffect, useState } from 'react';
import { ShieldCheck, ClipboardCheck, PackageCheck } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { num, fmtDateTime } from '@/lib/format';

const QUALITY = ['Grade A', 'Grade B', 'Mixed lot'];

export default function QualityAssessorDashboard() {
  const { user } = useAuth();
  const [queue, setQueue] = useState(null);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ quality: 'Grade A', qualityConfidence: 92, notes: '' });
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');

  const load = async () => {
    const [q, h] = await Promise.all([
      api.get('/quality/queue'),
      api.get('/quality/history').catch(() => ({ data: { history: [] } })),
    ]);
    setQueue(q.data.lots || []);
    setHistory(h.data.history || []);
  };
  useEffect(() => { load(); }, []);

  const attest = async (lotId) => {
    setBusy(true);
    try {
      await api.post(`/quality/lots/${lotId}/attest`, { ...form, qualityConfidence: Number(form.qualityConfidence) });
      setFlash('Quality attested. Lot updated and audit event recorded.');
      setSelected(null);
      await load();
    } catch (e) { setFlash(e.response?.data?.error || 'Attestation failed'); } finally { setBusy(false); }
  };

  if (!queue) return <div className="loading">Loading quality queue…</div>;

  const stats = {
    awaitingAttestation: queue.filter((l) => Number(l.qualityConfidence) < 90).length,
    totalInQueue: queue.length,
    attestedByMe: history.length,
  };
  const displayName = user?.name || 'Assessor';

  return (
    <div data-testid="quality-dashboard">
      <section className="role-hero">
        <p className="eyebrow">QUALITY ASSESSOR · {displayName}</p>
        <h1>Every grade, on the record.</h1>
        <p>Attest lot quality with parameters and notes. Every attestation is signed to the audit trail.</p>
      </section>
      <div className="stat-grid">
        <div className="stat" data-testid="stat-awaiting"><div className="stat-icon orange"><ClipboardCheck size={18} /></div><div><span>Awaiting attestation</span><strong>{stats.awaitingAttestation}</strong><small>confidence &lt; 90</small></div></div>
        <div className="stat" data-testid="stat-queue"><div className="stat-icon green"><PackageCheck size={18} /></div><div><span>In queue</span><strong>{stats.totalInQueue}</strong><small>Active lots</small></div></div>
        <div className="stat" data-testid="stat-attested"><div className="stat-icon blue"><ShieldCheck size={18} /></div><div><span>{user?.role === 'ADMIN' ? 'On record' : 'By me'}</span><strong>{stats.attestedByMe}</strong><small>Attestations</small></div></div>
      </div>

      {flash && <div className="flash" data-testid="quality-flash">{flash}</div>}

      <section className="section-head" style={{ marginTop: 30 }}><div><p className="eyebrow">QUEUE</p><h2>Lots awaiting attestation</h2></div></section>

      <div className="lots-grid">
        {queue.map((l) => (
          <div key={l.id} className="lot-card" data-testid={`qa-lot-${l.code}`} style={{ cursor: 'default' }}>
            <div className="lot-card-head">
              <div><b>{l.code}</b><span>{l.crop} · {l.quality}</span></div>
              <span className="status-chip">{Math.round(Number(l.qualityConfidence))}% conf</span>
            </div>
            <div className="lot-card-body">
              <div><span>Farmer</span><b>{l.farmer?.user?.name || '—'}</b></div>
              <div><span>Quantity</span><b>{num(l.quantityQuintals)} q</b></div>
              <div><span>Pickup</span><b>{l.pickupLocation}</b></div>
            </div>
            {selected === l.id ? (
              <div className="qa-form" data-testid={`qa-form-${l.code}`}>
                <div className="two-col">
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#627060' }}>Grade
                    <select value={form.quality} onChange={(e) => setForm({ ...form, quality: e.target.value })} data-testid="qa-quality">
                      {QUALITY.map((q) => <option key={q}>{q}</option>)}
                    </select>
                  </label>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#627060' }}>Confidence
                    <input type="number" min="0" max="100" value={form.qualityConfidence} onChange={(e) => setForm({ ...form, qualityConfidence: e.target.value })} data-testid="qa-confidence" />
                  </label>
                </div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#627060' }}>Notes (optional)
                  <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="qa-notes" />
                </label>
                <div className="offer-actions" style={{ marginTop: 10 }}>
                  <button className="primary" onClick={() => attest(l.id)} disabled={busy} data-testid={`qa-attest-${l.code}`}>{busy ? 'Attesting…' : 'Attest quality'}</button>
                  <button className="outline-btn" onClick={() => setSelected(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className="outline-btn" onClick={() => setSelected(l.id)} data-testid={`qa-open-${l.code}`}>Attest quality →</button>
            )}
          </div>
        ))}
        {queue.length === 0 && <div className="empty-inline" data-testid="qa-empty">No lots in queue right now. Come back after the next harvest window.</div>}
      </div>

      {history.length > 0 && (
        <>
          <section className="section-head" style={{ marginTop: 40 }}><div><p className="eyebrow">{user?.role === 'ADMIN' ? 'RECENT ATTESTATIONS' : 'MY RECENT ATTESTATIONS'}</p><h2>{history.length} on record</h2></div></section>
          <div className="offers-grid">
            {history.map((h) => (
              <div key={h.id} className="offer-card" data-testid={`qa-history-${h.id}`}>
                <div className="offer-head"><div><b>Lot {h.entityId?.slice(-6).toUpperCase()}</b><span>{fmtDateTime(h.createdAt)}</span></div><span className="status-chip status-accepted">ATTESTED</span></div>
                <div className="offer-body">
                  <div><span>Grade</span><b>{h.metadata?.quality || '—'}</b></div>
                  <div><span>Confidence</span><b>{h.metadata?.qualityConfidence ?? '—'}%</b></div>
                  <div style={{ gridColumn: '1 / -1' }}><span>Notes</span><b>{h.metadata?.notes || '—'}</b></div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
