import { useMemo } from 'react';
import { AlertTriangle, Award, BookOpen, CheckCircle2, Clock3, Medal, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import type { ApiNamedResource, PokemonSpecies, SavedProgress } from './types';
import { displayName, itemCard, MACRO_CATEGORIES, pokemonCard } from './catalog';

const DEX_SIZE = 1025;
const REGIONS = [
  { name: 'Kanto', start: 1, end: 151 }, { name: 'Johto', start: 152, end: 251 },
  { name: 'Hoenn', start: 252, end: 386 }, { name: 'Sinnoh', start: 387, end: 493 },
  { name: 'Unima', start: 494, end: 649 }, { name: 'Kalos', start: 650, end: 721 },
  { name: 'Alola', start: 722, end: 809 }, { name: 'Galar', start: 810, end: 905 },
  { name: 'Paldea', start: 906, end: 1025 },
];
type Props = { progress: SavedProgress; species: PokemonSpecies[]; items: ApiNamedResource[]; loading: boolean; onReset: () => void };

function Bar({ value }: { value: number }) {
  const safe = Math.max(0, Math.min(100, value));
  return <div className="pr-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(safe)}><span style={{ width: `${safe}%` }} /></div>;
}

export default function PersonalRegister({ progress, species, items, loading, onReset }: Props) {
  const donePokemon = useMemo(() => new Set(progress.completedIds), [progress.completedIds]);
  const doneEntries = useMemo(() => new Set(progress.completedEntries ?? []), [progress.completedEntries]);
  const catalog = useMemo(() => [...species.map(pokemonCard), ...items.map(itemCard)], [species, items]);
  const stats = useMemo(() => {
    const regions = REGIONS.map(region => {
      const done = [...donePokemon].filter(id => id >= region.start && id <= region.end).length;
      const total = region.end - region.start + 1;
      return { ...region, done, total, percent: done / total * 100, complete: done === total };
    });
    const macros = MACRO_CATEGORIES.map(macro => {
      const cards = catalog.filter(card => card.macroId === macro.id);
      const completed = (card: typeof cards[number]) => card.kind === 'pokemon'
        ? Boolean(card.pokemonId && donePokemon.has(card.pokemonId)) : doneEntries.has(card.id);
      const subs = new Map<string, { name: string; total: number; done: number }>();
      cards.forEach(card => {
        const item = subs.get(card.subcategoryId) ?? { name: card.subcategoryName, total: 0, done: 0 };
        item.total += 1;
        if (completed(card)) item.done += 1;
        subs.set(card.subcategoryId, item);
      });
      const done = cards.filter(completed).length;
      return { ...macro, total: cards.length, done, percent: cards.length ? done / cards.length * 100 : 0, subs: [...subs.values()].sort((a,b) => a.name.localeCompare(b.name, 'it')) };
    });
    return { regions, macros, pokemon: donePokemon.size, percent: donePokemon.size / DEX_SIZE * 100 };
  }, [catalog, donePokemon, doneEntries]);
  const medals = useMemo(() => [
    ...[
      { id: 'first', title: 'Primo passo', desc: 'Cataloga il primo Pokémon.', target: 1 },
      { id: '50', title: 'Collezionista', desc: 'Cataloga 50 Pokémon.', target: 50 },
      { id: '150', title: 'Ricercatore', desc: 'Cataloga 150 Pokémon.', target: 150 },
      { id: '500', title: 'Esperto nazionale', desc: 'Cataloga 500 Pokémon.', target: 500 },
      { id: '1025', title: 'Maestro Pokédex', desc: 'Completa tutti i 1.025 Pokémon.', target: 1025 },
    ].map(m => ({ id: m.id, title: m.title, desc: m.desc, earned: stats.pokemon >= m.target })),
    ...stats.regions.map(r => ({ id: `region-${r.name}`, title: r.name, desc: `Completa il Pokédex di ${r.name}.`, earned: r.complete })),
    ...stats.macros.map(m => ({ id: `macro-${m.id}`, title: m.name, desc: 'Classifica tutte le entità della macrocategoria.', earned: m.total > 0 && m.done === m.total })),
  ], [stats]);
  const history = [...(progress.history ?? [])].map(event => event.kind !== 'exam' ? event : ({ ...event, title: event.title.replace('Esame regionale superato', 'Regione completata').replace('Ricompensa esame riscattata', 'Traguardo registrato'), detail: event.detail.replace(/\s*·\s*\+\d+\s+Punti? esame/gi, '') })).sort((a,b) => b.timestamp - a.timestamp).slice(0,12);
  const earned = medals.filter(m => m.earned).length;

  return <>
    <div className="breadcrumb">Home / Area allievo / <b>Registro personale</b></div>
    <header className="pr-hero">
      <div><span className="eyebrow">SEGRETERIA DIDATTICA · SCHEDA STUDENTE</span><h1>Registro personale</h1><p>Progressi e traguardi.</p>
        <div className="pr-total"><strong>{Math.round(stats.percent)}%</strong><span>Pokédex nazionale completato</span></div><Bar value={stats.percent}/><small>{stats.pokemon.toLocaleString('it-IT')} / {DEX_SIZE.toLocaleString('it-IT')} specie</small>
      </div><div className="pr-seal" aria-hidden="true"><Trophy size={32}/><span>REGISTRO</span><b>UFFICIALE</b></div>
    </header>
    <section className="pr-stats" aria-label="Riepilogo risultati">
      <article><i className="pr-icon">✦</i><div><small>PORTAFOGLIO</small><strong>{progress.points.toLocaleString('it-IT')}</strong><span>Punti Poké</span></div></article>
      <article><i className="pr-icon">✦</i><div><small>AIUTI SBLOCCATI</small><strong>{(progress.inventory ?? []).length.toLocaleString('it-IT')}</strong><span>Strumenti e archivi</span></div></article>
      <article><i className="pr-icon"><Medal size={21}/></i><div><small>TRAGUARDI</small><strong>{earned}<em> / {medals.length}</em></strong><span>Medaglie ottenute</span></div></article>
      <article className="pr-errors"><i className="pr-icon"><AlertTriangle size={20}/></i><div><small>ALLENAMENTO</small><strong>{(progress.errors ?? 0).toLocaleString('it-IT')}</strong><span>Errori registrati</span></div></article>
    </section>
    <section className="pr-section">
      <div className="pr-heading"><div><span className="eyebrow">PANORAMICA</span><h2>Avanzamento per regione</h2></div><b>{stats.regions.filter(r=>r.complete).length} / {REGIONS.length} completate</b></div>
      <div className="pr-regions">{stats.regions.map(r=><article className={r.complete?'is-done':''} key={r.name}><div className="pr-region-head"><i>{r.complete?<CheckCircle2 size={17}/>:r.name.slice(0,2).toUpperCase()}</i><div><strong>{r.name}</strong><small>{r.done} / {r.total} specie</small></div><b>{Math.round(r.percent)}%</b></div><Bar value={r.percent}/><small className="pr-region-note">{r.complete?'Regione completata':`Ancora ${r.total-r.done} da catalogare`}</small></article>)}</div>
    </section>
    <section className="pr-section">
      <div className="pr-heading"><div><span className="eyebrow">CLASSIFICAZIONE</span><h2>Macrocategorie e sottocategorie</h2></div><b>{stats.macros.filter(m=>m.total>0&&m.done===m.total).length} / {stats.macros.length} complete</b></div>
      {loading?<div className="pr-empty"><span className="pokeball-loader"/><p>Caricamento dei dati del registro…</p></div>:stats.macros.map(m=><details className="pr-macro" key={m.id}>
        <summary><i>{m.id==='pokemon'?<Sparkles size={19}/>:m.id==='special'?<Award size={19}/>:<BookOpen size={19}/>}</i><div><strong>{m.name}</strong><small>{m.done.toLocaleString('it-IT')} / {m.total.toLocaleString('it-IT')} classificate</small><Bar value={m.percent}/></div><b>{Math.round(m.percent)}%</b><span className="pr-chevron">⌄</span></summary>
        <div className="pr-subs">{m.subs.map(s=><div key={s.name}><span>{s.name}</span><small>{s.done} / {s.total}</small><Bar value={s.total?s.done/s.total*100:0}/></div>)}{!m.total&&<p>Nessuna entità disponibile per questa categoria.</p>}</div>
      </details>)}
    </section>
    <section className="pr-section">
      <div className="pr-heading"><div><span className="eyebrow">OBIETTIVI</span><h2>Medaglie e traguardi</h2></div><b>{earned} ottenute</b></div>
      <div className="pr-medals">{medals.map(m=><article className={m.earned?'is-earned':''} key={m.id}><i>{m.earned?<Medal size={22}/>:<Award size={22}/>}</i><strong>{m.title}</strong><p>{m.desc}</p><small>{m.earned?'TRAGUARDO RAGGIUNTO':'OBIETTIVO DA COMPLETARE'}</small></article>)}</div>
    </section>
    <section className="pr-section">
      <div className="pr-heading"><div><span className="eyebrow">ATTIVITÀ RECENTE</span><h2>Storico del registro</h2></div><b>{(progress.history??[]).length} eventi salvati</b></div>
      {history.length?<ol className="pr-history">{history.map(event=><li className={`is-${event.kind}`} key={event.id}><i>{event.kind==='error'?<AlertTriangle size={16}/>:event.kind==='exam'?<Trophy size={16}/>:<CheckCircle2 size={16}/>}</i><div><strong>{event.title}</strong><p>{displayName(event.detail)}</p><small><Clock3 size={12}/>{new Date(event.timestamp).toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'})}</small></div></li>)}</ol>:<div className="pr-empty"><Clock3 size={25}/><strong>Nessuna attività registrata</strong></div>}
    </section>
    <footer className="pr-footer"><div><strong><RotateCcw size={16}/> Gestione progressi</strong></div><button type="button" className="secondary-button" onClick={onReset}>Azzera progressi</button></footer>
  </>;
}
