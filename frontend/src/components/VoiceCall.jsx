// Voice call with Sathi. Uses browser SpeechRecognition + speechSynthesis
// and the existing /api/v1/ai/chat endpoint. No external calls.
import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, Phone, Volume2, VolumeX } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const supportsRecognition = () => typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
const supportsSynthesis = () => typeof window !== 'undefined' && !!window.speechSynthesis;

export default function VoiceCall({ onClose, lotId }) {
  const { user } = useAuth();
  const [status, setStatus] = useState('idle');   // idle | listening | thinking | speaking
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [callStart] = useState(Date.now());
  const [tick, setTick] = useState(0);
  const recRef = useRef(null);
  const stoppedRef = useRef(false);

  const lang = user?.language === 'hi' ? 'hi-IN' : 'en-IN';

  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  const duration = Math.floor((Date.now() - callStart) / 1000);
  const mm = String(Math.floor(duration / 60)).padStart(2, '0');
  const ss = String(duration % 60).padStart(2, '0');

  const speak = (text) => {
    if (!supportsSynthesis() || muted) { startListening(); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 1.0;
    u.onstart = () => setStatus('speaking');
    u.onend = () => { if (!stoppedRef.current) startListening(); };
    u.onerror = () => { if (!stoppedRef.current) startListening(); };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  const startListening = () => {
    if (stoppedRef.current) return;
    const R = supportsRecognition();
    if (!R) { setError('Voice recognition not supported in this browser.'); return; }
    try {
      const rec = new R();
      rec.lang = lang;
      rec.interimResults = false;
      rec.continuous = false;
      rec.onstart = () => { setStatus('listening'); setError(''); };
      rec.onerror = (e) => {
        if (e.error === 'no-speech' && !stoppedRef.current) {
          setTimeout(() => { if (!stoppedRef.current) startListening(); }, 400);
        } else if (e.error === 'not-allowed') {
          setError('Microphone permission denied.');
          setStatus('idle');
        } else if (!stoppedRef.current) {
          setTimeout(() => { if (!stoppedRef.current) startListening(); }, 800);
        }
      };
      rec.onresult = async (e) => {
        const text = e.results[0][0].transcript;
        setTranscript(text);
        await ask(text);
      };
      rec.onend = () => { /* handled by onresult / onerror */ };
      recRef.current = rec;
      rec.start();
    } catch (e) {
      setError('Could not start microphone.');
    }
  };

  const ask = async (message) => {
    setStatus('thinking');
    try {
      const { data } = await api.post('/ai/chat', { message, lotId, sessionId, language: user?.language || 'en' });
      setSessionId(data.sessionId);
      setReply(data.reply);
      speak(data.reply);
    } catch (e) {
      const msg = 'I could not reach Sathi just now. Please try again.';
      setReply(msg);
      speak(msg);
    }
  };

  const hangUp = () => {
    stoppedRef.current = true;
    if (recRef.current) { try { recRef.current.stop(); } catch { /* ignore */ } }
    if (supportsSynthesis()) window.speechSynthesis.cancel();
    onClose?.();
  };

  useEffect(() => {
    // Greeting → speak → listen
    const greet = user?.language === 'hi'
      ? `नमस्ते ${user?.name?.split(' ')[0] || ''}, मैं साथी हूँ। आप क्या पूछना चाहेंगे?`
      : `Namaste ${user?.name?.split(' ')[0] || ''}, this is Sathi. What would you like to ask?`;
    setReply(greet);
    speak(greet);
    return () => { stoppedRef.current = true; if (supportsSynthesis()) window.speechSynthesis.cancel(); if (recRef.current) { try { recRef.current.stop(); } catch { /* ignore */ } } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="voice-call-overlay" data-testid="voice-call-overlay" role="dialog" aria-label="Voice call with Sathi">
      <div className="voice-call-card">
        <div className={`voice-avatar voice-avatar-${status}`}>
          <span className="voice-ring"></span>
          <span className="voice-ring voice-ring-2"></span>
          <div className="voice-avatar-inner">S</div>
        </div>
        <div className="voice-title">
          <b>Sathi</b>
          <span data-testid="voice-status">{status === 'idle' && 'Connecting…'}{status === 'listening' && 'Listening…'}{status === 'thinking' && 'Thinking…'}{status === 'speaking' && 'Speaking…'}</span>
          <small data-testid="voice-duration">{mm}:{ss}</small>
        </div>
        <div className="voice-transcript" data-testid="voice-transcript">
          {transcript && <p className="voice-you"><em>You:</em> {transcript}</p>}
          {reply && <p className="voice-sathi" data-testid="voice-reply"><em>Sathi:</em> {reply}</p>}
          {error && <p className="voice-error" data-testid="voice-error">{error}</p>}
        </div>
        <div className="voice-controls">
          <button className="voice-btn" onClick={() => setMuted((m) => !m)} data-testid="voice-mute-button" title={muted ? 'Unmute speaker' : 'Mute speaker'}>
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button className="voice-btn voice-btn-active" onClick={startListening} data-testid="voice-mic-button" title="Talk to Sathi">
            <Mic size={20} />
          </button>
          <button className="voice-btn voice-btn-danger" onClick={hangUp} data-testid="voice-hangup-button" title="End call">
            <PhoneOff size={18} />
          </button>
        </div>
        <div className="voice-hint" data-testid="voice-hint">
          Sathi speaks in {lang === 'hi-IN' ? 'Hindi' : 'English'}. Every number is grounded in your live calculation.
        </div>
      </div>
    </div>
  );
}
