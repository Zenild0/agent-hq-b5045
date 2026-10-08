// Minimal tar (ustar) writer/reader, enough for choir backups. No dependencies.

export function createTar(files) {
  const blocks = [];
  for (const f of files) {
    const header = Buffer.alloc(512);
    header.write(f.name, 0, 100, 'utf8');
    header.write('0000644\0', 100);
    header.write('0000000\0', 108);
    header.write('0000000\0', 116);
    header.write(`${f.data.length.toString(8).padStart(11, '0')}\0`, 124);
    header.write(`${Math.floor(Date.now() / 1000).toString(8).padStart(11, '0')}\0`, 136);
    header.write('        ', 148); // checksum field counts as spaces while summing
    header.write('0', 156);
    header.write('ustar\0', 257);
    header.write('00', 263);
    let sum = 0;
    for (const b of header) sum += b;
    header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148);
    blocks.push(header, f.data, Buffer.alloc((512 - (f.data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return Buffer.concat(blocks);
}

export function readTar(buf) {
  const files = [];
  let off = 0;
  while (off + 512 <= buf.length) {
    const h = buf.subarray(off, off + 512);
    if (h.every((b) => b === 0)) return files;
    const stored = parseInt(h.toString('ascii', 148, 156).replace(/\0.*$/s, '').trim(), 8);
    let sum = 0;
    for (let i = 0; i < 512; i += 1) sum += i >= 148 && i < 156 ? 32 : h[i];
    if (stored !== sum) throw new Error('not a tar file');
    const name = h.toString('utf8', 0, 100).replace(/\0.*$/s, '');
    const size = parseInt(h.toString('ascii', 124, 136).replace(/\0.*$/s, '').trim() || '0', 8);
    const type = String.fromCharCode(h[156] || 48);
    off += 512;
    if (!(size >= 0) || off + size > buf.length) throw new Error('damaged tar file');
    if (type === '0') files.push({ name, data: buf.subarray(off, off + size) });
    off += Math.ceil(size / 512) * 512;
  }
  return files;
}
