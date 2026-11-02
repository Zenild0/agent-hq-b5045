import { useState } from 'react';
import { formatMoney } from '../../../../shared/money';
import type { ParsedWorkbook } from '../../../../shared/excel';
import type { Snapshot } from '../../../../shared/types';
import type { Room } from '../../lib/useRoom';
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
        const res = (await room.act('players.import', { rows: playerRows })) as { added: number; updated: number; assigned: number; queued: number; skipped: string[] } | undefined;
        if (!res) return;
        summary += `${res.added} players added, ${res.updated} updated${res.assigned ? `, ${res.assigned} placed on teams` : ''}${res.queued ? `, ${res.queued} saved for round ${nextRound}` : ''}.`;
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
          <button className="btn-primary" disabled={nothing || busy} onClick={run}>
            {busy ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
