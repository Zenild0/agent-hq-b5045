// Teacher-only helper: read the words of a hymn from a web page the teacher pastes a link to
// (for example a page on divinehymns.com). The page is fetched, reduced to plain text, and handed
// back for the teacher to read and edit. Nothing is stored until the teacher saves the hymn.
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export class PageError extends Error {}

const MAX_BYTES = 1_500_000;
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…' };

const decode = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(Number(n), 0x10ffff)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Math.min(parseInt(n, 16), 0x10ffff)))
  .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);

// True for addresses that must never be fetched from here (this machine, home networks, cloud metadata).
export function isPrivateAddress(ip) {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === '::' || x === '::1' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe8') || x.startsWith('fe9') || x.startsWith('fea') || x.startsWith('feb')) return true;
    const m = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x);
    return m ? isPrivateAddress(m[1]) : false;
  }
  return true;
}

async function assertPublic(url) {
  if (!/^https?:$/.test(url.protocol)) throw new PageError('Please paste a link that starts with http:// or https://');
  if (process.env.CHOIR_ALLOW_PRIVATE_FETCH === '1') return; // tests only
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new PageError('That website could not be found.');
  if (addrs.some((a) => isPrivateAddress(a.address))) throw new PageError('That link is not allowed.');
}

async function readLimited(res) {
  const chunks = [];
  let size = 0;
  for await (const c of res.body) {
    size += c.length;
    if (size > MAX_BYTES) throw new PageError('That page is too large to read.');
    chunks.push(c);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function extractText(html) {
  const meta = (re) => decode((re.exec(html)?.[1] ?? '').replace(/\s+/g, ' ').trim());
  const title = meta(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || meta(/<title[^>]*>([\s\S]*?)<\/title>/i) || meta(/<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, '');
  let h = html.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|iframe|button|select)\b[\s\S]*?<\/\1>/gi, '');
  // prefer the part of the page that holds the words
  const part = /<(article|main)\b[^>]*>([\s\S]*?)<\/\1>/i.exec(h)
    || /<(div|section)\b[^>]*(?:class|id)=["'][^"']*(?:lyric|hymn|content|entry|post)[^"']*["'][^>]*>([\s\S]*)/i.exec(h);
  if (part) h = part[2];
  const text = decode(h
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ''))
    .replace(/\r/g, '')
    .split('\n').map((l) => l.replace(/[ \t ]+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { title: title.replace(/\s*[|–—-]\s*[^|–—-]*$/, '').trim() || title, text };
}

export async function fetchPageText(rawUrl) {
  let url;
  try { url = new URL(String(rawUrl ?? '').trim()); } catch { throw new PageError('Please paste a full web link, like https://divinehymns.com/…'); }
  let res;
  for (let hop = 0; hop < 4; hop += 1) {
    await assertPublic(url);
    try {
      res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10000), headers: { 'user-agent': 'Mozilla/5.0 (compatible; ChildrensChoirZD/1.0)', accept: 'text/html,text/plain' } });
    } catch (e) {
      if (e instanceof PageError) throw e;
      throw new PageError('Could not open that link right now. You can still type or paste the words.');
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      try { url = new URL(res.headers.get('location'), url); } catch { throw new PageError('That link redirects somewhere unusable.'); }
      continue;
    }
    break;
  }
  if (!res || (res.status >= 300 && res.status < 400)) throw new PageError('That link redirects too many times.');
  if (!res.ok) throw new PageError(`That page answered with an error (${res.status}).`);
  const type = res.headers.get('content-type') || '';
  if (!/text\/(html|plain)|application\/xhtml/i.test(type)) throw new PageError('That link is not a web page.');
  const body = await readLimited(res);
  const out = /text\/plain/i.test(type) ? { title: '', text: body.trim() } : extractText(body);
  if (!out.text) throw new PageError('No words were found on that page. Copy and paste them instead.');
  return { url: url.href, host: url.hostname, title: out.title.slice(0, 120), lyrics: out.text.slice(0, 6000), cut: out.text.length > 6000 };
}
