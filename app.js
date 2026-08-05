import { describe } from './emv.js';

// State
let payload = null;   // the exact decoded QR text — never mutated
let logoImg = null;

const $ = (id) => document.getElementById(id);
const els = {
  qrFile: $('qrFile'), logoFile: $('logoFile'), drop: $('drop'),
  fg: $('fg'), fgHex: $('fgHex'), bg: $('bg'), bgHex: $('bgHex'), tx: $('tx'), txHex: $('txHex'),
  logoSize: $('logoSize'), caption: $('caption'), merchant: $('merchant'),
  showMerchant: $('showMerchant'),
  canvas: $('canvas'), download: $('download'), removeLogo: $('removeLogo'),
  detected: $('detected'), verify: $('verify'), controls: $('controls'), empty: $('empty'),
};

// ---- Load the uploaded Fonepay QR and decode it -------------------------------
els.qrFile.addEventListener('change', (e) => e.target.files[0] && loadQR(e.target.files[0]));
els.drop.addEventListener('dragover', (e) => { e.preventDefault(); els.drop.classList.add('over'); });
els.drop.addEventListener('dragleave', () => els.drop.classList.remove('over'));
els.drop.addEventListener('drop', (e) => {
  e.preventDefault(); els.drop.classList.remove('over');
  const f = e.dataTransfer.files[0];
  if (f) loadQR(f);
});

function loadQR(file) {
  const img = new Image();
  img.onload = () => {
    // Downscale big photos so jsQR runs fast, keep enough detail to decode.
    const scale = Math.min(1, 800 / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0, w, h);
    const data = cx.getImageData(0, 0, w, h);
    const code = window.jsQR(data.data, w, h);
    if (!code) {
      showDetected(null);
      return;
    }
    payload = code.data;
    showDetected(describe(payload));
    render();
  };
  img.onerror = () => showDetected(null);
  img.src = URL.createObjectURL(file);
}

function showDetected(info) {
  els.empty.hidden = true;
  els.controls.hidden = !info;
  if (!info) {
    payload = null;
    els.detected.className = 'banner bad';
    els.detected.innerHTML = "Couldn't read a QR in that image. Try a sharper, straight-on screenshot.";
    els.controls.hidden = true;
    els.empty.hidden = false;
    return;
  }
  const bits = [];
  if (info.merchant) bits.push(`<strong>${escapeHtml(info.merchant)}</strong>`);
  if (info.city) bits.push(escapeHtml(info.city));
  if (info.currency) bits.push(info.currency);
  const kind = info.isFonepay ? 'Fonepay' : 'Payment';
  els.detected.className = 'banner ' + (info.valid ? 'ok' : 'warn');
  els.detected.innerHTML = info.valid
    ? `✓ ${kind} QR detected — pays ${bits.join(' · ') || 'this account'}. The redesign keeps this exact account.`
    : `⚠ Read a QR, but its checksum doesn't look like a standard Fonepay/EMV QR. You can still restyle it — just test-scan before using.`;
  // prefill merchant caption line
  if (info.merchant) els.merchant.value = info.merchant;
}

// ---- Logo --------------------------------------------------------------------
els.logoFile.addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const img = new Image();
  img.onload = () => { logoImg = img; els.removeLogo.hidden = false; render(); };
  img.src = URL.createObjectURL(f);
});
els.removeLogo.addEventListener('click', () => {
  logoImg = null; els.logoFile.value = ''; els.removeLogo.hidden = true; render();
});

// ---- Colour pickers with hex entry (kept in sync both ways) ------------------
function bindColor(picker, hex) {
  picker.addEventListener('input', () => { hex.value = picker.value; hex.classList.remove('invalid'); render(); });
  hex.addEventListener('input', () => {
    let v = hex.value.trim();
    if (v && v[0] !== '#') v = '#' + v;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) { picker.value = v; hex.classList.remove('invalid'); render(); }
    else { hex.classList.add('invalid'); }
  });
}
bindColor(els.fg, els.fgHex);
bindColor(els.bg, els.bgHex);
bindColor(els.tx, els.txHex);

