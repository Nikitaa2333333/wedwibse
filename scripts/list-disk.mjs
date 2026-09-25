const publicUrl = process.argv[2];
const API = 'https://cloud-api.yandex.net/v1/disk/public/resources';

async function get(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (r.ok) return r.json();
      console.error(`Attempt ${i}: ${r.status}`);
    } catch (e) {
      console.error(`Attempt ${i}: ${e.message}`);
    }
    if (i < tries) await new Promise(res => setTimeout(res, 2000 * i));
  }
  return null;
}

async function listFolder(path = '') {
  const pathParam = path ? `&path=${encodeURIComponent(path)}` : '';
  const url = `${API}?public_key=${encodeURIComponent(publicUrl)}&limit=200${pathParam}`;
  const data = await get(url);
  if (!data) { console.log(`No data for ${path || '/'}`); return; }
  if (!data._embedded) { console.log(`Empty: ${path || '/'}`); return; }

  console.log(`\n${path || '(root)'}:`);
  for (const item of data._embedded.items) {
    console.log(`  ${item.type === 'dir' ? '[DIR]' : '[FILE]'} ${item.name} ${item.size || ''}`);
    if (item.type === 'dir' && !path) {
      await listFolder(`/${item.name}`);
    }
  }
}

await listFolder();
