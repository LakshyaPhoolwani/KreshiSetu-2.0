import { useEffect, useState } from 'react';
import { Truck, PackageCheck, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { num, money, fmtDateTime } from '@/lib/format';

const FLOW = ['PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'];

export default function LogisticsDashboard() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const [flash, setFlash] = useState('');

  const load = () => api.get('/dashboard').then((r) => setData(r.data));
  useEffect(() => { load(); }, []);

  if (!data) return <div className="loading">Loading logistics queue…</div>;

  const setStatus = async (id, status) => {
    setBusy(id + ':' + status);
    try {
      await api.post(`/logistics/shipments/${id}/status`, { status });
      setFlash(`Shipment marked ${status.replace(/_/g, ' ')}.`);
      await load();
    } catch (e) { setFlash(e.response?.data?.error || 'Update failed'); } finally { setBusy(null); }
  };

  return (
    <div data-testid="logistics-dashboard">
      <section className="role-hero">
        <p className="eyebrow">LOGISTICS · {data.provider.name}</p>
        <h1>Every route, on schedule.</h1>
        <p>Pick up shipments assigned to you and progress them through delivery.</p>
      </section>

      <div className="stat-grid">
        <div className="stat" data-testid="stat-pending"><div className="stat-icon orange"><Truck size={18} /></div><div><span>Pending pickup</span><strong>{data.stats.pending}</strong><small>Assign yourself</small></div></div>
        <div className="stat" data-testid="stat-assigned"><div className="stat-icon green"><PackageCheck size={18} /></div><div><span>Assigned</span><strong>{data.stats.assigned}</strong><small>Ready</small></div></div>
        <div className="stat" data-testid="stat-in-transit"><div className="stat-icon blue"><Truck size={18} /></div><div><span>In transit</span><strong>{data.stats.inTransit}</strong><small>On route</small></div></div>
        <div className="stat" data-testid="stat-km"><div className="stat-icon green"><ChevronRight size={18} /></div><div><span>Total km</span><strong>{Math.round(data.stats.totalKmToday)}</strong><small>Across queue</small></div></div>
      </div>

      {flash && <div className="flash" data-testid="logistics-flash">{flash}</div>}

      <section className="section-head" style={{ marginTop: 30 }}><div><p className="eyebrow">SHIPMENT QUEUE</p><h2>Live shipments</h2></div></section>

      <div className="offers-grid">
        {data.shipments.map((s) => {
          const stepIdx = FLOW.indexOf(s.status);
          const nextStatus = FLOW[Math.min(stepIdx + 1, FLOW.length - 1)];
          return (
            <div key={s.id} className={`offer-card offer-${s.status.toLowerCase()}`} data-testid={`shipment-${s.id}`}>
              <div className="offer-head">
                <div><b>{s.transaction.code}</b><span>{fmtDateTime(s.createdAt)}</span></div>
                <span className={`status-chip status-${s.status.toLowerCase()}`}>{s.status.replace(/_/g, ' ')}</span>
              </div>
              <div className="offer-body">
                <div><span>Lot</span><b>{s.transaction.lot.code}</b></div>
                <div><span>Crop</span><b>{s.transaction.lot.crop}</b></div>
                <div><span>Pickup</span><b>{s.pickupLocation}</b></div>
                <div><span>Destination</span><b>{s.destination}</b></div>
                <div><span>Distance</span><b>{Math.round(Number(s.distanceKm))} km</b></div>
                <div><span>Value</span><b>{money(s.transaction.amount)}</b></div>
              </div>
              {s.status !== 'DELIVERED' && (
                <div className="offer-actions">
                  <button className="primary" onClick={() => setStatus(s.id, nextStatus)} disabled={!!busy} data-testid={`advance-${s.id}`}>
                    {busy === s.id + ':' + nextStatus ? 'Updating…' : `Mark ${nextStatus.replace(/_/g, ' ')}`}
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {data.shipments.length === 0 && <div className="empty-inline" data-testid="logistics-empty">No live shipments. When a farmer accepts an offer, a shipment appears here.</div>}
      </div>
    </div>
  );
}
