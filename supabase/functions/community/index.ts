import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const categories = new Set(["generale", "domande", "strategie", "annunci"]);
type Academy = "arancia" | "uva" | "mirtillo";

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function cleanText(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length >= min && cleaned.length <= max ? cleaned : null;
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
        .insert({ nickname, academy: academy as Academy, token_hash: tokenHash })
        .select("id,nickname,academy,created_at")
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
      .select("id,nickname,academy,created_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (identityError || !identity) return response(401, { error: "Identità community non riconosciuta." });

    if (action === "whoami") return response(200, { identity });

    if (action === "list_threads") {
      const { data, error } = await supabase
        .from("forum_threads")
        .select("id,title,body,category,created_at,updated_at,author:community_identities!forum_threads_identity_id_fkey(nickname,academy),posts:forum_posts(id,body,created_at,author:community_identities!forum_posts_identity_id_fkey(nickname,academy))")
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
