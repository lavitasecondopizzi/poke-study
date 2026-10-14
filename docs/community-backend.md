# Poké Study — community backend (release 0 foundation)

This increment adds the database/API foundation only. It does **not** replace the existing local game save, enable a public Bacheca UI, or claim that existing local student profiles are authenticated.

## Architecture

- React/Vite uses only `VITE_SUPABASE_URL` and the Supabase publishable/anon key.
- `supabase/functions/community` is the only browser-facing API.
- The Edge Function uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the Supabase runtime environment. Never put the service-role key in Vite variables, source files, GitHub Pages settings exposed to the client, or committed files.
- The SQL migration enables RLS and revokes direct table privileges from `anon` and `authenticated`. Browser operations go through the Edge Function.
- Account tokens contain 256 bits of randomness. The database stores only the SHA-256 token hash; the plaintext token is returned only when an identity is created.
- Metadata export/import transfers the private token without passwords or email authentication. The metadata is a bearer credential: anyone who obtains it can act as that account. Store it privately and do not share it publicly.

## Important identity boundary

The existing game currently stores nickname, academy and a generated matricola locally. Those values are not proof of identity on a server. The community identity must be created and bound to the game during the enrollment flow before the online Bacheca is exposed. Do not silently attach an existing local profile to a remote identity based only on its nickname or matricola. This foundation intentionally leaves that UI migration for a following increment.

## Supabase setup

1. Create a Supabase project.
2. Apply `supabase/migrations/20261014090000_community_foundation.sql` using the Supabase CLI or SQL Editor.
3. Deploy the Edge Function from the repository root with the Supabase CLI: `supabase functions deploy community --no-verify-jwt`. The matching `supabase/config.toml` setting documents why the gateway JWT check is disabled: the function validates the private Poké Study token for protected actions itself.
4. Confirm the project runtime has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. These are Supabase-managed Edge Function secrets; do not add their values to the repository.
5. Copy `.env.example` to a local `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (or publishable key). These are public client settings, not service secrets.
6. Configure the same two Vite variables in the build environment when deploying to GitHub Pages. Do not configure the service-role key as a `VITE_*` variable.

## API actions in this increment

All requests are POST JSON to `/functions/v1/community`.

- `create_identity`: creates a nickname/academy identity and returns the private token once.
- `whoami`: validates a token and returns its identity.
- `list_threads`: lists up to 50 recent discussions with replies.
- `create_thread`: creates a discussion in `generale`, `domande`, `strategie` or `annunci`.
- `create_reply`: adds a reply to an existing discussion.

The typed browser wrapper is `src/community.ts`. The profile page now exposes optional controls to create a community identity and export/import its metadata. The current Bacheca remains unchanged until the Supabase project is configured and the identity flow is verified end to end.

## Verification checklist

- [ ] Apply the migration to a disposable Supabase project and confirm all three tables have RLS enabled.
- [ ] Confirm direct `anon` and `authenticated` reads/writes to the three tables are denied.
- [ ] Deploy the Edge Function with runtime secrets configured; do not commit secret values.
- [ ] Create a test identity and verify the returned token is 64 lowercase hexadecimal characters.
- [ ] Confirm `token_hash` is stored instead of the plaintext token.
- [ ] Confirm `whoami` succeeds with the original token and fails with a modified token.
- [ ] Create a thread and reply; confirm malformed input and missing/invalid tokens are rejected.
- [ ] Export metadata, import it in a separate browser profile, and verify it resolves to the same identity.
- [ ] Run `npm run build` after installing dependencies and run a manual smoke test of the existing game.
- [ ] Only then implement enrollment/Bacheca UI integration as the next increment.

## Current limitations

This is a foundation, not a production-ready forum. Rate limiting, abuse reporting/moderation, account-token rotation/revocation, temporary transfer links, automated tests and UI integration remain follow-up work. Because a private token is a bearer credential, client-side XSS could expose it; keep the UI's content handling escaped and add a revocation/rotation path before broad public rollout.
