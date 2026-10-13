import { mkdir, access, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'public', 'data');
const SPRITES_DIR = path.join(ROOT, 'public', 'pokemon');
const API_URL = 'https://pokeapi.co/api/v2/pokemon-species?limit=1025';
const SPRITE_URL = id => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
const MAX_ID = 1025;
const CONCURRENCY = 16;

async function fetchWithRetry(url, attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw lastError;
}

await mkdir(DATA_DIR, { recursive: true });
await mkdir(SPRITES_DIR, { recursive: true });

console.log('Scarico il catalogo Pokémon da PokéAPI...');
const response = await fetchWithRetry(API_URL);
const payload = await response.json();
const pokemon = payload.results
  .map(item => ({ id: Number(item.url.match(/pokemon-species\/(\d+)/)?.[1] ?? 0), name: item.name }))
  .filter(item => item.id > 0 && item.id <= MAX_ID)
  .sort((a, b) => a.id - b.id);

if (pokemon.length < MAX_ID) {
  throw new Error(`Catalogo incompleto: ricevuti ${pokemon.length} Pokémon su ${MAX_ID}.`);
}

await writeFile(path.join(DATA_DIR, 'pokemon.json'), JSON.stringify(pokemon));
console.log(`Catalogo locale pronto: ${pokemon.length} specie.`);

let nextIndex = 0;
let downloaded = 0;
const workers = Array.from({ length: CONCURRENCY }, async () => {
  while (true) {
    const index = nextIndex++;
    if (index >= pokemon.length) return;
    const item = pokemon[index];
    const destination = path.join(SPRITES_DIR, `${item.id}.png`);
    try {
      await access(destination);
      continue;
    } catch { /* sprite not cached yet */ }

    const image = await fetchWithRetry(SPRITE_URL(item.id));
    const bytes = Buffer.from(await image.arrayBuffer());
    await writeFile(destination, bytes);
    downloaded++;
    if (downloaded % 100 === 0) console.log(`Sprite scaricati: ${downloaded}`);
  }
});

await Promise.all(workers);
console.log(`Sprite locali pronti. Nuovi download: ${downloaded}; totale catalogo: ${pokemon.length}.`);
