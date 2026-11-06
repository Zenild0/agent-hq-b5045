// "Say it to bid": the captain switches the mic on and says "raise" (or an amount like "1 crore 20 lakh"). The bid
// is placed like a tap on the BID button, and the big screen's host announces it so everyone hears it.
// Speech is turned into words by the phone's own browser (Chrome, Safari, Edge); nothing is recorded by ZenoBid.

import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '../../../shared/money';
import { decideVoiceBid, parseSpokenBid } from '../../../shared/voiceBid';
import type { EventSettings } from '../../../shared/types';

type Lang = 'en-IN' | 'hi-IN';
const LANG_KEY = 'zeno:voicebid-lang';
const COOLDOWN_MS = 2500;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const recognizer = (): any => (typeof window === 'undefined' ? null : (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null);

export function VoiceBid({ canBid, reason, min, limit, settings, place }: { canBid: boolean; reason: string; min: number; limit: number; settings: EventSettings; place: (amount: number) => Promise<void> }) {
  const [on, setOn] = useState(false);
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return localStorage.getItem(LANG_KEY) === 'hi-IN' ? 'hi-IN' : 'en-IN';
    } catch {
      return 'en-IN';
    }
  });
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState<number | null>(null);
  const latest = useRef({ canBid, reason, min, limit, place, settings });
  latest.current = { canBid, reason, min, limit, place, settings };
  const lastBidAt = useRef(0);

  useEffect(() => {
    if (!on) return;
    const Ctor = recognizer();
    if (!Ctor) return;
    let stopped = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rec: any = null;
    const money = (n: number) => formatMoney(n, latest.current.settings);
    const handle = (alternatives: string[]) => {
      if (stopped) return; // the mic was switched off: a late word must never bid
      const said = alternatives[0]?.trim() ?? '';
      if (!said) return;
      const heard = alternatives.map(parseSpokenBid).find(Boolean) ?? null;
      if (!heard) return setNote(`Heard “${said}” (not a bid)`);
      const now = latest.current;
      if (!now.canBid) return setNote(`Heard “${said}”, but ${now.reason.toLowerCase() || 'you cannot bid right now'}`);
      if (Date.now() - lastBidAt.current < COOLDOWN_MS) return;
      const d = decideVoiceBid(heard, now.min, now.limit);
      if (d.act === 'ignore') return setNote(`Heard “${said}”: ${d.why}`);
      if (d.act === 'confirm') {
        setConfirm(d.amount);
        return setNote(`Heard “${said}”. Tap to confirm.`);
      }
      lastBidAt.current = Date.now();
      setConfirm(null);
      setNote(`🎤 “${said}” → bid ${money(d.amount)}`);
      void now.place(d.amount);
    };
    const start = () => {
      if (stopped) return;
      rec = new Ctor();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = false;
      rec.maxAlternatives = 3;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (e: any) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (!r.isFinal) continue;
          const alts: string[] = [];
          for (let j = 0; j < r.length; j++) alts.push(String(r[j].transcript ?? ''));
          handle(alts);
        }
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onerror = (e: any) => {
        if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed' || e?.error === 'audio-capture') {
          stopped = true;
          setOn(false);
          setNote(e.error === 'audio-capture' ? 'No microphone found (or another app, like Zoom, is using it).' : 'Allow the microphone for this page to bid by voice.');
        }
      };
      // phones stop listening after a pause: keep going while the mic is on
      rec.onend = () => {
        if (!stopped) setTimeout(start, 300);
      };
      try {
        rec.start();
      } catch {
        /* already started */
      }
    };
    setNote('');
    start();
    return () => {
      stopped = true;
      try {
        rec?.abort();
      } catch {
        /* ignore */
      }
    };
  }, [on, lang]);

  if (!recognizer()) return null; // this browser cannot turn speech into words (e.g. Firefox)

  const chooseLang = (l: Lang) => {
    setLang(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      /* fine */
    }
  };

  return (
    <div className="mb-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid="voice-toggle"
          aria-pressed={on}
          title="Say “raise” or an amount to bid"
          onClick={() => {
            setOn((v) => !v);
            setConfirm(null);
            setNote('');
          }}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${on ? 'border-red-400/60 bg-red-500/20 text-red-200' : 'border-[var(--hairline)] text-slate-300 hover:bg-white/5'}`}
        >
          <span className={`inline-block h-2 w-2 rounded-full ${on ? 'animate-pulse bg-red-400' : 'bg-slate-500'}`} />
          {on ? 'Mic on · say “raise” or an amount' : '🎤 Use voice'}
        </button>
        <select aria-label="Voice bid language" className="input !w-auto !py-1 !text-xs" value={lang} onChange={(e) => chooseLang(e.target.value === 'hi-IN' ? 'hi-IN' : 'en-IN')}>
          <option value="en-IN">English</option>
          <option value="hi-IN">हिन्दी</option>
        </select>
      </div>
      {(note || confirm !== null) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-300" aria-live="polite">
          <span data-testid="voice-note">{note}</span>
          {confirm !== null && (
            <>
              <button
                type="button"
                className="rounded-full bg-gold/90 px-3 py-1 font-bold text-onaccent"
                onClick={() => {
                  lastBidAt.current = Date.now();
                  void place(confirm);
                  setNote(`Bid ${formatMoney(confirm, settings)}`);
                  setConfirm(null);
                }}
              >
                Bid {formatMoney(confirm, settings)}?
              </button>
              <button type="button" className="rounded-full border border-[var(--hairline)] px-3 py-1" onClick={() => (setConfirm(null), setNote(''))}>
                No
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
