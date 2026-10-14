/**
 * Thin client for the Supabase community Edge Function.
 * No service-role secret belongs in this browser bundle.
 */
export type CommunityAcademy = "arancia" | "uva" | "mirtillo";
export type CommunityCategory = "generale" | "domande" | "strategie" | "annunci";

export interface CommunityIdentity {
  id: string;
  nickname: string;
  academy: CommunityAcademy;
  created_at: string;
}

export interface CommunityAuthor {
  nickname: string;
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
 * Exports the private bearer token as portable metadata. Treat the result like a password:
 * anyone holding it can act as this identity. The metadata must never be posted publicly.
 */
export async function exportCommunityMetadata(gameBackup?: Record<string, unknown>): Promise<string> {
  const token = readToken();
  if (!token) throw new Error("Nessuna identità community da esportare.");
  const identity = await getCommunityIdentity();
  return JSON.stringify({
    format: METADATA_FORMAT,
    version: METADATA_VERSION,
    exportedAt: new Date().toISOString(),
    identity: { id: identity.id, nickname: identity.nickname, academy: identity.academy },
    token,
    ...(gameBackup ? { gameBackup } : {}),
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
  const result = await call<{ identity: CommunityIdentity }>("whoami", {}, record.token);
  saveToken(record.token);
  return result.identity;
}
