import { describe } from './emv.js';

// State
let payload = null;   // the exact decoded QR text — never mutated
let logoImg = null;
let dotShape = 'square';  // square | rounded | dots
let eyeShape = 'square';  // square | rounded

const $ = (id) => document.getElementById(id);
const els = {
  qrFile: $('qrFile'), logoFile: $('logoFile'), drop: $('drop'),
  fg: $('fg'), fgHex: $('fgHex'), bg: $('bg'), bgHex: $('bgHex'), tx: $('tx'), txHex: $('txHex'),
  fg2: $('fg2'), fg2Hex: $('fg2Hex'), fg2Field: $('fg2Field'), gradient: $('gradient'),
  dotShapeEl: $('dotShape'), eyeShapeEl: $('eyeShape'), presets: $('presets'), surprise: $('surprise'),
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
bindColor(els.fg2, els.fg2Hex);

// ---- Segmented controls (dot shape / eye shape) ------------------------------
function wireSeg(container, set) {
  container.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    container.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    set(b.dataset.val); render();
  });
}
wireSeg(els.dotShapeEl, (v) => { dotShape = v; });
wireSeg(els.eyeShapeEl, (v) => { eyeShape = v; });

els.gradient.addEventListener('change', () => { els.fg2Field.hidden = !els.gradient.checked; render(); });

// ---- Style presets + "Surprise me" ------------------------------------------
const PRESETS = {
  classic: { dot: 'square',  eye: 'square',  grad: false, fg: '#0a0a0b', fg2: '#0a0a0b', bg: '#ffffff', tx: '#0a0a0b' },
  soft:    { dot: 'rounded', eye: 'rounded', grad: false, fg: '#2b2b2b', fg2: '#2b2b2b', bg: '#ffffff', tx: '#2b2b2b' },
  dots:    { dot: 'dots',    eye: 'rounded', grad: false, fg: '#1d4ed8', fg2: '#1d4ed8', bg: '#ffffff', tx: '#1d4ed8' },
  neon:    { dot: 'rounded', eye: 'rounded', grad: true,  fg: '#fc4778', fg2: '#7c3aed', bg: '#0e0f13', tx: '#ffffff' },
  sunset:  { dot: 'dots',    eye: 'rounded', grad: true,  fg: '#f97316', fg2: '#db2777', bg: '#fff7ed', tx: '#9a3412' },
};

function applyStyle(p) {
  dotShape = p.dot; eyeShape = p.eye;
  setSeg(els.dotShapeEl, p.dot); setSeg(els.eyeShapeEl, p.eye);
  setColor(els.fg, els.fgHex, p.fg);
  setColor(els.fg2, els.fg2Hex, p.fg2);
  setColor(els.bg, els.bgHex, p.bg);
  setColor(els.tx, els.txHex, p.tx);
  els.gradient.checked = p.grad; els.fg2Field.hidden = !p.grad;
  render();
}
const setSeg = (c, v) => c.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.val === v));
const setColor = (picker, hex, v) => { picker.value = v; hex.value = v.toUpperCase(); hex.classList.remove('invalid'); };

els.presets.addEventListener('click', (e) => {
  const b = e.target.closest('[data-preset]'); if (b && PRESETS[b.dataset.preset]) applyStyle(PRESETS[b.dataset.preset]);
});

// A curated pool so "Surprise me" always lands on something tasteful & high-contrast.
const SURPRISE = [
  ...Object.values(PRESETS),
  { dot: 'dots', eye: 'rounded', grad: true, fg: '#06b6d4', fg2: '#3b82f6', bg: '#ffffff', tx: '#0e7490' },
  { dot: 'rounded', eye: 'square', grad: false, fg: '#16a34a', fg2: '#16a34a', bg: '#f0fdf4', tx: '#166534' },
  { dot: 'rounded', eye: 'rounded', grad: true, fg: '#e11d48', fg2: '#f59e0b', bg: '#fff7ed', tx: '#9f1239' },
  { dot: 'dots', eye: 'rounded', grad: true, fg: '#8b5cf6', fg2: '#ec4899', bg: '#faf5ff', tx: '#6d28d9' },
  { dot: 'square', eye: 'rounded', grad: false, fg: '#ffffff', fg2: '#ffffff', bg: '#111827', tx: '#f9fafb' },
];
els.surprise.addEventListener('click', () => applyStyle(SURPRISE[Math.floor(Math.random() * SURPRISE.length)]));

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

  // QR modules — shape + optional gradient. Finder "eyes" render solid so they
  // stay scannable even when the body is dots/rounded.
  const ox = pad, oy = headerH;
  let fill = fg;
  if (els.gradient.checked) {
    const g = ctx.createLinearGradient(ox, oy, ox + QR, oy + QR);
    g.addColorStop(0, fg); g.addColorStop(1, els.fg2.value);
    fill = g;
  }
  ctx.fillStyle = fill;

  const customEyes = !(dotShape === 'square' && eyeShape === 'square');
  const finders = [[0, 0], [0, n - 7], [n - 7, 0]];
  const inFinder = (r, c) => finders.some(([fr, fc]) => r >= fr && r < fr + 7 && c >= fc && c < fc + 7);

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.isDark(r, c)) continue;
      if (customEyes && inFinder(r, c)) continue; // eyes drawn separately below
      const x = ox + (c + quiet) * cell, y = oy + (r + quiet) * cell;
      if (dotShape === 'dots') {
        ctx.beginPath();
        ctx.arc(x + cell / 2, y + cell / 2, cell * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (dotShape === 'rounded') {
        roundRect(ctx, x, y, cell, cell, cell * 0.38); ctx.fill();
      } else {
        ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(cell), Math.ceil(cell));
      }
    }
  }
  if (customEyes) {
    for (const [fr, fc] of finders) {
      drawEye(ctx, ox + (fc + quiet) * cell, oy + (fr + quiet) * cell, cell, eyeShape, fill, bg);
    }
    ctx.fillStyle = fill;
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
// Draw a finder pattern (7x7 ring + 3x3 centre) as a solid square or rounded eye.
function drawEye(ctx, x, y, cell, style, fill, bg) {
  const s = 7 * cell;
  const rr = style === 'rounded';
  ctx.fillStyle = fill;
  rr ? (roundRect(ctx, x, y, s, s, cell * 1.75), ctx.fill()) : ctx.fillRect(x, y, s, s);
  ctx.fillStyle = bg;
  rr ? (roundRect(ctx, x + cell, y + cell, 5 * cell, 5 * cell, cell * 1.15), ctx.fill()) : ctx.fillRect(x + cell, y + cell, 5 * cell, 5 * cell);
  ctx.fillStyle = fill;
  rr ? (roundRect(ctx, x + 2 * cell, y + 2 * cell, 3 * cell, 3 * cell, cell * 0.75), ctx.fill()) : ctx.fillRect(x + 2 * cell, y + 2 * cell, 3 * cell, 3 * cell);
}

function fitContain(img, maxW, maxH) {
  const s = Math.min(maxW / img.width, maxH / img.height);
  return { w: img.width * s, h: img.height * s };
}
function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
