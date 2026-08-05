// EMVCo merchant-QR helpers (Fonepay QRs follow the EMV QRCPS spec).
// A Fonepay QR is just a text payload; the last 4 chars are a CRC-16 checksum.
// We never modify the payload — we decode it, confirm it, and re-encode it as-is.

/** CRC-16/CCITT-FALSE over a string, as used by EMV tag 63. */
export function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** True if the payload's trailing CRC matches its contents (a valid EMV QR). */
export function validCRC(payload) {
  if (payload.length < 8 || payload.slice(-8, -4) !== '6304') return false;
  return crc16(payload.slice(0, -4)) === payload.slice(-4).toUpperCase();
}

/**
 * Parse the top-level TLV fields of an EMV payload into { id: value }.
 * Returns null if the string isn't well-formed TLV.
 */
export function parseTLV(payload) {
  const out = {};
  let i = 0;
  while (i + 4 <= payload.length) {
    const id = payload.slice(i, i + 2);
    const len = parseInt(payload.slice(i + 2, i + 4), 10);
    if (Number.isNaN(len)) return null;
    const value = payload.slice(i + 4, i + 4 + len);
    if (value.length < len) return null;
    out[id] = value;
    i += 4 + len;
  }
  return out;
}

/** Human-readable summary of who a Fonepay/EMV QR pays. */
export function describe(payload) {
  const t = parseTLV(payload) || {};
  const currencyNames = { '524': 'NPR', '356': 'INR', '840': 'USD' };
  return {
    merchant: (t['59'] || '').trim() || null, // Merchant Name
    city: (t['60'] || '').trim() || null,     // Merchant City
    currency: currencyNames[t['53']] || t['53'] || null,
    country: t['58'] || null,
    isFonepay: /fonepay\.com/i.test(payload),
    valid: validCRC(payload),
  };
}
