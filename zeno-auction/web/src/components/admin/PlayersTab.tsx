import { Camera, ClipboardPaste, Download, FileSpreadsheet, FileUp, ImagePlus, Pencil, Plus, Search, Trash2, UserCheck } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { formatMoney } from '../../../../shared/money';
import { effectiveBase, teamStats } from '../../../../shared/rules';
import type { Player, Snapshot } from '../../../../shared/types';
import type { ParsedWorkbook } from '../../../../shared/excel';
import { uploadImage } from '../../lib/api';
import { downloadTemplate, exportAuction, parseFile } from '../../lib/excelClient';
import { parseImport } from '../../lib/csv';
import { normaliseName, resizeImage } from '../../lib/image';
import type { Room } from '../../lib/useRoom';
import { MoneyInput } from '../MoneyInput';
import { Field, Modal, PlayerAvatar, TeamDot, useToast } from '../ui';
import { ExcelImportModal } from './ExcelImportModal';

type Filter = 'all' | 'available' | 'sold' | 'unsold' | 'upcoming';

export function PlayersTab({ snap, room, adminKey }: { snap: Snapshot; room: Room; adminKey: string }) {
  const { settings } = snap;
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Player | 'new' | null>(null);
  const [assigning, setAssigning] = useState<Player | null>(null);
  const [importing, setImporting] = useState(false);
  const bulkPhotos = useRef<HTMLInputElement>(null);
  const excelFile = useRef<HTMLInputElement>(null);
  const [excelImport, setExcelImport] = useState<{ parsed: ParsedWorkbook; name: string } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  const counts = useMemo(
    () => ({
      all: snap.players.length,
      available: snap.players.filter((p) => p.status === 'available').length,
      sold: snap.players.filter((p) => p.status === 'sold').length,
      unsold: snap.players.filter((p) => p.status === 'unsold').length,
      upcoming: snap.players.filter((p) => p.status === 'upcoming').length,
    }),
    [snap.players],
  );

  const rows = snap.players.filter(
    (p) => (filter === 'all' || p.status === filter) && (!search || `${p.name} ${p.role}`.toLowerCase().includes(search.toLowerCase())),
  );
  const onBlock = snap.live.phase === 'spinning' || snap.live.phase === 'bidding' ? snap.live.playerId : null;

  const uploadMany = async (files: FileList) => {
    setPhotoBusy(true);
    let matched = 0;
    const missed: string[] = [];
    for (const f of Array.from(files)) {
      const target = snap.players.find((p) => normaliseName(p.name) === normaliseName(f.name));
      if (!target) {
        missed.push(f.name);
        continue;
      }
      try {
        const url = await uploadImage(snap.code, adminKey, await resizeImage(f));
        await room.act('player.update', { id: target.id, patch: { photo: url } });
        matched++;
      } catch (err) {
        toast(`${f.name}: ${(err as Error).message}`, 'error');
      }
    }
    setPhotoBusy(false);
    toast(`${matched} photo${matched === 1 ? '' : 's'} matched${missed.length ? `, ${missed.length} didn't match a player name (${missed.slice(0, 3).join(', ')}${missed.length > 3 ? '…' : ''})` : ''}`, missed.length ? 'info' : 'success');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" /> Add player
        </button>
        <button className="btn-ghost" onClick={() => setImporting(true)}>
          <ClipboardPaste className="h-4 w-4" /> Paste a list
        </button>
        <input
          ref={bulkPhotos}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) void uploadMany(e.target.files);
            e.target.value = '';
          }}
        />
        <button className="btn-ghost" disabled={photoBusy || snap.players.length === 0} onClick={() => bulkPhotos.current?.click()} title="Name each file after the player, e.g. aarav-mehta.jpg">
          <Camera className="h-4 w-4" /> {photoBusy ? 'Uploading…' : 'Bulk photos'}
        </button>
        <input
          ref={excelFile}
          type="file"
          accept=".xlsx,.csv"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              setExcelImport({ parsed: await parseFile(f), name: f.name });
            } catch (err) {
              toast(`Couldn't read that file: ${(err as Error).message}`, 'error');
            }
          }}
        />
        <button className="btn-ghost" onClick={() => excelFile.current?.click()} title="Import players and teams from an Excel (.xlsx) or CSV file">
          <FileUp className="h-4 w-4" /> Import Excel
        </button>
        <button className="btn-ghost" disabled={snap.players.length + snap.captains.length === 0} onClick={() => exportAuction(snap).catch((e) => toast(e.message, 'error'))} title="Download everything — players, teams, prices, purses — as .xlsx">
          <Download className="h-4 w-4" /> Export Excel
        </button>
        <button className="btn-ghost" onClick={() => downloadTemplate(snap.settings).catch((e) => toast(e.message, 'error'))} title="A blank file with the right columns">
          <FileSpreadsheet className="h-4 w-4" /> Template
        </button>
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
          <input className="input !w-56 !pl-9" placeholder="Search players" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'available', 'sold', 'unsold', ...(counts.upcoming > 0 ? ['upcoming'] : [])] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`chip capitalize ${filter === f ? '!border-gold !bg-gold/15 !text-gold' : 'hover:bg-white/10'}`}
          >
            {f === 'available' ? 'In pool' : f === 'upcoming' ? `For round ${snap.round + 1}` : f} · {counts[f]}
          </button>
        ))}
      </div>

      {snap.players.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-lg font-semibold">No players yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">Add them one by one, import an Excel file, or paste a list from Google Sheets. Include Team and Price columns to bring in players who were already bought.</p>
          <div className="mt-5 flex justify-center gap-2">
            <button className="btn-primary" onClick={() => setImporting(true)}>
              <ClipboardPaste className="h-4 w-4" /> Paste a list
            </button>
            <button className="btn-ghost" onClick={() => setEditing('new')}>
              Add one player
            </button>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="p-3">Player</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Base</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const team = snap.captains.find((c) => c.id === p.teamId);
                  const live = onBlock === p.id;
                  return (
                    <tr key={p.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                      <td className="p-2.5">
                        <div className="flex items-center gap-3">
                          <PlayerAvatar player={p} className="h-10 w-10 shrink-0 rounded-lg text-[10px]" />
                          <div className="min-w-0">
                            <div className="truncate font-semibold">{p.name}</div>
                            {p.description && <div className="max-w-[260px] truncate text-xs text-slate-500">{p.description}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="p-2.5 text-slate-300">{p.role || '—'}</td>
                      <td className="p-2.5 text-slate-300">{formatMoney(effectiveBase(settings, p), settings)}</td>
                      <td className="p-2.5">
                        <select
                          aria-label={`Status of ${p.name}`}
                          className={`input !w-auto !py-1.5 !pr-7 !text-xs font-semibold ${
                            live ? '!border-gold/60 !text-gold' : p.status === 'sold' ? '!text-emerald-300' : p.status === 'unsold' ? '!text-red-300' : p.status === 'upcoming' ? '!text-royal-300' : ''
                          }`}
                          value={live ? 'block' : p.status}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === 'sold') setAssigning(p);
                            else void room.act('player.setStatus', { id: p.id, status: v });
                          }}
                        >
                          <option value="available">In pool</option>
                          <option value="block">On the block</option>
                          <option value="unsold">Unsold</option>
                          <option value="upcoming">{`Waiting for round ${snap.round + 1}`}</option>
                          <option value="sold">{p.status === 'sold' ? 'Sold (change team…)' : 'Sold — pick team…'}</option>
                        </select>
                        {p.status === 'sold' && team && !live && (
                          <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold">
                            <TeamDot captain={team} /> {team.team} <span className="text-gold">{formatMoney(p.price, settings)}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-2.5">
                        <div className="flex justify-end gap-1.5">
                          <button className="btn-ghost !px-2.5 !py-1.5 !text-xs" disabled={snap.captains.length === 0} title="Record this player as bought by a team" onClick={() => setAssigning(p)}>
                            <UserCheck className="h-3.5 w-3.5" /> {p.status === 'sold' ? 'Move' : 'Assign'}
                          </button>
                          <button className="btn-ghost !px-2.5 !py-1.5 !text-xs" aria-label="Edit" onClick={() => setEditing(p)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            className="btn-danger !px-2.5 !py-1.5 !text-xs"
                            aria-label="Delete"
                            onClick={() => confirm(`Delete ${p.name}?`) && room.act('player.remove', { id: p.id })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      No players match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && <PlayerModal snap={snap} room={room} adminKey={adminKey} player={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {assigning && <AssignModal snap={snap} room={room} player={assigning} onClose={() => setAssigning(null)} />}
      {excelImport && <ExcelImportModal snap={snap} room={room} parsed={excelImport.parsed} fileName={excelImport.name} onClose={() => setExcelImport(null)} />}
      {importing && <ImportModal snap={snap} room={room} onClose={() => setImporting(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function PlayerModal({ snap, room, adminKey, player, onClose }: { snap: Snapshot; room: Room; adminKey: string; player: Player | null; onClose: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState({
    name: player?.name ?? '',
    role: player?.role ?? '',
    description: player?.description ?? '',
    photo: player?.photo ?? '',
    basePrice: player?.basePrice ?? 0,
  });
  const [later, setLater] = useState(false); // add for the next round instead of the pool
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const roles = [...new Set(snap.players.map((p) => p.role).filter(Boolean))];

  const save = async (another: boolean) => {
    const ok = player ? await room.act('player.update', { id: player.id, patch: f }) : await room.act('player.add', { ...f, later });
    if (!ok) return;
    if (another && !player) setF({ name: '', role: f.role, description: '', photo: '', basePrice: f.basePrice });
    else onClose();
  };

  return (
    <Modal title={player ? `Edit ${player.name}` : 'Add a player'} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          <div className="shrink-0 text-center">
            <PlayerAvatar player={{ name: f.name || '?', photo: f.photo }} className="h-24 w-24 rounded-2xl text-xs" />
            <input
              ref={file}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const fl = e.target.files?.[0];
                e.target.value = '';
                if (!fl) return;
                setBusy(true);
                try {
                  setF((x) => ({ ...x }));
                  const url = await uploadImage(snap.code, adminKey, await resizeImage(fl));
                  setF((x) => ({ ...x, photo: url }));
                } catch (err) {
                  toast((err as Error).message, 'error');
                } finally {
                  setBusy(false);
                }
              }}
            />
            <button className="btn-ghost mt-2 !px-3 !py-1.5 !text-xs" disabled={busy} onClick={() => file.current?.click()}>
              <ImagePlus className="h-3.5 w-3.5" /> {busy ? '…' : 'Photo'}
            </button>
          </div>
          <div className="flex-1 space-y-3">
            <Field label="Name">
              <input autoFocus className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && f.name.trim() && save(false)} />
            </Field>
            <Field label="Role / category">
              <input className="input" list="roles" placeholder="Batter, Goalkeeper, Designer…" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} />
              <datalist id="roles">
                {roles.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </Field>
          </div>
        </div>
        <Field label="Description" hint="One line the audience sees when this player comes up.">
          <textarea className="input min-h-[70px]" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Base price" hint={`Leave empty to use the default (${formatMoney(snap.settings.defaultBasePrice, snap.settings)}).`}>
            <MoneyInput allowZero value={f.basePrice} fmt={snap.settings} onChange={(n) => setF({ ...f, basePrice: n })} />
          </Field>
          <Field label="…or photo URL">
            <input className="input" placeholder="https://…" value={f.photo} onChange={(e) => setF({ ...f, photo: e.target.value })} />
          </Field>
        </div>
        {!player && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[var(--hairline)] bg-ink-900/50 p-3 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#f2b84b]" checked={later} onChange={(e) => setLater(e.target.checked)} />
            <span>
              <b className="text-white">Add for round {snap.round + 1}</b>
              <span className="block text-xs text-slate-400">Not in the pool yet and hidden from captains and the big screen. The auctioneer brings them in together with the unsold players when round {snap.round + 1} starts.</span>
            </span>
          </label>
        )}
        <div className="flex justify-end gap-2">
          {!player && (
            <button className="btn-ghost" disabled={!f.name.trim()} onClick={() => save(true)}>
              Save & add another
            </button>
          )}
          <button className="btn-primary" disabled={!f.name.trim() || busy} onClick={() => save(false)}>
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AssignModal({ snap, room, player, onClose }: { snap: Snapshot; room: Room; player: Player; onClose: () => void }) {
  const [captainId, setCaptainId] = useState(player.teamId ?? snap.captains[0]?.id ?? '');
  const [price, setPrice] = useState(player.price || effectiveBase(snap.settings, player));
  const team = snap.captains.find((c) => c.id === captainId);
  const left = team ? teamStats(snap, team).remaining + (player.teamId === team.id ? player.price : 0) : 0;
  return (
    <Modal title={`Assign ${player.name} to a team`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-400">Use this for players who were bought before you started using the app. The price comes off the team's purse.</p>
        <Field label="Team">
          <select className="input" value={captainId} onChange={(e) => setCaptainId(e.target.value)}>
            {snap.captains.map((c) => (
              <option key={c.id} value={c.id}>
                {c.team} — {formatMoney(teamStats(snap, c).remaining, snap.settings)} left
              </option>
            ))}
          </select>
        </Field>
        <Field label="Price paid">
          <MoneyInput allowZero value={price} fmt={snap.settings} onChange={setPrice} />
        </Field>
        {team && price > left && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300">That's more than {team.team} has left ({formatMoney(left, snap.settings)}). Their purse will go negative — top it up in the Teams tab if that's not intended.</p>}
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={!captainId}
            onClick={async () => {
              if (await room.act('player.assign', { id: player.id, captainId, price })) onClose();
            }}
          >
            Assign
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ImportModal({ snap, room, onClose }: { snap: Snapshot; room: Room; onClose: () => void }) {
  const [text, setText] = useState('');
  const [later, setLater] = useState(false);
  const rows = useMemo(() => parseImport(text).filter((r) => r.name), [text]);
  const withTeam = rows.filter((r) => r.team).length;
  const { toast } = useToast();
  return (
    <Modal wide title="Paste a list of players" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-300">
          Copy rows from Excel or Google Sheets (or a CSV) and paste them here. Columns, in order:{' '}
          <b>name, role, base price, description, photo URL, team, price</b>. Only the name is required. A first row with those headings is fine too.
        </p>
        <div className="rounded-xl border border-gold/20 bg-gold/5 p-3 text-sm text-slate-300">
          <b className="text-gold">Joining midway?</b> Fill the <b>team</b> and <b>price</b> columns for players that are already bought — they'll be put on that team and the price deducted from its purse. Team names must match ({snap.captains.map((c) => c.team).join(', ') || 'add teams first'}).
        </div>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[var(--hairline)] bg-ink-900/50 p-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#f2b84b]" checked={later} onChange={(e) => setLater(e.target.checked)} />
          <span>
            <b className="text-white">These are for round {snap.round + 1}</b>
            <span className="block text-xs text-slate-400">New names are saved for the next round: not in the pool yet and hidden from captains and the big screen. (Rows with a team and price are still placed on that team straight away.)</span>
          </span>
        </label>
        <textarea
          className="input min-h-[200px] font-mono text-xs"
          placeholder={'Aarav Mehta\tBatter\t20L\tOpens the innings\nRohan Iyer\tBowler\t25L\t\t\tThunder Hawks\t1.2cr'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {rows.length > 0 && (
          <div className="max-h-48 overflow-auto rounded-xl border border-white/10">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-ink-900 text-left text-slate-400">
                <tr>
                  <th className="p-2">Name</th>
                  <th className="p-2">Role</th>
                  <th className="p-2">Base</th>
                  <th className="p-2">Team</th>
                  <th className="p-2">Price</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="p-2 font-semibold">{r.name}</td>
                    <td className="p-2">{r.role}</td>
                    <td className="p-2">{r.basePrice ? formatMoney(r.basePrice, snap.settings) : '—'}</td>
                    <td className={`p-2 ${r.team && !snap.captains.some((c) => c.team.toLowerCase() === r.team.toLowerCase() || c.name.toLowerCase() === r.team.toLowerCase()) ? 'text-amber-300' : ''}`}>{r.team || '—'}</td>
                    <td className="p-2">{r.team ? formatMoney(r.price || r.basePrice || snap.settings.defaultBasePrice, snap.settings) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">
            {rows.length} player{rows.length === 1 ? '' : 's'}
            {withTeam ? `, ${withTeam} already on a team` : ''}
          </span>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={rows.length === 0}
              onClick={async () => {
                const res = await room.act('players.import', { rows, later });
                if (!res) return;
                const r = res as { added: number; assigned: number; skipped: string[] };
                toast(`Imported ${r.added} players${r.assigned ? ` (${r.assigned} placed on teams)` : ''}${r.skipped.length ? `. Notes: ${r.skipped.join('; ')}` : ''}`, r.skipped.length ? 'info' : 'success');
                onClose();
              }}
            >
              Import {rows.length || ''}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
