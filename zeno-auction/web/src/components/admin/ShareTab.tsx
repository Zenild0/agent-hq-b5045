import { ExternalLink } from 'lucide-react';
import type { Snapshot } from '../../../../shared/types';
import { CopyButton, TeamDot } from '../ui';

function LinkRow({ label, hint, url, accent }: { label: string; hint: string; url: string; accent?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-ink-900 p-3">
      <div className="min-w-[180px] flex-1">
        <div className="flex items-center gap-2 text-sm font-bold">
          {accent}
          {label}
        </div>
        <div className="text-xs text-slate-400">{hint}</div>
      </div>
      <code className="max-w-full flex-[2] truncate rounded-lg bg-black/30 px-3 py-2 text-xs text-slate-300">{url}</code>
      <div className="flex gap-1.5">
        <CopyButton text={url} />
        <a className="btn-ghost !px-3 !py-1.5 !text-xs" href={url} target="_blank" rel="noreferrer">
          <ExternalLink className="h-3.5 w-3.5" /> Open
        </a>
      </div>
    </div>
  );
}

export function ShareTab({ snap }: { snap: Snapshot }) {
  const o = location.origin;
  const code = snap.code;
  const s = snap.secrets;
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <section className="card p-6 text-center">
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">Auction code</div>
        <div className="my-2 font-display text-7xl tracking-[0.25em] text-gold">{code}</div>
        <p className="text-sm text-slate-400">
          Anyone can watch at <b className="text-slate-200">{o}/join</b> with this code.
        </p>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">Links</h2>
        <LinkRow label="Big screen" hint="Share this tab in Zoom. Public — anyone with the link can watch." url={`${o}/e/${code}/live`} />
        <LinkRow label="Team board only" hint="A standalone dashboard of purses and squads." url={`${o}/e/${code}/board`} />
        {s && <LinkRow label="Auctioneer console" hint="Whoever runs the gavel. Keep it private." url={`${o}/e/${code}/host?k=${s.hostKey}`} />}
        {s && <LinkRow label="Admin (this page)" hint="Full control — keep it safe, it's the only way back in." url={`${o}/e/${code}/admin?k=${s.adminKey}`} />}
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">Captain links</h2>
        <p className="text-sm text-slate-400">Send each captain their own link (or PIN + the auction code). They bid from their phone or laptop.</p>
        {snap.captains.length === 0 && <p className="text-sm text-slate-500">Add teams first.</p>}
        {snap.captains.map((c) => (
          <LinkRow
            key={c.id}
            accent={<TeamDot captain={c} />}
            label={`${c.team}${c.name ? ` · ${c.name}` : ''}`}
            hint={`PIN ${s?.captainTokens[c.id] ?? ''}`}
            url={`${o}/e/${code}/captain?k=${s?.captainTokens[c.id] ?? ''}`}
          />
        ))}
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-bold">Running it on Zoom</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-300">
          <li>The auctioneer opens the <b>Auctioneer console</b> and clicks <b>Sounds</b> and <b>Announcer</b> so the bid pings and “Going once…” are spoken.</li>
          <li>Open the <b>Big screen</b> in a second tab and share <b>that tab</b> in Zoom with “Share computer audio” ticked. Everyone sees the wheel, the bids and the SOLD stamp.</li>
          <li>Captains open their personal link on a phone. They tap <b>BID</b>; if someone would rather shout it out, the auctioneer taps their team under “Bid for a captain”.</li>
          <li>Tap <b>Space</b> on the auctioneer console to move through <i>going once → twice → thrice → sold</i>, then once more for the next player.</li>
        </ol>
      </section>
    </div>
  );
}