// ---- Re-render on any other control change -----------------------------------
['logoSize', 'caption', 'merchant', 'showMerchant'].forEach((k) =>
  els[k].addEventListener('input', render));

// ---- Draw the branded QR card ------------------------------------------------
function render() {
  if (!payload) return;

  const qr = window.qrcode(0, 'H'); // level H tolerates a center logo (~30% cover)
  qr.addData(payload);
  qr.make();
  const n = qr.getModuleCount();

  const QR = 720;                 // QR draw size (px)
  const quiet = 4;                // quiet-zone modules
  const cell = QR / (n + quiet * 2);
  const pad = 56;

  const merchant = els.merchant.value.trim();
  const showMerchant = els.showMerchant.checked && merchant;
  const captionText = els.caption.value.trim();
  const headerH = showMerchant ? 96 : 40;
  const captionH = captionText ? 92 : 40;

  const W = QR + pad * 2;
  const H = headerH + QR + captionH + pad;

  const cv = els.canvas;
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const fg = els.fg.value, bg = els.bg.value, textColor = els.tx.value;

  // card
  ctx.clearRect(0, 0, W, H);
  roundRect(ctx, 6, 6, W - 12, H - 12, 28);
  ctx.fillStyle = bg;
  ctx.fill();

  // header (merchant name)
  if (showMerchant) {
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.font = '700 40px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillText(merchant, W / 2, pad + 30);
  }

  // QR modules
  const ox = pad, oy = headerH;
  ctx.fillStyle = fg;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) {
        const x = ox + (c + quiet) * cell;
        const y = oy + (r + quiet) * cell;
        ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(cell), Math.ceil(cell));
      }
    }
  }

  // center logo
  if (logoImg) {
    // ponytail: cap coverage at 26% — beyond ~30% even level-H stops scanning.
    const frac = Math.min(0.26, Number(els.logoSize.value) / 100);
    const size = QR * frac;
    const cx = ox + quiet * cell + (n * cell) / 2;
    const cy = oy + quiet * cell + (n * cell) / 2;
    const box = size * 1.18;
    roundRect(ctx, cx - box / 2, cy - box / 2, box, box, box * 0.16);
    ctx.fillStyle = bg;            // knock out modules behind the logo
    ctx.fill();
    const r = fitContain(logoImg, size, size);
    ctx.drawImage(logoImg, cx - r.w / 2, cy - r.h / 2, r.w, r.h);
  }

  // caption
  if (captionText) {
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.font = '600 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillText(captionText, W / 2, oy + QR + 56);
  }

  verify();
  els.download.disabled = false;
}

// ---- Money-safety: confirm the rendered QR still scans to the same payload ----
function verify() {
  const cv = els.canvas;
  const ctx = cv.getContext('2d');
  const img = ctx.getImageData(0, 0, cv.width, cv.height);
  els.verify.hidden = false;
  const code = window.jsQR(img.data, cv.width, cv.height);
  if (code && code.data === payload) {
    els.verify.className = 'verify ok';
    els.verify.textContent = '✓ Verified — the redesigned QR still scans to the original account.';
    els.download.disabled = false;
  } else {
    els.verify.className = 'verify bad';
    els.verify.textContent = '✕ The logo is covering too much — shrink it until this turns green before downloading.';
    els.download.disabled = true;
  }
}

// ---- Download ----------------------------------------------------------------
els.download.addEventListener('click', () => {
  const a = document.createElement('a');
  a.download = 'fonepay-qr.png';
  a.href = els.canvas.toDataURL('image/png');
  a.click();
});

// ---- helpers -----------------------------------------------------------------
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function fitContain(img, maxW, maxH) {
  const s = Math.min(maxW / img.width, maxH / img.height);
  return { w: img.width * s, h: img.height * s };
}
function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
