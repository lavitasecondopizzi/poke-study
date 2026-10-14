import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const categories = new Set(["generale", "domande", "strategie", "annunci"]);
type Academy = "arancia" | "uva" | "mirtillo";

const STARTER_AVATAR_IDS = new Set([1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393, 495, 498, 501, 650, 653, 656, 722, 725, 728, 810, 813, 816, 906, 909, 912]);
const NATIONAL_DEX_SIZE = 1025;

function normalizePlayerProgress(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const count = (candidate: unknown) => typeof candidate === "number" && Number.isSafeInteger(candidate) && candidate >= 0 && candidate <= 1_000_000_000 ? candidate : null;
  const strings = (candidate: unknown, maxLength: number) => {
    if (!Array.isArray(candidate) || candidate.length > 5000) return null;
    if (!candidate.every(item => typeof item === "string" && item.length > 0 && item.length <= maxLength)) return null;
    return [...new Set(candidate as string[])];
  };
  if (!Array.isArray(raw.completedIds) || raw.completedIds.length > NATIONAL_DEX_SIZE
    || !raw.completedIds.every(id => Number.isInteger(id) && Number(id) >= 1 && Number(id) <= NATIONAL_DEX_SIZE)) return null;
  const points = count(raw.points);
  const examPoints = count(raw.examPoints);
  const completedExams = strings(raw.completedExams ?? [], 100);
  const inventory = strings(raw.inventory ?? [], 120);
  const completedEntries = strings(raw.completedEntries ?? [], 180);
  if (points === null || examPoints === null || !completedExams || !inventory || !completedEntries) return null;
  const cooldowns: Record<string, number> = {};
  if (raw.abilityCooldowns !== undefined) {
    if (!raw.abilityCooldowns || typeof raw.abilityCooldowns !== "object" || Array.isArray(raw.abilityCooldowns)) return null;
    for (const [key, until] of Object.entries(raw.abilityCooldowns as Record<string, unknown>)) {
      if ((key !== "scanner" && key !== "research") || typeof until !== "number" || !Number.isSafeInteger(until) || until < 0) return null;
      cooldowns[key] = until;
    }
  }
  return {
    points,
    completedIds: [...new Set(raw.completedIds as number[])],
    examPoints,
    completedExams,
    inventory,
    completedEntries,
    abilityCooldowns: cooldowns,
  };
}

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function cleanText(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length >= min && cleaned.length <= max ? cleaned : null;
}

function normalizeProfileSettings(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const textField = (key: string, max: number) => {
    const candidate = raw[key];
    return typeof candidate === "string" && candidate.length <= max ? candidate.trim() : null;
  };
  const bio = textField("bio", 180);
  const favoritePokemon = textField("favoritePokemon", 60);
  const motto = textField("motto", 90);
  const activeTitle = textField("activeTitle", 80);
  if (bio === null || favoritePokemon === null || motto === null || activeTitle === null) return null;
  const frames = new Set(["academy", "research", "archive", "expert", "master"]);
  if (typeof raw.frame !== "string" || !frames.has(raw.frame)) return null;
  if (!Array.isArray(raw.badges) || raw.badges.length > 3
    || !raw.badges.every(item => typeof item === "string" && item.length > 0 && item.length <= 80)) return null;
  const visibilityKeys = ["bio", "favoritePokemon", "motto", "activeTitle", "badges", "catalogStats", "communityStats", "matricola"];
  if (!raw.visibility || typeof raw.visibility !== "object" || Array.isArray(raw.visibility)) return null;
  const visibilityRaw = raw.visibility as Record<string, unknown>;
  const visibility: Record<string, boolean> = {};
  for (const key of visibilityKeys) {
    if (typeof visibilityRaw[key] !== "boolean") return null;
    visibility[key] = visibilityRaw[key] as boolean;
  }
  return {
    bio, favoritePokemon, motto, activeTitle,
    badges: [...new Set(raw.badges as string[])],
    frame: raw.frame,
    visibility,
  };
}

async function hashToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function newPrivateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

