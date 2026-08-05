# ReBrand Fonepay QR

Upload a Fonepay (or any EMV merchant) QR **or paste a link**, add a logo, colours,
business name and caption, style it (dot/eye shapes, gradient, presets), and download a
**branded QR that still pays the same account / opens the same link** — in PNG, JPG, WebP
(3×) or true-vector SVG.

Everything runs in the browser — nothing is uploaded to a server.

> **Status:** built, not yet deployed. Planned home: `rebrandfonepayqr.vijaykarn.com.np`.
> For now, [run it locally](#run-it).

## Features

- **Two inputs** — upload a Fonepay/EMV QR image, or paste a link/text to make one.
- **Design studio** — logo overlay, per-element colours (with hex), gradient fills,
  square/rounded/dot module shapes, styled finder "eyes", one-click **style presets**
  and a **Surprise me** generator.
- **Scan-safe** — the output is re-scanned in-browser; download unlocks only when it
  decodes back to the original payload.
- **Export** — PNG, JPG, WebP (3× hi-res) and true-vector **SVG**.
- **Private & offline** — 100% client-side; fonts and libraries are self-hosted (no CDN).

## How it works

1. **Decode** — [`jsQR`](https://github.com/cozmo/jsQR) reads the uploaded image to the raw
   EMV payload string.
2. **Confirm** — the payload's CRC is checked and the merchant name/city are shown, so you
   know it's the right account before you restyle it.
3. **Re-render** — a fresh QR is generated from the **exact same payload** (never modified)
   at error-correction level **H**, drawn on a canvas with your colours, logo and caption.
4. **Verify** — the finished image is re-scanned with `jsQR`; download is only enabled once
   it decodes back to the original payload. If your logo covers too much, the badge turns red
   until you shrink it.

## Run it

No build step. Serve the folder over HTTP (needed because `app.js` is an ES module):

```bash
cd fonepay-qr-studio
python3 -m http.server 8000
# open http://localhost:8000
```

## Test the payload logic

```bash
node test.mjs
```

## Files

| File | Purpose |
|------|---------|
| `index.html` / `style.css` | UI + hero + SEO tags |
| `app.js` | upload → decode → render → verify → download |
| `emv.js` | EMV TLV parsing + CRC-16 (shared by app and tests) |
| `test.mjs` | self-check for the EMV/CRC logic |
| `lib/` | vendored `jsQR` + `qrcode-generator` (no CDN at runtime) |
| `lib/fonts/` | self-hosted Clash Display + Switzer (Fontshare, woff2) |
| `favicon.svg` `robots.txt` `sitemap.xml` `og-image.png` | SEO / social assets |

## Design & fonts

Light editorial theme (ground `#f1f1f1`, ink `#2b2b2b`, accent `#fc4778`) with **Clash
Display** and **Switzer** from [Fontshare](https://fontshare.com) — free for commercial use,
self-hosted in `lib/fonts/` so there is **no CDN at runtime**.

## Note

It's a payment QR — **always test-scan the downloaded image** before printing or sharing.
