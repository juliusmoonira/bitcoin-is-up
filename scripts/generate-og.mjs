// Renders og.png (1200x630) from live BTC data and stamps today's date into the og:image meta tags.
// FORCE_DIRECTION=up|down is for testing the two render modes only.
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const font = (f) => new URL(`scripts/fonts/${f}`, root).pathname;
const GREEN = '#0f8a4b', INK = '#0a0a0a', SAND = '#f4f4f4', GREY = '#5b5f66';

const get = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
};
const coingecko = async () =>
  (await get('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=7')).prices.map((p) => p[1]);
const coinbase = async () =>
  (await get('https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=3600')).slice(0, 168).reverse().map((c) => c[4]);

let p;
try { p = await coingecko(); } catch (e) { console.warn('CoinGecko failed:', e.message); p = await coinbase(); }
if (!Array.isArray(p) || p.length < 2) throw new Error('No price data');

const first = p[0], last = p.at(-1);
const pct = Math.abs((last - first) / first * 100).toFixed(1);
const down = process.env.FORCE_DIRECTION ? process.env.FORCE_DIRECTION === 'down' : last < first;

// Chart box: x 72..1128, y 300..550. Line sits inside with padding.
const BX = 72, BY = 300, BW = 1056, BH = 250, PX = 36, PY = 32;
const min = Math.min(...p), span = Math.max(...p) - min || 1;
const d = p.map((v, i) =>
  `${i ? 'L' : 'M'}${(BX + PX + i / (p.length - 1) * (BW - 2 * PX)).toFixed(1)} ${(BY + PY + (1 - (v - min) / span) * (BH - 2 * PY)).toFixed(1)}`).join(' ');
// Down week: mirror the chart area vertically, like the page's rotateX(180deg).
const flip = down ? ` transform="translate(0 ${2 * BY + BH}) scale(1 -1)"` : '';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#fff"/>
<text x="72" y="150" font-family="Inter Tight" font-weight="600" font-size="84" letter-spacing="-1.7" fill="${INK}">Bitcoin is up this week</text>
<text x="72" y="256" font-family="Inter Tight" font-weight="500" font-size="88" letter-spacing="-2.6" fill="${INK}">$${Math.round(last).toLocaleString('en-US')}<tspan dx="24" font-family="Inter" font-weight="400" font-size="34" letter-spacing="0" fill="${GREEN}">+${pct}% this week</tspan></text>
<rect x="${BX}" y="${BY}" width="${BW}" height="${BH}" rx="16" fill="${SAND}"/>
<g${flip}><path d="${d}" fill="none" stroke="${GREEN}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/></g>${down ? `
<text x="72" y="596" font-family="Inter" font-size="26" fill="${GREY}">It was down ${pct}%. We turned the chart upside down.</text>` : ''}
</svg>`;

const png = new Resvg(svg, {
  font: { fontFiles: [font('Inter-Regular.ttf'), font('InterTight-Medium.ttf'), font('InterTight-SemiBold.ttf')], loadSystemFonts: false, defaultFontFamily: 'Inter' },
}).render().asPng();

const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
const url = `https://bitcoinisup.com/og.png?v=${date}`;
const htmlPath = new URL('index.html', root);
let html = readFileSync(htmlPath, 'utf8');
for (const name of ['og:image', 'twitter:image']) {
  const re = new RegExp(`(<meta (?:property|name)="${name}" content=")[^"]*(")`);
  if (!re.test(html)) throw new Error(`meta ${name} not found in index.html`);
  html = html.replace(re, `$1${url}$2`);
}

writeFileSync(new URL('og.png', root), png);
writeFileSync(htmlPath, html);
console.log(`og.png written (${down ? 'down' : 'up'}, $${Math.round(last)}, ${pct}%), ${url}`);
