import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Crown, GraduationCap, Medal, RefreshCw, Search, ShieldCheck, Trophy, Users, WifiOff } from 'lucide-react';
import type { CommunityIdentity, CommunityRankingEntry } from './community';
import { listCommunityRanking } from './community';
import type { SavedProgress } from './types';

type AcademyFilter = 'tutte' | 'arancia' | 'uva' | 'mirtillo';

interface LeaderboardProps {
  communityIdentity: CommunityIdentity | null;
  communityConfigured: boolean;
  progress: SavedProgress;
  onConnect: () => void;
}

const ACADEMIES: { value: AcademyFilter; label: string }[] = [
  { value: 'tutte', label: 'Tutte le accademie' },
  { value: 'arancia', label: 'Accademia Arancia' },
  { value: 'uva', label: 'Accademia Uva' },
  { value: 'mirtillo', label: 'Accademia Mirtillo' },
];

const ACADEMY_NAMES: Record<CommunityRankingEntry['academy'], string> = {
  arancia: 'Accademia Arancia',
  uva: 'Accademia Uva',
  mirtillo: 'Accademia Mirtillo',
};

function academyLabel(academy: string) {
  return ACADEMY_NAMES[academy as CommunityRankingEntry['academy']] ?? 'Accademia';
}

function avatarUrl(id: number) {
  return `${import.meta.env.BASE_URL}images/portraits/${id}.png`;
}

function rankLabel(rank: number) {
  if (rank === 1) return '1°';
  if (rank === 2) return '2°';
  if (rank === 3) return '3°';
  return String(rank).padStart(2, '0');
}

function PodiumCard({ entry, position, isCurrent }: { entry: CommunityRankingEntry; position: number; isCurrent: boolean }) {
  const Icon = position === 1 ? Crown : Medal;
  return (
    <article className={`leaderboard-podium-card leaderboard-podium-${position} ${isCurrent ? 'is-current' : ''}`}>
      <div className="leaderboard-podium-rank"><Icon size={18} /><span>{rankLabel(position)} POSTO</span></div>
      <div className="leaderboard-podium-avatar">
        {entry.avatarId ? <img src={avatarUrl(entry.avatarId)} alt="" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} /> : <GraduationCap size={28} />}
      </div>
      <strong className="leaderboard-podium-name">{entry.nickname}</strong>
      <span className="leaderboard-academy-name">{academyLabel(entry.academy)}</span>
      <strong className="leaderboard-podium-score">{entry.points.toLocaleString('it-IT')} <small>PP</small></strong>
      <span className="leaderboard-podium-secondary">{entry.examPoints.toLocaleString('it-IT')} punti esame</span>
    </article>
  );
}

