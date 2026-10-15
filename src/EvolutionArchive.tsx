import { useEffect, useMemo, useState } from 'react';
import { Search, GitBranch, ChevronRight, RefreshCw } from 'lucide-react';
import type { ApiNamedResource, PokemonSpecies } from './types';
import { displayName } from './catalog';

type EvolutionDetail = {
  trigger: string;
  item: string | null;
  heldItem: string | null;
  minLevel: number | null;
  minHappiness: number | null;
  minBeauty: number | null;
  minAffection: number | null;
  gender: number | null;
  timeOfDay: string | null;
  location: string | null;
  knownMove: string | null;
  knownMoveType: string | null;
  tradeSpecies: string | null;
  needsMultiplayer: boolean;
  needsOverworldRain: boolean;
  partySpecies: string | null;
  partyType: string | null;
  relativePhysicalStats: number | null;
  turnUpsideDown: boolean;
  usedMove: string | null;
  minMoveCount: number | null;
  minSteps: number | null;
  minDamageTaken: number | null;
  conditionExpression: string | null;
};
type EvolutionNode = {
  speciesId: number;
  speciesName: string;
  details: EvolutionDetail[];
  evolvesTo: EvolutionNode[];
};
type EvolutionChain = { id: number; babyTriggerItem: string | null; chain: EvolutionNode };

function readableSlug(value: string) {
  return displayName(value.replace(/-/g, ' '));
}

function conditionLabels(details: EvolutionDetail[], itemNames: Map<string, string>) {
  return details.map(detail => {
    const parts: string[] = [];
    const triggerLabels: Record<string, string> = {
      'level-up': 'Salendo di livello',
      trade: 'Scambio',
      'use-item': 'Usando uno strumento',
      shed: 'Alla comparsa di un Pokémon aggiuntivo',
      spin: 'Ruotando il personaggio',
      'tower-of-darkness': 'Alla Torre delle Tenebre',
      'tower-of-waters': 'Alla Torre delle Acque',
      'three-critical-hits': 'Dopo tre brutti colpi',
      'take-damage': 'Dopo aver subito danni',
      'other': 'Condizione speciale',
      'agile-style-move': 'Usando una mossa in stile rapido',
      'strong-style-move': 'Usando una mossa in stile potente',
      'recoil-damage': 'Dopo aver subito danni da contraccolpo',
    };
    if (detail.trigger) parts.push(triggerLabels[detail.trigger] ?? readableSlug(detail.trigger));
    if (detail.minLevel) parts.push(`livello ${detail.minLevel} o superiore`);
    if (detail.item) parts.push(`strumento: ${itemNames.get(detail.item) ?? readableSlug(detail.item)}`);
    if (detail.heldItem) parts.push(`strumento tenuto: ${itemNames.get(detail.heldItem) ?? readableSlug(detail.heldItem)}`);
    if (detail.minHappiness) parts.push(`amicizia almeno ${detail.minHappiness}`);
    if (detail.minBeauty) parts.push(`bellezza almeno ${detail.minBeauty}`);
    if (detail.minAffection) parts.push(`affetto almeno ${detail.minAffection}`);
    if (detail.gender === 1) parts.push('solo femmina');
    if (detail.gender === 2) parts.push('solo maschio');
    if (detail.timeOfDay) parts.push(detail.timeOfDay === 'day' ? 'di giorno' : detail.timeOfDay === 'night' ? 'di notte' : readableSlug(detail.timeOfDay));
    if (detail.location) parts.push(`luogo: ${readableSlug(detail.location)}`);
    if (detail.knownMove) parts.push(`con la mossa ${readableSlug(detail.knownMove)}`);
    if (detail.knownMoveType) parts.push(`con una mossa di tipo ${readableSlug(detail.knownMoveType)}`);
    if (detail.tradeSpecies) parts.push(`scambiando con ${readableSlug(detail.tradeSpecies)}`);
    if (detail.needsMultiplayer) parts.push('in modalità multiplayer');
    if (detail.needsOverworldRain) parts.push('mentre piove nel mondo di gioco');
    if (detail.partySpecies) parts.push(`con ${readableSlug(detail.partySpecies)} in squadra`);
    if (detail.partyType) parts.push(`con un Pokémon di tipo ${readableSlug(detail.partyType)} in squadra`);
    if (detail.relativePhysicalStats !== null) parts.push(detail.relativePhysicalStats > 0 ? 'Attacco superiore alla Difesa' : detail.relativePhysicalStats < 0 ? 'Difesa superiore all’Attacco' : 'Attacco e Difesa uguali');
    if (detail.turnUpsideDown) parts.push('con la console capovolta');
    if (detail.usedMove) parts.push(`dopo aver usato ${readableSlug(detail.usedMove)}`);
    if (detail.minMoveCount) parts.push(`almeno ${detail.minMoveCount} utilizzi della mossa`);
    if (detail.minSteps) parts.push(`dopo ${detail.minSteps} passi`);
    if (detail.minDamageTaken) parts.push(`dopo aver subito ${detail.minDamageTaken} danni`);
    if (detail.conditionExpression) parts.push(detail.conditionExpression);
    return [...new Set(parts)].join(' · ');
  }).filter(Boolean);
}

