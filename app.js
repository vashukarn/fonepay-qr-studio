import { describe } from './emv.js';

// State
let payload = null;   // the exact decoded QR text — never mutated
let isLink = false;   // true when the payload was typed (a link/text) rather than decoded
let logoImg = null;
let dotShape = 'square';  // square | rounded | dots
let eyeShape = 'square';  // square | rounded

const $ = (id) => document.getElementById(id);
const els = {
  qrFile: $('qrFile'), logoFile: $('logoFile'), drop: $('drop'),
  linkInput: $('linkInput'), linkGo: $('linkGo'),
  fg: $('fg'), fgHex: $('fgHex'), bg: $('bg'), bgHex: $('bgHex'), tx: $('tx'), txHex: $('txHex'),
  fg2: $('fg2'), fg2Hex: $('fg2Hex'), fg2Field: $('fg2Field'), gradient: $('gradient'),
  dotShapeEl: $('dotShape'), eyeShapeEl: $('eyeShape'), presets: $('presets'), surprise: $('surprise'),
  logoSize: $('logoSize'), caption: $('caption'), merchant: $('merchant'),
  showMerchant: $('showMerchant'),
  canvas: $('canvas'), download: $('download'), removeLogo: $('removeLogo'), format: $('format'),
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
    isLink = false;
    els.linkInput.value = '';
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

// ---- Make a QR from a typed link / text --------------------------------------
els.linkGo.addEventListener('click', () => setLink(els.linkInput.value));
els.linkInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') setLink(els.linkInput.value); });

function setLink(raw) {
  let v = raw.trim();
  if (!v) return;
  // Bare domain (no scheme, has a dot, no spaces) → assume https so it opens as a link.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v) && /^[^\s]+\.[^\s]{2,}$/.test(v)) v = 'https://' + v;
  payload = v;
  isLink = true;
  els.empty.hidden = true;
  els.controls.hidden = false;
  els.detected.hidden = false;
  els.detected.className = 'banner ok';
  els.detected.innerHTML = `🔗 Link QR — encodes <strong>${escapeHtml(v)}</strong>. Style it below, then download.`;
  render();
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

// ---- Layout: all geometry for the card at a given pixel scale (k=1 = preview) -
function layout(k) {
  const qr = window.qrcode(0, 'H'); // level H tolerates a center logo (~30% cover)
  qr.addData(payload);
  qr.make();
  const n = qr.getModuleCount();
  const QR = 720 * k, quiet = 4, cell = QR / (n + quiet * 2), pad = 56 * k;
  const merchant = els.merchant.value.trim();
  const showMerchant = els.showMerchant.checked && !!merchant;
  const caption = els.caption.value.trim();
  const headerH = (showMerchant ? 96 : 40) * k;
  const captionH = (caption ? 92 : 40) * k;
  const W = QR + pad * 2, H = headerH + QR + captionH + pad;
  const customEyes = !(dotShape === 'square' && eyeShape === 'square');
  const finders = [[0, 0], [0, n - 7], [n - 7, 0]];
  const logoFrac = Math.min(0.26, Number(els.logoSize.value) / 100); // ponytail: >~30% stops scanning
  return {
    k, qr, n, QR, quiet, cell, pad, ox: pad, oy: headerH, W, H,
    merchant, showMerchant, caption, customEyes, finders, logoFrac,
    fg: els.fg.value, fg2: els.fg2.value, bg: els.bg.value, tx: els.tx.value, gradient: els.gradient.checked,
  };
}

// ---- Draw the branded QR card to a canvas (used by preview and raster export) -
function drawCard(ctx, k) {
  const L = layout(k);
  const { qr, n, QR, quiet, cell, ox, oy, W, H, k: s } = L;
  ctx.canvas.width = W; ctx.canvas.height = H;

  ctx.clearRect(0, 0, W, H);
  roundRect(ctx, 6 * s, 6 * s, W - 12 * s, H - 12 * s, 28 * s);
  ctx.fillStyle = L.bg; ctx.fill();

  if (L.showMerchant) {
    ctx.fillStyle = L.tx; ctx.textAlign = 'center';
    ctx.font = `700 ${40 * s}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
    ctx.fillText(L.merchant, W / 2, L.pad + 30 * s);
  }

  let fill = L.fg;
  if (L.gradient) {
    const g = ctx.createLinearGradient(ox, oy, ox + QR, oy + QR);
    g.addColorStop(0, L.fg); g.addColorStop(1, L.fg2); fill = g;
  }
  ctx.fillStyle = fill;

  const inFinder = (r, c) => L.finders.some(([fr, fc]) => r >= fr && r < fr + 7 && c >= fc && c < fc + 7);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!qr.isDark(r, c)) continue;
    if (L.customEyes && inFinder(r, c)) continue;
    const x = ox + (c + quiet) * cell, y = oy + (r + quiet) * cell;
    if (dotShape === 'dots') { ctx.beginPath(); ctx.arc(x + cell / 2, y + cell / 2, cell * 0.5, 0, Math.PI * 2); ctx.fill(); }
    else if (dotShape === 'rounded') { roundRect(ctx, x, y, cell, cell, cell * 0.38); ctx.fill(); }
    else ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(cell), Math.ceil(cell));
  }
  if (L.customEyes) {
    for (const [fr, fc] of L.finders) drawEye(ctx, ox + (fc + quiet) * cell, oy + (fr + quiet) * cell, cell, eyeShape, fill, L.bg);
    ctx.fillStyle = fill;
  }

  if (logoImg) {
    const size = QR * L.logoFrac;
    const cx = ox + quiet * cell + (n * cell) / 2, cy = oy + quiet * cell + (n * cell) / 2;
    const box = size * 1.18;
    roundRect(ctx, cx - box / 2, cy - box / 2, box, box, box * 0.16);
    ctx.fillStyle = L.bg; ctx.fill();
    const r = fitContain(logoImg, size, size);
    ctx.drawImage(logoImg, cx - r.w / 2, cy - r.h / 2, r.w, r.h);
  }

  if (L.caption) {
    ctx.fillStyle = L.tx; ctx.textAlign = 'center';
    ctx.font = `600 ${34 * s}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
    ctx.fillText(L.caption, W / 2, oy + QR + 56 * s);
  }
}

function render() {
  if (!payload) return;
  drawCard(els.canvas.getContext('2d'), 1);
  verify();
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
    els.verify.textContent = isLink
      ? '✓ Verified — the QR scans to your link.'
      : '✓ Verified — the redesigned QR still scans to the original account.';
    els.download.disabled = false;
  } else {
    els.verify.className = 'verify bad';
    els.verify.textContent = '✕ The logo is covering too much — shrink it until this turns green before downloading.';
    els.download.disabled = true;
  }
}

// ---- Export: PNG / JPG / WebP (raster, 3×) or SVG (true vector) ---------------
const EXPORT_SCALE = 3; // 720 → 2160px QR — crisp for print
els.download.addEventListener('click', () => {
  if (els.download.disabled || !payload) return;
  const fmt = els.format.value;
  const base = 'rebrand-fonepay-qr';

  if (fmt === 'svg') {
    const blob = new Blob([buildSVG()], { type: 'image/svg+xml' });
    saveURL(`${base}.svg`, URL.createObjectURL(blob), true);
    return;
  }
  const off = document.createElement('canvas');
  drawCard(off.getContext('2d'), EXPORT_SCALE);
  let url;
  if (fmt === 'jpg') url = flattenWhite(off).toDataURL('image/jpeg', 0.95);
  else if (fmt === 'webp') url = off.toDataURL('image/webp', 0.95);
  else url = off.toDataURL('image/png');
  saveURL(`${base}.${fmt}`, url, false);
});

function saveURL(filename, url, revoke) {
  const a = document.createElement('a');
  a.download = filename; a.href = url; a.click();
  if (revoke) setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// JPG has no alpha — flatten the transparent card corners onto white.
function flattenWhite(src) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
  x.drawImage(src, 0, 0); return c;
}

// ---- True-vector SVG export (mirrors drawCard geometry) ----------------------
function buildSVG() {
  const L = layout(1);
  const { qr, n, QR, quiet, cell, ox, oy, W, H, pad } = L;
  const fillRef = L.gradient ? 'url(#g)' : L.fg;
  const font = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  const f = (v) => Number(v.toFixed(2));

  const inFinder = (r, c) => L.finders.some(([fr, fc]) => r >= fr && r < fr + 7 && c >= fc && c < fc + 7);
  let mods = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!qr.isDark(r, c)) continue;
    if (L.customEyes && inFinder(r, c)) continue;
    const x = ox + (c + quiet) * cell, y = oy + (r + quiet) * cell;
    if (dotShape === 'dots') mods += `<circle cx="${f(x + cell / 2)}" cy="${f(y + cell / 2)}" r="${f(cell * 0.5)}"/>`;
    else if (dotShape === 'rounded') mods += `<rect x="${f(x)}" y="${f(y)}" width="${f(cell)}" height="${f(cell)}" rx="${f(cell * 0.38)}"/>`;
    else mods += `<rect x="${f(x)}" y="${f(y)}" width="${f(cell + 0.5)}" height="${f(cell + 0.5)}"/>`;
  }

  let eyes = '';
  if (L.customEyes) {
    const rx = eyeShape === 'rounded';
    const rect = (X, Y, S, fillv, r) => `<rect x="${f(X)}" y="${f(Y)}" width="${f(S)}" height="${f(S)}"${r ? ` rx="${f(r)}"` : ''} fill="${fillv}"/>`;
    for (const [fr, fc] of L.finders) {
      const x = ox + (fc + quiet) * cell, y = oy + (fr + quiet) * cell;
      eyes += rect(x, y, 7 * cell, fillRef, rx ? cell * 1.75 : 0);
      eyes += rect(x + cell, y + cell, 5 * cell, L.bg, rx ? cell * 1.15 : 0);
      eyes += rect(x + 2 * cell, y + 2 * cell, 3 * cell, fillRef, rx ? cell * 0.75 : 0);
    }
  }

  let logo = '';
  if (logoImg) {
    const size = QR * L.logoFrac;
    const cx = ox + quiet * cell + (n * cell) / 2, cy = oy + quiet * cell + (n * cell) / 2;
    const box = size * 1.18, r = fitContain(logoImg, size, size);
    logo = `<rect x="${f(cx - box / 2)}" y="${f(cy - box / 2)}" width="${f(box)}" height="${f(box)}" rx="${f(box * 0.16)}" fill="${L.bg}"/>`
      + `<image x="${f(cx - r.w / 2)}" y="${f(cy - r.h / 2)}" width="${f(r.w)}" height="${f(r.h)}" href="${logoDataURL()}"/>`;
  }

  let text = '';
  if (L.showMerchant) text += `<text x="${W / 2}" y="${pad + 30}" text-anchor="middle" font-family="${font}" font-weight="700" font-size="40" fill="${L.tx}">${esc(L.merchant)}</text>`;
  if (L.caption) text += `<text x="${W / 2}" y="${oy + QR + 56}" text-anchor="middle" font-family="${font}" font-weight="600" font-size="34" fill="${L.tx}">${esc(L.caption)}</text>`;

  const defs = L.gradient
    ? `<defs><linearGradient id="g" x1="${ox}" y1="${oy}" x2="${ox + QR}" y2="${oy + QR}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${L.fg}"/><stop offset="1" stop-color="${L.fg2}"/></linearGradient></defs>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + defs
    + `<rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="28" fill="${L.bg}"/>`
    + `<g fill="${fillRef}">${mods}</g>${eyes}${logo}${text}</svg>`;
}

function esc(s) { return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
function logoDataURL() {
  const c = document.createElement('canvas');
  c.width = logoImg.naturalWidth || logoImg.width;
  c.height = logoImg.naturalHeight || logoImg.height;
  c.getContext('2d').drawImage(logoImg, 0, 0);
  return c.toDataURL('image/png');
}

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
