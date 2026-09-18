import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Bell, Bot, ChevronRight, CircleHelp, Leaf, LayoutDashboard, LogOut, MapPin, PackageCheck, ScrollText, ShoppingBasket, ShieldCheck, Users, Scale } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const ROLE_NAV = {
  FARMER: [
    { to: '/app', label: 'Overview', icon: LayoutDashboard, id: 'overview' },
    { to: '/app/sell', label: 'Sell my produce', icon: Leaf, id: 'sell' },
    { to: '/app/lots', label: 'My lots & offers', icon: PackageCheck, id: 'lots' },
    { to: '/app/transactions', label: 'Transactions', icon: ScrollText, id: 'transactions' },
  ],
  BUYER: [
    { to: '/app', label: 'Buyer overview', icon: LayoutDashboard, id: 'overview' },
    { to: '/app/demands', label: 'Demand', icon: ShoppingBasket, id: 'demands' },
    { to: '/app/matches', label: 'Matching lots', icon: MapPin, id: 'matches' },
    { to: '/app/offers', label: 'My offers', icon: Scale, id: 'offers' },
  ],
  FPO: [
    { to: '/app', label: 'FPO overview', icon: LayoutDashboard, id: 'overview' },
    { to: '/app/farmers', label: 'Farmers', icon: Users, id: 'farmers' },
    { to: '/app/lots', label: 'Aggregated lots', icon: PackageCheck, id: 'lots' },
  ],
  ADMIN: [
    { to: '/app', label: 'Admin overview', icon: LayoutDashboard, id: 'overview' },
    { to: '/app/users', label: 'Users', icon: Users, id: 'users' },
    { to: '/app/transactions', label: 'Transactions', icon: ScrollText, id: 'transactions' },
  ],
};

export default function AppLayout({ children, onOpenChat }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const nav = ROLE_NAV[user?.role] || ROLE_NAV.FARMER;

  return (
    <div className="app-shell" data-testid="app-shell">
      <aside className="sidebar" data-testid="main-sidebar">
        <div className="brand">
          <div className="brand-mark"><Leaf size={20} /></div>
          <div><strong>KrishiSetu</strong><span>fairer selling, together</span></div>
        </div>
        <div className="role-switch" data-testid="role-badge">
          <span>Signed in as</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--forest)', fontWeight: 700, fontSize: 13 }}>
            <ShieldCheck size={14} /> {user?.role}
          </div>
        </div>
        <nav>
          {nav.map(({ to, label, icon: Icon, id }) => {
            const active = location.pathname === to || (to !== '/app' && location.pathname.startsWith(to));
            return (
              <button key={id} onClick={() => navigate(to)} className={active ? 'active' : ''} data-testid={`nav-${id}-button`}>
                <Icon size={18} /><span>{label}</span>{active && <ChevronRight size={15} />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <button className="help-box" onClick={onOpenChat} data-testid="open-sathi-sidebar" style={{ width: '100%', textAlign: 'left', border: 0, background: 'transparent' }}>
            <CircleHelp size={18} />
            <div><b>Need a hand?</b><span>Talk to Sathi AI</span></div>
          </button>
          <div className="profile" data-testid="profile-block">
            <div className="avatar">{user?.name?.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase() || 'U'}</div>
            <div><b>{user?.name || 'User'}</b><span>{user?.email}</span></div>
            <button onClick={async () => { await logout(); navigate('/login'); }} data-testid="logout-button" style={{ border: 0, background: 'transparent', color: '#9aa49a', cursor: 'pointer', marginLeft: 'auto' }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="mobile-brand"><Leaf size={18} /> KrishiSetu</div>
          <div className="crumb">Workspace <span>/</span> <b>Good morning, {user?.name?.split(' ')[0] || 'friend'}</b></div>
          <div className="top-actions">
            <button className="icon-btn" onClick={onOpenChat} data-testid="open-chat-button">
              <Bot size={19} /><span>Ask Sathi</span>
            </button>
            <button className="icon-btn" data-testid="notifications-button">
              <Bell size={19} /><i></i>
            </button>
            <Link to="/" className="lang-btn" data-testid="home-link">Home</Link>
            <div className="top-avatar">{user?.name?.[0]?.toUpperCase() || 'U'}</div>
          </div>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
