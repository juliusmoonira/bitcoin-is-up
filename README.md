# Bitcoin is up

Static one-page site at https://bitcoinisup.com. It shows the live BTC price, the weekly change and a 7-day chart. If the week is down, the chart flips upside down and turns green. Vercel deploys `main` with no build step.

## Daily social preview

`.github/workflows/og.yml` runs every day at 06:23 UTC (and on manual dispatch). It runs `scripts/generate-og.mjs`, which:

- fetches 7 days of BTC prices (CoinGecko, Coinbase as fallback)
- renders `og.png` (1200x630) with `@resvg/resvg-js` and the bundled fonts in `scripts/fonts/`
- sets `og:image` in `index.html` to `og.png?v=<hash of the PNG>` and updates the image alt text

The workflow commits `og.png` and `index.html` to `main` when they changed, and Vercel redeploys. Link previews refresh on each platform as its cache expires. If both feeds fail, the script exits non-zero and leaves `og.png` untouched.

## Icons

`favicon.svg` is the source. After changing it, run `node scripts/generate-icons.mjs` to rebuild `favicon.ico` and `apple-touch-icon.png`, and commit the outputs.

## Test locally

```
npm ci
node scripts/generate-og.mjs                      # live data
FORCE_DIRECTION=down node scripts/generate-og.mjs # synthetic data, writes og-test-down.png
FORCE_DIRECTION=up node scripts/generate-og.mjs   # synthetic data, writes og-test-up.png
```
