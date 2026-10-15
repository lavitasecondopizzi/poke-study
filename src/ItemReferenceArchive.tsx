import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Search, ShieldCheck, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ApiNamedResource } from './types';
import { displayName, itemCard } from './catalog';
import type { CatalogCard } from './catalog';

type ArchiveKind = 'machines' | 'held-items';
type MachineEntry = {
  id: string;
  itemName: string;
  itemLabel: string;
  moveName: string;
  moveLabel: string;
  versionGroup: string;
  versionLabel: string;
};
type ArchiveEntry = {
  id: string;
  name: string;
  imageUrl: string;
  subcategoryName: string;
  itemLabel?: string;
  moveLabel?: string;
  versionLabel?: string;
};

type ItemReferenceArchiveProps = {
  kind: ArchiveKind;
  items: ApiNamedResource[];
  loading: boolean;
  completedEntries: string[];
};

const PAGE_SIZE = 48;
const HELD_ITEM_PATTERN = /^(?:ability-shield|adamant-orb|air-balloon|amulet-coin|assault-vest|big-root|binding-band|black-belt|black-glasses|black-sludge|bright-powder|charcoal|choice-band|choice-scarf|choice-specs|clear-amulet|covert-cloak|eject-button|eject-pack|eviolite|expert-belt|focus-band|focus-sash|loaded-dice|life-orb|leftovers|lucky-egg|lucky-punch|mental-herb|metronome|muscle-band|mystic-water|never-melt-ice|power-anklet|power-band|power-belt|power-bracer|power-herb|power-lens|power-weight|protective-pads|quick-claw|razor-claw|razor-fang|red-card|rocky-helmet|safety-goggles|scope-lens|shell-bell|silk-scarf|silver-powder|smoke-ball|soft-sand|soothe-bell|spell-tag|sticky-barb|wide-lens|wise-glasses|zoom-lens|flame-orb|toxic-orb|heavy-duty-boots|terrain-extender|throat-spray|weakness-policy|smooth-rock|heat-rock|icy-rock|damp-rock|utility-umbrella|red-orb|blue-orb|lustrous-orb|griseous-orb|adamant-crystal|lustrous-globe|griseous-core|rusted-sword|rusted-shield|booster-energy|punching-glove|mirror-herb|ability-urge|adrenaline-orb|absorbing-bulb|cell-battery|float-stone|grip-claw|lagging-tail|luminous-moss|magnet|metal-coat|miracle-seed|macho-brace|odd-incense|quick-powder|sharp-beak|shed-shell|snowball|twisted-spoon|protector|reaper-cloth|electirizer|magmarizer|king.s-rock|dragon-scale|prism-scale|deep-sea-tooth|deep-sea-scale|whipped-dream|sachet|oval-stone|everstone|destiny-knot|exp-share|metal-powder|light-ball|thick-club|stick|leek|power-item-.+)$/;

