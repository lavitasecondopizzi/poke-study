import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'public', 'data');
const API_URL = 'https://pokeapi.co/api/v2/pokemon-species?limit=1025';
const MAX_ID = 1025;

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
console.log('Aggiorno il catalogo Nazionale da PokéAPI...');
const response = await fetchWithRetry(API_URL);
const payload = await response.json();
const pokemon = payload.results
  .map(item => ({ id: Number(item.url.match(/pokemon-species\\/(\\d+)/)?.[1] ?? 0), name: item.name }))
  .filter(item => item.id > 0 && item.id <= MAX_ID)
  .sort((a, b) => a.id - b.id);

if (pokemon.length !== MAX_ID) {
  throw new Error(`Catalogo incompleto: ricevuti ${pokemon.length} Pokémon su ${MAX_ID}.`);
}

await writeFile(path.join(DATA_DIR, 'pokemon.json'), JSON.stringify(pokemon));
console.log(`Catalogo locale pronto: ${pokemon.length} specie. Le immagini saranno caricate on-demand dalla CDN pubblica.`);
