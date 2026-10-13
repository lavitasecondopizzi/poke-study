import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronRight, CircleHelp, FlaskConical, GraduationCap, Menu, Search, ShoppingBag, Trophy, X } from 'lucide-react';
import type { PokemonSpecies, SavedProgress } from './types';

const API = 'https://pokeapi.co/api/v2/pokemon-species?limit=1025';
const NATIONAL_DEX_SIZE = 1025;
const SAVE_KEY = 'poke-study-progress-v1';

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

function loadProgress(): SavedProgress {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return JSON.parse(raw) as SavedProgress;
  } catch { /* storage may be unavailable */ }
  return { points: 0, completedIds: [], examPoints: 0 };
}

function titleCase(name: string) {
  return name.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function spriteUrl(id: number) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function App() {
  const [species, setSpecies] = useState<PokemonSpecies[]>([]);
  const [order, setOrder] = useState<PokemonSpecies[]>([]);
  const [progress, setProgress] = useState<SavedProgress>(loadProgress);
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState('Trascina ogni Pokémon sul suo numero Nazionale. Tutte le specie sono disponibili fin da subito.');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState('home');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [search, setSearch] = useState('');
  const [wrongId, setWrongId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetch(API)
      .then(response => {
        if (!response.ok) throw new Error('Il servizio dati non risponde.');
        return response.json();
      })
      .then(data => {
        if (!active) return;
        const list = (data.results as { name: string; url: string }[])
          .map(item => ({
            id: Number(item.url.match(/pokemon-species\/(\d+)/)?.[1] ?? 0),
            name: item.name,
          }))
          .filter(item => item.id > 0 && item.id <= NATIONAL_DEX_SIZE)
          .sort((a, b) => a.id - b.id);
        setSpecies(list);
        setOrder(shuffled(list));
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLoadError('Non è stato possibile caricare il Pokédex. Controlla la connessione e riprova.');
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch { /* storage may be unavailable */ }
  }, [progress]);

  const completedSet = useMemo(() => new Set(progress.completedIds), [progress.completedIds]);
  const speciesById = useMemo(() => new Map(species.map(pokemon => [pokemon.id, pokemon])), [species]);
  const slots = useMemo(() => Array.from({ length: NATIONAL_DEX_SIZE }, (_, index) => index + 1), []);
  const remaining = useMemo(() => {
    const term = search.trim().toLowerCase();
    return order.filter(pokemon =>
      !completedSet.has(pokemon.id) &&
      (!term || pokemon.name.toLowerCase().includes(term) || String(pokemon.id).includes(term)),
    );
  }, [order, completedSet, search]);

  const placePokemon = useCallback((pokemon: PokemonSpecies, slotId: number) => {
    if (completedSet.has(pokemon.id)) return;
    if (pokemon.id !== slotId) {
      setWrongId(slotId);
      setMessage(`Non è lo slot corretto per ${titleCase(pokemon.name)}. Riprova: i tentativi sono illimitati e non ci sono penalità.`);
      window.setTimeout(() => setWrongId(current => current === slotId ? null : current), 650);
      return;
    }
    setProgress(old => {
      if (old.completedIds.includes(pokemon.id)) return old;
      const completedIds = [...old.completedIds, pokemon.id];
      const examsBefore = regions.filter(region =>
        Array.from({ length: region.end - region.start + 1 }, (_, i) => region.start + i)
          .every(id => old.completedIds.includes(id)),
      ).length;
      const examsAfter = regions.filter(region =>
        Array.from({ length: region.end - region.start + 1 }, (_, i) => region.start + i)
          .every(id => completedIds.includes(id)),
      ).length;
      return {
        points: old.points + 1,
        completedIds,
        examPoints: old.examPoints + Math.max(0, examsAfter - examsBefore),
      };
    });
    setSelected(null);
    setWrongId(null);
    setMessage(`Corretto! ${titleCase(pokemon.name)} è il Pokémon n. ${pokemon.id}. +1 Punto Poké.`);
  }, [completedSet]);

  function navTo(next: string) {
    setView(next);
    setMobileMenu(false);
  }

  return (
    <div className="site-shell">
      <div className="utility-bar">
        <span>PORTALE ALLIEVI · DIPARTIMENTO DI RICERCA POKÉMON</span>
        <span className="utility-right">AREA DIDATTICA <b>● ONLINE</b></span>
      </div>
      <header className="masthead">
        <button className="mobile-toggle" aria-label="Apri menu" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X /> : <Menu />}</button>
        <div className="pokeball-mark" aria-label="Poké Ball"><span /></div>
        <div className="brand">
          <div className="brand-kicker">ACCADEMIA POKÉMON</div>
          <div className="brand-name">Accademia Pokémon <span>✦</span></div>
          <div className="brand-subtitle">Portale dello studente</div>
        </div>
        <div className="student-card"><div className="student-avatar">★</div><div><small>PROFILO ALLIEVO</small><strong>Allenatore in formazione</strong><span>Matricola n. 000001</span></div></div>
      </header>
      <nav className={`main-nav ${mobileMenu ? 'nav-open' : ''}`}>
        <button className={view === 'home' ? 'active' : ''} onClick={() => navTo('home')}><GraduationCap size={16} /> Portale</button>
        <button className={view === 'pokedex' ? 'active' : ''} onClick={() => navTo('pokedex')}><BookOpen size={16} /> Pokédex Nazionale</button>
        <button className={view === 'registro' ? 'active' : ''} onClick={() => navTo('registro')}><Trophy size={16} /> Registro personale</button>
        <button className={view === 'shop' ? 'active' : ''} onClick={() => navTo('shop')}><ShoppingBag size={16} /> Cartoleria</button>
        <button className={view === 'forum' ? 'active' : ''} onClick={() => navTo('forum')}><CircleHelp size={16} /> Bacheca studenti</button>
        <div className="nav-status">ARCHIVIO NAZIONALE · 1–1025</div>
      </nav>

      <main className="page-layout">
        <aside className="sidebar">
          <section className="side-box">
            <h2>AREA ALLIEVO</h2>
            <button className={view === 'pokedex' ? 'side-active' : ''} onClick={() => navTo('pokedex')}>▸ Pokédex Nazionale</button>
            <button className={view === 'registro' ? 'side-active' : ''} onClick={() => navTo('registro')}>▸ Registro personale</button>
            <button className={view === 'shop' ? 'side-active' : ''} onClick={() => navTo('shop')}>▸ Cartoleria punti</button>
          </section>
          <section className="side-box">
            <h2>LIBRETTO PERSONALE</h2>
            <div className="stat-row"><span>Punti Poké</span><strong>{progress.points}</strong></div>
            <div className="stat-row"><span>Punti esame</span><strong>{progress.examPoints}</strong></div>
            <div className="progress-track"><span style={{ width: `${Math.min(100, progress.completedIds.length / NATIONAL_DEX_SIZE * 100)}%` }} /></div>
            <small className="muted">{progress.completedIds.length} / {NATIONAL_DEX_SIZE} specie catalogate</small>
          </section>
          <section className="notice-box"><strong>AVVISO DEL PRESIDE</strong><p>Tutti i Pokémon e tutti i numeri Nazionali sono disponibili fin dall'inizio. Ogni collocazione corretta vale un Punto Poké; gli errori non comportano penalità.</p></section>
          <div className="side-footer">POKÉ STUDY v0.2<br />Un progetto fan-made.</div>
        </aside>

        <section className="content">
          {view === 'home' && <>
            <div className="breadcrumb">Portale dello studente / <b>Pagina iniziale</b></div>
            <section className="welcome-panel">
              <div className="welcome-copy">
                <div className="welcome-ribbon"><span>✦</span> BENVENUTO IN ACCADEMIA</div>
                <h1>Il tuo viaggio nel mondo Pokémon comincia qui!</h1>
                <p>Cataloga le specie del Pokédex Nazionale, tieni traccia dei tuoi progressi e scopri nuove curiosità dal nostro archivio scientifico.</p>
                <button className="enter-pokedex" onClick={() => navTo('pokedex')}><BookOpen size={18} /> ENTRA NEL POKÉDEX <ChevronRight size={19} /></button>
              </div>
              <div className="welcome-art"><div className="art-sun" /><div className="art-book"><BookOpen size={68} strokeWidth={1.3}/></div><div className="art-caption">IL SAPERE È LA TUA<br/>PRIMA POKÉ BALL!</div></div>
            </section>
            <div className="currency-row">
              <div className="currency-card poke-currency"><div className="currency-icon">₱</div><div><small>PORTAFOGLIO ALLIEVO</small><strong>{progress.points.toLocaleString('it-IT')} <span>Punti Poké</span></strong><p>Per strumenti e oggetti utili</p></div><div className="currency-gloss" /></div>
              <div className="currency-card exam-currency"><div className="currency-icon">★</div><div><small>RISULTATI ACCADEMICI</small><strong>{progress.examPoints.toLocaleString('it-IT')} <span>Punti esame</span></strong><p>Per sbloccare e potenziare super-aiuti</p></div><div className="currency-gloss" /></div>
            </div>
            <section className="portal-menu-panel">
              <div className="portal-panel-heading"><div><span>AREA PERSONALE</span><h2>Che cosa vuoi fare oggi?</h2></div><span className="panel-badge">MENU ALLIEVO</span></div>
              <button className="portal-menu-item" onClick={() => navTo('pokedex')}><span className="menu-item-icon blue-icon"><BookOpen size={22}/></span><span className="menu-item-copy"><strong>Pokédex Nazionale</strong><small>Cataloga tutte le 1.025 specie disponibili</small></span><ChevronRight className="menu-chevron"/></button>
              <button className="portal-menu-item" onClick={() => { setSearch(''); navTo('pokedex'); }}><span className="menu-item-icon green-icon"><FlaskConical size={22}/></span><span className="menu-item-copy"><strong>Archivio scientifico</strong><small>Cerca una specie per nome o numero</small></span><ChevronRight className="menu-chevron"/></button>
              <button className="portal-menu-item" onClick={() => navTo('forum')}><span className="menu-item-icon orange-icon"><CircleHelp size={22}/></span><span className="menu-item-copy"><strong>Forum studenti</strong><small>Avvisi, guide e comunicazioni dell'Accademia</small></span><ChevronRight className="menu-chevron"/></button>
              <button className="portal-menu-item" onClick={() => navTo('shop')}><span className="menu-item-icon purple-icon"><ShoppingBag size={22}/></span><span className="menu-item-copy"><strong>Negozio strumenti</strong><small>Usa i tuoi punti per prepararti alle ricerche</small></span><ChevronRight className="menu-chevron"/></button>
            </section>
            <section className="home-progress-panel"><div><div className="progress-medal">★</div><div><span className="section-label">IL TUO PERCORSO</span><h2>Registro personale</h2><p>Hai catalogato {progress.completedIds.length} specie su {NATIONAL_DEX_SIZE}.</p></div></div><button className="secondary-button" onClick={() => navTo('registro')}>Apri registro <ChevronRight size={15}/></button><div className="home-progress-track"><span style={{width: `${Math.min(100,progress.completedIds.length/NATIONAL_DEX_SIZE*100)}%`}}/></div></section>
          </>}
          {view === 'pokedex' && <>
            <div className="breadcrumb">Home / Archivio nazionale / <b>Pokédex</b></div>
            <div className="page-heading"><div><div className="eyebrow">ARCHIVIO COMPLETO · TUTTE LE SPECIE DISPONIBILI</div><h1>Pokédex Nazionale</h1><p>Le schede sono mescolate; gli slot numerati restano sempre nell'ordine nazionale. Completa il catalogo senza lezioni o turni.</p></div><div className="heading-stamp">POKÉDEX<br /><b>001–1025</b></div></div>
            <div className="dashboard-strip">
              <div><span>SPECIE CATALOGATE</span><strong>{progress.completedIds.length.toLocaleString('it-IT')} <small>/ {NATIONAL_DEX_SIZE.toLocaleString('it-IT')}</small></strong></div>
              <div><span>PUNTI POKÉ</span><strong>{progress.points.toLocaleString('it-IT')}</strong></div>
              <div><span>PUNTI ESAME</span><strong>{progress.examPoints.toLocaleString('it-IT')}</strong></div>
            </div>
            <div className="instructions"><span className="info-icon">i</span><p><b>Come si gioca</b><br />Trascina una scheda sul numero corretto. Su telefono o tablet, tocca prima il Pokémon e poi il suo slot. Tutti i 1.025 slot sono già presenti: gli errori sono illimitati e senza penalità.</p></div>
            {loadError && <div className="error-panel"><h3>Archivio non raggiungibile</h3><p>{loadError}</p><button className="primary-button" onClick={() => window.location.reload()}>Riprova</button></div>}
            <section className="challenge-board">
              <div className="board-header"><div><span className="section-label">SCHEDE DISPONIBILI</span><h2>Tutti i Pokémon, in ordine misto</h2></div><div className="round-count">{remaining.length.toLocaleString('it-IT')} <span>da catalogare</span></div></div>
              <div className="search-wrap card-search"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Filtra le schede per nome o numero, senza sblocchi…" aria-label="Filtra Pokémon disponibili" />{search && <button className="clear-search" onClick={() => setSearch('')} aria-label="Cancella ricerca">×</button>}</div>
              {loading ? <div className="loading-panel"><div className="pokeball-loader" /><h3>Caricamento dell'archivio completo…</h3><p>Gli slot numerati sono già disponibili qui sotto.</p></div> : remaining.length > 0 ? <div className="pokemon-cards">
                {remaining.map(pokemon => <button key={pokemon.id} className={`pokemon-card ${selected === pokemon.id ? 'chosen' : ''}`} draggable onDragStart={event => event.dataTransfer.setData('text/plain', String(pokemon.id))} onClick={() => { setSelected(pokemon.id); setMessage(`Selezionato ${titleCase(pokemon.name)}: tocca lo slot n. ${pokemon.id} per collocarlo.`); }}>
                  <img src={spriteUrl(pokemon.id)} alt="" loading="lazy" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />
                  <span className="pokemon-name">{titleCase(pokemon.name)}</span><span className="pokemon-prompt">N. {String(pokemon.id).padStart(4, '0')} · TRASCINA</span>
                </button>)}
              </div> : <div className="round-complete"><div className="success-seal">✓</div><h3>Pokédex completato!</h3><p>Hai catalogato tutte le specie disponibili nell'archivio Nazionale.</p></div>}
              <div className={`feedback-bar ${message.startsWith('Corretto') ? 'feedback-success' : wrongId !== null ? 'feedback-error' : ''}`} role="status">{message}</div>
              <div className="slots-heading"><div><span className="section-label">SLOT NAZIONALI</span><h2>Tutti i numeri da 0001 a 1025</h2></div><span>{progress.completedIds.length} catalogati</span></div>
              <div className="slots-grid">
                {slots.map(slotId => {
                  const isFilled = completedSet.has(slotId);
                  const pokemon = speciesById.get(slotId);
                  return <div key={slotId} role="button" tabIndex={0} aria-label={`Slot numero ${slotId}${isFilled ? ', catalogato' : ', vuoto'}`} className={`dex-slot ${isFilled ? 'slot-filled' : ''} ${wrongId === slotId ? 'slot-wrong' : ''}`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const id = Number(event.dataTransfer.getData('text/plain')); const dragged = speciesById.get(id); if (dragged) placePokemon(dragged, slotId); }} onClick={() => { if (selected !== null) { const chosen = speciesById.get(selected); if (chosen) placePokemon(chosen, slotId); } }} onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && selected !== null) { event.preventDefault(); const chosen = speciesById.get(selected); if (chosen) placePokemon(chosen, slotId); } }}>
                    <span className="slot-number">N. {String(slotId).padStart(4, '0')}</span>
                    {isFilled ? <><img src={spriteUrl(slotId)} alt="" loading="lazy" /><strong>{pokemon ? titleCase(pokemon.name) : 'Catalogato'}</strong><span className="slot-check">CATALOGATO ✓</span></> : <><div className="slot-placeholder">?</div><strong>{selected !== null ? 'Tocca per collocare' : 'Slot disponibile'}</strong><span className="slot-check">RILASCIA QUI</span></>}
                  </div>;
                })}
              </div>
            </section>
          </>}
          {view === 'registro' && <><div className="breadcrumb">Home / Area allievo / <b>Registro personale</b></div><div className="page-heading"><div><div className="eyebrow">SEGRETERIA DIDATTICA</div><h1>Registro personale</h1><p>Il riepilogo dei progressi nel catalogo Nazionale completo.</p></div></div><div className="dashboard-strip"><div><span>PUNTI POKÉ</span><strong>{progress.points}</strong></div><div><span>PUNTI ESAME</span><strong>{progress.examPoints}</strong></div><div><span>SPECIE CATALOGATE</span><strong>{progress.completedIds.length} <small>/ 1025</small></strong></div></div><section className="archive-search"><h2>Avanzamento per regione</h2>{regions.map(region => { const count = progress.completedIds.filter(id => id >= region.start && id <= region.end).length; const total = region.end - region.start + 1; return <div className="region-progress" key={region.name}><div><b>{region.name}</b><span>{count} / {total}</span></div><div className="progress-track"><span style={{ width: `${count / total * 100}%` }} /></div>{count === total && <small className="exam-earned">Regione completata · Punto esame ottenuto</small>}</div>})}<button className="secondary-button reset-button" onClick={() => { if (window.confirm('Vuoi azzerare punteggio e progressi salvati su questo dispositivo?')) { setProgress({ points: 0, completedIds: [], examPoints: 0 }); setSelected(null); setMessage('Progressi azzerati. Tutti i Pokémon sono nuovamente disponibili.'); } }}>Azzera progressi</button></section></>}
          {view === 'shop' && <><div className="breadcrumb">Home / Servizi / <b>Cartoleria punti</b></div><div className="page-heading"><div><div className="eyebrow">SERVIZI STUDENTI</div><h1>Cartoleria punti</h1><p>I Punti Poké serviranno per gli strumenti; i Punti esame per acquistare e potenziare i super-aiuti.</p></div></div><div className="empty-service"><ShoppingBag size={34} /><h2>Catalogo in allestimento</h2><p>La cartoleria verrà attivata con un prossimo aggiornamento. I tuoi punti sono già registrati.</p><div className="currency-pills"><span>{progress.points} Punti Poké</span><span>{progress.examPoints} Punti esame</span></div></div></>}
          {view === 'forum' && <><div className="breadcrumb">Home / Comunità / <b>Bacheca studenti</b></div><div className="page-heading"><div><div className="eyebrow">COMUNITÀ SCOLASTICA</div><h1>Bacheca studenti</h1><p>Avvisi e appunti dell'archivio Pokémon.</p></div></div><section className="forum-post"><div className="post-icon">📌</div><div><span className="section-label">AVVISO DEL PRESIDE</span><h2>Benvenuto nel Pokédex Nazionale</h2><p>Tutte le specie e tutti i numeri sono disponibili fin dall'inizio. Catalogare è un'attività continua: ogni collocazione corretta aggiunge un Punto Poké e gli errori non sottraggono punti. Completando una regione ottieni un Punto esame.</p><small>SEGRETERIA DIDATTICA</small></div></section><section className="forum-post"><div className="post-icon">📚</div><div><span className="section-label">GUIDA RAPIDA</span><h2>Come funziona la catalogazione</h2><p>Le schede Pokémon sono mescolate e possono essere trascinate sul numero Nazionale corrispondente. Su mobile, seleziona la scheda e poi tocca lo slot. Non ci sono lezioni, turni o sblocchi progressivi.</p><small>MANUALE DELLO STUDENTE</small></div></section></>}
          <footer className="site-footer"><div>© 2026 POKÉ STUDY · PORTALE DIDATTICO FAN-MADE</div><div>PROGETTO NON UFFICIALE · TUTTI I MARCHI AI RISPETTIVI PROPRIETARI</div></footer>
        </section>
      </main>
    </div>
  );
}
