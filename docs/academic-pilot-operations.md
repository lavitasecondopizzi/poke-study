# Operatività del prototipo accademico

## Stato del rilascio
Il prototipo è sviluppato nel branch `feature/academic-pilot` e nella PR draft #3. La migrazione `20261014182830_academic_pilot` è stata applicata al progetto Supabase `pokè-study` (`hfcdiixfdxvefgyqhapy`) e la Edge Function `academy` è attiva alla versione 1. Il frontend non è stato unito a `main` né pubblicato tramite questo branch. Prima di aprire l'Accademia agli utenti, completare la verifica end-to-end dall'interfaccia e il test manuale mobile.

## Riconciliazione della cronologia migrazioni
- I file locali `player_state`, `server_matricola` e `blueberry_academy` usano ora le versioni registrate nel progetto remoto: `20261014131025`, `20261014131029` e `20261014131201`. La migrazione duplicata `add_blueberry_academy` è stata rimossa.
- La migrazione locale `20261014090000_community_foundation.sql` non compariva nella cronologia remota. Dopo la verifica degli oggetti esistenti, la versione è stata riconciliata con `supabase migration repair 20261014090000 --status applied`; `supabase migration list` conferma ora che le versioni locali e remote corrispondono.
- La migrazione `20261014194346_academic_question_counts.sql` registra la configurazione approvata: 5 domande per test lezione e 25 per esame finale. Il valore è stato aggiornato anche in `public.academy_settings` sul progetto Supabase.
- Non eseguire `supabase db push` senza prima controllare `supabase migration list`. Non modificare direttamente la cronologia interna delle migrazioni via SQL.

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
6. Completato il test HTTP della Edge Function: richiesta senza token respinta con `401`; richiesta con token privato valido ha restituito il JSON del curriculum. Il test autenticato era di sola lettura.
7. Verificato dopo il test che `academy_attempts` e `academy_attempt_answers` siano ancora a zero righe; le 3 identità community esistenti sono rimaste invariate.
8. Configurazione verificata: `questions_per_attempt = 5`, `questions_per_grade_exam = 25`. Con 33 domande attive, l'archivio supera la quantità richiesta per l'esame finale.
9. Da completare: verifica end-to-end dall'interfaccia e test manuale mobile.

## Parametri accademici approvati
- Test lezione: **5 domande**.
- Esame finale del grado: **25 domande**.
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
