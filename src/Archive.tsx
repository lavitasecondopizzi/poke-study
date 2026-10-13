import { useEffect, useMemo, useState } from 'react';
import type { ApiNamedResource, PokemonSpecies } from './types';
import { displayName, itemCard, MACRO_CATEGORIES, pokemonCard } from './catalog';
import type { CatalogCard, MacroId } from './catalog';

const PAGE_SIZE = 24;

type ArchiveProps = {
  species: PokemonSpecies[];
  items: ApiNamedResource[];
  loadingSpecies: boolean;
  loadingItems: boolean;
  online: boolean;
  completedPokemon: number[];
  completedEntries: string[];
};

export default function Archive({
  species,
  items,
  loadingSpecies,
  loadingItems,
  online,
  completedPokemon,
  completedEntries,
}: ArchiveProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const allEntries = useMemo(() => {
    const macroOrder: Record<MacroId, number> = {
      pokemon: 0,
      items: 1,
      berries: 2,
      machines: 3,
      special: 4,
    };
    return [
      ...species.map(pokemonCard),
      ...items.map(itemCard),
    ].sort((a, b) =>
      macroOrder[a.macroId] - macroOrder[b.macroId] ||
      a.subcategoryName.localeCompare(b.subcategoryName, 'it') ||
      a.name.localeCompare(b.name, 'it'),
    );
  }, [species, items]);

  const normalizedSearch = search.trim().toLocaleLowerCase('it');
  const results = useMemo(() => {
    if (!normalizedSearch) return allEntries;
    return allEntries.filter(entry =>
      entry.name.toLocaleLowerCase('it').includes(normalizedSearch) ||
      entry.subcategoryName.toLocaleLowerCase('it').includes(normalizedSearch) ||
      entry.macroName.toLocaleLowerCase('it').includes(normalizedSearch) ||
      (entry.pokemonId !== undefined && String(entry.pokemonId).includes(normalizedSearch)),
    );
  }, [allEntries, normalizedSearch]);

  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleEntries = results.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const categoryCounts = useMemo(() => {
    const counts = new Map<MacroId, number>();
    for (const entry of allEntries) counts.set(entry.macroId, (counts.get(entry.macroId) ?? 0) + 1);
    return counts;
  }, [allEntries]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  function changeSearch(value: string) {
    setSearch(value);
    setPage(0);
  }

  function pagination(label: string) {
    return (
      <nav className="archive-pagination" aria-label={label}>
        <button type="button" onClick={() => setPage(current => Math.max(0, current - 1))} disabled={safePage === 0}>
          ‹ Indietro
        </button>
        <span>Pagina {safePage + 1} di {pageCount}</span>
        <button type="button" onClick={() => setPage(current => Math.min(pageCount - 1, current + 1))} disabled={safePage >= pageCount - 1}>
          Avanti ›
        </button>
      </nav>
    );
  }

  return (
    <section className="archive-browser" aria-labelledby="archive-title">
      <header className="archive-browser-heading">
        <div>
          <div className="eyebrow">ARCHIVIO DIDATTICO</div>
          <h2 id="archive-title">Archivio Nazionale</h2>
          <p>Cerca e consulta tutte le entità disponibili. Le categorie sono informative: non filtrano l’elenco.</p>
        </div>
        <strong className="archive-total">{results.length.toLocaleString('it-IT')} risultati</strong>
      </header>

      <label className="archive-search-field">
        <span>Cerca per nome, numero o categoria</span>
        <input
          type="search"
          value={search}
          onChange={event => changeSearch(event.target.value)}
          placeholder="Es. Pikachu, 25, bacche…"
          autoComplete="off"
        />
        {search && <button type="button" className="archive-clear-search" onClick={() => changeSearch('')}>Cancella</button>}
      </label>

      <div className="archive-category-overview" aria-label="Categorie dell’archivio, non interattive">
        {MACRO_CATEGORIES.map(category => (
          <div className="archive-category-chip" key={category.id}>
            <span>{category.name}</span>
            <strong>{(categoryCounts.get(category.id) ?? 0).toLocaleString('it-IT')}</strong>
          </div>
        ))}
      </div>

      {loadingItems && items.length === 0 && (
        <p className="archive-data-status" role="status">Gli oggetti e i materiali sono in caricamento. Intanto puoi già consultare i Pokémon.</p>
      )}
      {!loadingItems && items.length === 0 && (
        <p className="archive-data-status" role="status">
          {online
            ? 'Il catalogo degli oggetti non è disponibile in questo momento; l’elenco Pokémon resta consultabile.'
            : 'Sei offline e non ci sono oggetti salvati in cache; l’elenco Pokémon resta consultabile.'}
        </p>
      )}

      {loadingSpecies && allEntries.length === 0 ? (
        <div className="archive-empty-state" role="status">Caricamento dell’archivio…</div>
      ) : results.length === 0 ? (
        <div className="archive-empty-state">
          <strong>Nessun risultato</strong>
          <p>Modifica la ricerca oppure cancella il testo per rivedere tutte le entità.</p>
          {search && <button type="button" className="secondary-button" onClick={() => changeSearch('')}>Mostra tutto</button>}
        </div>
      ) : (
        <>
          {pagination('Paginazione superiore dell’archivio')}
          <div className="archive-entity-grid">
            {visibleEntries.map((entry: CatalogCard) => {
              const done = entry.kind === 'pokemon'
                ? completedPokemon.includes(entry.pokemonId ?? -1)
                : completedEntries.includes(entry.id);
              const categoryName = MACRO_CATEGORIES.find(category => category.id === entry.macroId)?.name ?? entry.macroName;
              return (
                <article className="archive-entity-card" key={entry.id}>
                  <div className="archive-entity-image">
                    <img
                      src={entry.imageUrl}
                      alt={displayName(entry.name)}
                      loading="lazy"
                      onError={event => { event.currentTarget.closest('.archive-entity-image')?.classList.add('archive-image-missing'); }}
                    />
                    <span aria-hidden="true">✦</span>
                  </div>
                  <div className="archive-entity-copy">
                    <small className="archive-entity-category">{categoryName}</small>
                    <strong>{displayName(entry.name)}</strong>
                    <span className="archive-entity-subcategory">{entry.subcategoryName}</span>
                    <span className={done ? 'archive-entity-done' : 'archive-entity-pending'}>{done ? 'Catalogato' : 'Da catalogare'}</span>
                  </div>
                </article>
              );
            })}
          </div>
          {pagination('Paginazione inferiore dell’archivio')}
        </>
      )}
    </section>
  );
}