function newMatricola(): string {
  return `PS-${new Date().getFullYear()}-${crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}`;
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response(405, { error: "Metodo non consentito." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return response(503, { error: "Il servizio community non è configurato." });
  }

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return response(400, { error: "Richiesta JSON non valida." });
  }

  const action = input.action;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    if (action === "create_identity") {
      const nickname = cleanText(input.nickname, 2, 24);
      const academy = input.academy;
      if (!nickname || (academy !== "arancia" && academy !== "uva" && academy !== "mirtillo")) {
        return response(400, { error: "Nickname o Accademia non validi." });
      }

      // This token is returned once. Only its SHA-256 hash is stored in the database.
      const token = newPrivateToken();
      const tokenHash = await hashToken(token);
      const { data: identity, error } = await supabase
        .from("community_identities")
        .insert({ nickname, academy: academy as Academy, matricola: newMatricola(), token_hash: tokenHash })
        .select("id,nickname,academy,matricola,created_at")
        .single();

      if (error || !identity) {
        if (error?.code === "23505") return response(409, { error: "Questo nickname è già registrato nella community." });
        return response(400, { error: "Non è stato possibile creare l'identità community." });
      }
      return response(201, { identity, token });
    }

    const token = typeof input.token === "string" ? input.token : "";
    if (!/^[a-f0-9]{64}$/.test(token)) {
      return response(401, { error: "Token community mancante o non valido." });
    }
    const tokenHash = await hashToken(token);
    const { data: identity, error: identityError } = await supabase
      .from("community_identities")
      .select("id,nickname,academy,matricola,created_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (identityError || !identity) return response(401, { error: "Identità community non riconosciuta." });

    if (action === "whoami") return response(200, { identity });

    if (action === "get_public_profile") {
      const targetId = typeof input.identityId === "string" ? input.identityId : "";
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId)) {
        return response(400, { error: "Identificativo profilo non valido." });
      }
      const { data: target, error: targetError } = await supabase
        .from("community_identities")
        .select("id,nickname,academy,matricola,player_profile,player_progress")
        .eq("id", targetId)
        .maybeSingle();
      if (targetError || !target) return response(404, { error: "Profilo pubblico non trovato." });
      const rawProfile = target.player_profile && typeof target.player_profile === "object" && !Array.isArray(target.player_profile)
        ? target.player_profile as Record<string, unknown>
        : {};
      const settings = rawProfile.profileSettings === undefined
        ? null
        : normalizeProfileSettings(rawProfile.profileSettings);
      if (rawProfile.profileSettings !== undefined && !settings) {
        return response(500, { error: "Le preferenze pubbliche del profilo non sono valide." });
      }
      const visibility = settings?.visibility as Record<string, boolean> | undefined ?? {
        bio: true, favoritePokemon: true, motto: true, activeTitle: true,
        badges: true, catalogStats: true, communityStats: true, matricola: false,
      };
      const progress = target.player_progress === null ? null : normalizePlayerProgress(target.player_progress);
      if (target.player_progress !== null && !progress) {
        return response(500, { error: "Le statistiche del profilo non sono disponibili." });
      }
      let communityStats: { discussions: number; replies: number } | undefined;
      if (visibility.communityStats) {
        const [threads, replies] = await Promise.all([
          supabase.from("forum_threads").select("id", { count: "exact", head: true }).eq("identity_id", target.id),
          supabase.from("forum_posts").select("id", { count: "exact", head: true }).eq("identity_id", target.id),
        ]);
        if (threads.error || replies.error) {
          return response(500, { error: "Non è stato possibile caricare le statistiche pubbliche del profilo." });
        }
        communityStats = { discussions: threads.count ?? 0, replies: replies.count ?? 0 };
      }
      const profile: Record<string, unknown> = {
        id: target.id,
        nickname: target.nickname,
        academy: target.academy,
        avatarId: typeof rawProfile.avatarId === "number" && STARTER_AVATAR_IDS.has(rawProfile.avatarId) ? rawProfile.avatarId : null,
        frame: settings?.frame ?? "academy",
      };
      if (visibility.matricola) profile.matricola = target.matricola;
      if (visibility.bio && settings?.bio) profile.bio = settings.bio;
      if (visibility.favoritePokemon && settings?.favoritePokemon) profile.favoritePokemon = settings.favoritePokemon;
      if (visibility.motto && settings?.motto) profile.motto = settings.motto;
      if (visibility.activeTitle && settings?.activeTitle) profile.activeTitle = settings.activeTitle;
      if (visibility.badges && settings?.badges?.length) profile.badges = settings.badges;
      if (visibility.catalogStats && progress) {
        profile.catalogStats = {
          completedPokemon: progress.completedIds.length,
          completedEntries: progress.completedEntries.length,
          points: progress.points,
        };
      }
      if (communityStats) profile.communityStats = communityStats;
      return response(200, profile);
    }

    if (action === "get_my_public_activity") {
      const [threads, replies] = await Promise.all([
        supabase.from("forum_threads").select("id", { count: "exact", head: true }).eq("identity_id", identity.id),
        supabase.from("forum_posts").select("id", { count: "exact", head: true }).eq("identity_id", identity.id),
      ]);
      if (threads.error || replies.error) {
        return response(500, { error: "Non è stato possibile caricare le statistiche pubbliche della community." });
      }
      return response(200, { discussions: threads.count ?? 0, replies: replies.count ?? 0 });
    }

    if (action === "list_leaderboard") {
      const { data, error, count } = await supabase
        .from("community_identities")
        .select("id,nickname,academy,player_profile,player_progress,player_state_updated_at", { count: "exact" })
        .order("created_at", { ascending: true })
        .limit(1000);
      if (error) return response(500, { error: "Non è stato possibile caricare la classifica." });

      const entries = (data ?? []).map(row => {
        const progress = row.player_progress === null ? null : normalizePlayerProgress(row.player_progress);
        const profile = row.player_profile && typeof row.player_profile === "object" && !Array.isArray(row.player_profile)
          ? row.player_profile as Record<string, unknown>
          : null;
        const completedPokemon = progress?.completedIds.length ?? 0;
        const completedEntries = progress?.completedEntries.length ?? 0;
        return {
          id: row.id,
          nickname: row.nickname,
          academy: row.academy,
          avatarId: typeof profile?.avatarId === "number" && STARTER_AVATAR_IDS.has(profile.avatarId) ? profile.avatarId : null,
          // Recalculate the main score from recorded completions instead of trusting the client-supplied points total.
          points: completedPokemon + completedEntries,
          examPoints: progress?.examPoints ?? 0,
          completedPokemon,
          completedEntries,
          updatedAt: row.player_state_updated_at,
        };
      }).sort((left, right) =>
        right.points - left.points
        || right.examPoints - left.examPoints
        || right.completedPokemon - left.completedPokemon
        || left.nickname.localeCompare(right.nickname, "it")
      ).map((entry, index) => ({ ...entry, rank: index + 1 }));

      return response(200, { entries, totalPlayers: count ?? entries.length });
    }


    if (action === "load_player_state") {
      const { data, error } = await supabase
        .from("community_identities")
        .select("matricola,player_profile,player_progress,player_state_updated_at")
        .eq("id", identity.id)
        .single();
      if (error || !data) return response(500, { error: "Non è stato possibile caricare i dati del giocatore." });
      const rawProfile = data.player_profile && typeof data.player_profile === "object" && !Array.isArray(data.player_profile)
        ? data.player_profile as Record<string, unknown>
        : null;
      const settings = rawProfile?.profileSettings === undefined
        ? null
        : normalizeProfileSettings(rawProfile.profileSettings);
      const profile = rawProfile
        ? {
            matricola: identity.matricola,
            ...(typeof rawProfile.avatarId === "number" && STARTER_AVATAR_IDS.has(rawProfile.avatarId) ? { avatarId: rawProfile.avatarId } : {}),
            ...(settings ? { profileSettings: settings } : {}),
          }
        : null;
      if (data.player_profile !== null && !rawProfile) {
        return response(500, { error: "Il profilo salvato nel database non è valido; i dati non sono stati sovrascritti." });
      }
      if (rawProfile?.profileSettings !== undefined && !settings) {
        return response(500, { error: "Le preferenze del profilo salvate nel database non sono valide; i dati non sono stati sovrascritti." });
      }
      const progress = data.player_progress === null ? null : normalizePlayerProgress(data.player_progress);
      if (data.player_progress !== null && !progress) {
        return response(500, { error: "I progressi salvati nel database non sono validi; i dati non sono stati sovrascritti." });
      }
      return response(200, { profile, progress, updatedAt: data.player_state_updated_at });
    }

    if (action === "save_player_state") {
      const rawProfile = input.profile;
      if (!rawProfile || typeof rawProfile !== "object" || Array.isArray(rawProfile)) {
        return response(400, { error: "Profilo giocatore non valido." });
      }
      const profileInput = rawProfile as Record<string, unknown>;
      let avatarId: number | null = null;
      if (profileInput.avatarId !== null && profileInput.avatarId !== undefined) {
        if (typeof profileInput.avatarId !== "number" || !STARTER_AVATAR_IDS.has(profileInput.avatarId)) {
          return response(400, { error: "Avatar giocatore non valido." });
        }
        avatarId = profileInput.avatarId;
      }
      const profileSettings = profileInput.profileSettings === undefined
        ? undefined
        : normalizeProfileSettings(profileInput.profileSettings);
      if (profileInput.profileSettings !== undefined && !profileSettings) {
        return response(400, { error: "Preferenze del profilo non valide." });
      }
      const progress = normalizePlayerProgress(input.progress);
      if (!progress) return response(400, { error: "Progressi giocatore non validi." });
      const { data: existing, error: existingError } = await supabase
        .from("community_identities")
        .select("player_profile")
        .eq("id", identity.id)
        .single();
      if (existingError || !existing) return response(500, { error: "Non è stato possibile leggere il profilo prima del salvataggio." });
      const previousProfile = existing.player_profile && typeof existing.player_profile === "object" && !Array.isArray(existing.player_profile)
        ? existing.player_profile as Record<string, unknown>
        : {};
      const preservedSettings = profileSettings ?? previousProfile.profileSettings;
      const playerProfile = {
        avatarId,
        ...(preservedSettings !== undefined ? { profileSettings: preservedSettings } : {}),
      };
      const updatedAt = new Date().toISOString();
      const { error } = await supabase
        .from("community_identities")
        .update({
          player_profile: playerProfile,
          player_progress: progress,
          player_state_updated_at: updatedAt,
        })
        .eq("id", identity.id);
      if (error) return response(500, { error: "Non è stato possibile salvare i dati del giocatore nel database." });
      return response(200, { saved: true, updatedAt });
    }

    if (action === "list_threads") {
      const { data, error } = await supabase
        .from("forum_threads")
        .select("id,title,body,category,created_at,updated_at,author:community_identities!forum_threads_identity_id_fkey(id,nickname,academy),posts:forum_posts(id,body,created_at,author:community_identities!forum_posts_identity_id_fkey(id,nickname,academy))")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return response(500, { error: "Non è stato possibile caricare le discussioni." });
      return response(200, { threads: data ?? [] });
    }

    if (action === "create_thread") {
      const title = cleanText(input.title, 5, 120);
      const body = cleanText(input.body, 1, 5000);
      const category = input.category;
      if (!title || !body || typeof category !== "string" || !categories.has(category)) {
        return response(400, { error: "Titolo, testo o categoria non validi." });
      }
      const { data, error } = await supabase
        .from("forum_threads")
        .insert({ identity_id: identity.id, title, body, category })
        .select("id,title,body,category,created_at,updated_at")
        .single();
      if (error || !data) return response(400, { error: "Non è stato possibile pubblicare la discussione." });
      return response(201, { thread: data });
    }

    if (action === "create_reply") {
      const threadId = typeof input.threadId === "string" ? input.threadId : "";
      const body = cleanText(input.body, 1, 2000);
      if (!/^[0-9a-f-]{36}$/i.test(threadId) || !body) {
        return response(400, { error: "Discussione o testo della risposta non validi." });
      }
      const { data, error } = await supabase
        .from("forum_posts")
        .insert({ thread_id: threadId, identity_id: identity.id, body })
        .select("id,thread_id,body,created_at")
        .single();
      if (error || !data) return response(400, { error: "Non è stato possibile pubblicare la risposta." });
      return response(201, { post: data });
    }

    return response(400, { error: "Azione community sconosciuta." });
  } catch {
    return response(500, { error: "Errore interno del servizio community." });
  }
});
