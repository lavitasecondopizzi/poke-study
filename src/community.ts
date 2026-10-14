/**
 * Thin client for the Supabase Edge Function.
 * Account identity and all authoritative player data live in the database.
 * No service-role secret belongs in this browser bundle.
 */
import type { SavedProgress, StudentProfile } from "./types";
export type CommunityAcademy = "arancia" | "uva" | "mirtillo";
export type CommunityCategory = "generale" | "domande" | "strategie" | "annunci";

export interface CommunityIdentity {
  id: string;
  nickname: string;
  academy: CommunityAcademy;
  matricola: string;
  created_at: string;
}

export interface CommunityAuthor {
  id?: string;
  matricola: string;
  academy: CommunityAcademy;
}

export interface CommunityPost {
  id: string;
  thread_id?: string;
  body: string;
  created_at: string;
  author?: CommunityAuthor;
}

export interface CommunityThread {
  id: string;
  title: string;
  body: string;
  category: CommunityCategory;
  created_at: string;
  updated_at: string;
  author?: CommunityAuthor;
  posts?: CommunityPost[];
}

interface CommunityResponse<T> {
  data?: T;
  error?: string;
}

const TOKEN_KEY = "poke-study-community-token-v1";
const METADATA_FORMAT = "poke-study-community-account";
const METADATA_VERSION = 1;

export interface PublicStudentProfile {
  id: string;
  matricola: string;
  academy: CommunityAcademy;
  avatarId: number | null;
  bio?: string;
  favoritePokemon?: string;
  motto?: string;
  activeTitle?: string;
  badges?: string[];
  frame: string;
  catalogStats?: { completedPokemon: number; completedEntries: number; points: number };
  communityStats?: { discussions: number; replies: number };
  academicGrade?: number;
}

export interface CommunityPublicActivity {
  discussions: number;
  replies: number;
}

export interface CommunityRankingEntry {
  id: string;
  rank: number;
  matricola: string;
  academy: CommunityAcademy;
  avatarId: number | null;
  points: number;
  examPoints: number;
  completedPokemon: number;
  completedEntries: number;
  updatedAt: string | null;
}

export interface CommunityRankingResponse {
  entries: CommunityRankingEntry[];
  totalPlayers: number;
}

export interface CommunityPlayerState {
  profile: Pick<StudentProfile, "matricola" | "avatarId" | "profileSettings"> | null;
  progress: SavedProgress | null;
  updatedAt: string | null;
}

let pendingPlayerStateWrite: Promise<void> = Promise.resolve();

function configuration() {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, "");
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  return url && anonKey ? { url, anonKey } : null;
}

export function isCommunityConfigured(): boolean {
  return configuration() !== null;
}

export function hasCommunityToken(): boolean {
  try {
    return Boolean(localStorage.getItem(TOKEN_KEY));
  } catch {
    return false;
  }
}

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function saveToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    throw new Error("Impossibile salvare il token community in questo browser.");
  }
}

async function call<T>(action: string, payload: Record<string, unknown> = {}, token?: string): Promise<T> {
  const config = configuration();
  if (!config) throw new Error("Community non configurata: imposta VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
  const response = await fetch(`${config.url}/functions/v1/community`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
    },
    body: JSON.stringify({ action, ...payload, ...(token ? { token } : {}) }),
  });
  const result = await response.json().catch(() => ({})) as CommunityResponse<T>;
  if (!response.ok) throw new Error(result.error || `Errore community (${response.status}).`);
  return result as T;
}

export async function createCommunityIdentity(nickname: string, academy: CommunityAcademy) {
  const result = await call<{ identity: CommunityIdentity; token: string }>("create_identity", { nickname, academy });
  if (!/^[a-f0-9]{64}$/.test(result.token) || !result.identity?.id) {
    throw new Error("Il servizio ha restituito un'identità non valida.");
  }
  saveToken(result.token);
  return result.identity;
}

export async function getCommunityIdentity(): Promise<CommunityIdentity> {
  const token = readToken();
  if (!token) throw new Error("Nessuna identità community importata o registrata.");
  const result = await call<{ identity: CommunityIdentity }>("whoami", {}, token);
  return result.identity;
}

export async function loadCommunityPlayerState(): Promise<CommunityPlayerState> {
  const token = readToken();
  if (!token) throw new Error("Registra o importa prima la tua identità community.");
  return await call<CommunityPlayerState>("load_player_state", {}, token);
}

