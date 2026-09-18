import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Logo from '@/components/Logo';

const ROLES = [
  { v: 'FARMER', l: 'Farmer' },
  { v: 'BUYER', l: 'Buyer / Processor' },
  { v: 'FPO', l: 'FPO / Cooperative' },
  { v: 'QUALITY_ASSESSOR', l: 'Quality assessor' },
  { v: 'LOGISTICS_PROVIDER', l: 'Logistics provider' },
  { v: 'ADMIN', l: 'Admin' },
];

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'FARMER', phone: '', language: 'en' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { register } = useAuth();
  const nav = useNavigate();

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await register(form);
      nav('/app', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="auth-shell" data-testid="register-page">
      <div className="auth-card">
        <div className="auth-brand">
          <Logo size={18} />
        </div>
        <p className="eyebrow">CREATE ACCOUNT</p>
        <h1>Join the network.</h1>
        <p className="auth-sub">Register once — the platform figures out the fair price, buyers and route.</p>
        <form onSubmit={submit} className="auth-form">
          <label>Full name
            <input value={form.name} onChange={(e) => set('name', e.target.value)} data-testid="register-name-input" required />
          </label>
          <label>Email
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} data-testid="register-email-input" required />
          </label>
          <div className="two-col">
            <label>Password
              <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} data-testid="register-password-input" required minLength={6} />
            </label>
            <label>I am a…
              <select value={form.role} onChange={(e) => set('role', e.target.value)} data-testid="register-role-select">
                {ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
              </select>
            </label>
          </div>
          <label>Phone (optional)
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)} data-testid="register-phone-input" />
          </label>
          {error && <div className="auth-error" data-testid="register-error">{error}</div>}
          <button type="submit" className="primary full" disabled={busy} data-testid="register-submit-button">
            {busy ? 'Creating account…' : 'Create account'} <ArrowRight size={16} />
          </button>
        </form>
        <div className="auth-footer">
          Already registered? <Link to="/login" data-testid="login-link">Sign in</Link>
        </div>
      </div>
      <div className="auth-side">
        <img alt="harvest" src="https://images.pexels.com/photos/20445169/pexels-photo-20445169.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" />
      </div>
    </div>
  );
}
