// Formatting helpers — Indian number formatting for money.
export const money = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
export const shortMoney = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(1)} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)} L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(1)}k`;
  return `₹${Math.round(v)}`;
};
export const num = (n, digits = 0) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: digits });
export const pct = (n) => `${Math.round(Number(n) || 0)}%`;
export const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
export const fmtDateTime = (d) => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
