import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'public', 'data');
const DB_DIR = path.join(ROOT, 'data', 'pokeapi', 'v2');
const MAX_ID = 1025;
const LANGUAGE = 'it';

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

await mkdir(DATA_DIR, { recursive: true });

const indexPath = path.join(DB_DIR, 'pokemon-species', 'index.json');
const index = await readJson(indexPath);
const species = index.results
  .map(resource => ({
    name: resource.name,
    id: Number(resource.url.split('/').filter(Boolean).at(-1)),
  }))
  .filter(resource => Number.isInteger(resource.id) && resource.id > 0 && resource.id <= MAX_ID)
  .sort((a, b) => a.id - b.id);

if (species.length !== MAX_ID) {
  throw new Error(`Database PokéAPI locale incompleto: trovate ${species.length} specie su ${MAX_ID}. Importare prima il database completo.`);
}

const pokemon = [];
for (const entry of species) {
  const detail = await readJson(path.join(DB_DIR, 'pokemon-species', String(entry.id), 'index.json'));
  const localizedName = detail.names?.find(name => name.language?.name === LANGUAGE)?.name;
  pokemon.push({
    id: entry.id,
    name: detail.name ?? entry.name,
    localizedName: localizedName || detail.name || entry.name,
  });
}

await writeFile(path.join(DATA_DIR, 'pokemon.json'), JSON.stringify(pokemon));
console.log(`Catalogo Pokémon generato dai dati locali: ${pokemon.length} specie.`);
