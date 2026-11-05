import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STYLES, announce, hindiMoney, isStyle, type AnnouncerStyle, type SpeechKind } from './announcer';
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
  assert.ok(k.rate! < 1 && m.rate! < k.rate! + 0.1 && w.rate! > 1, 'KBC and Mortal Kombat are slow, WWE is quick');
  assert.ok(m.pitch! < k.pitch! && k.pitch! < w.pitch! && w.pitch! < 1, 'Mortal Kombat is the deepest');
  assert.equal(c.pitch, undefined, 'classic keeps the app\'s own voice settings');
  assert.deepEqual([w.gender, k.gender, m.gender], ['male', 'male', 'male']);
  assert.equal(announce('mk', 'call', { ...ctx, call: 3 })!.text, 'Finish him!');
  assert.match(announce('kbc', 'call', { ...ctx, call: 3 })!.text, /तीसरी बार/);
  assert.equal(announce('classic', 'call', { ...ctx, call: 1 })!.text, 'Going once!');
  // the lines vary from one bid to the next, but a given bid always reads the same
  const texts = new Set([0, 1, 2, 3].map((v) => announce('wwe', 'bid', { ...ctx, variant: v })!.text));
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
