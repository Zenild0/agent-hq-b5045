import { summarizeImport } from '../../../../shared/excel';
import { useState } from 'react';
import { formatMoney } from '../../../../shared/money';
import type { ParsedWorkbook } from '../../../../shared/excel';
import type { Snapshot } from '../../../../shared/types';
import type { Room } from '../../lib/useRoom';
import { downloadAuctionFile } from '../../lib/auctionFile';
import { Modal, useToast } from '../ui';

const Tag = ({ children, tone }: { children: React.ReactNode; tone: 'new' | 'update' | 'same' | 'warn' }) => (
  <span
    className={`chip !px-2 !py-0.5 ${
      tone === 'new' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : tone === 'update' ? 'border-cyan/30 bg-cyan/10 text-cyan' : tone === 'warn' ? 'border-amber-400/30 bg-amber-400/10 text-amber-300' : ''
    }`}
  >
    {children}
  </span>
);

export function ExcelImportModal({ snap, room, parsed, fileName, onClose }: { snap: Snapshot; room: Room; parsed: ParsedWorkbook; fileName: string; onClose: () => void }) {
  const { settings } = snap;
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [replace, setReplace] = useState(false); // override everything with this file
  const [typed, setTyped] = useState('');
  const [backedUp, setBackedUp] = useState(false);
  const lc = (s: string) => s.trim().toLowerCase();

  const teamRows = parsed.teams.map((t) => {
    const existing = snap.captains.find((c) => lc(c.team) === lc(t.team));
    const tag = !existing ? 'new' : t.purse && t.purse !== existing.budget ? 'update' : 'same';
    return { ...t, existing, tag } as const;
  });
  const knownTeams = new Set([...snap.captains.map((c) => lc(c.team)), ...parsed.teams.map((t) => lc(t.team))]);
  const playerRows = parsed.players.map((p) => ({
    ...p,
    isUpdate: snap.players.some((x) => lc(x.name) === lc(p.name)),
    badTeam: !!p.team && !knownTeams.has(lc(p.team)),
  }));
  const summary = summarizeImport(parsed.players, {
    currentRound: snap.round,
    existing: snap.players.map((p) => ({ name: p.name, status: p.status })),
    knownTeams: [...knownTeams],
    blankRows: parsed.blankRows,
    replace,
  });
  const live = snap.live.phase === 'spinning' || snap.live.phase === 'bidding';
  const replaceReady = !replace || (typed.trim().toUpperCase() === 'REPLACE' && !live);
  const placed = playerRows.filter((p) => p.team && !p.badTeam).length;
  const nextRound = snap.round + 1;
  const hasRound = playerRows.some((p) => p.round);
  const forNext = playerRows.filter((p) => p.round === nextRound && !p.team).length;
  const tooFar = playerRows.filter((p) => (p.round ?? 0) > nextRound).length;
  const nothing = teamRows.length === 0 && playerRows.length === 0;

  const run = async () => {
    setBusy(true);
    try {
      let teamsDone = 0;
      for (const t of teamRows) {
        if (t.tag === 'new') {
          if (await room.act('captain.add', { team: t.team, name: t.captain, budget: t.purse || settings.defaultBudget })) teamsDone++;
        } else if (t.existing) {
          if (t.tag === 'update' && (await room.act('captain.budget', { id: t.existing.id, mode: 'set', amount: t.purse }))) teamsDone++;
          if (t.captain && t.captain !== t.existing.name) await room.act('captain.update', { id: t.existing.id, name: t.captain });
        }
      }
      let summary = teamsDone ? `${teamsDone} team${teamsDone === 1 ? '' : 's'} updated. ` : '';
      if (playerRows.length) {
        const res = (await room.act('players.import', { rows: playerRows, replace })) as { added: number; updated: number; assigned: number; queued: number; removed?: number; skipped: string[] } | undefined;
        if (!res) return;
        summary += `${res.added} players added, ${res.updated} updated${res.removed ? `, ${res.removed} removed` : ''}${res.assigned ? `, ${res.assigned} placed on teams` : ''}${res.queued ? `, ${res.queued} saved for round ${nextRound}` : ''}.`;
        if (res.skipped.length) summary += ` Notes: ${res.skipped.join('; ')}`;
      }
      toast(summary.trim() || 'Nothing changed', 'success');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal wide title={`Import ${fileName}`} onClose={onClose}>
      <div className="space-y-4">
        {nothing ? (
          <p className="rounded-xl bg-amber-500/10 p-4 text-sm text-amber-200">
            No players or teams found. Use the template: a <b>Players</b> sheet with a <b>Name</b> column (and optional Team / Price Paid), and a <b>Teams</b> sheet.
          </p>
        ) : (
          <p className="text-sm text-slate-300">
            Nothing is changed until you press Import. Players with a name that already exists are updated, not duplicated. A <b>Round</b> column of <b>{nextRound}</b> saves a player for round {nextRound}: hidden from captains and the big screen until that round starts.
          </p>
        )}

        {playerRows.length > 0 && (
          <div className="rounded-xl border border-gold/30 bg-gold/5 p-3 text-sm">
            <p className="font-semibold text-white">After this import the auction will have{replace ? ' (replacing everything)' : ''}:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="chip">{summary.total} players</span>
              <span className="chip border-emerald-400/40 text-emerald-300">{summary.pool} in the pool</span>
              <span className="chip">{summary.sold} sold</span>
              {summary.unsold > 0 && <span className="chip">{summary.unsold} unsold</span>}
              {summary.saved > 0 && <span className="chip border-royal-300/40 text-royal-300">{summary.saved} saved for round {nextRound}</span>}
              {replace && summary.removed.length > 0 && <span className="chip border-hot/40 text-hot">{summary.removed.length} removed</span>}
            </div>
            <p className="mt-2 text-xs text-slate-400">Compare this with your sheet. The Status, Spent, Left and Players columns in the file are only notes: they are not read. The <b>Team</b> and <b>Round</b> columns decide.</p>
            {summary.warnings.length > 0 && (
              <div className="mt-3 rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-100">
                <p className="mb-1 font-bold">Check before importing ({summary.warnings.length}):</p>
                <ul className="list-disc space-y-0.5 pl-4">
                  {summary.warnings.slice(0, 12).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
                {summary.warnings.length > 12 && <p className="mt-1">…and {summary.warnings.length - 12} more.</p>}
              </div>
            )}
          </div>
        )}

        {playerRows.length > 0 && (
          <div className={`rounded-xl border p-3 text-sm ${replace ? 'border-hot/50 bg-hot/5' : 'border-[var(--hairline)]'}`}>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#ff5c7a]" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
              <span>
                <b className="text-white">Replace everything with this file</b>
                <span className="block text-xs text-slate-400">
                  The file becomes the whole truth: every player's sale (team and price), round and order are set exactly as written, and players that are <b>not</b> in the file are removed. A role, description or photo
                  left blank in the file keeps what the system has now.
                </span>
              </span>
            </label>
            {replace && (
              <div className="mt-3 space-y-2.5">
                {live && <p className="rounded-lg bg-hot/10 p-2 text-xs font-semibold text-hot">A player is on the block right now. Finish that player (sold or no sale), then replace.</p>}
                {summary.removed.length > 0 ? (
                  <p className="rounded-lg bg-hot/10 p-2 text-xs text-slate-200">
                    <b className="text-hot">{summary.removed.length} player{summary.removed.length === 1 ? '' : 's'} in the system {summary.removed.length === 1 ? 'is' : 'are'} not in this file and will be removed:</b>{' '}
                    {summary.removed.slice(0, 15).join(', ')}
                    {summary.removed.length > 15 ? ` …and ${summary.removed.length - 15} more` : ''}.
                  </p>
                ) : (
                  <p className="text-xs text-slate-400">Everyone in the system is also in this file, so nobody is removed.</p>
                )}
                <p className="text-xs text-slate-400">
                  A full safety copy is saved on the server automatically just before. You can also download one to your own computer:{' '}
                  <button
                    type="button"
                    className="font-semibold text-gold underline"
                    onClick={async () => {
                      try {
                        await downloadAuctionFile(snap.code, snap.secrets!.adminKey, snap.settings.name);
                        setBackedUp(true);
                      } catch (err) {
                        toast((err as Error).message, 'error');
                      }
                    }}
                  >
                    download the current auction
                  </button>
                  {backedUp ? ' ✓ saved' : ''}.
                </p>
                <label className="block text-xs font-semibold text-slate-300">
                  To confirm, type <span className="text-white">REPLACE</span>
                  <input className="input mt-1" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="REPLACE" aria-label="Type REPLACE to confirm" />
                </label>
              </div>
            )}
          </div>
        )}

        {teamRows.length > 0 && (
          <div>
            <h4 className="mb-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">Teams ({teamRows.length})</h4>
            <div className="max-h-40 overflow-auto rounded-xl border border-white/10">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-ink-900 text-left text-slate-400">
                  <tr><th className="p-2">Team</th><th className="p-2">Captain</th><th className="p-2">Purse</th><th className="p-2" /></tr>
                </thead>
                <tbody>
                  {teamRows.map((t) => (
                    <tr key={t.team} className="border-t border-white/5">
                      <td className="p-2 font-semibold">{t.team}</td>
                      <td className="p-2">{t.captain || '—'}</td>
                      <td className="p-2">{t.purse ? formatMoney(t.purse, settings) : `${formatMoney(settings.defaultBudget, settings)} (default)`}</td>
                      <td className="p-2 text-right">
                        {t.tag === 'new' ? <Tag tone="new">New team</Tag> : t.tag === 'update' ? <Tag tone="update">Purse → {formatMoney(t.purse, settings)}</Tag> : <Tag tone="same">No change</Tag>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {playerRows.length > 0 && (
          <div>
            <h4 className="mb-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">
              Players ({playerRows.length}){placed ? ` · ${placed} already on a team` : ''}{forNext ? ` · ${forNext} saved for round ${nextRound}` : ''}
            </h4>
            <div className="max-h-64 overflow-auto rounded-xl border border-white/10">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-ink-900 text-left text-slate-400">
                  <tr><th className="p-2">Name</th><th className="p-2">Role</th><th className="p-2">Base</th><th className="p-2">Team</th><th className="p-2">Price paid</th>{hasRound && <th className="p-2">Round</th>}<th className="p-2" /></tr>
                </thead>
                <tbody>
                  {playerRows.map((p, i) => (
                    <tr key={i} className="border-t border-white/5">
                      <td className="p-2 font-semibold">{p.name}</td>
                      <td className="p-2">{p.role || '—'}</td>
                      <td className="p-2">{p.basePrice ? formatMoney(p.basePrice, settings) : '—'}</td>
                      <td className={`p-2 ${p.badTeam ? 'text-amber-300' : ''}`}>{p.team || '—'}{p.badTeam ? ' ⚠ no such team' : ''}</td>
                      <td className="p-2">{p.team ? formatMoney(p.price || p.basePrice || settings.defaultBasePrice, settings) : '—'}</td>
                      {hasRound && (
                        <td className={`p-2 ${(p.round ?? 0) > nextRound ? 'text-amber-300' : (p.round ?? 0) === nextRound && !p.team ? 'text-royal-300' : ''}`}>
                          {p.round ? p.round : '—'}
                          {(p.round ?? 0) > nextRound ? ' ⚠ too far ahead' : (p.round ?? 0) === nextRound && !p.team ? ' (saved ahead)' : ''}
                        </td>
                      )}
                      <td className="p-2 text-right">{p.isUpdate ? <Tag tone="update">Update</Tag> : <Tag tone="new">New</Tag>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tooFar > 0 && <p className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-200">{tooFar} row{tooFar === 1 ? ' has' : 's have'} a round later than {nextRound}. Only the very next round can be prepared ahead, so {tooFar === 1 ? 'it' : 'they'} will be skipped.</p>}

        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className={replace ? 'btn-hot' : 'btn-primary'} disabled={nothing || busy || !replaceReady} onClick={run}>
            {busy ? 'Importing…' : replace ? 'Replace everything' : 'Import'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
