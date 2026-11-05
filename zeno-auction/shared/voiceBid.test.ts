import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideVoiceBid, parseSpokenBid } from './voiceBid';

const L = 100_000, CR = 10_000_000;
const amt = (s: string) => {
  const h = parseSpokenBid(s);
  return h && h.kind === 'amount' ? h.amount : h ? h.kind : null;
};

test('raise words place the next bid', () => {
  for (const s of ['raise', 'Raise!', 'bid', 'my bid', 'boli', 'बोली', 'badhao', 'बढ़ाओ', 'yes raise']) assert.equal(amt(s), 'raise', s);
});

test('amounts are understood the way people say them', () => {
  assert.equal(amt('1 crore 20 lakh'), 1 * CR + 20 * L);
  assert.equal(amt('one crore twenty lakh'), 1 * CR + 20 * L);
  assert.equal(amt('1 crore 20'), 1 * CR + 20 * L, 'the size after a crore is lakh');
  assert.equal(amt('1.2 crore'), 12_000_000);
  assert.equal(amt('1.25 cr'), 12_500_000);
  assert.equal(amt('50 lakh'), 50 * L);
  assert.equal(amt('fifty five lakhs'), 55 * L);
  assert.equal(amt('पचास लाख'), 50 * L);
  assert.equal(amt('pachaas lakh'), 50 * L);
  assert.equal(amt('ek crore bees lakh'), 1 * CR + 20 * L);
  assert.equal(amt('डेढ़ करोड़'), 15_000_000);
  assert.equal(amt('a crore'), CR);
  assert.equal(amt('75 thousand'), 75_000);
  assert.equal(amt('75k'), 75_000);
  assert.equal(amt('2 million'), 2_000_000);
  assert.equal(amt('₹12,00,000'), 1_200_000);
  assert.equal(amt('bid 60 lakh'), 60 * L, 'an amount wins over the raise word');
  assert.equal(amt('१ करोड़'), CR, 'Devanagari digits');
});

test('talk and noise are ignored', () => {
  for (const s of ['', 'hello', 'what do you think about this player', '20', 'two', 'he is a bit expensive', 'can you hear me', 'I think we should raise the money for the next round team players']) {
    assert.equal(amt(s), null, s);
  }
});

test('what to do with it: bid, ask first, or ignore', () => {
  const min = 50 * L, limit = 3 * CR;
  assert.deepEqual(decideVoiceBid({ kind: 'raise' }, min, limit), { act: 'bid', amount: min });
  assert.deepEqual(decideVoiceBid({ kind: 'amount', amount: 60 * L }, min, limit), { act: 'bid', amount: 60 * L });
  assert.equal(decideVoiceBid({ kind: 'amount', amount: 40 * L }, min, limit).act, 'ignore', 'below the next bid');
  assert.equal(decideVoiceBid({ kind: 'amount', amount: 5 * CR }, min, limit).act, 'ignore', 'over the budget');
  assert.deepEqual(decideVoiceBid({ kind: 'amount', amount: 2 * CR }, min, limit), { act: 'confirm', amount: 2 * CR }, 'a big jump is confirmed with a tap');
  assert.equal(decideVoiceBid({ kind: 'raise' }, 4 * CR, limit).act, 'ignore');
  assert.equal(decideVoiceBid(null, min, limit).act, 'ignore');
});
