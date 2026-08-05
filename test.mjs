// Self-check for the EMV/CRC logic — run: `node test.mjs`
import { crc16, validCRC, parseTLV, describe } from './emv.js';
import assert from 'node:assert';

// A real Fonepay static QR payload (DOPETECH NEPAL).
const payload =
  '00020101021126350011fonepay.com071622220300164465495204506553035245802NP5914DOPETECH NEPAL6011Lalitpur MP62110707168928663049651';

assert.equal(crc16(payload.slice(0, -4)), '9651', 'CRC-16 must match the trailing checksum');
assert.equal(validCRC(payload), true, 'valid Fonepay QR should pass CRC');
assert.equal(validCRC(payload.slice(0, -1) + '0'), false, 'tampered payload should fail CRC');

const info = describe(payload);
assert.equal(info.merchant, 'DOPETECH NEPAL');
assert.equal(info.city, 'Lalitpur MP');
assert.equal(info.currency, 'NPR');
assert.equal(info.isFonepay, true);

assert.equal(parseTLV('00XX0102'), null, 'non-numeric length field → null');
assert.deepEqual(parseTLV(''), {}, 'empty string → empty map');

console.log('ok — all EMV/CRC checks passed');
