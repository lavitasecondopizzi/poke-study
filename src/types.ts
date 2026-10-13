export interface PokemonSpecies {
  id: number;
  name: string;
}

export interface SavedProgress {
  points: number;
  completedIds: number[];
  examPoints: number;
  completedExams?: string[];
  inventory?: string[];
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
