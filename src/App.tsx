import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, CircleHelp, GraduationCap, Menu, RotateCcw, Search, ShoppingBag, Trophy, X } from 'lucide-react';
import type { PokemonSpecies, SavedProgress } from './types';

const API = 'https://pokeapi.co/api/v2/pokemon-species?limit=1025';
const SAVE_KEY = 'poke-study-progress-v1';
const ROUND_SIZE = 6;

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
  const [progress, setProgress] = useState<SavedProgress>(loadProgress);
  const [round, setRound] = useState<PokemonSpecies[]>([]);
  const [order, setOrder] = useState<PokemonSpecies[]>([]);
  const [placed, setPlaced] = useState<Record<number, PokemonSpecies>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState('Trascina ogni Pokémon nello slot con il suo numero Nazionale.');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState('pokedex');
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
        const list = (data.results as { name: string; url: string }[]).map(item => ({
          id: Number(item.url.match(/pokemon-species\/(\d+)/)?.[1] ?? 0),
          name: item.name,
        })).filter(item => item.id > 0);
        setSpecies(list);
        startRound(list);
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

  const startRound = useCallback((pool: PokemonSpecies[]) => {
    const chosen = shuffled(pool).slice(0, ROUND_SIZE).sort((a, b) => a.id - b.id);
    setRound(chosen);
    setOrder(shuffled(chosen));
    setPlaced({});
    setSelected(null);
    setWrongId(null);
    setMessage('Trascina ogni Pokémon nello slot con il suo numero Nazionale.');
  }, []);

  const completedInRound = round.filter(pokemon => placed[pokemon.id]?.id === pokemon.id).length;
  const filteredSpecies = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return species.filter(p => p.name.includes(term) || String(p.id).includes(term)).slice(0, 12);
  }, [species, search]);

  const placePokemon = useCallback((pokemon: PokemonSpecies, slotId: number) => {
    if (placed[pokemon.id]?.id === pokemon.id || placed[slotId]) return;
    if (pokemon.id !== slotId) {
      setWrongId(slotId);
      setMessage(`Non è lo slot corretto per ${titleCase(pokemon.name)}. Riprova: non ci sono penalità.`);
      window.setTimeout(() => setWrongId(current => current === slotId ? null : current), 650);
      return;
    }
    const next = { ...placed, [slotId]: pokemon };
    setPlaced(next);
    setProgress(old => {
      const alreadyCompleted = old.completedIds.includes(pokemon.id);
      const completedIds = alreadyCompleted ? old.completedIds : [...old.completedIds, pokemon.id];
      const points = old.points + (alreadyCompleted ? 0 : 1);
      const examsBefore = regions.filter(region => Array.from({ length: region.end - region.start + 1 }, (_, i) => region.start + i).every(id => old.completedIds.includes(id))).length;
      const examsAfter = regions.filter(region => Array.from({ length: region.end - region.start + 1 }, (_, i) => region.start + i).every(id => completedIds.includes(id))).length;
      return { points, completedIds, examPoints: old.examPoints + Math.max(0, examsAfter - examsBefore) };
    });
    setSelected(null);
    setWrongId(null);
    setMessage(`Corretto! ${titleCase(pokemon.name)} è il Pokémon n. ${pokemon.id}. +1 Punto Poké.`);
  }, [placed]);

  const remaining = order.filter(p => placed[p.id]?.id !== p.id);

  function navTo(next: string) {
    setView(next);
    setMobileMenu(false);
  }

  return (
    <div className="site-shell">
      <div className="utility-bar">
        <span>PORTALE UFFICIALE ALLIEVI · DIPARTIMENTO DI RICERCA POKÉMON</span>
        <span className="utility-right">AREA DIDATTICA <b>● ONLINE</b></span>
      </div>
      <header className="masthead">
        <button className="mobile-toggle" aria-label="Apri menu" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X /> : <Menu />}</button>
        <div className="crest"><GraduationCap size={30} /><span>PS</span></div>
        <div className="brand">
          <div className="brand-kicker">ISTITUTO INTERREGIONALE DI STUDI POKÉMON</div>
          <div className="brand-name">Poké Study <span>✦</span></div>
          <div className="brand-subtitle">Conosci. Cataloga. Diventa Allenatore.</div>
        </div>
        <div className="student-card"><div className="student-avatar">★</div><div><small>PROFILO ALLIEVO</small><strong>Allenatore in formazione</strong><span>Matricola n. 000001</span></div></div>
      </header>
      <nav className={`main-nav ${mobileMenu ? 'nav-open' : ''}`}>
        <button className={view === 'pokedex' ? 'active' : ''} onClick={() => navTo('pokedex')}><BookOpen size={16} /> Pokédex Lab</button>
        <button className={view === 'registro' ? 'active' : ''} onClick={() => navTo('registro')}><Trophy size={16} /> Registro voti</button>
        <button className={view === 'shop' ? 'active' : ''} onClick={() => navTo('shop')}><ShoppingBag size={16} /> Cartoleria</button>
        <button className={view === 'forum' ? 'active' : ''} onClick={() => navTo('forum')}><CircleHelp size={16} /> Bacheca studenti</button>
        <div className="nav-status">ANNO ACCADEMICO 2026/27</div>
      </nav>

      <main className="page-layout">
        <aside className="sidebar">
          <section className="side-box">
            <h2>AREA ALLIEVO</h2>
            <button className={view === 'pokedex' ? 'side-active' : ''} onClick={() => navTo('pokedex')}>▸ Laboratorio Pokédex</button>
            <button className={view === 'registro' ? 'side-active' : ''} onClick={() => navTo('registro')}>▸ Registro personale</button>
            <button className={view === 'shop' ? 'side-active' : ''} onClick={() => navTo('shop')}>▸ Cartoleria punti</button>
          </section>
          <section className="side-box">
            <h2>LIBRETTO PERSONALE</h2>
            <div className="stat-row"><span>Punti Poké</span><strong>{progress.points}</strong></div>
            <div className="stat-row"><span>Punti esame</span><strong>{progress.examPoints}</strong></div>
            <div className="progress-track"><span style={{ width: `${Math.min(100, progress.completedIds.length / Math.max(1, species.length) * 100)}%` }} /></div>
            <small className="muted">{progress.completedIds.length} / {species.length || '…'} specie catalogate</small>
          </section>
          <section className="notice-box"><strong>AVVISO DEL PRESIDE</strong><p>Ogni Pokémon catalogato correttamente vale un Punto Poké. Gli errori sono parte dell'apprendimento: nessuna penalità.</p></section>
          <div className="side-footer">POKÉ STUDY v0.1<br />Un progetto fan-made.</div>
        </aside>

        <section className="content">
          {view === 'pokedex' && <>
            <div className="breadcrumb">Home / Area didattica / <b>Pokédex Lab</b></div>
            <div className="page-heading"><div><div className="eyebrow">LABORATORIO DI RICERCA · ESERCITAZIONE 01</div><h1>Riordina il Pokédex Nazionale</h1><p>Osserva i Pokémon, studiali e trascinali nel loro numero corretto.</p></div><div className="heading-stamp">LEZIONE<br /><b>N. 001</b></div></div>
            <div className="dashboard-strip">
              <div><span>SPECIE CATALOGATE</span><strong>{progress.completedIds.length.toLocaleString('it-IT')} <small>/ {species.length.toLocaleString('it-IT') || '—'}</small></strong></div>
              <div><span>PUNTI POKÉ</span><strong>{progress.points.toLocaleString('it-IT')}</strong></div>
              <div><span>PUNTI ESAME</span><strong>{progress.examPoints.toLocaleString('it-IT')}</strong></div>
            </div>
            {loadError ? <div className="error-panel"><h3>Archivio non raggiungibile</h3><p>{loadError}</p><button className="primary-button" onClick={() => window.location.reload()}>Riprova</button></div> : loading ? <div className="loading-panel"><div className="pokeball-loader" /><h3>Consultazione archivio nazionale…</h3><p>Stiamo caricando l'indice delle specie Pokémon.</p></div> : <>
              <div className="lab-toolbar"><div><span className="section-label">ESERCITAZIONE IN CORSO</span><strong>Fase di catalogazione</strong></div><button className="secondary-button" onClick={() => startRound(species)}><RotateCcw size={15} /> Nuovo esercizio</button></div>
              <div className="instructions"><span className="info-icon">i</span><p><b>Come si gioca</b><br />Trascina una scheda Pokémon sullo slot con il suo numero Nazionale. Su telefono o tablet, tocca prima la scheda e poi lo slot.</p></div>
              <div className="challenge-board">
                <div className="board-header"><div><span className="section-label">BANCO DI CATALOGAZIONE</span><h2>Assegna il numero corretto</h2></div><div className="round-count">{completedInRound} / {round.length} <span>completati</span></div></div>
                <div className="pokemon-cards">
                  {remaining.map(pokemon => <button key={pokemon.id} className={`pokemon-card ${selected === pokemon.id ? 'chosen' : ''}`} draggable onDragStart={event => event.dataTransfer.setData('text/plain', String(pokemon.id))} onClick={() => { setSelected(pokemon.id); setMessage(`Selezionato ${titleCase(pokemon.name)}: scegli lo slot corretto.`); }}>
                    <img src={spriteUrl(pokemon.id)} alt="" loading="lazy" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />
                    <span className="pokemon-name">{titleCase(pokemon.name)}</span><span className="pokemon-prompt">TRASCINA O SELEZIONA</span>
                  </button>)}
                  {remaining.length === 0 && <div className="round-complete"><div className="success-seal">✓</div><h3>Esercitazione completata!</h3><p>Hai catalogato correttamente tutti i Pokémon di questo turno.</p><button className="primary-button" onClick={() => startRound(species)}>Prossimo esercizio →</button></div>}
                </div>
                <div className={`feedback-bar ${message.startsWith('Corretto') ? 'feedback-success' : wrongId !== null ? 'feedback-error' : ''}`} role="status">{message}</div>
                <div className="slots-grid">
                  {round.map(pokemon => <div key={pokemon.id} className={`dex-slot ${placed[pokemon.id] ? 'slot-filled' : ''} ${wrongId === pokemon.id ? 'slot-wrong' : ''}`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const id = Number(event.dataTransfer.getData('text/plain')); const dragged = round.find(item => item.id === id); if (dragged) placePokemon(dragged, pokemon.id); }} onClick={() => { if (selected !== null) { const chosen = round.find(item => item.id === selected); if (chosen) placePokemon(chosen, pokemon.id); } }}>
                    <span className="slot-number">N. {String(pokemon.id).padStart(4, '0')}</span>
                    {placed[pokemon.id] ? <><img src={spriteUrl(pokemon.id)} alt="" /><strong>{titleCase(pokemon.name)}</strong><span className="slot-check">CATALOGATO ✓</span></> : <><div className="slot-placeholder">?</div><strong>Slot da completare</strong><span className="slot-check">RILASCIA QUI</span></>}
                  </div>)}
                </div>
              </div>
              <section className="archive-search"><div><span className="section-label">ARCHIVIO NAZIONALE</span><h2>Consulta l'indice delle specie</h2><p>Cerca una specie per nome o numero nel catalogo.</p></div><div className="search-wrap"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Es. Pikachu o 25" aria-label="Cerca Pokémon" /></div>{search.trim() && <div className="search-results">{filteredSpecies.map(p => <div key={p.id} className="search-result"><span className="search-id">N. {String(p.id).padStart(4, '0')}</span><img src={spriteUrl(p.id)} alt="" loading="lazy" /><span>{titleCase(p.name)}</span></div>)}{filteredSpecies.length === 0 && <p>Nessuna specie trovata.</p>}</div>}</section>
            </>}
          </>}
          {view === 'registro' && <><div className="breadcrumb">Home / Area didattica / <b>Registro personale</b></div><div className="page-heading"><div><div className="eyebrow">SEGRETERIA DIDATTICA</div><h1>Registro personale</h1><p>Il riepilogo dei progressi nel percorso di catalogazione.</p></div></div><div className="dashboard-strip"><div><span>PUNTI POKÉ</span><strong>{progress.points}</strong></div><div><span>PUNTI ESAME</span><strong>{progress.examPoints}</strong></div><div><span>SPECIE CATALOGATE</span><strong>{progress.completedIds.length}</strong></div></div><section className="archive-search"><h2>Avanzamento per regione</h2>{regions.map(region => { const count = progress.completedIds.filter(id => id >= region.start && id <= region.end).length; const total = region.end - region.start + 1; return <div className="region-progress" key={region.name}><div><b>{region.name}</b><span>{count} / {total}</span></div><div className="progress-track"><span style={{ width: `${count / total * 100}%` }} /></div>{count === total && <small className="exam-earned">Punto esame ottenuto</small>}</div>})}<button className="secondary-button reset-button" onClick={() => { if (window.confirm('Vuoi azzerare punteggio e progressi salvati su questo dispositivo?')) { setProgress({ points: 0, completedIds: [], examPoints: 0 }); startRound(species); } }}>Azzera progressi</button></section></>}
          {view === 'shop' && <><div className="breadcrumb">Home / Servizi / <b>Cartoleria punti</b></div><div className="page-heading"><div><div className="eyebrow">SERVIZI STUDENTI</div><h1>Cartoleria punti</h1><p>Qui potrai spendere i Punti Poké per strumenti e i Punti esame per super-aiuti.</p></div></div><div className="empty-service"><ShoppingBag size={34} /><h2>Catalogo in allestimento</h2><p>La cartoleria verrà attivata con il prossimo aggiornamento. I tuoi punti sono già registrati.</p><div className="currency-pills"><span>{progress.points} Punti Poké</span><span>{progress.examPoints} Punti esame</span></div></div></>}
          {view === 'forum' && <><div className="breadcrumb">Home / Comunità / <b>Bacheca studenti</b></div><div className="page-heading"><div><div className="eyebrow">COMUNITÀ SCOLASTICA</div><h1>Bacheca studenti</h1><p>Avvisi e appunti del laboratorio Pokémon.</p></div></div><section className="forum-post"><div className="post-icon">📌</div><div><span className="section-label">AVVISO DEL PRESIDE · 14/10/2026</span><h2>Benvenuto nel Pokédex Lab</h2><p>Catalogare è il primo passo per conoscere. Ogni risposta corretta aggiunge un Punto Poké; gli errori non sottraggono punti. Completa una regione del Pokédex per ottenere un Punto esame.</p><small>SEGRETERIA DIDATTICA</small></div></section><section className="forum-post"><div className="post-icon">📚</div><div><span className="section-label">GUIDA RAPIDA</span><h2>Come funziona la catalogazione</h2><p>Trascina una scheda sul numero Nazionale corrispondente. Su mobile, seleziona la scheda e poi tocca lo slot. Puoi tentare quante volte vuoi.</p><small>MANUALE DELLO STUDENTE</small></div></section></>}
          <footer className="site-footer"><div>© 2026 POKÉ STUDY · PORTALE DIDATTICO FAN-MADE</div><div>PROGETTO NON UFFICIALE · TUTTI I MARCHI AI RISPETTIVI PROPRIETARI</div></footer>
        </section>
      </main>
    </div>
  );
}
