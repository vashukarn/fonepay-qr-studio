# Fonepay QR Studio

Upload a Fonepay (or any EMV merchant) QR, add a logo, colours and a caption, and
download a **branded QR that still pays the exact same account**.

Everything runs in the browser — the QR image is never uploaded to a server.

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
| `index.html` / `style.css` | UI |
| `app.js` | upload → decode → render → verify → download |
| `emv.js` | EMV TLV parsing + CRC-16 (shared by app and tests) |
| `test.mjs` | self-check for the EMV/CRC logic |
| `lib/` | vendored `jsQR` + `qrcode-generator` (no CDN at runtime) |

## Note

It's a payment QR — **always test-scan the downloaded image** before printing or sharing.
