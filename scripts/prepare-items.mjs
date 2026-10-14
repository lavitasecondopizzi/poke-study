import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const ITEM_DIR = path.join(ROOT, 'public', 'images', 'items');
const DATA_DIR = path.join(ROOT, 'public', 'data');

await mkdir(DATA_DIR, { recursive: true });
const files = await readdir(ITEM_DIR, { withFileTypes: true });
const items = files
  .filter(file => file.isFile() && file.name.toLowerCase().endsWith('.png'))
  .map(file => ({
    name: file.name.slice(0, -4),
    url: `/images/items/${file.name}`,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

await writeFile(path.join(DATA_DIR, 'items.json'), JSON.stringify(items));
console.log(`Catalogo locale strumenti pronto: ${items.length} immagini disponibili.`);
