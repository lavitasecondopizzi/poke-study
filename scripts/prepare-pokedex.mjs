import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'public', 'data');
const API_URL = 'https://pokeapi.co/api/v2/pokemon-species?limit=1025';
const MAX_ID = 1025;
const LANGUAGE = 'it';

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
console.log('Aggiorno il catalogo Nazionale da PokéAPI...');
const response = await fetchWithRetry(API_URL);
const payload = await response.json();
const basePokemon = payload.results
  .map(item => ({ id: Number(item.url.split('/').filter(Boolean).at(-1) ?? 0), name: item.name, url: item.url }))
  .filter(item => item.id > 0 && item.id <= MAX_ID)
  .sort((a, b) => a.id - b.id);

if (basePokemon.length !== MAX_ID) {
  throw new Error(`Catalogo incompleto: ricevuti ${basePokemon.length} Pokémon su ${MAX_ID}.`);
}

console.log('Recupero i nomi italiani delle specie...');
const pokemon = await mapWithConcurrency(basePokemon, 12, async item => {
  try {
    const detail = await (await fetchWithRetry(item.url, 2)).json();
    const localizedName = detail.names?.find(entry => entry.language?.name === LANGUAGE)?.name;
    return { id: item.id, name: item.name, localizedName: localizedName || item.name };
  } catch {
    // Il catalogo rimane utilizzabile anche se la traduzione di una singola voce non è disponibile.
    return { id: item.id, name: item.name, localizedName: item.name };
  }
});

await writeFile(path.join(DATA_DIR, 'pokemon.json'), JSON.stringify(pokemon));
console.log(`Catalogo locale pronto: ${pokemon.length} specie con nomi italiani quando disponibili.`);
