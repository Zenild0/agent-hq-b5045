import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, parseMoney, spokenMoney } from './money';
import { stepFor } from './rules';

const inr = { symbol: '₹', moneyStyle: 'indian' as const };
const usd = { symbol: '$', moneyStyle: 'western' as const };

test('formats Indian amounts as Cr / L', () => {
  assert.equal(formatMoney(120_000_000, inr), '₹12 Cr');
  assert.equal(formatMoney(12_500_000, inr), '₹1.25 Cr');
  assert.equal(formatMoney(9_500_000, inr), '₹95 L');
  assert.equal(formatMoney(2_000_000, inr), '₹20 L');
  assert.equal(formatMoney(50_000, inr), '₹50,000');
  // 1.125 Cr can't be shown exactly in 2 decimals of Cr, so it drops to lakh rather than rounding
  assert.equal(formatMoney(11_250_000, inr), '₹112.5 L');
});

test('formats western amounts as M / K', () => {
  assert.equal(formatMoney(2_500_000, usd), '$2.5M');
  assert.equal(formatMoney(750_000, usd), '$750K');
  assert.equal(formatMoney(999, usd), '$999');
});

test('word-like symbols go after the number', () => {
  assert.equal(formatMoney(1_000_000, { symbol: 'pts', moneyStyle: 'western' }), '1M pts');
});

test('parses typed amounts', () => {
  assert.equal(parseMoney('12cr'), 120_000_000);
  assert.equal(parseMoney('5 lakh'), 500_000);
  assert.equal(parseMoney('1.5 Cr'), 15_000_000);
  assert.equal(parseMoney('750k'), 750_000);
  assert.equal(parseMoney('₹1,200,000'), 1_200_000);
  assert.equal(parseMoney('2m'), 2_000_000);
  assert.equal(parseMoney('abc'), null);
  assert.equal(parseMoney('5 zz'), null);
});

test('speaks amounts', () => {
  assert.equal(spokenMoney(12_000_000, inr), '1 crore 20 lakh rupees');
  assert.equal(spokenMoney(2_500_000, usd), '2 million 500 thousand dollars');
});

test('step switches once the bid reaches the tier threshold', () => {
  const tiers = [
    { from: 0, step: 500_000 },
    { from: 10_000_000, step: 1_000_000 },
  ];
  assert.equal(stepFor(tiers, 9_500_000), 500_000);
  assert.equal(stepFor(tiers, 10_000_000), 1_000_000);
  assert.equal(stepFor(tiers, 25_000_000), 1_000_000);
});
