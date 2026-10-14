export interface PokemonSpecies {
  id: number;
  name: string;
}

export interface ProgressHistoryEntry {
  id: string;
  timestamp: number;
  kind: 'catalog' | 'error' | 'exam';
  title: string;
  detail: string;
}

export interface SavedProgress {
  points: number;
  completedIds: number[];
  /** Legacy save field retained for compatibility; no longer used by gameplay. */
  examPoints: number;
  completedExams?: string[];
  inventory?: string[];
  completedEntries?: string[];
  /** Unix timestamps in milliseconds; one cooldown per active ability. */
  abilityCooldowns?: Record<string, number>;
  errors?: number;
  history?: ProgressHistoryEntry[];
}

export interface ApiNamedResource {
  name: string;
  url: string;
}

export interface PokemonTypeIndex {
  name: string;
  ids: number[];
}

export interface StudentProfile {
  nickname: string;
  matricola: string;
  avatarId?: number;
}
