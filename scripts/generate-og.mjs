// Renders og.png (1200x630) from live BTC data and stamps the image hash + alt text into index.html.
// FORCE_DIRECTION=up|down renders synthetic data to og-test-<dir>.png only (og.png and index.html stay untouched).
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const font = (f) => {
  const p = fileURLToPath(new URL(`scripts/fonts/${f}`, root));
  if (!existsSync(p)) throw new Error(`font missing: ${p}`);
  return p;
};
const GREEN = '#0f8a4b', GREEN_TEXT = '#0b7a41', INK = '#0a0a0a', SAND = '#f4f4f4', GREY = '#5b5f66';

const forced = process.env.FORCE_DIRECTION;
if (forced !== undefined && forced !== 'up' && forced !== 'down') throw new Error('FORCE_DIRECTION must be "up" or "down"');

const get = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
};
const valid = (a) => {
  if (!Array.isArray(a) || a.length < 100 || !a.every(Number.isFinite)) throw new Error('bad price series');
  return a;
};
const coingecko = async () => {
  const url = 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=7';
  let j;
  try { j = await get(url); } catch { await new Promise((r) => setTimeout(r, 2000)); j = await get(url); }
  return valid(j.prices.map((x) => x[1]));
};
// Candles: [time, low, high, open, close, volume], newest first. Oldest open + all closes = 169 points, same 7-day window as CoinGecko.
const coinbase = async () => {
  const c = (await get('https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=3600')).slice(0, 168).reverse();
  return valid([c[0][3], ...c.map((x) => x[4])]);
};

let p;
if (forced) {
  p = Array.from({ length: 168 }, (_, i) => 100 + i * 0.2 + 3 * Math.sin(i / 6));
  if (forced === 'down') p.reverse();
} else {
  try { p = await coingecko(); } catch (e) { console.error('CoinGecko failed:', e.message); p = await coinbase(); }
}

const first = p[0], last = p.at(-1);
const pct = Math.abs((last - first) / first * 100).toFixed(1);
const down = last < first && pct !== '0.0';
const label = down ? `+${pct}% (down week, mirrored)` : `+${pct}%`;

// Chart box bleeds full width. Padding leaves room for the axis labels at the bottom of the box.
const BX = 0, BW = 1200, BY = down ? 350 : 280, BH = 570 - BY, PX = 60, PT = 30, PB = 62;
const min = Math.min(...p), span = Math.max(...p) - min;
const d = p.map((v, i) =>
  `${i ? 'L' : 'M'}${(BX + PX + i / (p.length - 1) * (BW - 2 * PX)).toFixed(1)} ${(BY + PT + (span ? 1 - (v - min) / span : 0.5) * (BH - PT - PB)).toFixed(1)}`).join(' ');
// Down week: mirror the whole chart (line and axis labels) vertically, like the page's rotateX(180deg).
const flip = down ? ` transform="translate(0 ${2 * BY + BH}) scale(1 -1)"` : '';
const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#fff"/>
<g text-anchor="middle">
<text x="600" y="62" font-family="Inter" font-size="24" fill="${GREY}">${date}</text>
<text x="600" y="140" font-family="Inter Tight" font-weight="600" font-size="64" letter-spacing="-1.4" fill="${INK}">Bitcoin is up this week</text>
<text x="600" y="214" font-family="Inter Tight" font-weight="500" font-size="56" letter-spacing="-1.2" fill="${GREEN_TEXT}">+${pct}% this week</text>${down ? `
<text x="600" y="276" font-family="Inter" font-size="38" fill="${INK}">It was down ${pct}%.</text>
<text x="600" y="322" font-family="Inter" font-size="38" fill="${INK}">We turned the chart upside down.</text>` : ''}
</g>
<rect x="${BX}" y="${BY}" width="${BW}" height="${BH}" fill="${SAND}"/>
<g${flip}><path d="${d}" fill="none" stroke="${GREEN}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>
<text x="${PX}" y="${BY + BH - 20}" font-family="Inter" font-size="24" fill="${GREY}">7 days ago</text>
<text x="${BW - PX}" y="${BY + BH - 20}" text-anchor="end" font-family="Inter" font-size="24" fill="${GREY}">Now</text></g>
</svg>`;

const png = new Resvg(svg, {
  font: { fontFiles: [font('Inter-Regular.ttf'), font('InterTight-Medium.ttf'), font('InterTight-SemiBold.ttf')], loadSystemFonts: false, defaultFontFamily: 'Inter' },
}).render().asPng();

const msg = `OG: ${label} ${stamp}`;
if (forced) {
  writeFileSync(new URL(`og-test-${forced}.png`, root), png);
  console.error(`og-test-${forced}.png written (${png.length} bytes)`);
  console.log(msg);
  process.exit(0);
}

const hash = createHash('sha256').update(png).digest('hex').slice(0, 8);
const alt = down
  ? `Bitcoin was down ${pct}% this week. The 7-day chart is turned upside down so it looks up.`
  : `Bitcoin is up ${pct}% this week. 7-day price chart.`;
const htmlPath = new URL('index.html', root);
let html = readFileSync(htmlPath, 'utf8');
const set = (attr, name, value) => {
  const re = new RegExp(`(<meta ${attr}="${name}" content=")[^"]*(")`);
  if (!re.test(html)) throw new Error(`meta ${name} not found in index.html`);
  html = html.replace(re, `$1${value}$2`);
};
set('property', 'og:image', `https://bitcoinisup.com/og.png?v=${hash}`);
set('property', 'og:image:alt', alt);
set('name', 'twitter:image:alt', alt);

writeFileSync(new URL('og.png', root), png);
writeFileSync(htmlPath, html);
console.error(`og.png written (${png.length} bytes), v=${hash}`);
console.log(msg);
