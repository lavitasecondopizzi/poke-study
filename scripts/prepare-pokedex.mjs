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


// Genera un archivio evolutivo statico a partire dallo snapshot PokéAPI locale.
// In questo modo la pagina non effettua richieste esterne durante la consultazione.
const evolutionIndex = await readJson(path.join(DB_DIR, 'evolution-chain', 'index.json'));
function speciesIdFromUrl(url) {
  const id = Number(url.split('/').filter(Boolean).at(-1));
  return Number.isInteger(id) ? id : 0;
}
function compactEvolutionNode(node) {
  return {
    speciesId: speciesIdFromUrl(node.species?.url ?? ''),
    speciesName: node.species?.name ?? '',
    details: (node.evolution_details ?? []).map(detail => ({
      trigger: detail.trigger?.name ?? '',
      item: detail.item?.name ?? null,
      heldItem: detail.held_item?.name ?? null,
      minLevel: detail.min_level ?? null,
      minHappiness: detail.min_happiness ?? null,
      minBeauty: detail.min_beauty ?? null,
      minAffection: detail.min_affection ?? null,
      gender: detail.gender ?? null,
      timeOfDay: detail.time_of_day || null,
      location: detail.location?.name ?? null,
      knownMove: detail.known_move?.name ?? null,
      knownMoveType: detail.known_move_type?.name ?? null,
      tradeSpecies: detail.trade_species?.name ?? null,
      needsMultiplayer: Boolean(detail.needs_multiplayer),
      needsOverworldRain: Boolean(detail.needs_overworld_rain),
      partySpecies: detail.party_species?.name ?? null,
      partyType: detail.party_type?.name ?? null,
      relativePhysicalStats: detail.relative_physical_stats ?? null,
      turnUpsideDown: Boolean(detail.turn_upside_down),
      usedMove: detail.used_move?.name ?? null,
      minMoveCount: detail.min_move_count ?? null,
      minSteps: detail.min_steps ?? null,
      minDamageTaken: detail.min_damage_taken ?? null,
      needsOverworldRain: Boolean(detail.needs_overworld_rain),
      conditionExpression: detail.condition_expression ?? null,
    })),
    evolvesTo: (node.evolves_to ?? []).map(compactEvolutionNode),
  };
}
const evolutionChains = [];
for (const resource of evolutionIndex.results ?? []) {
  const id = speciesIdFromUrl(resource.url ?? '');
  if (!id) continue;
  const detail = await readJson(path.join(DB_DIR, 'evolution-chain', String(id), 'index.json'));
  evolutionChains.push({
    id,
    babyTriggerItem: detail.baby_trigger_item?.name ?? null,
    chain: compactEvolutionNode(detail.chain),
  });
}
await writeFile(path.join(DATA_DIR, 'evolution-chains.json'), JSON.stringify(evolutionChains));
console.log(`Archivio evolutivo generato dai dati locali: ${evolutionChains.length} catene.`);
