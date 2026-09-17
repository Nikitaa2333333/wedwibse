// Оригиналы ОТОБРАННЫХ кадров с публичного Яндекс.Диска по номерам из
// контактного листа (yadisk-previews.mjs):
//   node --dns-result-order=ipv6first scripts/yadisk-pick.mjs <slug> <public_url> "004 005 017 …"
// Кладёт в research/specialists/<slug>/raw/<номер>.<ext>; уже скачанное
// (по размеру) пропускает. Дальше — scripts/prep-photos.mjs research/specialists/<slug>.
// Диск целиком не качаем: у подрядчиков папки на гигабайты, а в карточку
// идёт 25–40 кадров. Часть конвейера specialist-page.
import { writeFile, mkdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const [slug, publicUrl, picks] = process.argv.slice(2);
if (!slug || !publicUrl || !picks) { console.error('usage: node scripts/yadisk-pick.mjs <slug> <public_url> "004 005 …"'); process.exit(1); }
const API = 'https://cloud-api.yandex.net/v1/disk/public/resources';

async function get(url, tries = 12) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(180_000) });
      if (r.ok) return r;
      if (i >= tries) throw new Error(`${r.status} ${await r.text()}`);
    } catch (e) { if (i >= tries) throw e; }
    await new Promise((res) => setTimeout(res, 2000 * i));
  }
}

// слаг со слэшем — готовый путь (research/grebnevo/grand-lesnoy), как в prep-photos
const base = slug.includes('/') ? slug : join('research', 'specialists', slug);
const index = Object.fromEntries(
  (await readFile(join(base, 'prev', 'index.tsv'), 'utf8')).split('\n').map((l) => l.split('\t')).map(([n, path, size]) => [n, { path, size: Number(size) }])
);
const raw = join(base, 'raw');
await mkdir(raw, { recursive: true });

let got = 0;
for (const n of picks.trim().split(/\s+/)) {
  const it = index[n];
  if (!it) { console.error(`нет номера ${n} в index.tsv`); continue; }
  const dest = join(raw, `${n}.${it.path.replace(/.*\./, '').toLowerCase()}`);
  try { if ((await stat(dest)).size === it.size) { got++; continue; } } catch {}
  const { href } = await (await get(`${API}/download?public_key=${encodeURIComponent(publicUrl)}&path=${encodeURIComponent(it.path)}`)).json();
  const f = await get(href);
  await writeFile(dest, Buffer.from(await f.arrayBuffer()));
  got++;
}
console.log(`оригиналов: ${got} -> ${raw}`);
