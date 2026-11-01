import { ModeToggle } from '../components/Brand';
import { ArrowRight, BadgeDollarSign, Gavel, HeartPulse, Image, LayoutDashboard, Mic, Shuffle, Smartphone, Sparkles, Timer, Trophy, Users, Zap } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HeroDemo } from '../components/HeroDemo';
import { Logo } from '../components/ui';
import { forgetEvent, savedEvents } from '../lib/session';

const FEATURES = [
  { icon: Shuffle, title: 'Spin-the-wheel draws', body: 'A roulette lands on the next player and flashes the name — or the auctioneer picks each one by hand.' },
  { icon: Gavel, title: 'The auctioneer’s gavel', body: 'Going once, twice, thrice… then a SOLD stamp. The next player only appears when the host says so.' },
  { icon: HeartPulse, title: 'A room with a heartbeat', body: 'The whole screen pulses with the bidding — calm when quiet, racing in a bidding war.' },
  { icon: BadgeDollarSign, title: 'Smart bid steps', body: '+5L a bid, then +10L past 1 Cr. Any tiers, any currency — lakh/crore, K/M or points.' },
  { icon: LayoutDashboard, title: 'Live team board', body: 'Purse left, spend and full squads for every team, always on the big screen.' },
  { icon: Timer, title: 'Strategy breaks', body: 'A countdown on every screen while captains plan their next picks in a private strategy tab.' },
];

const USE_CASES = ['Cricket & football leagues', 'Esports rosters', 'Talent & hiring drafts', 'Charity galas', 'Hackathon team picks', 'Fantasy leagues', 'Office off-sites', 'Sales kick-offs'];

const STEPS = [
  { n: '01', title: 'Create', body: 'Set the purse, bid steps and what the audience sees. A live preview shows exactly how it will look.' },
  { n: '02', title: 'Invite', body: 'Add teams and players (or paste a sheet). Every captain gets a personal link; everyone else joins with a code.' },
  { n: '03', title: 'Run the room', body: 'Share the big screen on Zoom. Captains bid from their phones. The auctioneer calls it. Hear the gavel.' },
];

