import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, RefreshCw, ShieldCheck, Users } from "lucide-react";
import {
  COMMUNITY_ROLE_LABELS,
  listCommunityAdminAudit,
  listCommunityAdminUsers,
  setCommunityUserRole,
} from "./community";
import type { CommunityAdminAuditEntry, CommunityAdminUser, CommunityIdentity, CommunityRole } from "./community";

const ROLE_OPTIONS: CommunityRole[] = [
  "utente",
  "collaboratore_autorizzato",
  "moderatore",
  "amministratore",
];

type AdminPanelProps = {
  identity: CommunityIdentity | null;
};

export default function AdminPanel({ identity }: AdminPanelProps) {
  const [users, setUsers] = useState<CommunityAdminUser[]>([]);
  const [audit, setAudit] = useState<CommunityAdminAuditEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextUsers, nextAudit] = await Promise.all([
        listCommunityAdminUsers(),
        listCommunityAdminAudit(),
      ]);
      setUsers(nextUsers);
      setAudit(nextAudit);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Non è stato possibile caricare la gestione utenti.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("it-IT");
    if (!query) return users;
    return users.filter(user =>
      user.nickname.toLocaleLowerCase("it-IT").includes(query)
      || user.matricola.toLocaleLowerCase("it-IT").includes(query)
      || user.id.toLocaleLowerCase("it-IT").includes(query)
    );
  }, [search, users]);

  const usersById = useMemo(() => new Map(users.map(user => [user.id, user])), [users]);

  async function changeRole(user: CommunityAdminUser, nextRole: CommunityRole) {
    if (user.role === nextRole || user.id === identity?.id) return;
    const oldLabel = COMMUNITY_ROLE_LABELS[user.role];
    const newLabel = COMMUNITY_ROLE_LABELS[nextRole];
    if (!window.confirm(`Confermi di cambiare il ruolo di ${user.nickname} da “${oldLabel}” a “${newLabel}”?`)) return;
    setBusyId(user.id);
    setError("");
    setNotice("");
    try {
      await setCommunityUserRole(user.id, nextRole);
      setUsers(current => current.map(entry => entry.id === user.id ? { ...entry, role: nextRole } : entry));
      setNotice(`Ruolo di ${user.nickname} aggiornato: ${newLabel}.`);
      setAudit(await listCommunityAdminAudit());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Non è stato possibile modificare il ruolo.");
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (!identity || identity.role !== "amministratore") {
    return (
      <section className="admin-panel">
        <div className="admin-panel-heading"><ShieldCheck size={24} /><div><span>AREA RISERVATA</span><h1>Gestione amministrativa</h1></div></div>
        <div className="admin-panel-state" role="alert"><AlertCircle size={20} /><div><strong>Accesso non autorizzato</strong><p>Questa sezione è disponibile solo per un’identità con ruolo Amministratore.</p></div></div>
      </section>
    );
  }

  return (
    <section className="admin-panel">
      <header className="admin-panel-heading">
        <span className="admin-panel-icon"><ShieldCheck size={25} /></span>
        <div><span>SEGRETERIA · ACCESSO RISERVATO</span><h1>Gestione utenti e ruoli</h1><p>Assegna solo i permessi necessari. Ogni modifica viene registrata.</p></div>
        <button type="button" className="admin-refresh" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15} className={loading ? "admin-spinning" : ""} /> Aggiorna</button>
      </header>

      <div className="admin-panel-summary">
        <article><Users size={20} /><div><span>Identità registrate</span><strong>{users.length}</strong></div></article>
        <article><ShieldCheck size={20} /><div><span>Amministratori</span><strong>{users.filter(user => user.role === "amministratore").length}</strong></div></article>
      </div>

      {notice && <div className="admin-panel-notice" role="status">{notice}</div>}
      {error && <div className="admin-panel-error" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}

      <section className="admin-users-section" aria-labelledby="admin-users-title">
        <div className="admin-section-title"><div><span>ACCESSI E PERMESSI</span><h2 id="admin-users-title">Utenti community</h2></div><span className="admin-count">{filteredUsers.length} risultati</span></div>
        <label className="admin-search">Cerca per nickname, matricola o ID <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Es. PS-2026-ABC123" /></label>
        {loading ? <div className="admin-panel-state"><RefreshCw size={19} className="admin-spinning" /> Caricamento utenti…</div> : filteredUsers.length === 0 ? <div className="admin-panel-state">Nessun utente corrispondente alla ricerca.</div> : (
          <div className="admin-user-list">
            {filteredUsers.map(user => (
              <article className="admin-user-row" key={user.id}>
                <div className="admin-user-avatar">{user.nickname.slice(0, 1).toLocaleUpperCase("it-IT")}</div>
                <div className="admin-user-details"><strong>{user.nickname}</strong><span>{user.matricola} · {user.academy === "arancia" ? "Accademia Arancia" : user.academy === "uva" ? "Accademia Uva" : "Istituto Mirtillo"}</span><small>ID: {user.id}</small></div>
                <label className="admin-role-control"><span>Ruolo</span><select aria-label={`Ruolo per ${user.nickname}`} value={user.role} disabled={busyId === user.id || user.id === identity.id} onChange={event => void changeRole(user, event.target.value as CommunityRole)}>{ROLE_OPTIONS.map(role => <option value={role} key={role}>{COMMUNITY_ROLE_LABELS[role]}</option>)}</select>{user.id === identity.id && <small>Il tuo ruolo non è modificabile da questa schermata.</small>}</label>
                {busyId === user.id && <span className="admin-user-saving" role="status">Salvataggio…</span>}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="admin-audit-section" aria-labelledby="admin-audit-title">
        <div className="admin-section-title"><div><span>TRACCIABILITÀ</span><h2 id="admin-audit-title">Registro delle modifiche</h2></div><span className="admin-count">Ultime {audit.length}</span></div>
        {audit.length === 0 ? <p className="admin-audit-empty">Non sono ancora state registrate modifiche ai ruoli.</p> : <div className="admin-audit-list">{audit.map(entry => {
          const actor = usersById.get(entry.actor_id);
          const target = usersById.get(entry.target_id);
          return <article className="admin-audit-row" key={entry.id}><span className="admin-audit-dot" /><div><p><strong>{actor?.nickname ?? "Identità non disponibile"}</strong> ha modificato il ruolo di <strong>{target?.nickname ?? "Identità non disponibile"}</strong></p><small>{COMMUNITY_ROLE_LABELS[entry.old_role]} → {COMMUNITY_ROLE_LABELS[entry.new_role]} · {new Date(entry.created_at).toLocaleString("it-IT")}</small></div></article>;
        })}</div>}
      </section>
      <p className="admin-panel-footnote">Il sistema impedisce di rimuovere l’ultimo amministratore e non consente di modificare il proprio ruolo da questa schermata.</p>
    </section>
  );
}
