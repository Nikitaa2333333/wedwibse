/// <reference path="../../pb_data/types.d.ts" />
// ============================================================
// ВХОД ЧЕРЕЗ TELEGRAM — проверка данных виджета входа.
// https://core.telegram.org/widgets/login#checking-authorization
//
//   секрет  = SHA-256(токен бота)          — 32 сырых байта
//   строка  = «ключ=значение» всех полей, кроме hash, по алфавиту, через \n
//   подпись = HMAC-SHA-256(строка, секрет)  — hex, должна совпасть с hash
//
// Почему своя SHA-256: $security.hs256 в PocketBase принимает ключ
// строкой, а секрет здесь — сырые байты хэша. Байты больше 0x7F при
// переходе JS-строки в Go превратились бы в два байта UTF-8, и подпись
// не сошлась бы ни разу. Поэтому хэш и HMAC считаются над массивами байт.
// ============================================================

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

/** строка → байты UTF-8 (TextEncoder в VM хуков нет) */
function utf8(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d < 0xe000) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

/** SHA-256 над массивом байт → массив из 32 байт */
function sha256(bytes) {
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const msg = bytes.slice();
  const bitLen = bytes.length * 8;
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  for (let i = 7; i >= 0; i--) msg.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 0xff);
  const w = new Array(64);
  for (let off = 0; off < msg.length; off += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = (msg[off + i * 4] << 24) | (msg[off + i * 4 + 1] << 16) | (msg[off + i * 4 + 2] << 8) | msg[off + i * 4 + 3];
    }
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15], b = w[i - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const t1 = (hh + S1 + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
  }
  const out = [];
  for (const x of h) out.push((x >>> 24) & 0xff, (x >>> 16) & 0xff, (x >>> 8) & 0xff, x & 0xff);
  return out;
}

function hmacSha256(key, message) {
  let k = key.length > 64 ? sha256(key) : key.slice();
  while (k.length < 64) k.push(0);
  const inner = sha256(k.map((x) => x ^ 0x36).concat(message));
  return sha256(k.map((x) => x ^ 0x5c).concat(inner));
}

const hex = (bytes) => bytes.map((b) => (b < 16 ? '0' : '') + b.toString(16)).join('');

/** подпись данных виджета — та же формула, что у Telegram (и у теста) */
function signTelegram(data, botToken) {
  const check = Object.keys(data)
    .filter((k) => k !== 'hash' && data[k] !== undefined && data[k] !== null && data[k] !== '')
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join('\n');
  return hex(hmacSha256(sha256(utf8(botToken)), utf8(check)));
}

/** данные входа живут сутки: подсмотренную ссылку нельзя переиграть через неделю */
const MAX_AGE = 86400;

/**
 * Проверка данных виджета. Возвращает { id, name } или бросает ошибку.
 * now — секунды, для теста.
 */
function verifyTelegram(data, botToken, now) {
  if (!data || typeof data !== 'object' || !data.hash || !data.id) {
    throw new UnauthorizedError('Нет данных входа через Telegram.');
  }
  const ok = $security.equal(signTelegram(data, botToken), String(data.hash).toLowerCase());
  if (!ok) throw new UnauthorizedError('Telegram не подтвердил вход — попробуйте ещё раз.');
  const t = parseInt(String(data.auth_date), 10);
  const nowSec = now || Math.floor(Date.now() / 1000);
  if (!isFinite(t) || t > nowSec + 300 || nowSec - t > MAX_AGE) {
    throw new UnauthorizedError('Вход через Telegram устарел — нажмите кнопку ещё раз.');
  }
  const id = String(data.id);
  if (!/^\d{1,20}$/.test(id)) throw new UnauthorizedError('Telegram прислал неверный номер учётки.');
  const name = [data.first_name, data.last_name].filter((x) => !!x).join(' ').slice(0, 120);
  return { id, name };
}

module.exports = { sha256, hex, utf8, signTelegram, verifyTelegram };