export default function ItemReferenceArchive({ kind, items, loading, completedEntries }: ItemReferenceArchiveProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [machineEntries, setMachineEntries] = useState<MachineEntry[]>([]);
  const [machineLoading, setMachineLoading] = useState(false);
  const [machineError, setMachineError] = useState('');
  const isMachines = kind === 'machines';
  const title = isMachines ? 'Archivio MT e tecniche' : 'Archivio strumenti tenuti';

  useEffect(() => {
    if (!isMachines) return;
    let active = true;
    setMachineLoading(true);
    setMachineError('');
    fetch(`${import.meta.env.BASE_URL}data/machines.json`)
      .then(response => {
        if (!response.ok) throw new Error('Archivio MT e tecniche non disponibile.');
        return response.json() as Promise<MachineEntry[]>;
      })
      .then(data => { if (active) setMachineEntries(data); })
      .catch(() => { if (active) setMachineError('Non è stato possibile caricare l’archivio tecnico locale. Aggiorna la pagina quando sei online.'); })
      .finally(() => { if (active) setMachineLoading(false); });
    return () => { active = false; };
  }, [isMachines]);

  const entries = useMemo<ArchiveEntry[]>(() => {
    if (isMachines) {
      return machineEntries.map(entry => ({
        id: entry.id,
        name: entry.itemLabel + ' — ' + entry.moveLabel,
        imageUrl: `${import.meta.env.BASE_URL}images/items/${entry.itemName}.png`,
        subcategoryName: entry.versionLabel,
        itemLabel: entry.itemLabel,
        moveLabel: entry.moveLabel,
        versionLabel: entry.versionLabel,
      }));
    }
    return items
      .map(itemCard)
      .filter(entry => entry.subcategoryId === 'held-tools' || HELD_ITEM_PATTERN.test(entry.id.replace(/^item:/, '')))
      .sort((a, b) => a.name.localeCompare(b.name, 'it'))
      .map((entry: CatalogCard) => ({
        id: entry.id,
        name: entry.name,
        imageUrl: entry.imageUrl,
        subcategoryName: entry.subcategoryName,
      }));
  }, [items, isMachines, machineEntries]);

  const normalizedSearch = search.trim().toLocaleLowerCase('it');
  const results = entries.filter(entry =>
    entry.name.toLocaleLowerCase('it').includes(normalizedSearch) ||
    entry.subcategoryName.toLocaleLowerCase('it').includes(normalizedSearch) ||
    entry.id.toLocaleLowerCase('it').includes(normalizedSearch),
  );
  const completedCount = isMachines ? 0 : entries.filter(entry => completedEntries.includes(entry.id)).length;
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const visibleEntries = results.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const Icon = isMachines ? BookOpen : ShieldCheck;

  function changeSearch(value: string) {
    setSearch(value);
    setPage(0);
  }

  return (
    <section className="fossil-archive" aria-labelledby={isMachines ? 'machines-archive-title' : 'held-items-archive-title'}>
      <header className="fossil-archive-hero">
        <div className="fossil-archive-emblem" aria-hidden="true"><Icon size={28} /></div>
        <div className="fossil-archive-heading">
          <div className="eyebrow">SUPER-AIUTO · ACCESSO PERMANENTE</div>
          <h1 id={isMachines ? 'machines-archive-title' : 'held-items-archive-title'}>{title}</h1>
          <p>{isMachines
            ? 'Consulta le MT, le DT e le altre macchine tecniche, con la mossa insegnata e il gruppo di versioni.'
            : 'Consulta gli strumenti che i Pokémon possono tenere per ottenere effetti durante la lotta o in altre situazioni.'}</p>
        </div>
        <div className="fossil-archive-count"><strong>{entries.length.toLocaleString('it-IT')}</strong><span>{isMachines ? 'tecniche' : 'strumenti'}</span></div>
      </header>

      <div className="fossil-archive-stats">
        <div><Icon size={17} /><span>{isMachines ? 'Combinazioni macchina e mossa' : 'Strumenti tenuti disponibili'}</span><strong>{entries.length.toLocaleString('it-IT')}</strong></div>
        <div><Sparkles size={17} /><span>{isMachines ? 'Gruppi di versioni coperti' : 'Già catalogati'}</span><strong>{isMachines ? new Set(machineEntries.map(entry => entry.versionGroup)).size : completedCount}</strong></div>
      </div>

      <label className="fossil-archive-search">
        <Search size={18} />
        <span className="sr-only">Cerca in {title}</span>
        <input type="search" value={search} onChange={event => changeSearch(event.target.value)} placeholder={isMachines ? 'Cerca una MT, una mossa o una versione…' : 'Cerca uno strumento tenuto…'} autoComplete="off" />
        {search && <button type="button" onClick={() => changeSearch('')}>Cancella</button>}
      </label>

      {isMachines && machineLoading ? (
        <div className="fossil-archive-empty" role="status">Caricamento dell’archivio delle tecniche…</div>
      ) : isMachines && machineError ? (
        <div className="fossil-archive-empty" role="alert">{machineError}</div>
      ) : !isMachines && loading && items.length === 0 ? (
        <div className="fossil-archive-empty" role="status">Caricamento degli strumenti tenuti…</div>
      ) : results.length === 0 ? (
        <div className="fossil-archive-empty"><strong>Nessun elemento trovato</strong><p>{entries.length === 0 ? 'Non sono ancora presenti elementi classificati in questo archivio.' : 'Prova con un altro nome.'}</p></div>
      ) : (
        <>
          <div className="fossil-archive-grid">
            {visibleEntries.map(entry => {
              const done = !isMachines && completedEntries.includes(entry.id);
              return (
                <article className="fossil-archive-card" key={entry.id}>
                  <div className="fossil-archive-art">
                    <img src={entry.imageUrl} alt={displayName(entry.name)} loading="lazy" onError={event => { event.currentTarget.closest('.fossil-archive-art')?.classList.add('is-missing'); }} />
                    <span aria-hidden="true">◇</span>
                  </div>
                  <div className="fossil-archive-copy">
                    <small>{isMachines ? 'MACCHINA TECNICA · ' + entry.itemLabel : 'STRUMENTO TENUTO'}</small>
                    <strong>{isMachines ? entry.moveLabel : displayName(entry.name)}</strong>
                    <span className={done ? 'fossil-archive-done' : 'fossil-archive-pending'}>{isMachines ? entry.versionLabel : done ? 'Catalogato' : 'Da catalogare'}</span>
                  </div>
                </article>
              );
            })}
          </div>
          {pageCount > 1 && <nav className="fossil-archive-pagination" aria-label="Pagine archivio">
            <button type="button" className="secondary-button" disabled={page === 0} onClick={() => setPage(current => Math.max(0, current - 1))}><ChevronLeft size={16}/> Precedente</button>
            <span>Pagina {page + 1} di {pageCount} · {results.length.toLocaleString('it-IT')} risultati</span>
            <button type="button" className="secondary-button" disabled={page + 1 >= pageCount} onClick={() => setPage(current => Math.min(pageCount - 1, current + 1))}>Successiva <ChevronRight size={16}/></button>
          </nav>}
        </>
      )}
    </section>
  );
}
