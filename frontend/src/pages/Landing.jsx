import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Bot, ChevronRight, Leaf, MapPin, Phone, Scale, ShieldCheck, Sparkles, TrendingUp, Truck, Users, Wallet } from 'lucide-react';
import { legacyApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { money } from '@/lib/format';
import Logo from '@/components/Logo';
import MarketTicker from '@/components/MarketTicker';

export default function Landing() {
  const [demo, setDemo] = useState(null);
  const { user } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    legacyApi.get('/dashboard').then((r) => setDemo(r.data)).catch(() => {});
  }, []);

  return (
    <div className="landing" data-testid="landing-page">
      <header className="landing-nav">
        <Logo size={20} />
        <nav className="landing-nav-links">
          <a href="#how" data-testid="nav-how">How it works</a>
          <a href="#roles" data-testid="nav-roles">For everyone</a>
          <a href="#trust" data-testid="nav-trust">Trust</a>
          {user ? (
            <button className="primary sm" onClick={() => nav('/app')} data-testid="cta-open-app">Open app <ArrowRight size={14} /></button>
          ) : (
            <>
              <Link to="/login" data-testid="nav-signin">Sign in</Link>
              <Link to="/register" className="primary sm" data-testid="nav-register">Get started <ArrowRight size={14} /></Link>
            </>
          )}
        </nav>
      </header>

      <MarketTicker />

      <section className="hero">
        <div>
          <p className="eyebrow" data-testid="hero-tagline"><span className="pulse"></span> The autonomous decision engine for Indian agriculture</p>
          <h1>The fair price,<br /><em>after every cost.</em></h1>
          <p className="hero-sub" data-testid="hero-subtagline">KrishiSetu is a voice-first market-linkage platform that shows every Indian farmer their real net realisation — after transport, commission, packaging, storage and spoilage — and matches them to the buyer that maximises what they actually keep.</p>
          <div className="hero-actions">
            <button className="primary" onClick={() => nav(user ? '/app' : '/login')} data-testid="hero-cta">
              {user ? 'Open my dashboard' : 'Try a live demo'} <ArrowRight size={16} />
            </button>
            <Link to="/register" className="text-btn" data-testid="hero-register-link">Create farmer account →</Link>
          </div>
          <div className="hero-facts">
            <div><Sparkles size={14} /> Transparent net realisation</div>
            <div><Phone size={14} /> Voice-first AI · Hindi & English</div>
            <div><ShieldCheck size={14} /> Every action audited</div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-card">
            <div className="hero-card-head">
              <div>
                <span className="tag recommended">TOP RECOMMENDATION</span>
                <h3>{demo?.analysis?.recommended?.market || 'Live analysis loading…'}</h3>
                <small>{demo?.analysis?.recommended?.location || 'demo data'}</small>
              </div>
              <div className="score-chip"><b>{demo?.analysis?.recommended?.confidence || 88}%</b><span>confidence</span></div>
            </div>
            <div className="realisation">
              <span>Expected net realisation</span>
              <strong>{money(demo?.analysis?.recommended?.net || 0)}</strong>
              <small>for 12 tonnes of {demo?.farmer?.crop || 'onion'} · after every cost</small>
            </div>
            <div className="hero-mini-grid">
              <div><span>Transport</span><b>{money(demo?.analysis?.recommended?.transport || 0)}</b></div>
              <div><span>Commission</span><b>{money(demo?.analysis?.recommended?.commission || 0)}</b></div>
              <div><span>Packaging</span><b>{money(demo?.analysis?.recommended?.packaging || 0)}</b></div>
              <div><span>Expected loss</span><b>{money(demo?.analysis?.recommended?.loss || 0)}</b></div>
            </div>
            <div className="hero-store-vs">
              <div><span>Sell now</span><b>{money(demo?.analysis?.sell_now_net || 0)}</b></div>
              <div className="vs">vs</div>
              <div><span>Store 30 days</span><b>{money(demo?.analysis?.store_net || 0)}</b></div>
            </div>
          </div>
          <img className="hero-img" src="https://images.unsplash.com/photo-1738992765917-15d0b7d36683?crop=entropy&cs=srgb&fm=jpg&q=80&w=900" alt="Farmer in field" />
        </div>
      </section>

      <section id="how" className="how">
        <p className="eyebrow center">HOW IT WORKS</p>
        <h2 className="center">A guided journey · not another price list.</h2>
        <div className="how-grid">
          {[
            { i: Leaf, t: 'Tell Sathi about your lot', d: 'Crop, quantity, location, quality, timeline. Voice or text.' },
            { i: MapPin, t: 'Compare live options', d: 'Markets, direct buyers, storage — ranked by expected net realisation.' },
            { i: Scale, t: 'See every cost', d: 'Transport, commission, packaging, spoilage, storage — never hidden.' },
            { i: Bot, t: 'Sathi explains', d: 'The AI only explains the transparent math. It never sells for you.' },
            { i: Users, t: 'Match a buyer', d: 'FPO aggregation optional. Deterministic buyer matching engine.' },
            { i: Truck, t: 'Ship & get paid', d: 'Every milestone on the audit trail. Payments provider-abstracted.' },
          ].map((s, i) => (
            <div key={i} className="how-card" data-testid={`how-card-${i}`}>
              <div className="brand-mark"><s.i size={17} /></div>
              <h3>{s.t}</h3><p>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="roles" className="roles">
        <p className="eyebrow center">FOR EVERYONE IN THE CHAIN</p>
        <h2 className="center">One platform · four roles.</h2>
        <div className="roles-grid">
          {[
            { t: 'Farmer', d: 'Get the fair price after every cost. Voice call Sathi in Hindi or English.', u: 'rajesh@krishisetu.dev / farmer123' },
            { t: 'Buyer', d: 'Post demand once. Get matched to verified lots with quality and provenance.', u: 'freshcart@krishisetu.dev / buyer123' },
            { t: 'FPO', d: 'Aggregate produce, compare buyer offers, track outcomes for member farmers.', u: 'fpo@krishisetu.dev / fpo123' },
            { t: 'Quality Assessor', d: 'Attest lot grade and confidence — every attestation is signed to the audit trail.', u: 'quality@krishisetu.dev / quality123' },
            { t: 'Logistics', d: 'See shipments assigned to you, progress pickup → in transit → delivered.', u: 'logistics@krishisetu.dev / logistics123' },
            { t: 'Admin', d: 'Verify, monitor, investigate disputes, review the full audit trail.', u: 'admin@krishisetu.dev / admin123' },
          ].map((r) => (
            <div key={r.t} className="role-card" data-testid={`role-card-${r.t.toLowerCase().replace(/\s+/g, '-')}`}>
              <h3>{r.t}</h3>
              <p>{r.d}</p>
              <code>{r.u}</code>
            </div>
          ))}
        </div>
      </section>

      <section id="trust" className="trust">
        <div>
          <p className="eyebrow">TRUST · BY DESIGN</p>
          <h2>Numbers you can prove.</h2>
          <ul>
            <li><ShieldCheck size={16} /> Every offer, acceptance, shipment and payment is captured in an immutable audit log (mock chain by default; wire an EVM RPC to record on chain).</li>
            <li><Scale size={16} /> Financial fields use Decimal, never floats — no ₹0.01 drift.</li>
            <li><Sparkles size={16} /> AI is restricted to explaining backend-calculated numbers. It never fabricates prices.</li>
            <li><TrendingUp size={16} /> Sell-now vs store is honest about uncertainty. Forecasts are estimates, not promises.</li>
          </ul>
          <Link to="/register" className="primary" data-testid="trust-cta">Create free account <ArrowRight size={14} /></Link>
        </div>
        <img src="https://images.unsplash.com/photo-1667487648590-4bab281f0300?crop=entropy&cs=srgb&fm=jpg&q=80&w=900" alt="silo" />
      </section>

      <footer className="landing-footer">
        <Logo size={16} />
        <span>Demo data is clearly labelled. Payments and blockchain are mock providers unless credentials are configured.</span>
      </footer>
    </div>
  );
}
