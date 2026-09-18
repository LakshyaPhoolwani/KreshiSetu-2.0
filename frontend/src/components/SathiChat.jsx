import { useEffect, useState } from 'react';
import { Bot, Mic, Phone, Send, X } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function SathiChat({ onClose, lotId, onStartCall }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    { role: 'assistant', content: user ? `Namaste ${user.name.split(' ')[0]}! I'm Sathi. Ask me anything about your lot, prices, or costs.` : "Namaste! I'm Sathi. Sign in to see your live analysis." },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  const send = async (text = input) => {
    if (!text.trim() || sending) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setSending(true);
    try {
      const { data } = await api.post('/ai/chat', { message: text, lotId, sessionId, language: user?.language || 'en' });
      setSessionId(data.sessionId);
      setMessages((m) => [...m, { role: 'assistant', content: data.reply, source: data.source }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: "I'm unable to reach the assistant right now, but your saved calculations remain available in the dashboard." }]);
    } finally {
      setSending(false);
    }
  };

  const listen = () => {
    const R = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (!R) { setInput('Please explain my best selling option'); return; }
    const rec = new R();
    rec.lang = user?.language === 'hi' ? 'hi-IN' : 'en-IN';
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onresult = (e) => send(e.results[0][0].transcript);
    rec.start();
  };

  return (
    <div className="chat-drawer" data-testid="chat-drawer">
      <div className="chat-head">
        <div>
          <div className="sathi-avatar"><Bot size={18} /></div>
          <div><b>Sathi AI</b><span>Farmer decision companion · grounded in your live numbers</span></div>
        </div>
        <button onClick={onClose} className="close-btn" data-testid="close-chat-button"><X size={18} /></button>
      </div>
      <div className="chat-messages" data-testid="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role === 'user' ? 'you' : 'bot'}`} data-testid={`chat-message-${i}`}>{m.content}</div>
        ))}
        {sending && <div className="bubble bot" data-testid="chat-thinking">Thinking…</div>}
      </div>
      <div className="quick-prompts">
        {onStartCall && <button onClick={() => { onStartCall(); onClose?.(); }} data-testid="switch-to-voice-button" style={{ background: 'var(--forest)', color: '#fff', borderColor: 'var(--forest)' }}><Phone size={11} style={{ marginRight: 4 }} /> Voice call</button>}
        <button onClick={() => send('Compare sell now vs store for me')} data-testid="quick-sell-store-button">Sell now vs store</button>
        <button onClick={() => send('Why is the top option recommended?')} data-testid="quick-why-button">Why this option?</button>
        <button onClick={() => send('Explain each cost in the breakdown')} data-testid="quick-explain-button">Explain costs</button>
      </div>
      <div className="chat-input">
        <button onClick={listen} className={listening ? 'listening' : ''} data-testid="voice-input-button"><Mic size={18} /></button>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Ask Sathi anything…" data-testid="chat-input" />
        <button onClick={() => send()} className="send-btn" data-testid="send-chat-button" disabled={sending}><Send size={16} /></button>
      </div>
      <div className="chat-note">Numbers come from KrishiSetu's transparent calculation engine · demo data labelled</div>
    </div>
  );
}
