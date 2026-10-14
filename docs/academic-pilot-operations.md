# Operatività del prototipo accademico

## Stato del rilascio

Il prototipo è sviluppato nel branch `feature/academic-pilot` e nella PR draft #3. La migrazione `20261014182830_academic_pilot` è stata applicata al progetto Supabase `pokè-study` (`hfcdiixfdxvefgyqhapy`) e la Edge Function `academy` è attiva alla versione 1. Il frontend non è stato unito a `main` né pubblicato tramite questo branch. Prima di aprire l'Accademia agli utenti, completare il collaudo HTTP autenticato con un token privato valido e la verifica manuale dell'interfaccia.

## Prerequisiti

- Il progetto Supabase deve avere già la tabella `public.community_identities` del sistema community, con `id` UUID e `token_hash` SHA-256 del token privato esistente.
- La configurazione frontend esistente deve valorizzare `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- La chiave `SUPABASE_SERVICE_ROLE_KEY` deve restare esclusivamente nell'ambiente server-side della Edge Function; non inserirla in variabili `VITE_*` né nel repository.

## Stato delle verifiche e passi rimanenti

1. Confermato lo schema community esistente e la compatibilità del riferimento `community_identities.id/token_hash`.
2. Applicata la migrazione `supabase/migrations/20261014182830_academic_pilot.sql`; la cronologia Supabase riporta la versione `20261014182830`.
3. Distribuita la funzione `academy` (versione 1, `verify_jwt = false`); il codice valida il token privato dell'account e usa la chiave service-role esclusivamente lato server.
4. Verificati via SQL le 8 tabelle accademiche, RLS abilitata, nessun privilegio `SELECT` per `anon/authenticated`, 3 lezioni pubblicate e 33 domande attive.
5. Eseguito un test SQL transazionale della correzione, della media e del blocco del grado; la transazione è stata annullata e non ha lasciato dati di prova.
6. Da completare: chiamata HTTP autenticata della Edge Function con un token valido, verifica end-to-end dall'interfaccia e test manuale mobile.

## Parametri provvisori

- `questions_per_attempt` è inizializzato a 5 solo come valore tecnico provvisorio. Il numero definitivo di domande per test lezione deve essere deciso prima del collaudo.
- `questions_per_grade_exam` è inizializzato a 20, all'interno dell'intervallo approvato di 20–30 domande.
- Punti accademici e bonus non sono ancora implementati: gli importi devono essere definiti prima della fase ricompense.

## Verifiche di accettazione

- Un utente senza identità online non può iniziare né consegnare test.
- Un'identità non può leggere o modificare i tentativi di un'altra identità.
- La risposta corretta non compare nella risposta di avvio del test; la correzione avviene lato server.
- Ogni tentativo consegnato conserva domande, risposte, versioni, fonti, data di verifica e versione/soglia della valutazione.
- Le domande di uno stesso tentativo non si ripetono e le difficoltà vengono distribuite in modo bilanciato.
- I test supportano scelta multipla, vero/falso, abbinamenti, ordinamento, identificazione visiva e scenari.
- La media usa tutti i tentativi, compresi quelli insufficienti; i calcoli server-side non si limitano agli ultimi tentativi mostrati.
- La lezione successiva e l'esame finale restano bloccati finché non sono soddisfatti i prerequisiti.
- La materia/lezione richiede almeno 18/30; il grado richiede media del grado ed esame finale entrambi almeno 26/30.
- La consegna concorrente o ripetuta dello stesso tentativo non produce due risultati o due serie di risposte.
- Catalogo, cartoleria, Punti Poké, progressi esistenti e community non subiscono regressioni.
