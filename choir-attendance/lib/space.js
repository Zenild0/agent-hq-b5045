// Choir Space: a small, safe, friendly place for the children. No free chat, no photos, no voices: only short automatic
// posts (a streak, a long practice day, new songs), notes from the teacher, one-tap reactions, a weekly challenge the whole
// choir fills together, and a little avatar made from a colour, a badge and a frame that unlock with XP.

export const REACTIONS = ['👏', '🔥', '🎵', '😍'];
export const STREAK_MARKS = [3, 7, 14, 30, 60, 100];
export const BIG_DAY_SECS = 600;      // ten minutes of singing in a day earns a post
export const MEDALS = [{ id: 'bronze', emoji: '🥉', at: 50 }, { id: 'silver', emoji: '🥈', at: 80 }, { id: 'gold', emoji: '🥇', at: 100 }];
export const COLOURS = ['#FFC62E', '#FF8AD1', '#3DDCFF', '#C8FF3D', '#B13DF5', '#FF8A3D'];
export const BADGES = [{ id: 'none', e: '', xp: 0 }, { id: 'note', e: '🎵', xp: 0 }, { id: 'mic', e: '🎤', xp: 60 }, { id: 'star', e: '⭐', xp: 120 }, { id: 'fire', e: '🔥', xp: 250 }, { id: 'crown', e: '👑', xp: 500 }];
export const FRAMES = [{ id: 'none', c: '', xp: 0 }, { id: 'gold', c: '#FFE14D', xp: 40 }, { id: 'mint', c: '#2EE6A6', xp: 150 }, { id: 'sky', c: '#3DDCFF', xp: 300 }];
export const DEFAULT_AVATAR = { color: COLOURS[0], badge: 'note', frame: 'none' };
export const MAX_POSTS = 300;

// The highest streak milestone reached (0 if none), so a post is made once per milestone.
export const streakMark = (streak) => [...STREAK_MARKS].reverse().find((m) => streak >= m) ?? 0;

// An avatar is valid when every part exists and has been unlocked by the child's total XP. Returns the clean avatar or null.
export function cleanAvatar(input, totalXp = 0) {
  const a = input ?? {};
  const color = COLOURS.includes(a.color) ? a.color : null;
  const badge = BADGES.find((b) => b.id === a.badge);
  const frame = FRAMES.find((f) => f.id === a.frame);
  if (!color || !badge || !frame) return null;
  if (totalXp < badge.xp || totalXp < frame.xp) return null;
  return { color, badge: badge.id, frame: frame.id };
}
export const avatarOf = (child) => cleanAvatar(child?.avatar, Infinity) ?? DEFAULT_AVATAR;

// The weekly challenge: every child's practice minutes add up towards one goal.
// rows: [{ id, name, secs }]; returns the progress, the medals earned and who is helping most.
export function challengeView(rows, target, meId) {
  const goal = Math.max(10, Math.round(Number(target) || 500));
  const mins = (r) => Math.round((r.secs || 0) / 60);
  const total = rows.reduce((n, r) => n + mins(r), 0);
  const pct = Math.min(100, Math.round((100 * total) / goal));
  const ranked = rows.filter((r) => mins(r) > 0).sort((a, b) => mins(b) - mins(a) || a.name.localeCompare(b.name));
  const best = Math.max(1, ranked[0] ? mins(ranked[0]) : 1);
  const top = ranked.slice(0, 4).map((r, i) => ({ rank: i + 1, id: r.id, name: r.name, minutes: mins(r), share: Math.round((100 * mins(r)) / best), me: r.id === meId }));
  const mine = rows.find((r) => r.id === meId);
  return { goal, minutes: total, pct, medals: MEDALS.map((m) => ({ ...m, minutes: Math.round((goal * m.at) / 100), got: pct >= m.at })), top, mine: mine ? mins(mine) : 0 };
}
