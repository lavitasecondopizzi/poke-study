import './student-card.css';
import { ChevronRight } from 'lucide-react';

type StudentCardProps = {
  academy: string;
  academyLabel: string;
  nickname: string;
  matricola: string;
  avatarId?: number;
  onOpen: () => void;
};

const ACADEMY_CRESTS: Record<string, string> = {
  arancia: 'naranja-academy-crest.svg',
  uva: 'uva-academy-crest.svg',
  mirtillo: 'blueberry-academy-crest.png',
};

export default function StudentCard({
  academy,
  academyLabel,
  nickname,
  matricola,
  avatarId,
  onOpen,
}: StudentCardProps) {
  const crest = ACADEMY_CRESTS[academy] ?? ACADEMY_CRESTS.uva;
  const baseUrl = import.meta.env.BASE_URL;
  const avatarUrl = avatarId ? `${baseUrl}images/portraits/${avatarId}.png` : undefined;

  return (
    <button
      type="button"
      className="student-card-refactor"
      onClick={onOpen}
      aria-label={`Apri il profilo studente: matricola ${matricola}`}
      title="Apri il profilo studente"
    >
      <img
        className="student-card-refactor__crest"
        src={`${baseUrl}images/academies/${crest}`}
        alt=""
        aria-hidden="true"
      />
      <span className="student-card-refactor__avatar" aria-hidden="true">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" loading="eager" decoding="async" />
        ) : (
          <span className="student-card-refactor__avatar-fallback">★</span>
        )}
      </span>
      <span className="student-card-refactor__copy">
        <span className="student-card-refactor__eyebrow">PROFILO ALLIEVO</span>
        <strong className="student-card-refactor__nickname">{nickname}</strong>
        <span className="student-card-refactor__matricola">Matricola {matricola}</span>
        <span className="student-card-refactor__academy">{academyLabel}</span>
      </span>
      <ChevronRight className="student-card-refactor__chevron" size={16} aria-hidden="true" />
    </button>
  );
}
