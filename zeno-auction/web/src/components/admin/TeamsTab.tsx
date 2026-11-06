import { ImagePlus, Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { formatMoney } from '../../../../shared/money';
import { teamStats } from '../../../../shared/rules';
import type { Captain, Snapshot } from '../../../../shared/types';
import { uploadImage } from '../../lib/api';
import { resizeImage } from '../../lib/image';
import type { Room } from '../../lib/useRoom';
import { MoneyInput } from '../MoneyInput';
import { CopyButton, Field, TeamDot, useToast } from '../ui';

function BlurInput({ value, onCommit, placeholder, className = '' }: { value: string; onCommit: (v: string) => void; placeholder?: string; className?: string }) {
  const [v, setV] = useState(value);
  const [focus, setFocus] = useState(false);
  return (
    <input
      className={`input ${className}`}
      value={focus ? v : value}
      placeholder={placeholder}
      onFocus={() => (setV(value), setFocus(true))}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        setFocus(false);
        if (v.trim() !== value) onCommit(v.trim());
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

export function TeamsTab({ snap, room, adminKey }: { snap: Snapshot; room: Room; adminKey: string }) {
  const { settings } = snap;
  const [newTeam, setNewTeam] = useState({ team: '', name: '', budget: settings.defaultBudget });
  const [topup, setTopup] = useState(0);
  const [nextTopup, setNextTopup] = useState(snap.nextTopup ?? 0); // the extra purse saved for the next round

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3 p-5">
          <h3 className="font-bold">Add a team</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Team name">
              <input className="input" placeholder="Thunder Hawks" value={newTeam.team} onChange={(e) => setNewTeam({ ...newTeam, team: e.target.value })} />
            </Field>
            <Field label="Captain">
              <input className="input" placeholder="Priya" value={newTeam.name} onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })} />
            </Field>
          </div>
          <Field label="Starting purse" hint="Defaults to the event's starting purse. Joining midway? Enter what they have left.">
            <MoneyInput value={newTeam.budget} fmt={settings} onChange={(n) => setNewTeam({ ...newTeam, budget: n })} />
          </Field>
          <button
            className="btn-primary"
            disabled={!newTeam.team.trim()}
            onClick={async () => {
              const payload = newTeam;
              setNewTeam({ team: '', name: '', budget: settings.defaultBudget });
              if (!(await room.act('captain.add', payload))) setNewTeam(payload);
            }}
          >
            <Plus className="h-4 w-4" /> Add team
          </button>
        </section>

        <section className="card space-y-3 p-5">
          <h3 className="font-bold">Change every purse at once</h3>
          <p className="text-sm text-slate-400">Handy between rounds: give everyone more to spend, or trim it.</p>
          <MoneyInput value={topup} fmt={settings} onChange={setTopup} />
          <div className="flex gap-2">
            <button className="btn-primary" disabled={!topup || snap.captains.length === 0} onClick={() => room.act('captains.topup', { amount: topup })}>
              + Add to all
            </button>
            <button className="btn-ghost" disabled={!topup || snap.captains.length === 0} onClick={() => room.act('captains.topup', { amount: -topup })}>
              − Subtract from all
            </button>
          </div>
        </section>

        <section className="card space-y-3 p-5 lg:col-span-2">
          <h3 className="font-bold">Extra money for round {snap.round + 1}</h3>
          <p className="text-sm text-slate-400">
            Set it up now to save time: every team receives this amount automatically at the moment the auctioneer starts round {snap.round + 1}. You can change or clear it until then.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[220px] flex-1">
              <MoneyInput value={nextTopup} fmt={settings} onChange={setNextTopup} />
            </div>
            <button className="btn-primary" disabled={nextTopup === snap.nextTopup || snap.captains.length === 0} onClick={() => room.act('round.topup', { amount: nextTopup })}>
              Save for round {snap.round + 1}
            </button>
            {snap.nextTopup > 0 && (
              <button
                className="btn-ghost"
                onClick={async () => {
                  if (await room.act('round.topup', { amount: 0 })) setNextTopup(0);
                }}
              >
                Clear
              </button>
            )}
          </div>
          <p className="text-sm">
            {snap.nextTopup > 0 ? (
              <span className="text-emerald-300">✓ Every team will get +{formatMoney(snap.nextTopup, settings)} when round {snap.round + 1} starts.</span>
            ) : (
              <span className="text-slate-500">Nothing set: purses stay as they are at the start of round {snap.round + 1}.</span>
            )}
          </p>
        </section>
      </div>

      {snap.captains.length === 0 && <p className="card p-8 text-center text-slate-400">No teams yet. You need at least two to start bidding.</p>}

      <div className="grid gap-4 xl:grid-cols-2">
        {snap.captains.map((c) => (
          <TeamCard key={c.id} captain={c} snap={snap} room={room} adminKey={adminKey} />
        ))}
      </div>
    </div>
  );
}

