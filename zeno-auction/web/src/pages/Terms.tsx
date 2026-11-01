import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/ui';
import { getPlatformInfo, type PlatformInfo } from '../lib/api';
import { ModeToggle } from '../components/Brand';

const mb = (b: number) => `${Math.round(b / 1024 / 1024)} MB`;

/** Plain-language terms. The numbers come from the server, so this page can never disagree with what the app really enforces. */
export default function Terms() {
  const [info, setInfo] = useState<PlatformInfo | null>(null);
  useEffect(() => {
    getPlatformInfo().then(setInfo).catch(() => setInfo(null));
  }, []);
  const l = info?.limits;
  const row = (what: string, limit: string, note = '') => (
    <tr className="border-t border-[var(--hairline)] align-top">
      <td className="py-2 pr-4 font-semibold text-white">{what}</td>
      <td className="num py-2 pr-4 text-gold">{limit}</td>
      <td className="py-2 text-slate-400">{note}</td>
    </tr>
  );
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-5 sm:px-8">
      <div className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-3">
          <ModeToggle />
          <Link to="/" className="text-sm font-semibold text-slate-400 hover:text-white">
            ← Home
          </Link>
        </div>
      </div>

      <h1 className="mt-10 font-display text-4xl font-extrabold tracking-tight">Terms of use</h1>
      <p className="mt-2 text-slate-400">Short, plain-language rules for using this ZenoBid.</p>

      <section className="card mt-8 space-y-3 p-6 leading-relaxed text-slate-300">
        <h2 className="font-display text-xl font-bold text-white">1. What this is</h2>
        <p>
          ZenoBid is a tool for running live team auctions. It is run by {info?.operatorName ? <b className="text-white">{info.operatorName}</b> : 'its operator'}
          {info?.contact ? <> (contact: {info.contact})</> : null}, provided “as is”, on a small server.
        </p>
      </section>

      <section className="card mt-5 space-y-3 p-6 leading-relaxed text-slate-300">
        <h2 className="font-display text-xl font-bold text-white">2. Limits</h2>
        <p>These are the real limits of this server. Going over them is not possible.</p>
        {l ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-4">What</th>
                  <th className="pb-2 pr-4">Limit</th>
                  <th className="pb-2">Good to know</th>
                </tr>
              </thead>
              <tbody>
                {row('Teams (bidders) per auction', String(l.teams), 'Each team has one captain PIN; several people can use it.')}
                {row('Players per auction', String(l.players))}
                {row('Photos per auction', String(l.photos), `Each photo up to ${mb(l.photoBytes)} (they are shrunk automatically); logos up to ${mb(l.logoBytes)}.`)}
                {row('Screens watching one auction', String(l.screensPerAuction), 'Phones, laptops and big screens together. Extra screens still work, but refresh every few seconds instead of instantly.')}
                {row('Auctions on this server at once', String(l.auctionsOnServer))}
                {row('Saved auction file (Restore)', '25 MB')}
                {row('Auctions with no activity', l.autoDeleteDays > 0 ? `deleted after ${l.autoDeleteDays} days` : 'kept', l.autoDeleteDays > 0 ? 'Download your auction file to keep it.' : '')}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-500">Loading the limits…</p>
        )}
      </section>

      <section className="card mt-5 space-y-3 p-6 leading-relaxed text-slate-300">
        <h2 className="font-display text-xl font-bold text-white">3. Your data</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>An auction (teams, players, bids, results, photos) is kept on the server only while it exists. Delete it any time from Settings; it is removed for good.</li>
          <li>The server also makes a nightly safety backup that is kept for 7 days, so a deleted auction can remain in a backup for up to a week before it disappears.</li>
          <li>You can download the whole auction as a file to your own computer and bring it back later. ZenoBid is not meant to be where you keep your records.</li>
          <li>Admin links and team PINs are secrets. Anyone who has them can act for that team or auction. Don’t share them publicly.</li>
        </ul>
      </section>

      <section className="card mt-5 space-y-3 p-6 leading-relaxed text-slate-300">
        <h2 className="font-display text-xl font-bold text-white">4. Going live and contributions</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Setting up an auction, adding teams and players, and practice runs are free.</li>
          {info?.payments ? (
            <li>
              Starting the real auction needs a one-off contribution of <b className="num text-gold">₹{info.price}</b> per auction, paid by UPI. It helps cover the server and the upkeep of the app. The operator approves payments by hand, so it may take a little while.
            </li>
          ) : (
            <li>Right now there is no charge for going live. A one-off contribution per auction may be introduced; if so it will be shown before you are asked to pay.</li>
          )}
          <li>The operator can give free access to anyone. An unlock belongs to that one auction; restoring your own saved file keeps it.</li>
          <li>Contributions are not refundable once an auction has been unlocked, unless the operator decides otherwise.</li>
        </ul>
      </section>

      <section className="card mt-5 space-y-3 p-6 leading-relaxed text-slate-300">
        <h2 className="font-display text-xl font-bold text-white">5. Fair use</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Use ZenoBid for lawful auctions and drafts. Don’t upload content you have no right to use.</li>
          <li>Don’t try to overload the server, guess other people’s PINs, or get around the limits or the unlock.</li>
          <li>The operator may remove an auction that breaks these rules.</li>
        </ul>
      </section>

      <section className="card mt-5 space-y-3 p-6 leading-relaxed text-slate-300">
        <h2 className="font-display text-xl font-bold text-white">6. No guarantees</h2>
        <p>The server is small and may occasionally be unavailable, for example while it updates. Run an important event with a practice first, and keep a downloaded copy of your auction file. ZenoBid is provided without warranty and the operator is not liable for losses from its use.</p>
      </section>
    </div>
  );
}
