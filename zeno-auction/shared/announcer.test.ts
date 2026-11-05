import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_CTX, SPEECH_KINDS, STYLES, announce, heatOf, studioPace, hindiMoney, isStyle, momentCtx, type AnnouncerStyle, type SpeechKind } from './announcer';
import { pickStyleVoice } from './voice';
import { spokenMoney } from './money';

const inr = { symbol: '₹', moneyStyle: 'indian' as const };
const usd = { symbol: '$', moneyStyle: 'western' as const };
const L = 100_000;
const CR = 10_000_000;

test('Hindi amounts are read in Hindi words, in both scripts', () => {
  assert.equal(hindiMoney(12 * CR, inr), 'बारह करोड़ रुपये');
  assert.equal(hindiMoney(1 * CR + 20 * L, inr), 'एक करोड़ बीस लाख रुपये');
  assert.equal(hindiMoney(1 * CR + 20 * L, inr, 'latin'), 'ek crore bees lakh rupaye');
  assert.equal(hindiMoney(95 * L, inr, 'latin'), 'panchaanave lakh rupaye');
  assert.equal(hindiMoney(2_500_000, inr), 'पच्चीस लाख रुपये');
  assert.equal(hindiMoney(75_000, inr, 'latin'), 'pachhattar hazaar rupaye');
  assert.equal(hindiMoney(625, inr, 'latin'), 'chhah sau pachchees rupaye');
  assert.equal(hindiMoney(100, inr, 'latin'), 'ek sau rupaye');
  assert.equal(hindiMoney(0, inr, 'latin'), 'shoonya rupaye');
  assert.equal(hindiMoney(1 * CR + 5 * L + 50_000 + 250, inr), 'एक करोड़ पाँच लाख पचास हज़ार दो सौ पचास रुपये');
  // every number from 1 to 99 has its own word in both scripts
  for (let n = 1; n < 100; n++) {
    const d = hindiMoney(n * L, inr), l = hindiMoney(n * L, inr, 'latin');
    assert.ok(/^[ऀ-ॿ ]+$/.test(d), `${n}: ${d}`);
    assert.ok(/^[a-z ]+$/.test(l), `${n}: ${l}`);
  }
  // not rupees / too big: plain English words rather than something wrong
  assert.equal(hindiMoney(5_000_000, usd), spokenMoney(5_000_000, usd));
});

test('every style announces who bid how much, every time', () => {
  const kinds: SpeechKind[] = ['reveal', 'bid', 'call', 'sold', 'unsold'];
  for (const s of STYLES) {
    for (let variant = 0; variant < 8; variant++) {
      const ctx = { team: 'Thunder Hawks', player: 'Aarav Mehta', amount: 1 * CR + 20 * L, call: 2, fmt: inr, variant };
      const bid = announce(s.id, 'bid', ctx)!;
      assert.ok(bid.text.includes('Thunder Hawks'), `${s.id} names the team`);
      const hearsAmount = s.lang === 'hi' ? bid.text.includes('एक करोड़ बीस लाख') && bid.alt!.includes('ek crore bees lakh') : bid.text.includes('1 crore 20 lakh');
      assert.ok(hearsAmount, `${s.id} says the amount: ${bid.text}`);
      assert.equal(bid.lang, s.lang);
      for (const k of kinds) {
        const l = announce(s.id, k, ctx)!;
        assert.ok(l && l.text.length > 3, `${s.id}/${k}`);
        if (k === 'sold') assert.ok(l.text.includes('Aarav Mehta') && l.text.includes('Thunder Hawks'), `${s.id} sold names both`);
        if (s.lang === 'hi') assert.ok(l.alt && !/[ऀ-ॿ]/.test(l.alt), `${s.id}/${k} has a Latin-letter version`);
      }
    }
  }
  assert.equal(announce('wwe', 'bid', { fmt: inr, variant: 0 }), null, 'no team or amount = nothing to say');
});

