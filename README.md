# Bitcoin is up

Static one-page site at https://bitcoinisup.com. It shows the live BTC price, the weekly change and a 7-day chart. If the week is down, the chart flips upside down and turns green. Vercel deploys `main` with no build step.

## Daily social preview

`.github/workflows/og.yml` runs every day at 06:00 UTC (and on manual dispatch). It runs `scripts/generate-og.mjs`, which:

- fetches 7 days of BTC prices (CoinGecko, Coinbase as fallback)
- renders `og.png` (1200x630) with `@resvg/resvg-js` and the bundled fonts in `scripts/fonts/`
- sets `og:image` and `twitter:image` in `index.html` to `og.png?v=YYYYMMDD` so social platforms refetch daily

The workflow commits `og.png` and `index.html` to `main` when they changed, and Vercel redeploys. If both feeds fail, the script exits non-zero and leaves `og.png` untouched.

## Test locally

```
npm ci
node scripts/generate-og.mjs                      # live data
FORCE_DIRECTION=down node scripts/generate-og.mjs # mirrored chart + note
FORCE_DIRECTION=up node scripts/generate-og.mjs   # normal chart
```
