import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, Crown, GraduationCap, Medal, RefreshCw, Search,
  ShieldCheck, Trophy, Users, WifiOff,
} from 'lucide-react';
import type { CommunityIdentity, CommunityRankingEntry } from './community';
import { listCommunityRanking } from './community';
import type { SavedProgress } from './types';
import { loadAcademyCurriculum } from './academy';
import type { AcademyPointsSummary } from './academy';
import './academy.css';

type AcademyFilter = 'tutte' | 'arancia' | 'uva' | 'mirtillo';

interface LeaderboardProps {
  academy: string;
  academyName: string;
  communityIdentity: CommunityIdentity | null;
  communityConfigured: boolean;
  progress: SavedProgress;
  onConnect: () => void;
}

const ACADEMIES: { value: AcademyFilter; label: string }[] = [
  { value: 'tutte', label: 'Tutte le accademie' },
  { value: 'arancia', label: 'Accademia Arancia' },
  { value: 'uva', label: 'Accademia Uva' },
  { value: 'mirtillo', label: 'Istituto Mirtillo' },
];

const ACADEMY_NAMES: Record<CommunityRankingEntry['academy'], string> = {
  arancia: 'Accademia Arancia',
  uva: 'Accademia Uva',
  mirtillo: 'Istituto Mirtillo',
};

const ACADEMY_CRESTS: Record<string, string> = {
  arancia: 'naranja-academy-crest.svg',
  uva: 'uva-academy-crest.svg',
  mirtillo: 'blueberry-academy-crest.png',
};

function academyLabel(academy: string) {
  return ACADEMY_NAMES[academy as CommunityRankingEntry['academy']] ?? 'Accademia Pokémon';
}

function crestUrl(academy: string) {
  return `${import.meta.env.BASE_URL}images/academies/${ACADEMY_CRESTS[academy] ?? ACADEMY_CRESTS.uva}`;
}

function avatarUrl(id: number) {
  return `${import.meta.env.BASE_URL}images/portraits/${id}.png`;
}

function rankLabel(rank: number) {
  return rank <= 3 ? `${rank}°` : String(rank).padStart(2, '0');
}

function PlayerAvatar({ avatarId, nickname, large = false }: { avatarId: number | null; nickname: string; large?: boolean }) {
  return (
    <span className={large ? 'leaderboard-avatar leaderboard-avatar-large' : 'leaderboard-avatar'}>
      {avatarId
        ? <img src={avatarUrl(avatarId)} alt={`Avatar di ${nickname}`} loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} />
        : <GraduationCap aria-hidden="true" size={large ? 27 : 17} />}
    </span>
  );
}

function AcademyBadge({ academy }: { academy: CommunityRankingEntry['academy'] }) {
  return <span className={`leaderboard-academy-badge academy-badge-${academy}`}>{academyLabel(academy)}</span>;
}

function PodiumCard({ entry, position, isCurrent }: { entry: CommunityRankingEntry; position: number; isCurrent: boolean }) {
  const Icon = position === 1 ? Crown : Medal;
  return (
    <article className={`leaderboard-podium-card leaderboard-podium-${position}${isCurrent ? ' is-current' : ''}`}>
      <div className="leaderboard-podium-position"><Icon size={17} aria-hidden="true" /><span>{rankLabel(position)} POSTO</span></div>
      <PlayerAvatar avatarId={entry.avatarId} nickname={entry.nickname} large />
      <strong className="leaderboard-podium-name">{entry.nickname}</strong>
      <AcademyBadge academy={entry.academy} />
      <strong className="leaderboard-podium-score">{entry.points.toLocaleString('it-IT')} <small>PP</small></strong>
      <span className="leaderboard-podium-exams">{entry.examPoints.toLocaleString('it-IT')} punti esame</span>
      {isCurrent && <span className="leaderboard-you-tag">LA TUA POSIZIONE</span>}
    </article>
  );
}