export default function Leaderboard({ communityIdentity, communityConfigured, progress, onConnect }: LeaderboardProps) {
  const [entries, setEntries] = useState<CommunityRankingEntry[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [academyFilter, setAcademyFilter] = useState<AcademyFilter>('tutte');
  const [query, setQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    if (!communityIdentity || !communityConfigured) {
      setEntries([]);
      setTotalPlayers(0);
      setLoading(false);
      setError('');
      return () => { active = false; };
    }
    setLoading(true);
    setError('');
    listCommunityRanking()
      .then(result => {
        if (!active) return;
        setEntries(result.entries);
        setTotalPlayers(result.totalPlayers);
      })
      .catch(reason => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : 'Non è stato possibile caricare la classifica.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [communityIdentity, communityConfigured, refreshKey]);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('it');
    return entries.filter(entry =>
      (academyFilter === 'tutte' || entry.academy === academyFilter)
      && (!normalizedQuery || entry.nickname.toLocaleLowerCase('it').includes(normalizedQuery))
    );
  }, [entries, academyFilter, query]);

  const currentEntry = communityIdentity ? entries.find(entry => entry.id === communityIdentity.id) : undefined;
  const podium = filteredEntries.slice(0, 3);
  const completedPokemonTotal = entries.reduce((sum, entry) => sum + entry.completedPokemon, 0);

  return (
    <>
      <div className="breadcrumb">Home / Comunità / <b>Classifica globale</b></div>
      <header className="leaderboard-hero">
        <div className="leaderboard-hero-copy">
          <span className="eyebrow"><Trophy size={14} /> RISULTATI STUDENTI</span>
          <h1>Classifica globale</h1>
          <p>Confronta i progressi degli allievi delle tre accademie e scopri chi guida il Pokédex Nazionale.</p>
          <div className="leaderboard-hero-tags"><span><ShieldCheck size={14} /> Identità verificate</span><span><Users size={14} /> Aggiornamento online</span></div>
        </div>
        <div className="leaderboard-hero-emblem"><Trophy size={42} /><span>POKÉ<br />RANKING</span></div>
      </header>

      {!communityIdentity ? (
        <section className="leaderboard-connect-panel">
          <div className="leaderboard-connect-icon"><WifiOff size={28} /></div>
          <div>
            <span className="section-label">CLASSIFICA CONDIVISA</span>
            <h2>Collega la tua identità community</h2>
            <p>Per consultare la graduatoria globale devi importare o creare la tua identità verificata. I progressi locali non vengono pubblicati automaticamente e non sono usati per attribuire un posto in classifica.</p>
            <div className="leaderboard-local-stats">
              <div><span>I TUOI PUNTI POKÉ</span><strong>{progress.points.toLocaleString('it-IT')}</strong></div>
              <div><span>PUNTI ESAME</span><strong>{progress.examPoints.toLocaleString('it-IT')}</strong></div>
              <div><span>POKÉMON CATALOGATI</span><strong>{progress.completedIds.length}/1025</strong></div>
            </div>
            <button type="button" className="leaderboard-primary-button" onClick={onConnect}>Vai al profilo e collega l'account <span>›</span></button>
          </div>
        </section>
      ) : !communityConfigured ? (
        <section className="leaderboard-connect-panel">
          <div className="leaderboard-connect-icon"><WifiOff size={28} /></div>
          <div><h2>Servizio online non configurato</h2><p>La classifica condivisa è momentaneamente indisponibile. I tuoi progressi locali restano disponibili.</p></div>
        </section>
      ) : (
        <>
          <section className="leaderboard-stats-grid" aria-label="Statistiche della classifica">
            <article><span><Users size={15} /> ALLIEVI REGISTRATI</span><strong>{totalPlayers.toLocaleString('it-IT')}</strong><small>Identità community</small></article>
            <article><span><Trophy size={15} /> IL TUO POSIZIONAMENTO</span><strong>{currentEntry ? `#${currentEntry.rank}` : '—'}</strong><small>{currentEntry ? `su ${totalPlayers} allievi` : 'Completa una sincronizzazione'}</small></article>
            <article><span><Medal size={15} /> I TUOI PUNTI POKÉ</span><strong>{currentEntry?.points.toLocaleString('it-IT') ?? progress.points.toLocaleString('it-IT')}</strong><small>{currentEntry?.completedPokemon ?? progress.completedIds.length} Pokémon catalogati</small></article>
            <article><span><GraduationCap size={15} /> PUNTI ESAME</span><strong>{currentEntry?.examPoints.toLocaleString('it-IT') ?? progress.examPoints.toLocaleString('it-IT')}</strong><small>Ricompense didattiche</small></article>
          </section>

          <section className="leaderboard-content-panel">
            <div className="leaderboard-section-heading">
              <div><span className="section-label">GRADUATORIA</span><h2>Allievi in classifica</h2><p>Ordinamento: Punti Poké, poi punti esame e Pokémon catalogati.</p></div>
              <button type="button" className="leaderboard-refresh-button" onClick={() => setRefreshKey(value => value + 1)} disabled={loading}><RefreshCw size={15} className={loading ? 'leaderboard-spinning' : ''} /> Aggiorna</button>
            </div>
            <div className="leaderboard-filters">
              <label className="leaderboard-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Cerca nickname…" aria-label="Cerca nickname" /></label>
              <label className="leaderboard-academy-filter"><span>Accademia</span><select value={academyFilter} onChange={event => setAcademyFilter(event.target.value as AcademyFilter)}>{ACADEMIES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            </div>

            {loading && <div className="leaderboard-message"><RefreshCw size={20} className="leaderboard-spinning" /><span>Caricamento della graduatoria online…</span></div>}
            {error && <div className="leaderboard-message leaderboard-message-error" role="alert"><AlertCircle size={20} /><div><strong>Classifica non disponibile</strong><p>{error}</p><button type="button" onClick={() => setRefreshKey(value => value + 1)}>Riprova</button></div></div>}
            {!loading && !error && podium.length > 0 && <div className="leaderboard-podium">{podium.map((entry, index) => <PodiumCard key={entry.id} entry={entry} position={index + 1} isCurrent={entry.id === communityIdentity.id} />)}</div>}
            {!loading && !error && filteredEntries.length > 0 && (
              <div className="leaderboard-table-wrap">
                <table className="leaderboard-table">
                  <thead><tr><th>Pos.</th><th>Allievo</th><th>Accademia</th><th>Punti Poké</th><th>Punti esame</th><th>Pokémon</th></tr></thead>
                  <tbody>{filteredEntries.map((entry, index) => (
                    <tr key={entry.id} className={entry.id === communityIdentity.id ? 'leaderboard-current-row' : ''}>
                      <td><span className={`leaderboard-rank-number ${index < 3 ? `leaderboard-rank-${index + 1}` : ''}`}>{rankLabel(index + 1)}</span></td>
                      <td><div className="leaderboard-player-cell"><span className="leaderboard-player-avatar">{entry.avatarId ? <img src={avatarUrl(entry.avatarId)} alt="" loading="lazy" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} /> : <GraduationCap size={16} />}</span><strong>{entry.nickname}</strong>{entry.id === communityIdentity.id && <span className="leaderboard-you-tag">TU</span>}</div></td>
                      <td><span className={`leaderboard-academy-pill academy-${entry.academy}`}>{academyLabel(entry.academy)}</span></td>
                      <td><strong>{entry.points.toLocaleString('it-IT')}</strong></td>
                      <td>{entry.examPoints.toLocaleString('it-IT')}</td>
                      <td>{entry.completedPokemon.toLocaleString('it-IT')}/1025</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            {!loading && !error && filteredEntries.length === 0 && <div className="leaderboard-empty"><Search size={25} /><strong>Nessun allievo trovato</strong><p>Modifica la ricerca o seleziona un'altra accademia.</p></div>}
            <p className="leaderboard-footnote">La classifica mostra nickname, accademia e progressi di gioco. Non mostra matricole, credenziali o dati privati.</p>
          </section>
          <section className="leaderboard-total-progress"><div><strong>{completedPokemonTotal.toLocaleString('it-IT')}</strong><span>Pokémon catalogati da tutti gli allievi mostrati</span></div><span className="leaderboard-total-progress-mark">#DEX1025</span></section>
        </>
      )}
    </>
  );
}
