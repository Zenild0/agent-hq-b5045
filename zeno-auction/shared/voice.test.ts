import { test } from 'node:test';
import assert from 'node:assert/strict';
import { englishVoices, isFemaleVoice, pickVoice } from './voice';

const v = (name: string, lang = 'en-US') => ({ name, lang });

test('recognises female and male voice names across platforms', () => {
  for (const n of ['Microsoft Zira Desktop', 'Microsoft Heera', 'Google UK English Female', 'Samantha', 'Karen', 'Veena', 'Microsoft Neerja Online (Natural)']) assert.equal(isFemaleVoice(v(n)), true, n);
  for (const n of ['Microsoft David', 'Microsoft Ravi', 'Google UK English Male', 'Alex', 'Daniel', 'Rishi', 'Microsoft Mark']) assert.equal(isFemaleVoice(v(n)), false, n);
});

test('Windows: picks an Indian-English female voice when there is one', () => {
  const win = [v('Microsoft David Desktop'), v('Microsoft Zira Desktop'), v('Microsoft Ravi', 'en-IN'), v('Microsoft Heera', 'en-IN'), v('Microsoft Hazel', 'en-GB')];
  assert.equal(pickVoice(win)?.name, 'Microsoft Heera');
  const natural = [...win, v('Microsoft Neerja Online (Natural) - English (India)', 'en-IN')];
  assert.equal(pickVoice(natural)?.name.startsWith('Microsoft Neerja'), true);
});

test('Chrome: picks a female Google voice, never the male one', () => {
  const chrome = [v('Google UK English Male', 'en-GB'), v('Google UK English Female', 'en-GB'), v('Google US English'), v('Google español', 'es-ES')];
  const pick = pickVoice(chrome)!;
  assert.equal(isFemaleVoice(pick), true);
  assert.notEqual(pick.name, 'Google UK English Male');
});

test('Mac: Veena (en-IN) beats Samantha; non-English voices are ignored', () => {
  const mac = [v('Alex'), v('Samantha'), v('Daniel', 'en-GB'), v('Veena', 'en-IN'), v('Rishi', 'en-IN'), v('Amélie', 'fr-CA'), v('Kyoko', 'ja-JP')];
  assert.equal(pickVoice(mac)?.name, 'Veena');
  assert.deepEqual(englishVoices(mac).map((x) => x.name).slice(0, 2), ['Veena', 'Samantha']);
  assert.equal(englishVoices(mac).some((x) => x.lang.startsWith('fr') || x.lang.startsWith('ja')), false);
});

test('the person\'s own choice always wins; with only male voices we still return one', () => {
  const list = [v('Microsoft David Desktop'), v('Microsoft Zira Desktop')];
  assert.equal(pickVoice(list, 'Microsoft David Desktop')?.name, 'Microsoft David Desktop');
  assert.equal(pickVoice(list, 'Gone Voice')?.name, 'Microsoft Zira Desktop'); // saved voice no longer installed → fall back to best
  assert.equal(pickVoice([v('Microsoft David Desktop')])?.name, 'Microsoft David Desktop');
  assert.equal(pickVoice([]), undefined);
});
