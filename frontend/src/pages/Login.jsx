import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Logo from '@/components/Logo';

const DEMO_USERS = [
  { label: 'Farmer · Rajesh', email: 'rajesh@krishisetu.dev', password: 'farmer123', role: 'FARMER' },
  { label: 'Buyer · FreshCart', email: 'freshcart@krishisetu.dev', password: 'buyer123', role: 'BUYER' },
  { label: 'FPO · Nashik', email: 'fpo@krishisetu.dev', password: 'fpo123', role: 'FPO' },
  { label: 'Quality assessor', email: 'quality@krishisetu.dev', password: 'quality123', role: 'QUALITY_ASSESSOR' },
  { label: 'Logistics', email: 'logistics@krishisetu.dev', password: 'logistics123', role: 'LOGISTICS_PROVIDER' },
  { label: 'Admin', email: 'admin@krishisetu.dev', password: 'admin123', role: 'ADMIN' },
];

export default function Login() {
  const [email, setEmail] = useState('rajesh@krishisetu.dev');
  const [password, setPassword] = useState('farmer123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();
  const location = useLocation();

  const submit = async (e) => {
    e?.preventDefault?.();
    setError('');
    setBusy(true);
    try {
      const u = await login(email, password);
      const redirect = location.state?.from?.pathname || '/app';
      nav(redirect, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  const quick = async (u) => {
    setEmail(u.email); setPassword(u.password);
    setError('');
    setBusy(true);
    try {
      await login(u.email, u.password);
      nav('/app', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="auth-shell" data-testid="login-page">
      <div className="auth-card">
        <div className="auth-brand">
          <Logo size={18} />
        </div>
        <p className="eyebrow">SIGN IN</p>
        <h1>Welcome back.</h1>
        <p className="auth-sub">Sign in to see your live selling brief with transparent net-realisation math.</p>

        <form onSubmit={submit} className="auth-form">
          <label>Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="login-email-input" required />
          </label>
          <label>Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="login-password-input" required />
          </label>
          {error && <div className="auth-error" data-testid="login-error">{error}</div>}
          <button type="submit" className="primary full" disabled={busy} data-testid="login-submit-button">
            {busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={16} />
          </button>
        </form>

        <div className="auth-divider"><span>Or try a demo account</span></div>
        <div className="quick-users">
          {DEMO_USERS.map((u) => (
            <button key={u.email} onClick={() => quick(u)} disabled={busy} data-testid={`quick-login-${u.role.toLowerCase()}-${u.email.split('@')[0]}`}>
              <ShieldCheck size={13} /> {u.label}
            </button>
          ))}
        </div>

        <div className="auth-footer">
          New farmer? <Link to="/register" data-testid="register-link">Create an account</Link> · <Link to="/" data-testid="landing-link">Back to home</Link>
        </div>
      </div>
      <div className="auth-side" data-testid="auth-side">
        <img alt="farmer" src="https://images.unsplash.com/photo-1738992765917-15d0b7d36683?crop=entropy&cs=srgb&fm=jpg&q=80&w=1000" />
        <div className="auth-side-note">
          <span>DEMO DATA</span>
          <b>Every number on KrishiSetu is traceable — from price discovery to the final payment milestone.</b>
        </div>
      </div>
    </div>
  );
}