function RankingTable({ entries, currentIdentityId }: { entries: CommunityRankingEntry[]; currentIdentityId: string }) {
  return (
    <div className="leaderboard-table-wrap">
      <table className="leaderboard-table">
        <thead><tr><th scope="col">Pos.</th><th scope="col">Allievo</th><th scope="col">Accademia</th><th scope="col">Punti Poké</th><th scope="col">Punti esame</th><th scope="col">Pokémon</th></tr></thead>
        <tbody>{entries.map(entry => (
          <tr key={entry.id} className={entry.id === currentIdentityId ? 'leaderboard-current-row' : undefined}>
            <td><span className={`leaderboard-rank-number leaderboard-rank-${entry.rank <= 3 ? entry.rank : 'other'}`}>{rankLabel(entry.rank)}</span></td>
            <td>
              <div className="leaderboard-player-cell">
                <PlayerAvatar avatarId={entry.avatarId} nickname={entry.nickname} />
                <strong>{entry.nickname}</strong>
                {entry.id === currentIdentityId && <span className="leaderboard-you-tag">TU</span>}
              </div>
            </td>
            <td><AcademyBadge academy={entry.academy} /></td>
            <td><strong>{entry.points.toLocaleString('it-IT')}</strong></td>
            <td>{entry.examPoints.toLocaleString('it-IT')}</td>
            <td>{entry.completedPokemon.toLocaleString('it-IT')}/1025</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function LocalProgressPanel({ progress, onConnect }: { progress: SavedProgress; onConnect: () => void }) {
  return (
    <section className="leaderboard-connect-panel">
      <div className="leaderboard-connect-icon"><WifiOff size={27} aria-hidden="true" /></div>
      <div className="leaderboard-connect-content">
        <span className="leaderboard-section-label">CLASSIFICA CONDIVISA</span>
        <h2>Collega la tua identità community</h2>
        <p>Collega l’identità online per entrare in classifica.</p>
        <div className="leaderboard-local-stats">
          <div><span>I TUOI PUNTI POKÉ</span><strong>{progress.points.toLocaleString('it-IT')}</strong></div>
          <div><span>PUNTI ESAME</span><strong>{progress.examPoints.toLocaleString('it-IT')}</strong></div>
          <div><span>POKÉMON CATALOGATI</span><strong>{progress.completedIds.length}/1025</strong></div>
        </div>
        <button type="button" className="leaderboard-primary-button" onClick={onConnect}>Vai al profilo <span aria-hidden="true">›</span></button>
      </div>
    </section>
  );
}

export default function Leaderboard({
  academy, academyName: currentAcademyName, communityIdentity, communityConfigured, progress, onConnect,
}: LeaderboardProps) {
  const [entries, setEntries] = useState<CommunityRankingEntry[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [academyFilter, setAcademyFilter] = useState<AcademyFilter>('tutte');
  const [query, setQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [academicPoints, setAcademicPoints] = useState<AcademyPointsSummary | null>(null);
  const [academicPointsError, setAcademicPointsError] = useState('');

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

  useEffect(() => {
    let active = true;
    if (!communityIdentity || !communityConfigured) {
      setAcademicPoints(null);
      setAcademicPointsError('');
      return () => { active = false; };
    }
    loadAcademyCurriculum()
      .then(data => {
        if (active) {
          setAcademicPoints(data.points);
          setAcademicPointsError('');
        }
      })
      .catch(reason => {
        if (active) setAcademicPointsError(reason instanceof Error ? reason.message : 'Punteggio delle accademie non disponibile.');
      });
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
    <div className={`leaderboard-page academy-theme-${academy}`}>
      <div className="breadcrumb">Home / Comunità / <b>Classifica globale</b></div>

      <header className="leaderboard-hero">
        <div className="leaderboard-hero-copy">
          <span className="leaderboard-eyebrow"><Trophy size={14} aria-hidden="true" /> PORTALE UFFICIALE · CLASSIFICHE</span>
          <h1>Classifica globale</h1>
          <p>I progressi degli allievi, in un’unica classifica.</p>
          <div className="leaderboard-hero-tags">
            <span><ShieldCheck size={14} aria-hidden="true" /> Identità verificate</span>
            <span><Users size={14} aria-hidden="true" /> Graduatoria online</span>
          </div>
        </div>
        <div className="leaderboard-hero-academy">
          <img src={crestUrl(academy)} alt={`Stemma ${currentAcademyName}`} />
          <span>{currentAcademyName}</span>
          <small>ANNO ACCADEMICO 2026/27</small>
        </div>
      </header>

      <section className="academy-content-card academy-campus-points leaderboard-campus-points">
        <div className="academy-campus-points-heading">
          <div><span className="academy-eyebrow">PUNTI ACCADEMICI</span><h2>Classifica delle accademie</h2></div>
          {academicPoints && <div className="academy-student-points"><span>Il tuo saldo</span><strong>{academicPoints.studentPoints}</strong></div>}
        </div>
        <p>I punti ottenuti nelle prove contribuiscono al punteggio complessivo del campus.</p>
        {!communityIdentity
          ? <p className="leaderboard-campus-note">Collega il tuo profilo per visualizzare la classifica accademica.</p>
          : academicPointsError
            ? <p className="leaderboard-campus-note">{academicPointsError}</p>
            : !academicPoints
              ? <p className="leaderboard-campus-note">Caricamento della classifica accademica…</p>
              : <ol className="academy-campus-ranking">
                  {academicPoints.campusRanking.map((campus, index) => (
                    <li key={campus.academy} className={academicPoints.studentAcademy === campus.academy ? 'is-own-campus' : ''}>
                      <span className="academy-ranking-position">{index + 1}</span>
                      <span className="academy-ranking-name">{campus.title}{academicPoints.studentAcademy === campus.academy && <small>Il tuo campus</small>}</span>
                      <strong>{campus.points} pt</strong>
                    </li>
                  ))}
                </ol>}
      </section>

      {!communityIdentity ? (
        <LocalProgressPanel progress={progress} onConnect={onConnect} />
      ) : !communityConfigured ? (
        <section className="leaderboard-state-panel">
          <WifiOff size={25} aria-hidden="true" />
          <div><h2>Servizio online non configurato</h2><p>La classifica condivisa è momentaneamente indisponibile. I tuoi progressi locali restano disponibili.</p></div>
        </section>
      ) : (
        <>
          <section className="leaderboard-stats-grid" aria-label="Statistiche della classifica">
            <article className="leaderboard-stat-card"><span><Users size={15} aria-hidden="true" /> ALLIEVI REGISTRATI</span><strong>{totalPlayers.toLocaleString('it-IT')}</strong><small>Identità community</small></article>
            <article className="leaderboard-stat-card"><span><Trophy size={15} aria-hidden="true" /> IL TUO POSIZIONAMENTO</span><strong>{currentEntry ? `#${currentEntry.rank}` : '—'}</strong><small>{currentEntry ? `su ${totalPlayers} allievi` : 'In attesa di sincronizzazione'}</small></article>
            <article className="leaderboard-stat-card"><span><Medal size={15} aria-hidden="true" /> I TUOI PUNTI POKÉ</span><strong>{currentEntry?.points.toLocaleString('it-IT') ?? progress.points.toLocaleString('it-IT')}</strong><small>{currentEntry?.completedPokemon ?? progress.completedIds.length} Pokémon catalogati</small></article>
            <article className="leaderboard-stat-card"><span><GraduationCap size={15} aria-hidden="true" /> PUNTI ESAME</span><strong>{currentEntry?.examPoints.toLocaleString('it-IT') ?? progress.examPoints.toLocaleString('it-IT')}</strong><small>Ricompense didattiche</small></article>
          </section>

          <section className="leaderboard-content-panel">
            <div className="leaderboard-section-heading">
              <div><span className="leaderboard-section-label">GRADUATORIA UFFICIALE</span><h2>Allievi in classifica</h2></div>
              <button type="button" className="leaderboard-refresh-button" onClick={() => setRefreshKey(value => value + 1)} disabled={loading} aria-label="Aggiorna classifica">
                <RefreshCw size={15} className={loading ? 'leaderboard-spinning' : ''} aria-hidden="true" /> <span>Aggiorna</span>
              </button>
            </div>

            <div className="leaderboard-filters">
              <label className="leaderboard-search"><Search size={16} aria-hidden="true" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Cerca nickname…" aria-label="Cerca nickname" /></label>
              <label className="leaderboard-academy-filter"><span>Accademia</span><select value={academyFilter} onChange={event => setAcademyFilter(event.target.value as AcademyFilter)}>{ACADEMIES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            </div>

            {loading && <div className="leaderboard-message" role="status"><RefreshCw size={20} className="leaderboard-spinning" aria-hidden="true" /><span>Caricamento della graduatoria online…</span></div>}
            {error && <div className="leaderboard-message leaderboard-message-error" role="alert"><AlertCircle size={20} aria-hidden="true" /><div><strong>Classifica non disponibile</strong><p>{error}</p><button type="button" onClick={() => setRefreshKey(value => value + 1)}>Riprova</button></div></div>}

            {!loading && !error && podium.length > 0 && <div className="leaderboard-podium" aria-label="Podio dei primi classificati">{podium.map((entry, index) => <PodiumCard key={entry.id} entry={entry} position={index + 1} isCurrent={entry.id === communityIdentity.id} />)}</div>}
            {!loading && !error && filteredEntries.length > 0 && <RankingTable entries={filteredEntries} currentIdentityId={communityIdentity.id} />}
            {!loading && !error && filteredEntries.length === 0 && <div className="leaderboard-empty"><Search size={25} aria-hidden="true" /><strong>Nessun allievo trovato</strong><p>Prova un’altra ricerca.</p></div>}

            
          </section>

          <section className="leaderboard-total-progress"><div><strong>{completedPokemonTotal.toLocaleString('it-IT')}</strong><span>Pokémon catalogati complessivamente</span></div><span className="leaderboard-total-progress-mark">POKÉDEX NAZIONALE · 1025</span></section>
        </>
      )}
    </div>
  );
}