export default function Home() {
  const [mine, setMine] = useState(savedEvents());
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute -left-40 top-20 h-[460px] w-[460px] animate-drift rounded-full bg-royal/20 blur-[120px]" />
      <div className="pointer-events-none absolute -right-32 top-[420px] h-[420px] w-[420px] animate-drift rounded-full bg-gold/10 blur-[120px]" />

      <div className="relative mx-auto max-w-6xl px-4 pb-24 sm:px-8">
        <nav className="flex items-center justify-between py-5">
          <Logo />
          <div className="flex items-center gap-2">
            <a href="#how" className="hidden px-3 text-sm font-semibold text-slate-300 hover:text-white sm:block">
              How it works
            </a>
            <a href="#use" className="hidden px-3 text-sm font-semibold text-slate-300 hover:text-white sm:block">
              Use cases
            </a>
            <ModeToggle />
            <Link to="/join" className="btn-ghost">
              Join with a code
            </Link>
            <Link to="/new" className="btn-primary hidden sm:inline-flex">
              Create auction
            </Link>
          </div>
        </nav>

        {/* ------------------------------ hero ------------------------------ */}
        <section className="grid items-center gap-12 py-10 sm:py-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="animate-rise">
            <span className="chip border-gold/40 bg-gold/10 text-gold">
              <Sparkles className="h-3.5 w-3.5" /> Live auctions for teams, leagues & events
            </span>
            <h1 className="mt-6 font-display text-[clamp(2.6rem,6.4vw,5.2rem)] font-extrabold leading-[1.02] tracking-tight">
              Every bid is a <span className="text-gold-grad">heartbeat.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
              Turn any player draft into a premium, edge-of-your-seat event. Captains bid live, the wheel spins, the gavel falls — and the whole room feels it.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link to="/new" className="btn-primary !px-7 !py-3.5 text-base">
                <Gavel className="h-5 w-5" /> Create an auction
              </Link>
              <Link to="/join" className="btn-ghost !px-7 !py-3.5 text-base">
                I have a code <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4">
              {[
                ['5 min', 'to set up'],
                ['Any sport', 'or industry'],
                ['Zoom-ready', 'big screen'],
              ].map(([a, b]) => (
                <div key={a}>
                  <dt className="font-display text-xl font-extrabold text-pearl">{a}</dt>
                  <dd className="text-xs text-slate-400">{b}</dd>
                </div>
              ))}
            </dl>
          </div>
          <HeroDemo />
        </section>

        {/* ------------------------- continue (saved) ------------------------ */}
        {mine.length > 0 && (
          <section className="mb-16">
            <h2 className="mb-4 font-display text-xl font-bold">Continue where you left off</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mine.map((e) => (
                <div key={e.code + e.role} className="card card-lift flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="truncate font-display font-bold">{e.name}</div>
                    <div className="text-xs text-slate-400">
                      Code <b className="num tracking-widest text-gold">{e.code}</b> · {e.role}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Link className="btn-primary !px-3.5 !py-1.5 !text-xs" to={`/e/${e.code}/admin?k=${e.key}`}>
                      Open
                    </Link>
                    <button
                      className="btn-ghost !px-2.5 !py-1.5 !text-xs"
                      title="Remove from this list"
                      aria-label="Remove from this list"
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

        {/* ------------------------------ use cases ------------------------------ */}
        <section id="use" className="mb-20 text-center">
          <p className="eyebrow">Built for every kind of draft</p>
          <div className="mx-auto mt-5 flex max-w-4xl flex-wrap justify-center gap-2.5">
            {USE_CASES.map((u) => (
              <span key={u} className="chip !px-4 !py-2 text-sm text-slate-200">
                {u}
              </span>
            ))}
          </div>
        </section>

        {/* ------------------------------ features ------------------------------ */}
        <section className="mb-20">
          <div className="mb-8 max-w-2xl">
            <p className="eyebrow">Why it feels different</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Designed like a trading floor. Built like a show.</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card card-lift p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl text-onaccent" style={{ background: 'var(--gold-grad)' }}>
                  <f.icon className="h-5 w-5" strokeWidth={2.4} />
                </span>
                <h3 className="mt-4 font-display text-lg font-bold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------ how ------------------------------ */}
        <section id="how" className="mb-20">
          <div className="mb-8 max-w-2xl">
            <p className="eyebrow">How it works</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">From zero to live in three steps.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="card relative overflow-hidden p-6">
                <span className="font-display text-6xl font-extrabold text-royal/25">{s.n}</span>
                <h3 className="mt-2 font-display text-xl font-bold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------ closing ------------------------------ */}
        <section className="card overflow-hidden p-8 text-center sm:p-14">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_240px_at_50%_0%,rgb(var(--accent)/0.18),transparent)]" />
          <div className="relative">
            <div className="mx-auto mb-4 flex w-fit items-center gap-4 text-slate-300">
              <Users className="h-5 w-5" /> <Smartphone className="h-5 w-5" /> <Mic className="h-5 w-5" /> <Trophy className="h-5 w-5" /> <Image className="h-5 w-5" /> <Zap className="h-5 w-5" />
            </div>
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Ready to hear the gavel?</h2>
            <p className="mx-auto mt-3 max-w-lg text-slate-400">Run a practice round first — nothing counts until you go live.</p>
            <Link to="/new" className="btn-primary mt-8 !px-8 !py-3.5 text-base">
              <Gavel className="h-5 w-5" /> Create your auction
            </Link>
          </div>
        </section>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <Logo />
          <span>Live team auctions · works with any currency, sport or industry</span>
        </footer>
      </div>
    </div>
  );
}