test('the styles sound different: pace, depth, wording and who is speaking', () => {
  const ctx = { team: 'Red', player: 'P', amount: 5 * L, fmt: inr, variant: 1 };
  const w = announce('wwe', 'bid', ctx)!, k = announce('kbc', 'bid', ctx)!, m = announce('mk', 'bid', ctx)!, c = announce('classic', 'bid', ctx)!;
  assert.ok(w.rate === 1 && k.rate === 1 && m.rate === 1, 'every host speaks at normal pace');
  assert.ok(m.pitch! < k.pitch! && k.pitch! < w.pitch! && w.pitch! < 1, 'Mortal Kombat is the deepest');
  assert.equal(c.pitch, undefined, 'classic keeps the app\'s own voice settings');
  assert.deepEqual([w.gender, k.gender, m.gender], ['male', 'male', 'male']);
  for (let variant = 0; variant < 6; variant++) assert.match(announce('mk', 'call', { ...ctx, call: 3, variant })!.text, /Going three times, FINISH HIM!$/);
  assert.match(announce('kbc', 'call', { ...ctx, call: 3 })!.text, /तीसरी बार/);
  assert.equal(announce('classic', 'call', { ...ctx, call: 1 })!.text, 'Going once!');
  // the lines vary from one bid to the next, but a given bid always reads the same
  const texts = new Set([0, 1, 2, 3, 4, 5].map((v) => announce('wwe', 'bid', { ...ctx, bids: 8, variant: v })!.text));
  assert.ok(texts.size >= 3);
  assert.equal(announce('wwe', 'bid', ctx)!.text, announce('wwe', 'bid', ctx)!.text);
});

test('classic is word for word what the app said before', () => {
  const ctx = { team: 'Thunder Hawks', player: 'Aarav', amount: 1 * CR + 20 * L, call: 3, fmt: inr, variant: 0 };
  assert.equal(announce('classic', 'bid', ctx)!.text, `Thunder Hawks, ${spokenMoney(ctx.amount, inr)}`);
  assert.equal(announce('classic', 'sold', ctx)!.text, `Sold! Aarav goes to Thunder Hawks for ${spokenMoney(ctx.amount, inr)}`);
  assert.equal(announce('classic', 'reveal', ctx)!.text, `Up next, Aarav. Base price ${spokenMoney(ctx.amount, inr)}.`);
  assert.equal(announce('classic', 'call', ctx)!.text, 'Going thrice! Last call!');
  assert.equal(announce('classic', 'unsold', ctx)!.text, 'Aarav goes unsold');
});

test('picking a voice for a style: a deep male English voice, or a Hindi voice, and "none" when the device has no Hindi', () => {
  const v = (name: string, lang: string) => ({ name, lang });
  const win = [v('Microsoft Zira Desktop', 'en-US'), v('Microsoft David Desktop', 'en-US'), v('Microsoft Heera', 'en-IN'), v('Microsoft Ravi', 'en-IN'), v('Microsoft Hemant', 'hi-IN'), v('Microsoft Kalpana', 'hi-IN')];
  assert.equal(pickStyleVoice(win, 'en', 'male')?.name, 'Microsoft Ravi');
  assert.equal(pickStyleVoice(win, 'hi', 'male')?.name, 'Microsoft Hemant');
  const chrome = [v('Google UK English Male', 'en-GB'), v('Google UK English Female', 'en-GB'), v('Google हिन्दी', 'hi-IN')];
  assert.equal(pickStyleVoice(chrome, 'en', 'male')?.name, 'Google UK English Male');
  assert.equal(pickStyleVoice(chrome, 'hi', 'male')?.name, 'Google हिन्दी', 'a female-only Hindi voice is better than none');
  assert.equal(pickStyleVoice([v('Samantha', 'en-US')], 'hi', 'male'), undefined);
  assert.equal(pickStyleVoice([], 'en', 'male'), undefined);
  assert.equal(isStyle('kbc') && !isStyle('nope') && !isStyle(undefined), true);
});

test('the host gets more excited as a bidding war heats up', () => {
  assert.equal(heatOf({ bids: 1 }), 0);
  assert.equal(heatOf({ bids: 3 }), 1);
  assert.equal(heatOf({ bids: 5 }), 2);
  assert.equal(heatOf({ bids: 9 }), 3);
  assert.equal(heatOf({ bids: 1, amount: 50 * L, base: 10 * L }), 1, 'a price far above the base adds excitement');
  for (const s of STYLES.filter((x) => x.id !== 'classic')) {
    const at = (bids: number) => new Set([0, 1, 2, 3, 4, 5].map((variant) => announce(s.id, 'bid', { team: 'Red', player: 'Asha', amount: 40 * L, bids, fmt: inr, variant })!.text));
    const calm = at(1), war = at(9);
    for (const t of war) assert.ok(!calm.has(t), `${s.id}: a bidding war does not sound like the first bid: ${t}`);
  }
  // an outbid team is named
  const rivalLines = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((variant) => announce('wwe', 'bid', { team: 'Red', rival: 'Blue', amount: 40 * L, bids: 3, fmt: inr, variant })!.text);
  assert.ok(rivalLines.some((t) => t.includes('Blue')), rivalLines.join(' | '));
  // a hot sale sounds different from a quiet one
  const sold = (bids: number) => announce('kbc', 'sold', { team: 'Red', player: 'Asha', amount: 40 * L, bids, fmt: inr, variant: 0 })!.text;
  assert.notEqual(sold(1), sold(8));
  assert.match(sold(8), /ज़बरदस्त मुक़ाबला/);
});

