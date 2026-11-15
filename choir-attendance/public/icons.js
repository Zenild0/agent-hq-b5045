// One icon set for the whole app: friendly rounded lines with a soft filled shape behind, so every screen looks like it
// belongs together (instead of a mix of emoji). Use: icon('trophy'), icon('mic', { size: 28 }). Colour follows the text colour.
// Each icon: f = a soft filled shape (optional), s = the line drawing (24 x 24 grid).
const I = {
  home: { f: 'M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1z', s: '<path d="M3 11.5l9-8 9 8"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-5h4v5h4a1 1 0 0 0 1-1v-9"/>' },
  attendance: { f: 'M6 4h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', s: '<rect x="4" y="4" width="16" height="17" rx="3"/><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><path d="M8.5 13l2.5 2.5 4.5-5"/>' },
  children: { f: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20a6 6 0 0 1 12 0z', s: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.4 3.4 0 0 1 0 6.3"/><path d="M18 14.3a6.5 6.5 0 0 1 3.5 5.7"/>' },
  hymns: { f: 'M9 5l10-2v13H9z', s: '<path d="M9 18V5l10-2v13"/><circle cx="6.5" cy="18" r="2.6"/><circle cx="16.5" cy="16" r="2.6"/>' },
  schedule: { f: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3H4z', s: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v3.5M16 3v3.5"/><circle cx="8.5" cy="14.5" r=".9" fill="currentColor"/><circle cx="12" cy="14.5" r=".9" fill="currentColor"/><circle cx="15.5" cy="14.5" r=".9" fill="currentColor"/>' },
  sparkle: { f: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z', s: '<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/><path d="M19 3v3M17.5 4.5h3"/>' },
  gamepad: { f: 'M6.5 8h11a4.5 4.5 0 0 1 4.4 5.4l-.7 3.2a2.4 2.4 0 0 1-4 1.1L15 15.5H9L6.8 17.7a2.4 2.4 0 0 1-4-1.1l-.7-3.2A4.5 4.5 0 0 1 6.5 8z', s: '<path d="M6.5 8h11a4.5 4.5 0 0 1 4.4 5.4l-.7 3.2a2.4 2.4 0 0 1-4 1.1L15 15.5H9L6.8 17.7a2.4 2.4 0 0 1-4-1.1l-.7-3.2A4.5 4.5 0 0 1 6.5 8z"/><path d="M7 11v3M5.5 12.5h3"/><circle cx="15.5" cy="11.5" r=".9" fill="currentColor"/><circle cx="18" cy="13.5" r=".9" fill="currentColor"/>' },
  mic: { f: 'M12 2.5a3.2 3.2 0 0 1 3.2 3.2v5.6a3.2 3.2 0 0 1-6.4 0V5.7A3.2 3.2 0 0 1 12 2.5z', s: '<rect x="8.8" y="2.5" width="6.4" height="11.6" rx="3.2"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.2M8.5 21.2h7"/>' },
  book: { f: 'M5 5a2 2 0 0 1 2-2h11v14H7a2 2 0 0 0-2 2z', s: '<path d="M5 19.5V5a2 2 0 0 1 2-2h11.5v14H7a2 2 0 0 0-2 2.5 2 2 0 0 0 2 2h11.5"/><path d="M11.5 12.5V7l3-.6"/><circle cx="10.5" cy="12.8" r="1.2"/>' },
  trophy: { f: 'M7 4h10v5a5 5 0 0 1-10 0z', s: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1.5A3 3 0 0 0 7 10.5M17 6h3v1.5a3 3 0 0 1-3 3"/><path d="M12 14v4M8.5 21h7M9.5 21v-3h5v3"/>' },
  orbit: { f: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z', s: '<circle cx="12" cy="12" r="3.2"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(-28 12 12)"/><circle cx="19.2" cy="7" r="1" fill="currentColor"/>' },
  flame: { f: 'M12 3c.8 3.4 5.2 5.6 5.2 10.4a5.2 5.2 0 0 1-10.4 0c0-2 .9-3.5 2.2-4.7.1 1.6.8 2.6 1.9 2.9C10.2 8.4 11 5.4 12 3z', s: '<path d="M12 3c.8 3.4 5.2 5.6 5.2 10.4a5.2 5.2 0 0 1-10.4 0c0-2 .9-3.5 2.2-4.7.1 1.6.8 2.6 1.9 2.9C10.2 8.4 11 5.4 12 3z"/>' },
  target: { f: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', s: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>' },
  drop: { f: 'M12 3.5s6 6.2 6 10.5a6 6 0 0 1-12 0C6 9.7 12 3.5 12 3.5z', s: '<path d="M12 3.5s6 6.2 6 10.5a6 6 0 0 1-12 0C6 9.7 12 3.5 12 3.5z"/><path d="M9.2 14.2a3 3 0 0 0 2.3 2.7"/>' },
  alert: { f: 'M12 3.5l9.5 16.5h-19z', s: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.2"/><circle cx="12" cy="17.2" r=".9" fill="currentColor"/>' },
  check: { f: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', s: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>' },
  key: { f: 'M8 10.5a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4z', s: '<circle cx="8" cy="14.2" r="3.7"/><path d="M10.7 11.5L20 2.5M16.5 6l3 3M14 8.5l2 2"/>' },
  user: { f: 'M12 11.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 21a7.5 7.5 0 0 1 15 0z', s: '<circle cx="12" cy="7.5" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>' },
  save: { f: 'M4 15h16v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z', s: '<path d="M12 3.5v11M7.5 10.5l4.5 4.5 4.5-4.5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>' },
  edit: { f: 'M4 20l1-4.5L16 4.5a2.1 2.1 0 0 1 3 3L8 18.5z', s: '<path d="M4 20l1-4.5L16 4.5a2.1 2.1 0 0 1 3 3L8 18.5z"/><path d="M14.5 6l3.5 3.5"/>' },
  settings: { f: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z', s: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7"/>' },
  more: { s: '<circle cx="5.5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor"/>' },
  star: { f: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z', s: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>' },
  heart: { f: 'M12 20s-8-4.7-8-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 8 2.2C20 15.3 12 20 12 20z', s: '<path d="M12 20s-8-4.7-8-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 8 2.2C20 15.3 12 20 12 20z"/>' },
  chart: { f: 'M5 12h3v8H5zM10.5 6h3v14h-3zM16 9h3v11h-3z', s: '<path d="M5 20v-8h3v8M10.5 20V6h3v14M16 20V9h3v11M3.5 20.5h17"/>' },
};
export const iconNames = Object.keys(I);
export function icon(name, { size = 0, cls = '' } = {}) {
  const d = I[name] ?? I.star;
  return `<svg class="ico${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" aria-hidden="true"${size ? ` width="${size}" height="${size}"` : ''}>${d.f ? `<path class="f" d="${d.f}"/>` : ''}<g class="s">${d.s}</g></svg>`;
}
