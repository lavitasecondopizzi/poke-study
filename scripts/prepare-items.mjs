import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const ITEM_DIR = path.join(ROOT, 'public', 'images', 'items');
const DATA_DIR = path.join(ROOT, 'public', 'data');
const API_URL = 'https://pokeapi.co/api/v2/item?limit=2000';

async function fetchWithRetry(url, attempts = 2) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await new Promise(resolve => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function mapWithConcurrency(items, concurrency, callback) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await callback(items[index]);
    }
  }));
  return results;
}

await mkdir(DATA_DIR, { recursive: true });
const files = await readdir(ITEM_DIR, { withFileTypes: true });
const localItems = files
  .filter(file => file.isFile() && file.name.toLowerCase().endsWith('.png'))
  .map(file => ({
    name: file.name.slice(0, -4),
    url: `/images/items/${file.name}`,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

let itemUrls = new Map();
try {
  const response = await fetchWithRetry(API_URL);
  const payload = await response.json();
  itemUrls = new Map(payload.results.map(item => [item.name, item.url]));
} catch {
  // Mantiene il catalogo locale anche in caso di indisponibilità della lista PokéAPI.
}

console.log('Recupero i nomi italiani degli strumenti...');
const items = await mapWithConcurrency(localItems, 12, async item => {
  const detailUrl = itemUrls.get(item.name);
  if (!detailUrl) return { ...item, localizedName: item.name.replace(/-/g, ' ') };
  try {
    const detail = await (await fetchWithRetry(detailUrl)).json();
    const localizedName = detail.names?.find(entry => entry.language?.name === 'it')?.name;
    return { ...item, localizedName: localizedName || item.name.replace(/-/g, ' ') };
  } catch {
    return { ...item, localizedName: item.name.replace(/-/g, ' ') };
  }
});

await writeFile(path.join(DATA_DIR, 'items.json'), JSON.stringify(items));
console.log(`Catalogo locale strumenti pronto: ${items.length} immagini, con nomi italiani quando disponibili.`);
