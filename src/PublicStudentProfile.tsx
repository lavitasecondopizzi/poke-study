import { useEffect, useState } from 'react';
import { Award, BookOpen, CheckCircle2, Crown, GraduationCap, MessageSquare, ShieldCheck, Sparkles, X } from 'lucide-react';
import { getPublicStudentProfile } from './community';
import type { PublicStudentProfile } from './community';
import type { PokemonSpecies } from './types';

type Props = { identityId: string; species: PokemonSpecies[]; onClose: () => void };

function academyName(academy: string) {
  if (academy === 'arancia') return 'Accademia Arancia';
  if (academy === 'uva') return 'Accademia Uva';
  if (academy === 'mirtillo') return 'Istituto Mirtillo';
  return 'Accademia Pokémon';
}
function crestFile(academy: string) {
  if (academy === 'arancia') return 'naranja-academy-crest.svg';
  if (academy === 'mirtillo') return 'blueberry-academy-crest.png';
  return 'uva-academy-crest.svg';
}
function titleLabel(id: string) {
  const labels: Record<string, string> = {
    'title-first-study': 'Apprendista Pokédex',
    'title-collector': 'Collezionista',
    'title-researcher': 'Ricercatore Pokémon',
    'title-national-expert': 'Esperto Nazionale',
    'title-archive-master': 'Maestro dell’Archivio',
    'title-community-author': 'Voce della Bacheca',
    'title-community-helper': 'Compagno di Studio',
  };
  if (labels[id]) return labels[id];
  if (id.startsWith('title-region-')) return 'Custode di ' + id.slice('title-region-'.length).replace(/^\w/, letter => letter.toUpperCase());
  if (id.startsWith('title-grade-')) return 'Allievo di Grado ' + id.slice('title-grade-'.length);
  return id;
}
function badgeLabel(id: string) {
  const labels: Record<string, string> = {
    'badge-50': 'Collezionista', 'badge-150': 'Ricercatore', 'badge-500': 'Esperto Nazionale',
    'badge-1025': 'Pokédex completo', 'badge-entries-50': 'Catalogatore',
    'badge-community-thread': 'Prima discussione', 'badge-community-replies': 'Punto di riferimento',
  };
  if (labels[id]) return labels[id];
  if (id.startsWith('badge-region-')) return id.slice('badge-region-'.length).replace(/^\w/, letter => letter.toUpperCase());
  return id;
}
function avatarUrl(id: number | null) {
  return import.meta.env.BASE_URL + 'images/portraits/' + (id ?? 1) + '.png';
}

export default function PublicStudentProfile({ identityId, species, onClose }: Props) {
  const [profile, setProfile] = useState<PublicStudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getPublicStudentProfile(identityId)
      .then(data => { if (active) setProfile(data); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Profilo pubblico non disponibile.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [identityId]);

  const favorite = profile?.favoritePokemon ? species.find(item => String(item.id) === profile.favoritePokemon) : undefined;
  return (
    <div className="public-student-profile-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="public-student-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="public-student-profile-title">
        <header className="public-student-profile-heading"><div><span>POKÉ STUDY · COMMUNITY</span><h2 id="public-student-profile-title">Profilo studente</h2></div><button type="button" onClick={onClose} aria-label="Chiudi profilo"><X size={19}/></button></header>
        {loading ? <div className="public-student-profile-state"><span className="pokeball-loader"/><strong>Caricamento del profilo…</strong></div>
          : error || !profile ? <div className="public-student-profile-state is-error"><ShieldCheck size={25}/><strong>Profilo non disponibile</strong><p>{error || 'Questo profilo non è più disponibile.'}</p></div>
          : <div className={'public-student-profile-content profile-frame-' + profile.frame}>
            <div className="public-student-profile-hero">
              <img className="public-student-profile-crest" src={import.meta.env.BASE_URL + 'images/academies/' + crestFile(profile.academy)} alt=""/>
              <img className="public-student-profile-avatar" src={avatarUrl(profile.avatarId)} alt={'Avatar di ' + profile.nickname}/>
              <div><span className="public-student-profile-academy">{academyName(profile.academy)}</span><h3>{profile.nickname}</h3>{profile.matricola && <small>Matricola {profile.matricola}</small>}{profile.activeTitle && <span className="student-profile-title-pill"><Crown size={13}/>{titleLabel(profile.activeTitle)}</span>}</div>
            </div>
            {profile.bio && <section className="public-student-profile-section"><h4><ShieldCheck size={15}/> Presentazione</h4><p>{profile.bio}</p></section>}
            {favorite && <section className="public-student-profile-section"><h4><Sparkles size={15}/> Pokémon preferito</h4><p>#{String(favorite.id).padStart(4,'0')} · {favorite.name.split('-').map(part => part.charAt(0).toLocaleUpperCase('it-IT') + part.slice(1)).join(' ')}</p></section>}
            {profile.motto && <blockquote className="public-student-profile-motto">“{profile.motto}”</blockquote>}
            {profile.badges && profile.badges.length > 0 && <section className="public-student-profile-section"><h4><Award size={15}/> Distintivi</h4><div className="public-student-profile-badges">{profile.badges.slice(0,3).map(id => <span key={id}><Award size={14}/>{badgeLabel(id)}</span>)}</div></section>}
            {profile.catalogStats && <section className="public-student-profile-section"><h4><BookOpen size={15}/> Catalogazione</h4><div className="public-student-profile-stat-grid"><div><strong>{profile.catalogStats.completedPokemon.toLocaleString('it-IT')}</strong><small>Pokémon</small></div><div><strong>{profile.catalogStats.completedEntries.toLocaleString('it-IT')}</strong><small>Altre entità</small></div><div><strong>{profile.catalogStats.points.toLocaleString('it-IT')} ₱</strong><small>Punti Poké</small></div></div></section>}
            {profile.communityStats && <section className="public-student-profile-section"><h4><MessageSquare size={15}/> Attività pubblica</h4><div className="public-student-profile-stat-grid"><div><strong>{profile.communityStats.discussions.toLocaleString('it-IT')}</strong><small>Discussioni</small></div><div><strong>{profile.communityStats.replies.toLocaleString('it-IT')}</strong><small>Risposte</small></div></div></section>}
            <footer className="public-student-profile-footer"><CheckCircle2 size={14}/> Mostra solo le informazioni che lo studente ha scelto di rendere pubbliche.</footer>
          </div>}
      </section>
    </div>
  );
}
