import { useMemo, useState } from 'react';
import { Search, Bone, Pickaxe } from 'lucide-react';
import type { ApiNamedResource, PokemonSpecies } from './types';
import { displayName, itemCard, pokemonCard } from './catalog';
import type { CatalogCard } from './catalog';

const FOSSIL_POKEMON_IDS = new Set([
  138, 139, 140, 141, 142,
  345, 346, 347, 348,
  408, 409, 410, 411,
  564, 565, 566, 567,
  696, 697, 698, 699,
  880, 881, 882, 883,
]);

const EXTRA_FOSSIL_ITEMS = new Set([
  'old-amber',
  'fossilized-bird',
  'fossilized-dino',
  'fossilized-drake',
  'fossilized-fish',
]);

type FossilArchiveProps = {
  species: PokemonSpecies[];
  items: ApiNamedResource[];
  loadingSpecies: boolean;
  loadingItems: boolean;
  completedPokemon: number[];
  completedEntries: string[];
};

export default function FossilArchive({
  species,
  items,
  loadingSpecies,
  loadingItems,
  completedPokemon,
  completedEntries,
}: FossilArchiveProps) {
  const [search, setSearch] = useState('');

  const entries = useMemo(() => {
    const fossilPokemon = species
      .filter(entry => FOSSIL_POKEMON_IDS.has(entry.id))
      .map(pokemonCard);
    const fossilItems = items
      .filter(item => itemCard(item).subcategoryId === 'fossils' || EXTRA_FOSSIL_ITEMS.has(item.name))
      .map(itemCard);
    return [...fossilPokemon, ...fossilItems].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'pokemon' ? -1 : 1;
      if (a.kind === 'pokemon' && b.kind === 'pokemon') return (a.pokemonId ?? 0) - (b.pokemonId ?? 0);
      return a.name.localeCompare(b.name, 'it');
    });
  }, [species, items]);

  const normalizedSearch = search.trim().toLocaleLowerCase('it');
  const results = entries.filter(entry =>
    entry.name.toLocaleLowerCase('it').includes(normalizedSearch) ||
    entry.subcategoryName.toLocaleLowerCase('it').includes(normalizedSearch) ||
    (entry.pokemonId !== undefined && String(entry.pokemonId).includes(normalizedSearch)),
  );

  const fossilPokemonCount = entries.filter(entry => entry.kind === 'pokemon').length;
  const fossilItemCount = entries.length - fossilPokemonCount;

  return (
    <section className="fossil-archive" aria-labelledby="fossil-archive-title">
      <header className="fossil-archive-hero">
        <div className="fossil-archive-emblem" aria-hidden="true"><Bone size={28} /></div>
        <div className="fossil-archive-heading">
          <div className="eyebrow">SUPER-AIUTO · ACCESSO PERMANENTE</div>
          <h1 id="fossil-archive-title">Archivio fossili e reperti</h1>
          <p>Consulta i reperti fossili, gli strumenti per il loro recupero e i Pokémon riportati in vita grazie alla paleontologia.</p>
        </div>
        <div className="fossil-archive-count"><strong>{entries.length}</strong><span>voci</span></div>
      </header>

      <div className="fossil-archive-stats">
        <div><Bone size={17} /><span>Pokémon fossili</span><strong>{fossilPokemonCount}</strong></div>
        <div><Pickaxe size={17} /><span>Fossili e reperti</span><strong>{fossilItemCount}</strong></div>
      </div>

      <label className="fossil-archive-search">
        <Search size={18} />
        <span className="sr-only">Cerca nell’archivio fossili</span>
        <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Cerca Pokémon, fossili o reperti…" autoComplete="off" />
        {search && <button type="button" onClick={() => setSearch('')}>Cancella</button>}
      </label>

      {loadingSpecies && species.length === 0 || loadingItems && items.length === 0 ? (
        <div className="fossil-archive-empty" role="status">Caricamento del catalogo paleontologico…</div>
      ) : results.length === 0 ? (
        <div className="fossil-archive-empty"><strong>Nessun risultato</strong><p>Prova con un altro nome o termine di ricerca.</p></div>
      ) : (
        <div className="fossil-archive-grid">
          {results.map((entry: CatalogCard) => {
            const done = entry.kind === 'pokemon'
              ? completedPokemon.includes(entry.pokemonId ?? -1)
              : completedEntries.includes(entry.id);
            return (
              <article className="fossil-archive-card" key={entry.id}>
                <div className="fossil-archive-art">
                  <img src={entry.imageUrl} alt={displayName(entry.name)} loading="lazy" onError={event => { event.currentTarget.closest('.fossil-archive-art')?.classList.add('is-missing'); }} />
                  <span aria-hidden="true">{entry.kind === 'pokemon' ? '✦' : '◇'}</span>
                </div>
                <div className="fossil-archive-copy">
                  <small>{entry.kind === 'pokemon' ? `POKÉMON FOSSILE · #${String(entry.pokemonId ?? 0).padStart(4, '0')}` : entry.subcategoryName}</small>
                  <strong>{displayName(entry.name)}</strong>
                  <span className={done ? 'fossil-archive-done' : 'fossil-archive-pending'}>{done ? 'Catalogato' : 'Da catalogare'}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

// Trigger a fresh GitHub Pages deployment without changing archive behavior.
