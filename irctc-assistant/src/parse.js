import { CLASSES } from './constants.js';
import { istToday, addDays, isValidYMD, toISO, diffDays } from './dates.js';

const MONTH_RE = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const monthNo = (s) => ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(s.slice(0, 3).toLowerCase()) + 1;

const CLASS_WORDS = [
  [/\b(?:first|1st)\s*(?:ac|class)\b/i, '1A'],
  [/\b(?:second|2nd)\s*ac\b|\b2\s*tier\b/i, '2A'],
  [/\b(?:third|3rd)\s*ac\s*econom\w*|\b3\s*ac\s*econom\w*/i, '3E'],
  [/\b(?:third|3rd)\s*ac\b|\b3\s*tier\b|\b3\s*ac\b/i, '3A'],
  [/\bsleeper\b/i, 'SL'],
  [/\bchair\s*car\b/i, 'CC'],
  [/\bexec\w*\s*chair\b/i, 'EC'],
  [/\bsecond\s*sitting\b/i, '2S'],
];

const FILLER = /\b(?:please|pls|book|booking|ticket|tickets|train|seat|seats|reserve|reservation|me|my|for|a|an|the|i|want|need|would|like|travel|journey|class|quota|date|in|on|by|at|trip|going|go|via)\b/gi;

/**
 * Turn a sentence like
 *   "book 12951 from Mumbai Central to New Delhi on 25 Dec in 3A"
 *   "12951 BCT NDLS 2026-12-25 sleeper ladies"
 * into a structured request. Stations may be IRCTC codes (NDLS) or names (the
 * driver types them into IRCTC's autocomplete). Returns {request, issues}; it never throws.
 */
export function parseRequest(text, now = new Date()) {
  const issues = [];
  const req = { trainNo: null, from: null, to: null, date: null, travelClass: null, quota: 'GN' };
  let s = ` ${String(text ?? '').replace(/[,;]/g, ' ').replace(/\s+/g, ' ')} `;
  const take = (re) => {
    const m = re.exec(s);
    if (m) s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length);
    return m;
  };

  // ---- date ----
  const today = istToday(now);
  let ymd = null;
  let m;
  if ((m = take(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/))) ymd = { y: +m[1], m: +m[2], d: +m[3] };
  else if ((m = take(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/))) ymd = { y: m[3].length === 2 ? 2000 + +m[3] : +m[3], m: +m[2], d: +m[1] };
  else if ((m = take(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_RE})\\b\\.?(?:\\s+(\\d{4}))?`, 'i'))))
    ymd = { y: m[3] ? +m[3] : null, m: monthNo(m[2]), d: +m[1] };
  else if ((m = take(new RegExp(`\\b(${MONTH_RE})\\b\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:\\s+(\\d{4}))?`, 'i'))))
    ymd = { y: m[3] ? +m[3] : null, m: monthNo(m[1]), d: +m[2] };
  else if (take(/\bday after tomorrow\b/i)) ymd = addDays(today, 2);
  else if (take(/\btomorrow\b/i)) ymd = addDays(today, 1);
  else if (take(/\btoday\b/i)) ymd = today;
  else if ((m = take(/\bin\s+(\d{1,3})\s+days?\b/i))) ymd = addDays(today, +m[1]);

  if (ymd) {
    if (ymd.y == null) {
      // No year given: the next time that day/month occurs.
      ymd.y = today.y;
      if (isValidYMD(ymd) && diffDays(ymd, today) < 0) ymd.y += 1;
    }
    if (isValidYMD(ymd)) req.date = toISO(ymd);
    else issues.push('That date does not exist.');
  } else issues.push('Which date? (e.g. 25 Dec, 2026-12-25, tomorrow)');

  // ---- train number ----
  const tn = take(/\b(\d{5})\b/);
  if (tn) req.trainNo = tn[1];
  else issues.push('Which train number? (5 digits, e.g. 12951)');

  // ---- quota ----
  if (take(/\bladies\b/i)) req.quota = 'LD';
  else if (take(/\bsenior(?:\s*citizen)?\b/i)) req.quota = 'SS';
  else take(/\bgeneral\b|\bgn\b/i);

  // ---- class ----
  for (const [re, code] of CLASS_WORDS) {
    if (take(re)) {
      req.travelClass = code;
      break;
    }
  }
  if (!req.travelClass) {
    const c = take(new RegExp(`\\b(${Object.keys(CLASSES).join('|')})\\b`, 'i'));
    if (c) req.travelClass = c[1].toUpperCase();
  }
  if (!req.travelClass) issues.push('Which class? (SL, 3A, 2A, 1A, 3E, CC, EC, 2S)');

  // ---- stations ----
  const SEP = '(?:\\bto\\b|->|→|\\u2192|-)';
  let a = null;
  let b = null;
  if ((m = new RegExp(`\\bfrom\\s+(.+?)\\s+${SEP}\\s+(.+?)\\s*$`, 'i').exec(s))) [a, b] = [m[1], m[2]];
  else {
    const rest = s.replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
    if ((m = new RegExp(`^(.+?)\\s*${SEP}\\s*(.+)$`, 'i').exec(rest))) [a, b] = [m[1], m[2]];
    else {
      const toks = rest.split(' ').filter(Boolean);
      if (toks.length === 2 && toks.every((t) => /^[a-z]{2,5}$/i.test(t))) [a, b] = toks;
    }
  }
  const clean = (v) => {
    if (!v) return null;
    const t = v.replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
    if (!t) return null;
    return /^[a-z]{2,5}$/i.test(t) ? t.toUpperCase() : t.replace(/\b\w/g, (c) => c.toUpperCase());
  };
  req.from = clean(a);
  req.to = clean(b);
  if (!req.from || !req.to) issues.push('Which stations? (e.g. "from NDLS to BCT" or "from Mumbai Central to New Delhi")');

  return { request: req, issues };
}
