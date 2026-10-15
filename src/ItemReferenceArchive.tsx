import { useMemo, useState } from 'react';
import { BookOpen, Search, ShieldCheck, Sparkles } from 'lucide-react';
import type { ApiNamedResource } from './types';
import { displayName, itemCard } from './catalog';
import type { CatalogCard } from './catalog';

type ArchiveKind = 'machines' | 'held-items';

type ItemReferenceArchiveProps = {
  kind: ArchiveKind;
  items: ApiNamedResource[];
  loading: boolean;
  completedEntries: string[];
};

const HELD_ITEM_PATTERN = /^(?:ability-shield|adamant-orb|air-balloon|amulet-coin|assault-vest|big-root|binding-band|black-belt|black-glasses|black-sludge|bright-powder|charcoal|choice-band|choice-scarf|choice-specs|clear-amulet|covert-cloak|eject-button|eject-pack|eviolite|expert-belt|focus-band|focus-sash|loaded-dice|life-orb|leftovers|lucky-egg|lucky-punch|mental-herb|metronome|muscle-band|mystic-water|never-melt-ice|power-anklet|power-band|power-belt|power-bracer|power-herb|power-lens|power-weight|protective-pads|quick-claw|razor-claw|razor-fang|red-card|rocky-helmet|safety-goggles|scope-lens|shell-bell|silk-scarf|silver-powder|smoke-ball|soft-sand|soothe-bell|spell-tag|sticky-barb|wide-lens|wise-glasses|zoom-lens|flame-orb|toxic-orb|heavy-duty-boots|terrain-extender|throat-spray|weakness-policy|weakness-policy|weather-rock|smooth-rock|heat-rock|icy-rock|damp-rock|utility-umbrella|red-orb|blue-orb|lustrous-orb|griseous-orb|adamant-crystal|lustrous-globe|griseous-core|rusted-sword|rusted-shield|booster-energy|punching-glove|mirror-herb|loaded-dice|ability-urge|adrenaline-orb|absorbing-bulb|cell-battery|eject-button|float-stone|focus-band|grip-claw|lagging-tail|luminous-moss|magnet|metal-coat|miracle-seed|macho-brace|odd-incense|power-bracer|quick-powder|sharp-beak|shed-shell|snowball|sticky-barb|twisted-spoon|upgrade|dubious-disc|protector|reaper-cloth|electirizer|magmarizer|king.s-rock|dragon-scale|prism-scale|deep-sea-tooth|deep-sea-scale|whipped-dream|sachet|oval-stone|everstone|eviolite|red-scarf|blue-scarf|green-scarf|yellow-scarf|pink-scarf|destiny-knot|exp-share|soothe-bell|lucky-punch|metal-powder|quick-powder|light-ball|thick-club|stick|leek|lucky-punch|grip-claw|big-root|razor-fang|razor-claw|shell-bell|wide-lens|zoom-lens|power-item-.+)$/;

export default function ItemReferenceArchive({ kind, items, loading, completedEntries }: ItemReferenceArchiveProps) {
  const [search, setSearch] = useState('');
  const isMachines = kind === 'machines';
  const title = isMachines ? 'Archivio MT e tecniche' : 'Archivio strumenti tenuti';
  const entries = useMemo(() => items
    .map(itemCard)
    .filter(entry => isMachines
      ? entry.subcategoryId === 'technical-machines'
      : entry.subcategoryId === 'held-tools' || HELD_ITEM_PATTERN.test(entry.id.replace(/^item:/, '')))
    .sort((a, b) => a.name.localeCompare(b.name, 'it')),
  [items, isMachines]);

  const normalizedSearch = search.trim().toLocaleLowerCase('it');
  const results = entries.filter(entry =>
    entry.name.toLocaleLowerCase('it').includes(normalizedSearch) ||
    entry.subcategoryName.toLocaleLowerCase('it').includes(normalizedSearch) ||
    entry.id.toLocaleLowerCase('it').includes(normalizedSearch),
  );
  const completedCount = entries.filter(entry => completedEntries.includes(entry.id)).length;
  const Icon = isMachines ? BookOpen : ShieldCheck;

  return (
    <section className="fossil-archive" aria-labelledby={isMachines ? 'machines-archive-title' : 'held-items-archive-title'}>
      <header className="fossil-archive-hero">
        <div className="fossil-archive-emblem" aria-hidden="true"><Icon size={28} /></div>
        <div className="fossil-archive-heading">
          <div className="eyebrow">SUPER-AIUTO · ACCESSO PERMANENTE</div>
          <h1 id={isMachines ? 'machines-archive-title' : 'held-items-archive-title'}>{title}</h1>
          <p>{isMachines
            ? 'Consulta le MT, le DT e le altre macchine tecniche disponibili nel catalogo di Poké Study.'
            : 'Consulta gli strumenti che i Pokémon possono tenere per ottenere effetti durante la lotta o in altre situazioni.'}</p>
        </div>
        <div className="fossil-archive-count"><strong>{entries.length}</strong><span>{isMachines ? 'macchine' : 'strumenti'}</span></div>
      </header>

      <div className="fossil-archive-stats">
        <div><Icon size={17} /><span>{isMachines ? 'Macchine tecniche disponibili' : 'Strumenti tenuti disponibili'}</span><strong>{entries.length}</strong></div>
        <div><Sparkles size={17} /><span>Già catalogati</span><strong>{completedCount}</strong></div>
      </div>

      <label className="fossil-archive-search">
        <Search size={18} />
        <span className="sr-only">Cerca in {title}</span>
        <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={isMachines ? 'Cerca una MT o una tecnica…' : 'Cerca uno strumento tenuto…'} autoComplete="off" />
        {search && <button type="button" onClick={() => setSearch('')}>Cancella</button>}
      </label>

      {loading && items.length === 0 ? (
        <div className="fossil-archive-empty" role="status">Caricamento del catalogo…</div>
      ) : results.length === 0 ? (
        <div className="fossil-archive-empty"><strong>Nessun elemento trovato</strong><p>{entries.length === 0 ? 'Non sono ancora presenti elementi classificati in questo archivio.' : 'Prova con un altro nome.'}</p></div>
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
                  <small>{isMachines ? 'MACCHINA TECNICA' : 'STRUMENTO TENUTO'}</small>
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