function findChain(node: EvolutionNode, speciesId: number): boolean {
  return node.speciesId === speciesId || node.evolvesTo.some(child => findChain(child, speciesId));
}

function EvolutionNodeView({
  node, selectedId, speciesNames, itemNames, baseUrl,
}: {
  node: EvolutionNode;
  selectedId: number;
  speciesNames: Map<number, string>;
  itemNames: Map<string, string>;
  baseUrl: string;
}) {
  return (
    <div className="evolution-tree-node">
      <article className={'evolution-pokemon-card' + (node.speciesId === selectedId ? ' is-selected' : '')}>
        <div className="evolution-pokemon-art">
          <img src={`${baseUrl}images/pokemon/${node.speciesId}.png`} alt="" loading="lazy" />
        </div>
        <div className="evolution-pokemon-copy">
          <small>#{String(node.speciesId).padStart(4, '0')}</small>
          <strong>{speciesNames.get(node.speciesId) ?? readableSlug(node.speciesName)}</strong>
          {node.speciesId === selectedId && <span className="evolution-current-tag">Selezionato</span>}
        </div>
      </article>
      {node.evolvesTo.length > 0 && (
        <div className="evolution-branches">
          {node.evolvesTo.map(child => {
            const conditions = conditionLabels(child.details, itemNames);
            return (
              <div className="evolution-branch" key={child.speciesId}>
                <div className="evolution-condition"><ChevronRight size={15} /><span>{conditions.length ? conditions.join(' / ') : 'Condizione non specificata'}</span></div>
                <EvolutionNodeView node={child} selectedId={selectedId} speciesNames={speciesNames} itemNames={itemNames} baseUrl={baseUrl} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function EvolutionArchive({
  species, items, online,
}: {
  species: PokemonSpecies[];
  items: ApiNamedResource[];
  online: boolean;
}) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(1);
  const [chains, setChains] = useState<EvolutionChain[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    fetch(`${import.meta.env.BASE_URL}data/evolution-chains.json`)
      .then(response => {
        if (!response.ok) throw new Error('Archivio evolutivo non disponibile.');
        return response.json() as Promise<EvolutionChain[]>;
      })
      .then(data => { if (active) setChains(data); })
      .catch(() => { if (active) setLoadError('Non è stato possibile caricare l’archivio evolutivo locale. Aggiorna la pagina quando sei online.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const speciesNames = useMemo(() => new Map(species.map(entry => [entry.id, entry.localizedName ?? readableSlug(entry.name)])), [species]);
  const itemNames = useMemo(() => new Map(items.map(entry => [entry.name, entry.localizedName ?? readableSlug(entry.name)])), [items]);
  const normalizedSearch = search.trim().toLocaleLowerCase('it');
  const results = useMemo(() => {
    if (!normalizedSearch) return species.slice(0, 16);
    return species.filter(entry =>
      (entry.localizedName ?? entry.name).toLocaleLowerCase('it').includes(normalizedSearch) ||
      entry.name.toLocaleLowerCase('it').includes(normalizedSearch) ||
      String(entry.id).includes(normalizedSearch),
    ).slice(0, 24);
  }, [species, normalizedSearch]);
  const selectedSpecies = species.find(entry => entry.id === selectedId);
  const selectedChain = chains.find(entry => findChain(entry.chain, selectedId));
  const root = selectedChain?.chain;

  return (
    <section className="evolution-archive" aria-labelledby="evolution-archive-title">
      <header className="evolution-archive-hero">
        <div className="evolution-archive-hero-icon"><GitBranch size={28} /></div>
        <div>
          <div className="eyebrow">SUPER-AIUTO · ACCESSO PERMANENTE</div>
          <h1 id="evolution-archive-title">Archivio delle evoluzioni</h1>
          <p>Esplora le linee evolutive dei Pokémon e scopri le condizioni necessarie per ogni trasformazione.</p>
        </div>
      </header>

      <label className="evolution-search">
        <Search size={18} />
        <input type="search" value={search} onChange={event => { setSearch(event.target.value); const match = species.find(entry => (entry.localizedName ?? entry.name).toLocaleLowerCase('it').includes(event.target.value.trim().toLocaleLowerCase('it')) || String(entry.id) === event.target.value.trim()); if (match) setSelectedId(match.id); }} placeholder="Cerca un Pokémon per nome o numero…" autoComplete="off" />
      </label>

      <div className="evolution-results" aria-label="Risultati Pokémon">
        {results.map(entry => (
          <button type="button" key={entry.id} className={'evolution-result' + (entry.id === selectedId ? ' is-active' : '')} onClick={() => setSelectedId(entry.id)}>
            <img src={`${import.meta.env.BASE_URL}images/pokemon/${entry.id}.png`} alt="" loading="lazy" />
            <span><small>#{String(entry.id).padStart(4, '0')}</small><strong>{entry.localizedName ?? readableSlug(entry.name)}</strong></span>
          </button>
        ))}
        {results.length === 0 && <p className="evolution-no-results">Nessun Pokémon corrisponde alla ricerca.</p>}
      </div>

      {loading ? <p className="evolution-status" role="status"><RefreshCw size={16} /> Caricamento delle catene evolutive…</p>
        : loadError ? <p className="evolution-status is-error" role="alert">{loadError}</p>
        : root ? (
          <section className="evolution-chain-panel" aria-label={'Linea evolutiva di ' + (selectedSpecies?.localizedName ?? selectedSpecies?.name ?? '')}>
            <div className="evolution-chain-heading">
              <div><span>LINEA EVOLUTIVA</span><h2>{selectedSpecies?.localizedName ?? selectedSpecies?.name ?? 'Pokémon selezionato'}</h2></div>
              <span>{selectedChain ? 'Catena completa' : ''}</span>
            </div>
            <div className="evolution-tree">
              <EvolutionNodeView node={root} selectedId={selectedId} speciesNames={speciesNames} itemNames={itemNames} baseUrl={import.meta.env.BASE_URL} />
            </div>
          </section>
        ) : (
          <section className="evolution-no-chain">
            <div className="evolution-no-chain-art"><img src={`${import.meta.env.BASE_URL}images/pokemon/${selectedId}.png`} alt="" /></div>
            <div><h2>{selectedSpecies?.localizedName ?? selectedSpecies?.name ?? 'Pokémon selezionato'}</h2><p>Questo Pokémon non ha una linea evolutiva registrata nell’archivio.</p></div>
          </section>
        )}
      {!online && <p className="evolution-offline-note">Archivio locale: per il primo caricamento è necessario che il file sia già disponibile nel browser.</p>}
    </section>
  );
}
