import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The profile holds NON-secret data only (passenger names/ages, a mobile number,
// preferences). assertNoSecrets() is the guard that keeps it that way: it refuses
// to write anything that looks like a password, OTP, card, CVV or UPI ID, no matter
// which code path (CLI, web UI, a future feature) tries to save it.

export const home = () => process.env.IRCTC_ASSISTANT_HOME || path.join(os.homedir(), '.irctc-assistant');

const SECRET_KEY = /password|passwd|passcode|passphrase|pwd|^pass$|\bpin\b|cvv|cvc|otp|card|vpa|upi|secret|token|captcha|cookie|session|aadhaa?r/i;
const CARD_LIKE = /\b(?:\d[ -]?){13,19}\b/;
const VPA_LIKE = /^[\w.\-]{2,}@[a-z]{2,}$/i;

export function assertNoSecrets(value, trail = '') {
  if (Array.isArray(value)) return value.forEach((v, i) => assertNoSecrets(v, `${trail}[${i}]`));
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (SECRET_KEY.test(k)) throw new Error(`Refusing to store "${trail}${k}": secrets are never saved.`);
      assertNoSecrets(v, `${trail}${k}.`);
    }
  } else if (typeof value === 'string' && (CARD_LIKE.test(value) || VPA_LIKE.test(value))) {
    throw new Error(`Refusing to store "${trail.replace(/\.$/, '')}": it looks like a card number or UPI ID.`);
  }
}

export const DEFAULT_PROFILE = () => ({
  contact: { mobile: '' },
  passengers: [],
  options: { autoUpgrade: false, confirmBerthsOnly: false, travelInsurance: false, acceptWaitlist: false },
  riskAcknowledged: false,
});

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw new Error(`Cannot read ${file}: ${e.message}`);
  }
}

function writeJSON(file, data) {
  assertNoSecrets(data);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

const profileFile = () => path.join(home(), 'profile.json');
const historyFile = () => path.join(home(), 'history.json');

export function loadProfile() {
  const d = DEFAULT_PROFILE();
  const p = readJSON(profileFile(), {});
  return { ...d, ...p, contact: { ...d.contact, ...p.contact }, options: { ...d.options, ...p.options } };
}

export function saveProfile(profile) {
  const d = DEFAULT_PROFILE();
  // Whitelist the shape so unknown keys can't smuggle data in.
  const clean = {
    contact: { mobile: String(profile.contact?.mobile ?? '') },
    passengers: (profile.passengers ?? []).map((p) => ({
      name: String(p.name ?? '').trim(),
      age: Number(p.age),
      gender: String(p.gender ?? '').toUpperCase(),
      berth: String(p.berth ?? 'NP').toUpperCase(),
    })),
    options: Object.fromEntries(Object.keys(d.options).map((k) => [k, Boolean(profile.options?.[k])])),
    riskAcknowledged: Boolean(profile.riskAcknowledged),
  };
  writeJSON(profileFile(), clean);
  return clean;
}

export const loadHistory = () => readJSON(historyFile(), []);

export function appendHistory(entry) {
  const h = loadHistory();
  h.push({ at: new Date().toISOString(), ...entry });
  writeJSON(historyFile(), h.slice(-200));
}