/** Serialize writes so a slower older request cannot overwrite a newer snapshot. */
export async function saveCommunityPlayerState(profile: StudentProfile, progress: SavedProgress): Promise<void> {
  const token = readToken();
  if (!token) throw new Error("Nessuna identità community disponibile per salvare i progressi.");
  const snapshot = {
    profile: { avatarId: profile.avatarId ?? null, ...(profile.profileSettings ? { profileSettings: profile.profileSettings } : {}) },
    progress,
  };
  const write = pendingPlayerStateWrite.then(async () => {
    await call<{ saved: boolean }>("save_player_state", snapshot, token);
  });
  pendingPlayerStateWrite = write.catch(() => undefined);
  await write;
}

export async function getPublicStudentProfile(identityId: string): Promise<PublicStudentProfile> {
  const token = readToken();
  if (!token) throw new Error("Registra o importa prima la tua identità community.");
  return await call<PublicStudentProfile>("get_public_profile", { identityId }, token);
}

export async function getCommunityPublicActivity(): Promise<CommunityPublicActivity> {
  const token = readToken();
  if (!token) throw new Error("Registra o importa prima la tua identità community.");
  return await call<CommunityPublicActivity>("get_my_public_activity", {}, token);
}

export async function listCommunityThreads(): Promise<CommunityThread[]> {
  const token = readToken();
  if (!token) throw new Error("Registra o importa prima la tua identità community.");
  const result = await call<{ threads: CommunityThread[] }>("list_threads", {}, token);
  return result.threads;
}

export async function createCommunityThread(input: {
  title: string;
  body: string;
  category: CommunityCategory;
}): Promise<CommunityThread> {
  const token = readToken();
  if (!token) throw new Error("Registra o importa prima la tua identità community.");
  const result = await call<{ thread: CommunityThread }>("create_thread", input, token);
  return result.thread;
}

export async function createCommunityReply(threadId: string, body: string): Promise<CommunityPost> {
  const token = readToken();
  if (!token) throw new Error("Registra o importa prima la tua identità community.");
  const result = await call<{ post: CommunityPost }>("create_reply", { threadId, body }, token);
  return result.post;
}

/**
 * Exports only the account reference and its private bearer credential.
 * The token is equivalent to a password: keep the file private and never publish it.
 * Profile details and game progress are fetched from Supabase after identity verification.
 */
export async function exportCommunityMetadata(): Promise<string> {
  const token = readToken();
  if (!token) throw new Error("Nessuna identità community da esportare.");
  const identity = await getCommunityIdentity();
  return JSON.stringify({
    format: METADATA_FORMAT,
    version: METADATA_VERSION,
    identityId: identity.id,
    token,
  }, null, 2);
}

/** Validates the imported token against the server before replacing the local identity. */
export async function importCommunityMetadata(serialized: string): Promise<CommunityIdentity> {
  let metadata: unknown;
  try {
    metadata = JSON.parse(serialized);
  } catch {
    throw new Error("Il file dei metadati non contiene JSON valido.");
  }
  if (!metadata || typeof metadata !== "object") throw new Error("Metadati account non validi.");
  const record = metadata as Record<string, unknown>;
  if (record.format !== METADATA_FORMAT || record.version !== METADATA_VERSION
    || typeof record.token !== "string" || !/^[a-f0-9]{64}$/.test(record.token)) {
    throw new Error("Formato dei metadati account non supportato.");
  }
  // Accept old exports, but never trust identity fields supplied by the file.
  const legacyIdentity = record.identity && typeof record.identity === "object"
    ? (record.identity as Record<string, unknown>).id
    : null;
  const expectedIdentityId = typeof record.identityId === "string" ? record.identityId : legacyIdentity;
  const result = await call<{ identity: CommunityIdentity }>("whoami", {}, record.token);
  if (typeof expectedIdentityId === "string" && result.identity.id !== expectedIdentityId) {
    throw new Error("Il riferimento dell'account non corrisponde alla credenziale verificata dal server.");
  }
  saveToken(record.token);
  return result.identity;
}


/** Fetches the public leaderboard through the server-verified community identity. */
export async function listCommunityRanking(): Promise<CommunityRankingResponse> {
  const token = readToken();
  if (!token) throw new Error("Registra o importa prima la tua identità community per consultare la classifica.");
  return await call<CommunityRankingResponse>("list_leaderboard", {}, token);
}


/** Calls the academic Edge Function with the existing verified private account token. */
export async function callAcademyService<T>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const config = configuration();
  if (!config) throw new Error("Servizio accademico non configurato: imposta VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
  const token = readToken();
  if (!token) throw new Error("Importa o verifica prima la tua identità online dal Profilo.");
  const response = await fetch(`${config.url}/functions/v1/academy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
    },
    body: JSON.stringify({ action, ...payload, token }),
  });
  const result = await response.json().catch(() => ({})) as CommunityResponse<T>;
  if (!response.ok) throw new Error(result.error || `Errore accademico (${response.status}).`);
  return result as T;
}