test('the host reacts: record price, a bargain, all in, and what a team has left', () => {
  const base = { team: 'Red', player: 'Asha', fmt: inr, variant: 0 };
  const rec = announce('wwe', 'sold', { ...base, amount: 90 * L, bids: 4, record: true, left: 2 * CR + 10 * L })!.text;
  assert.match(rec, /BIGGEST buy of the night/);
  assert.match(rec, /Red has 2 crore 10 lakh rupees left/);
  const steal = announce('kbc', 'sold', { ...base, amount: 10 * L, base: 10 * L, bids: 1, left: 5 * CR })!;
  assert.match(steal.text, /सस्ता सौदा/);
  assert.match(steal.text, /पाँच करोड़ रुपये/);
  assert.match(steal.alt!, /sasta sauda.*paanch crore rupaye/);
  assert.match(announce('cricket', 'bid', { ...base, amount: 3 * CR, bids: 4, allIn: true })!.text, /पूरा पर्स/);
  assert.match(announce('assistant', 'sold', { ...base, amount: 30 * L, bids: 2, squad: 5, left: CR })!.text, /player number 5 for Red\. Red now has 1 crore rupees left/);
});

test('the chosen host runs every part of the auction, in its own language', () => {
  for (const s of STYLES.filter((x) => x.id !== 'classic')) {
    for (const kind of SPEECH_KINDS) {
      const l = announce(s.id, kind, { team: 'Red', player: 'Asha', amount: 40 * L, call: 2, seconds: 300, round: 2, fmt: inr, variant: 1 });
      assert.ok(l && l.text.length > 5, `${s.id}/${kind}`);
      assert.equal(l.lang, s.lang);
      if (s.lang === 'hi') assert.ok(l.alt && !/[ऀ-ॿ]/.test(l.alt), `${s.id}/${kind} has a Latin-letter version`);
      assert.ok(!/undefined|NaN|\$\{/.test(l.text + (l.alt ?? '')), `${s.id}/${kind}: ${l.text}`);
    }
    assert.match(announce(s.id, 'break', { seconds: 300, fmt: inr, variant: 0 })!.text, s.lang === 'hi' ? /पाँच मिनट/ : /5 minutes/, s.id);
    assert.match(announce(s.id, 'round', { round: 2, fmt: inr, variant: 0 })!.text, /2/, s.id);
  }
  // classic keeps its own plain break announcements (said by the screen, not the host)
  assert.equal(announce('classic', 'break', { seconds: 300, fmt: inr, variant: 0 }), null);
  assert.ok(isStyle('show') && isStyle('velvet') && isStyle('trailer') && isStyle('cricket') && isStyle('assistant'));
  // the "Hear it" sample is a bidding war, so the excitement is heard
  assert.equal(heatOf(SAMPLE_CTX), 3);
});

test('a moment of the auction is read the same way by the server and the screens', () => {
  const src = {
    players: [
      { id: 'p1', name: 'Asha', basePrice: 10 * L, status: 'sold', teamId: 'a', price: 50 * L },
      { id: 'p2', name: 'Ben', basePrice: 10 * L, status: 'sold', teamId: 'b', price: 30 * L },
      { id: 'p3', name: 'Cal', basePrice: 0, status: 'sold', teamId: 'a', price: 80 * L },
    ],
    captains: [{ id: 'a', team: 'Red', budget: 2 * CR }, { id: 'b', team: 'Blue', budget: 2 * CR }],
    settings: { ...inr, defaultBasePrice: 5 * L },
    live: { bids: [{ captainId: 'b', amount: 70 * L }, { captainId: 'a', amount: 80 * L }] },
    round: 1,
  };
  const bid = momentCtx(src, { seq: 9, type: 'bid', playerId: 'p3', captainId: 'a', amount: 80 * L });
  assert.equal(bid.team, 'Red');
  assert.equal(bid.rival, 'Blue');
  assert.equal(bid.bids, 2);
  assert.equal(bid.base, 5 * L, 'no base price of its own: the default is used');
  const call = momentCtx(src, { seq: 10, type: 'call', call: 1 });
  assert.equal(call.team, 'Red');
  assert.equal(call.amount, 80 * L, 'a call repeats the top bid');
  const sold = momentCtx(src, { seq: 11, type: 'sold', playerId: 'p3', captainId: 'a', amount: 80 * L });
  assert.equal(sold.left, 2 * CR - 130 * L);
  assert.equal(sold.squad, 2);
  assert.equal(sold.record, true);
  const reveal = momentCtx(src, { seq: 12, type: 'reveal', playerId: 'p1' });
  assert.equal(reveal.amount, 10 * L);
  const allIn = momentCtx({ ...src, live: { bids: [{ captainId: 'b', amount: 60 * L }, { captainId: 'a', amount: 65 * L }] } }, { seq: 13, type: 'bid', playerId: 'p3', captainId: 'a', amount: 65 * L });
  assert.equal(allIn.allIn, true, 'Red has 70 lakh free; 65 lakh is nearly all of it');
  assert.equal(momentCtx(src, { seq: 14, type: 'break', amount: 300 }).seconds, 300);
});

test('every host speaks at normal pace, and a bid flows without long pauses', () => {
  for (const s of STYLES) for (const bids of [1, 9]) assert.equal(studioPace(s.id, 'bid', { bids, fmt: inr, variant: 0 }), 1, `${s.id} is never faster or slower`);
  for (const s of STYLES.filter((x) => x.id !== 'classic')) {
    for (const bids of [1, 4, 9]) for (let variant = 0; variant < 4; variant++) {
      const b = announce(s.id, 'bid', { team: 'Red', rival: 'Blue', player: 'Asha', amount: 40 * L, bids, fmt: inr, variant })!;
      assert.ok(!b.text.includes('...') && !(b.alt ?? '').includes('...'), `${s.id}: no long pauses in a bid: ${b.text}`);
    }
    const c = announce(s.id, 'call', { amount: 40 * L, call: 2, fmt: inr, variant: 0 })!;
    assert.ok(!c.text.includes('...'), `${s.id}: ${c.text}`);
  }
  // plenty of different lines: a host does not keep repeating the same two or three
  for (const s of STYLES.filter((x) => x.id !== 'classic')) {
    const lines = new Set<string>();
    for (const bids of [1, 2, 4, 9]) for (let variant = 0; variant < 12; variant++) lines.add(announce(s.id, 'bid', { team: 'Red', rival: 'Blue', player: 'Asha', amount: 40 * L, bids, fmt: inr, variant })!.text);
    assert.ok(lines.size >= 12, `${s.id} has ${lines.size} different bid lines`);
  }
  // the cricket commentator is excited from the first ball
  const first = announce('cricket', 'bid', { team: 'Red', amount: 40 * L, bids: 1, fmt: inr, variant: 0 })!;
  assert.ok((first.text.match(/!/g) ?? []).length >= 2, first.text);
});

test('the organiser can write their own last call ("going thrice"), for every host', () => {
  const ctx = { team: 'Red', amount: 40 * L, call: 3, fmt: inr, variant: 0, lastCall: 'Ab ya kabhi nahin!' };
  for (const s of STYLES) assert.match(announce(s.id, 'call', ctx)!.text, /Ab ya kabhi nahin!$/, s.id);
  // only the last call changes
  assert.doesNotMatch(announce('wwe', 'call', { ...ctx, call: 2 })!.text, /kabhi/);
  // and it reaches the announcer from the auction's settings
  const src = { players: [], captains: [{ id: 'a', team: 'Red' }], settings: { ...inr, defaultBasePrice: L, lastCall: 'Finish them!' }, live: { bids: [{ captainId: 'a', amount: 5 * L }] } };
  assert.equal(momentCtx(src, { seq: 1, type: 'call', call: 3 }).lastCall, 'Finish them!');
  assert.equal(momentCtx(src, { seq: 1, type: 'call', call: 2 }).lastCall, undefined);
});
