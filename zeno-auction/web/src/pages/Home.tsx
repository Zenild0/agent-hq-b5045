import { Eye, Gavel, Image, Mic, Shuffle, Trophy, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/ui';
import { forgetEvent, savedEvents } from '../lib/session';
import { useState } from 'react';

const FEATURES = [
  { icon: Shuffle, title: 'Spin-the-wheel draws', body: 'A wheel spins, lands on a player and flashes the name — or you pick each player by hand.' },
  { icon: Gavel, title: 'Auctioneer’s gavel', body: 'Going once, twice, thrice… then a giant SOLD stamp. The next player only appears when you say so.' },
  { icon: Zap, title: 'Smart bid steps', body: '+5L per bid, then +10L once it crosses 1 Cr. Any tiers you like.' },
  { icon: Trophy, title: 'Live team board', body: 'Purse left, spend and squad for every team, always on the big screen.' },
  { icon: Image, title: 'Faces, names or both', body: 'Per event, choose whether the audience sees photos, descriptions, roles or just names.' },
  { icon: Mic, title: 'Built for Zoom', body: 'Share one tab. Captains bid from their phones with a personal link.' },
];

export default function Home() {
  const [mine, setMine] = useState(savedEvents());
  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-8">
      <nav className="flex items-center justify-between py-5">
        <Logo />
        <Link to="/join" className="btn-ghost">
          <Eye className="h-4 w-4" /> Join with a code
        </Link>
      </nav>

      <section className="py-14 text-center sm:py-24">
        <span className="chip mx-auto border-gold/40 bg-gold/10 text-gold">Live team auctions for offices, leagues & clubs</span>
        <h1 className="mx-auto mt-6 max-w-4xl font-display text-[clamp(3.2rem,10vw,8rem)] leading-[0.92] tracking-wide">
          BID. CALL. <span className="text-gold">SOLD.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
          Run a proper player auction — captains with budgets, a spinning wheel, a live scoreboard and an auctioneer's gavel — on Zoom or in the room. Set up in five minutes.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link to="/new" className="btn-primary !px-7 !py-3.5 text-base">
            <Gavel className="h-5 w-5" /> Create an auction
          </Link>
          <Link to="/join" className="btn-ghost !px-7 !py-3.5 text-base">
            I have a code
          </Link>
        </div>
      </section>

      {mine.length > 0 && (
        <section className="mb-14">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-400">Your auctions on this device</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map((e) => (
              <div key={e.code + e.role} className="card flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="truncate font-bold">{e.name}</div>
                  <div className="text-xs text-slate-400">
                    Code <b className="text-gold">{e.code}</b> · {e.role}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Link className="btn-primary !px-3 !py-1.5 !text-xs" to={`/e/${e.code}/admin?k=${e.key}`}>
                    Open
                  </Link>
                  <button
                    className="btn-ghost !px-2.5 !py-1.5 !text-xs"
                    title="Remove from this list"
                    onClick={() => {
                      forgetEvent(e.code, e.role);
                      setMine(savedEvents());
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="card p-5">
            <f.icon className="h-6 w-6 text-gold" />
            <h3 className="mt-3 font-bold">{f.title}</h3>
            <p className="mt-1 text-sm text-slate-400">{f.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
