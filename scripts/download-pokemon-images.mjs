import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const POKEMON_DIR = path.join(ROOT, 'public', 'images', 'pokemon');
const PORTRAIT_DIR = path.join(ROOT, 'public', 'images', 'portraits');
const ITEM_DIR = path.join(ROOT, 'public', 'images', 'items');
const DATA_DIR = path.join(ROOT, 'public', 'data');
const ITEMS_API_URL = 'https://pokeapi.co/api/v2/item?limit=2000';
const NATIONAL_DEX_SIZE = 1025;
const STARTER_IDS = [1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393, 495, 498, 501, 650, 653, 656, 722, 725, 728, 810, 813, 816, 906, 909, 912];
const CONCURRENCY = 12;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

async function isValidPng(filePath) {
  try {
    const info = await stat(filePath);
    if (info.size < PNG_SIGNATURE.length) return false;
    const handle = await readFile(filePath);
    return handle.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
  } catch {
    return false;
  }
}

async function downloadPng(url, destination) {
  if (await isValidPng(destination)) return 'cached';

  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < PNG_SIGNATURE.length || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
        throw new Error(`Risposta non PNG: ${url}`);
      }
      const temporary = `${destination}.download`;
      await writeFile(temporary, bytes);
      await rename(temporary, destination);
      return 'downloaded';
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise(resolve => setTimeout(resolve, 300 * attempt));
    }
  }
  throw lastError;
}

await Promise.all([
  mkdir(POKEMON_DIR, { recursive: true }),
  mkdir(PORTRAIT_DIR, { recursive: true }),
  mkdir(ITEM_DIR, { recursive: true }),
  mkdir(DATA_DIR, { recursive: true }),
]);

const tasks = [];
for (let id = 1; id <= NATIONAL_DEX_SIZE; id++) {
  tasks.push({
    label: `sprite ${id}`,
    url: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`,
    destination: path.join(POKEMON_DIR, `${id}.png`),
  });
}
for (const id of STARTER_IDS) {
  tasks.push({
    label: `portrait ${id}`,
    url: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
    destination: path.join(PORTRAIT_DIR, `${id}.png`),
  });
}

// L'elenco viene ricavato dalla PokéAPI; le immagini non disponibili vengono ignorate.
const itemResponse = await fetch(ITEMS_API_URL);
if (!itemResponse.ok) throw new Error(`Impossibile leggere il catalogo strumenti: HTTP ${itemResponse.status}`);
const itemPayload = await itemResponse.json();
const itemNames = itemPayload.results.map(item => item.name).sort((a, b) => a.localeCompare(b));
for (const name of itemNames) {
  tasks.push({
    label: `oggetto ${name}`,
    url: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${name}.png`,
    destination: path.join(ITEM_DIR, `${name}.png`),
    itemName: name,
    optional: true,
  });
}

let next = 0;
let downloaded = 0;
let cached = 0;
let skipped = 0;
const availableItems = [];
const failures = [];

async function worker() {
  while (true) {
    const index = next++;
    if (index >= tasks.length) return;
    const task = tasks[index];
    try {
      const result = await downloadPng(task.url, task.destination);
      if (result === 'downloaded') downloaded++;
      else cached++;
      if (task.itemName) availableItems.push(task.itemName);
    } catch (error) {
      if (task.optional) {
        skipped++;
      } else {
        failures.push(`${task.label}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if ((index + 1) % 100 === 0 || index + 1 === tasks.length) {
      console.log(`Immagini controllate: ${index + 1}/${tasks.length}`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

await writeFile(path.join(DATA_DIR, 'items.json'), JSON.stringify([...new Set(availableItems)].sort().map(name => ({ name, url: `/images/items/${name}.png` }))));
console.log(`Immagini scaricate: ${downloaded}; già presenti: ${cached}; oggetti senza immagine: ${skipped}; errori obbligatori: ${failures.length}.`);
if (failures.length) {
  console.error(failures.slice(0, 20).join('\n'));
  throw new Error(`Download immagini incompleto (${failures.length} file).`);
}
