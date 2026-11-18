// Renders favicon.ico (16/32/48) and apple-touch-icon.png (180) from favicon.svg.
// Run once after changing favicon.svg: node scripts/generate-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const root = new URL('../', import.meta.url);
const svg = readFileSync(new URL('favicon.svg', root), 'utf8');
const png = (size, background) =>
  new Resvg(svg, { fitTo: { mode: 'width', value: size }, background }).render().asPng();

// ICO with PNG-encoded frames: 6-byte header, 16-byte entry per frame, then the PNGs.
const sizes = [16, 32, 48];
const frames = sizes.map((s) => png(s));
const header = Buffer.alloc(6);
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(sizes.length, 4);
let offset = 6 + 16 * sizes.length;
const entries = frames.map((f, i) => {
  const e = Buffer.alloc(16);
  e[0] = sizes[i]; e[1] = sizes[i];
  e.writeUInt16LE(1, 4); // colour planes
  e.writeUInt16LE(32, 6); // bits per pixel
  e.writeUInt32LE(f.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += f.length;
  return e;
});
writeFileSync(new URL('favicon.ico', root), Buffer.concat([header, ...entries, ...frames]));

// Apple touch icon: 180px white square with the icon at 120px, centred (30px padding).
const inner = new Resvg(svg, { fitTo: { mode: 'width', value: 120 } }).render();
const wrapped = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><rect width="180" height="180" fill="#fff"/><image x="30" y="30" width="120" height="120" href="data:image/png;base64,${inner.asPng().toString('base64')}"/></svg>`;
writeFileSync(new URL('apple-touch-icon.png', root), new Resvg(wrapped).render().asPng());
