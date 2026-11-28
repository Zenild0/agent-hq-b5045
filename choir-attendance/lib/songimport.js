// Reads songs out of a text export (ChordPro, or plain text with chords above the words) so a whole songbook can be
// loaded in one go. One file may hold many songs. Nothing is fetched from any website: the teacher supplies the text.
import { chordsUsed, normaliseSheet, isChord } from '../public/chordpro.js';

const DIRECTIVE = /^\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}\s*$/i;
const TITLE = new Set(['title', 't']);
const NEW_SONG = new Set(['new_song', 'ns']);
const DROP = new Set(['subtitle', 'st', 'artist', 'composer', 'lyricist', 'copyright', 'album', 'year', 'time', 'tempo', 'duration', 'capo', 'meta', 'sorttitle', 'comment_italic', 'ci', 'comment_box', 'cb', 'define', 'chord', 'columns', 'col', 'column_break', 'cb', 'pagetype', 'new_page', 'np', 'new_physical_page', 'npp', 'textsize', 'textfont', 'chordsize', 'chordfont', 'start_of_tab', 'end_of_tab', 'sot', 'eot']);

// "Title / words" blocks split on a line of === or ---, or a ChordPro {new_song}, or each new {title: …}.
export function splitSongs(text) {
  const t = String(text ?? '').replace(/\r/g, '').replace(/^﻿/, '');
  const lines = t.split('\n');
  const isTitle = (l) => { const m = DIRECTIVE.exec(l.trim()); return m && TITLE.has(m[1].toLowerCase()); };
  const isNew = (l) => { const m = DIRECTIVE.exec(l.trim()); return m && NEW_SONG.has(m[1].toLowerCase()); };
  const titles = lines.filter(isTitle).length;
  const out = []; let cur = [];
  const flush = () => { if (cur.some((l) => l.trim())) out.push(cur.join('\n')); cur = []; };
  if (lines.some(isNew)) { for (const l of lines) { if (isNew(l)) flush(); else cur.push(l); } flush(); return out; }
  if (titles > 1) { for (const l of lines) { if (isTitle(l) && cur.some((x) => x.trim())) flush(); cur.push(l); } flush(); return out; }
  if (lines.some((l) => /^\s*(={3,}|-{3,}|#{3,})\s*$/.test(l))) { for (const l of lines) { if (/^\s*(={3,}|-{3,}|#{3,})\s*$/.test(l)) flush(); else cur.push(l); } flush(); return out; }
  return [t].filter((x) => x.trim());
}

// One block of text becomes { title, key, body }. Returns null when there is nothing usable (no title or no chords).
export function parseSong(block) {
  let title = '', key = '';
  const body = [];
  for (const raw of String(block ?? '').split('\n')) {
    const l = raw.trimEnd();
    const m = DIRECTIVE.exec(l.trim());
    if (m) {
      const d = m[1].toLowerCase(), v = (m[2] ?? '').trim();
      if (TITLE.has(d)) { title ||= v; continue; }
      if (d === 'key') { key ||= v; continue; }
      if (['start_of_chorus', 'soc'].includes(d)) { body.push('[Chorus]'); continue; }
      if (['start_of_verse', 'sov'].includes(d)) { body.push(v ? `[${v}]` : '[Verse]'); continue; }
      if (['start_of_bridge', 'sob'].includes(d)) { body.push('[Bridge]'); continue; }
      if (['end_of_chorus', 'eoc', 'end_of_verse', 'eov', 'end_of_bridge', 'eob'].includes(d)) continue;
      if (['comment', 'c', 'highlight', 'text'].includes(d)) { if (v) body.push(`[${v.replace(/[[\]]/g, '')}]`); continue; }
      if (DROP.has(d)) continue;
      continue; // any other directive is not part of the song
    }
    body.push(l);
  }
  let lines = body;
  if (!title) { // plain text: the first line is the title (with or without "Title:")
    const i = lines.findIndex((l) => l.trim());
    if (i < 0) return null;
    title = lines[i].trim().replace(/^title\s*[:\-]\s*/i, '');
    lines = lines.slice(i + 1);
  }
  const kl = lines.findIndex((l) => /^\s*key\s*[:\-]\s*\S+\s*$/i.test(l));
  if (kl >= 0) { key ||= lines[kl].split(/[:\-]/)[1].trim(); lines.splice(kl, 1); }
  title = title.replace(/\s+/g, ' ').trim().slice(0, 80);
  const sheet = normaliseSheet(lines.join('\n'));
  if (!title || !sheet || !chordsUsed(sheet).length) return null;
  key = isChord(key) ? key : '';
  return { title, key, body: sheet };
}

// All the songs in a text, in the order they appear. `skipped` says what could not be read.
export function parseSongs(text) {
  const songs = [], skipped = [];
  for (const block of splitSongs(text)) {
    const s = parseSong(block);
    if (s) songs.push(s);
    else skipped.push({ title: (/^\s*(?:\{\s*(?:title|t)\s*:\s*(.+?)\s*\}|(.+))/im.exec(block)?.slice(1).find(Boolean) ?? '?').slice(0, 60), reason: 'no title or no chords found' });
  }
  return { songs, skipped };
}
