import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitSongs, parseSong, parseSongs } from '../lib/songimport.js';

const CHORDPRO = `{title: Amazing Grace}
{key: G}
{artist: John Newton}
{start_of_verse}
[G]Amazing [C]grace how [G]sweet the sound
{end_of_verse}
{new_song}
{title: Be Thou My Vision}
{c: Verse 1}
[D]Be Thou my [G]vision, O [D]Lord of my [A]heart
{soc}
[D]Thou my best [G]thought
{eoc}`;

test('a ChordPro file with several songs is split in the order given, directives become headings', () => {
  const { songs, skipped } = parseSongs(CHORDPRO);
  assert.deepEqual(songs.map((s) => s.title), ['Amazing Grace', 'Be Thou My Vision']);
  assert.equal(songs[0].key, 'G');
  assert.ok(songs[0].body.includes('{Verse}') && songs[0].body.includes('[G]Amazing [C]grace'));
  assert.ok(!songs[0].body.includes('artist') && !songs[0].body.includes('{artist'));
  assert.ok(songs[1].body.includes('{Verse 1}') && songs[1].body.includes('{Chorus}'));
  assert.equal(skipped.length, 0);
});

test('songs split on each new title without a separator, and on === lines for plain text', () => {
  assert.equal(splitSongs('{t: One}\n[C]a\n{t: Two}\n[G]b').length, 2);
  const plain = 'How Great\n   G      C\nHow great is our God\n===\nSecond Song\n   D     A\nHello again';
  const { songs } = parseSongs(plain);
  assert.deepEqual(songs.map((s) => s.title), ['How Great', 'Second Song']);
  assert.ok(songs[0].body.includes('[G]') && songs[0].body.includes('[C]'), 'chords over the words become inline chords');
});

test('a block with no chords or no title is skipped and reported, not saved', () => {
  const { songs, skipped } = parseSongs('{title: Only Words}\nNo chords here at all\n{new_song}\n{title: Good}\n[C]yes');
  assert.deepEqual(songs.map((s) => s.title), ['Good']);
  assert.equal(skipped.length, 1);
  assert.equal(parseSong(''), null);
  assert.equal(parseSongs('').songs.length, 0);
});