function TeamCard({ captain: c, snap, room, adminKey }: { captain: Captain; snap: Snapshot; room: Room; adminKey: string }) {
  const { settings } = snap;
  const st = teamStats(snap, c);
  const token = snap.secrets?.captainTokens[c.id] ?? '';
  const link = `${location.origin}/e/${snap.code}/captain?k=${token}`;
  const [amount, setAmount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const online = snap.presence.captains.includes(c.id);

  const adjust = (mode: 'add' | 'subtract' | 'set') => room.act('captain.budget', { id: c.id, mode, amount });

  return (
    <section className="card relative overflow-hidden p-5">
      <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: c.color }} />
      <div className="flex items-start gap-3 pl-2">
        <label className="relative mt-1 h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-white/20" style={{ background: c.color }} title="Team colour">
          <input type="color" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={c.color} onChange={(e) => room.act('captain.update', { id: c.id, color: e.target.value })} />
        </label>
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
          <BlurInput value={c.team} placeholder="Team name" className="!font-bold" onCommit={(v) => room.act('captain.update', { id: c.id, team: v })} />
          <BlurInput value={c.name} placeholder="Captain name" onCommit={(v) => room.act('captain.update', { id: c.id, name: v })} />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const url = await uploadImage(snap.code, adminKey, await resizeImage(f, 256));
              await room.act('captain.update', { id: c.id, logo: url });
            } catch (err) {
              toast((err as Error).message, 'error');
            }
          }}
        />
        <button className="btn-ghost !p-2.5" title="Team logo" onClick={() => fileRef.current?.click()}>
          {c.logo ? <img src={c.logo} alt="" className="h-5 w-5 rounded-full object-cover" /> : <ImagePlus className="h-5 w-5" />}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 pl-2 text-center">
        <div className="rounded-xl bg-ink-900 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total purse</div>
          <div className="font-display text-2xl">{formatMoney(c.budget, settings)}</div>
        </div>
        <div className="rounded-xl bg-ink-900 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Spent ({st.count})</div>
          <div className="font-display text-2xl">{formatMoney(st.spent, settings)}</div>
        </div>
        <div className="rounded-xl bg-ink-900 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Left</div>
          <div className={`font-display text-2xl ${st.remaining < 0 ? 'text-red-400' : 'text-emerald-300'}`}>{formatMoney(st.remaining, settings)}</div>
        </div>
      </div>

      <div className="mt-4 pl-2">
        <label className="label">Change this team's purse</label>
        <div className="flex flex-wrap items-start gap-2">
          <MoneyInput className="min-w-[150px] flex-1" value={amount} fmt={settings} onChange={setAmount} />
          <button className="btn-primary" disabled={!amount} onClick={() => adjust('add')}>
            + Add
          </button>
          <button className="btn-ghost" disabled={!amount} onClick={() => adjust('subtract')}>
            − Subtract
          </button>
          <button className="btn-ghost" disabled={!amount} onClick={() => adjust('set')}>
            = Set to
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pl-2 pt-3 text-xs">
        <span className="flex items-center gap-2 text-slate-400">
          <TeamDot captain={{ color: online ? '#34d399' : '#475569' }} /> {online ? 'Online now' : 'Not connected'} · PIN{' '}
          <b className="font-mono text-sm tracking-widest text-gold">{token}</b>
        </span>
        <span className="flex gap-1.5">
          <CopyButton text={link} label="Copy captain link" />
          <button
            className="btn-danger !px-3 !py-1.5 !text-xs"
            onClick={() => {
              if (confirm(`Remove ${c.team}?${st.count ? ` Their ${st.count} player(s) go back to the pool.` : ''}`)) room.act('captain.remove', { id: c.id });
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </button>
        </span>
      </div>
    </section>
  );
}
