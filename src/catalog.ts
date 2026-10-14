import type { ApiNamedResource, PokemonSpecies } from './types';

export type MacroId = 'pokemon' | 'items' | 'berries' | 'machines' | 'special';

export interface CatalogCard {
  id: string;
  name: string;
  kind: 'pokemon' | 'item';
  imageUrl: string;
  macroId: MacroId;
  macroName: string;
  subcategoryId: string;
  subcategoryName: string;
  pokemonId?: number;
}

export const MACRO_CATEGORIES: { id: MacroId; name: string }[] = [
  { id: 'pokemon', name: 'Pokémon' },
  { id: 'items', name: 'Strumenti e oggetti' },
  { id: 'berries', name: 'Bacche, ingredienti e materiali' },
  { id: 'machines', name: 'Tecniche e macchine' },
  { id: 'special', name: 'Reperti e oggetti speciali' },
];

const regions = [
  { name: 'Kanto', start: 1, end: 151 },
  { name: 'Johto', start: 152, end: 251 },
  { name: 'Hoenn', start: 252, end: 386 },
  { name: 'Sinnoh', start: 387, end: 493 },
  { name: 'Unima', start: 494, end: 649 },
  { name: 'Kalos', start: 650, end: 721 },
  { name: 'Alola', start: 722, end: 809 },
  { name: 'Galar', start: 810, end: 905 },
  { name: 'Paldea', start: 906, end: 1025 },
];

function titleCase(value: string) {
  return value.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pokemonCard(pokemon: PokemonSpecies): CatalogCard {
  const region = regions.find(candidate => pokemon.id >= candidate.start && pokemon.id <= candidate.end) ?? regions[0];
  return {
    id: `pokemon:${pokemon.id}`,
    name: pokemon.name,
    kind: 'pokemon',
    imageUrl: `${import.meta.env.BASE_URL}images/pokemon/${pokemon.id}.png`,
    macroId: 'pokemon',
    macroName: 'Pokémon',
    subcategoryId: `pokemon-${region.name.toLowerCase()}`,
    subcategoryName: region.name,
    pokemonId: pokemon.id,
  };
}

export function itemCard(item: ApiNamedResource): CatalogCard {
  const name = item.name.toLowerCase();
  let macroId: MacroId = 'items';
  let subcategoryId = 'tools-battle';
  let subcategoryName = 'Strumenti da lotta e uso generale';

  if (/berry$/.test(name)) {
    macroId = 'berries';
    subcategoryId = 'berries';
    subcategoryName = 'Bacche';
  } else if (/^(tm|tr|hm)-?\d{1,3}$/.test(name) || /technical-machine|technical-record|hidden-machine/.test(name)) {
    macroId = 'machines';
    subcategoryId = 'technical-machines';
    subcategoryName = 'MT, DT e macchine';
  } else if (/fossil/.test(name)) {
    macroId = 'special';
    subcategoryId = 'fossils';
    subcategoryName = 'Fossili e reperti';
  } else if (/mega-stone|z-crystal|-z$|ite(?:-x|-y)?$|memory$|plate$|relic|nugget|pearl|star-piece|comet-shard|rare-bone|stardust|bottle-cap|treasure|strange-souvenir|gold-leaf|gold-teeth/.test(name)) {
    macroId = 'special';
    subcategoryId = /mega-stone|z-crystal|-z$|ite(?:-x|-y)?$|memory$|plate$/.test(name) ? 'special-mechanics' : 'treasures';
    subcategoryName = subcategoryId === 'special-mechanics' ? 'Pietre e oggetti speciali' : 'Tesori e reperti';
  } else if (/ingredient|herba|salt|spice|mushroom|root|fresh-cream|sweet-heart|honey|berry-juice|big-root/.test(name)) {
    macroId = 'berries';
    subcategoryId = 'materials';
    subcategoryName = 'Ingredienti e materiali';
  } else if (/ball$|ball-/.test(name) && !/football/.test(name)) {
    subcategoryId = 'capture-tools';
    subcategoryName = 'Poké Ball e cattura';
  } else if (/potion|antidote|awakening|burn-heal|ice-heal|paralyze-heal|full-heal|revive|ether|elixir|healing|medicine|herb/.test(name)) {
    subcategoryId = 'medicine';
    subcategoryName = 'Medicine e recupero';
  } else if (/stone$|scale|claw|protector|reaper-cloth|upgrade|dubious-disc|sachet|whipped-dream|electirizer|magmarizer|king.?s-rock|razor/.test(name)) {
    subcategoryId = 'evolution-tools';
    subcategoryName = 'Strumenti evolutivi';
  } else if (/key|pass|ticket|parcel|letter|card|map|finder|rod$|flute|bell$/.test(name)) {
    subcategoryId = 'key-exploration';
    subcategoryName = 'Strumenti chiave ed esplorazione';
  } else if (/incense|band$|scarf$|orb$|gem$|vest$|helmet|fang|tooth|lens|scope|coat|clay|seed|powder|amulet|charm|coin|luck|everstone|choice-|leftovers|black-belt|expert-belt|life-orb/.test(name)) {
    subcategoryId = 'held-tools';
    subcategoryName = 'Strumenti tenuti';
  }

  return {
    id: `item:${name}`,
    name,
    kind: 'item',
    imageUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${name}.png`,
    macroId,
    macroName: MACRO_CATEGORIES.find(category => category.id === macroId)?.name ?? 'Strumenti e oggetti',
    subcategoryId,
    subcategoryName,
  };
}

export function createFullCatalog(
  species: PokemonSpecies[],
  items: ApiNamedResource[],
  completedIds: number[],
  completedEntries: string[],
): CatalogCard[] {
  const completedPokemon = new Set(completedIds);
  const completedOther = new Set(completedEntries);
  const entries = [
    ...species.filter(entry => !completedPokemon.has(entry.id)).map(pokemonCard),
    ...items.map(itemCard).filter(card => !completedOther.has(card.id)),
  ];
  return shuffled(entries);
}

export function createMixedLesson(
  species: PokemonSpecies[],
  items: ApiNamedResource[],
  completedIds: number[],
  completedEntries: string[],
): CatalogCard[] {
  const completedPokemon = new Set(completedIds);
  const completedOther = new Set(completedEntries);
  const pokemon = shuffled(species.filter(entry => !completedPokemon.has(entry.id)).map(pokemonCard)).slice(0, 3);
  const categorizedItems = items
    .map(itemCard)
    .filter(card => !completedOther.has(card.id));
  const groups: MacroId[] = ['items', 'berries', 'machines', 'special'];
  const selected = [...pokemon];

  for (const macroId of groups) {
    const candidates = categorizedItems.filter(card => card.macroId === macroId);
    selected.push(...shuffled(candidates).slice(0, 3));
  }

  return shuffled(selected);
}

export function displayName(name: string) {
  return titleCase(name.replace(/-/g, ' '));
}
