import { useMemo, useState } from 'react';
import { Search, Sparkles, Gem } from 'lucide-react';
import type { ApiNamedResource } from './types';
import { displayName, itemCard } from './catalog';
import type { CatalogCard } from './catalog';

type EvolutionToolsArchiveProps = {
  items: ApiNamedResource[];
  loading: boolean;
  completedEntries: string[];
};

export default function EvolutionToolsArchive({
  items,
  loading,
  completedEntries,
}: EvolutionToolsArchiveProps) {
  const [search, setSearch] = useState('');

  const entries = useMemo(() => items
    .map(itemCard)
    .filter(entry => entry.subcategoryId === 'evolution-tools')
    .sort((a, b) => a.name.localeCompare(b.name, 'it')),
  [items]);

  const normalizedSearch = search.trim().toLocaleLowerCase('it');
  const results = entries.filter(entry =>
    entry.name.toLocaleLowerCase('it').includes(normalizedSearch) ||
    entry.subcategoryName.toLocaleLowerCase('it').includes(normalizedSearch),
  );

  return (
    <section className="fossil-archive" aria-labelledby="evolution-tools-archive-title">
      <header className="fossil-archive-hero">
        <div className="fossil-archive-emblem" aria-hidden="true"><Sparkles size={28} /></div>
        <div className="fossil-archive-heading">
          <div className="eyebrow">SUPER-AIUTO · ACCESSO PERMANENTE</div>
          <h1 id="evolution-tools-archive-title">Archivio degli strumenti evolutivi</h1>
          <p>Consulta le pietre evolutive e gli strumenti necessari per innescare o completare l’evoluzione di alcuni Pokémon.</p>
        </div>
        <div className="fossil-archive-count"><strong>{entries.length}</strong><span>strumenti</span></div>
      </header>

      <div className="fossil-archive-stats">
        <div><Gem size={17} /><span>Strumenti evolutivi disponibili</span><strong>{entries.length}</strong></div>
        <div><Sparkles size={17} /><span>Già catalogati</span><strong>{entries.filter(entry => completedEntries.includes(entry.id)).length}</strong></div>
      </div>

      <label className="fossil-archive-search">
        <Search size={18} />
        <span className="sr-only">Cerca negli strumenti evolutivi</span>
        <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Cerca uno strumento evolutivo…" autoComplete="off" />
        {search && <button type="button" onClick={() => setSearch('')}>Cancella</button>}
      </label>

      {loading && items.length === 0 ? (
        <div className="fossil-archive-empty" role="status">Caricamento degli strumenti evolutivi…</div>
      ) : results.length === 0 ? (
        <div className="fossil-archive-empty"><strong>Nessuno strumento trovato</strong><p>{entries.length === 0 ? 'Il catalogo degli oggetti non contiene ancora strumenti classificati come evolutivi.' : 'Prova con un altro nome.'}</p></div>
      ) : (
        <div className="fossil-archive-grid">
          {results.map((entry: CatalogCard) => {
            const done = completedEntries.includes(entry.id);
            return (
              <article className="fossil-archive-card" key={entry.id}>
                <div className="fossil-archive-art">
                  <img src={entry.imageUrl} alt={displayName(entry.name)} loading="lazy" onError={event => { event.currentTarget.closest('.fossil-archive-art')?.classList.add('is-missing'); }} />
                  <span aria-hidden="true">◇</span>
                </div>
                <div className="fossil-archive-copy">
                  <small>STRUMENTO EVOLUTIVO</small>
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
