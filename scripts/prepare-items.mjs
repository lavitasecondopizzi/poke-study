import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const ITEM_DIR = path.join(ROOT, 'public', 'images', 'items');
const DATA_DIR = path.join(ROOT, 'public', 'data');
const DB_DIR = path.join(ROOT, 'data', 'pokeapi', 'v2');

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

await mkdir(DATA_DIR, { recursive: true });

const itemIndex = await readJson(path.join(DB_DIR, 'item', 'index.json'));
const idByName = new Map(itemIndex.results.map(item => [
  item.name,
  Number(item.url.split('/').filter(Boolean).at(-1)),
]));

const files = await readdir(ITEM_DIR, { withFileTypes: true });
const localItems = files
  .filter(file => file.isFile() && file.name.toLowerCase().endsWith('.png'))
  .map(file => ({
    name: file.name.slice(0, -4),
    url: `/images/items/${file.name}`,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const items = [];
for (const item of localItems) {
  const id = idByName.get(item.name);
  let localizedName = item.name.replace(/-/g, ' ');

  if (id) {
    const detail = await readJson(path.join(DB_DIR, 'item', String(id), 'index.json'));
    localizedName = detail.names?.find(name => name.language?.name === 'it')?.name
      || detail.name
      || localizedName;
  }

  items.push({ ...item, localizedName });
}

await writeFile(path.join(DATA_DIR, 'items.json'), JSON.stringify(items));
console.log(`Catalogo strumenti generato dai dati locali: ${items.length} immagini.`);
