# Operatività del prototipo accademico

## Stato del rilascio
Il prototipo è sviluppato nel branch `feature/academic-pilot` e nella PR draft #3. La migrazione `20261014182830_academic_pilot` è stata applicata al progetto Supabase `pokè-study` (`hfcdiixfdxvefgyqhapy`) e la Edge Function `academy` è attiva alla versione 1. Il frontend non è stato unito a `main` né pubblicato tramite questo branch. Prima di aprire l'Accademia agli utenti, completare la verifica end-to-end dall'interfaccia e il test manuale mobile.

## Riconciliazione della cronologia migrazioni
- I file locali `player_state`, `server_matricola` e `blueberry_academy` usano ora le versioni registrate nel progetto remoto: `20261014131025`, `20261014131029` e `20261014131201`. La migrazione duplicata `add_blueberry_academy` è stata rimossa.
- La migrazione locale `20261014090000_community_foundation.sql` non compariva nella cronologia remota. Dopo la verifica degli oggetti esistenti, la versione è stata riconciliata con `supabase migration repair 20261014090000 --status applied`; `supabase migration list` conferma ora che le versioni locali e remote corrispondono.
- La migrazione `20261014194346_academic_question_counts.sql` registra la configurazione approvata: 5 domande per test lezione e 25 per esame finale di grado. La nuova migrazione `20261014203000_academic_points_campus_ranking.sql` aggiunge il registro dei punti accademici, la classifica dei campus e il tipo di tentativo per l’esame finale di materia; è presente nel branch, ma non va applicata al progetto remoto senza approvazione esplicita.
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
7. La verifica funzionale manuale è stata dichiarata completata dall’utente. I test di accettazione non devono essere considerati prova di un’esecuzione reale dell’esame finale di grado.
8. Configurazione verificata: `questions_per_attempt = 5`, `questions_per_grade_exam = 25`. Con 33 domande attive, l'archivio supera la quantità richiesta per l'esame finale di grado.
9. Da completare: verifica end-to-end dall'interfaccia e test manuale mobile.

## Parametri accademici approvati
- Test lezione: **5 domande**.
- Esame finale del grado: **25 domande**.
- Ogni test di lezione consegnato assegna 1 punto accademico; ogni esame finale di materia consegnato assegna 3 punti; ogni esame finale di grado consegnato assegna 5 punti. Non esistono bonus e l’accredito vale anche per tentativi insufficienti.\n- L’esame finale di materia usa un default configurabile di 15 domande e soglia di 18/30 nel prototipo. Il numero e la soglia sono parametri del pilota, non una regola generale per materie future.\n- I punti sono registrati lato server per tentativo, studente e campus. La chiave univoca sul tentativo impedisce doppi accrediti; il punteggio della classifica è la somma degli accrediti registrati per ciascun campus.\n- I Punti Poké restano separati dal saldo accademico.

## Verifiche di accettazione
- Un utente senza identità online non può iniziare né consegnare test.
- Un'identità non può leggere o modificare i tentativi di un'altra identità.
- La risposta corretta non compare nella risposta di avvio del test; la correzione avviene lato server.
- Ogni tentativo consegnato conserva domande, risposte, versioni, fonti, data di verifica e versione/soglia della valutazione.
- Le domande di uno stesso tentativo non si ripetono e le difficoltà vengono distribuite in modo bilanciato.
- I test supportano scelta multipla, vero/falso, abbinamenti, ordinamento, identificazione visiva e scenari.
- La media usa tutti i tentativi, compresi quelli insufficienti; i calcoli server-side non si limitano agli ultimi tentativi mostrati.
- La lezione successiva, l’esame finale di materia e l’esame finale di grado restano bloccati finché non sono soddisfatti i rispettivi prerequisiti.\n- Un tentativo consegnato assegna esattamente 1, 3 o 5 punti accademici in base al tipo, anche se insufficiente; un retry HTTP o una consegna duplicata non può raddoppiare l’accredito.\n- La classifica mostra i tre campus ordinati per totale punti accademici, con parità risolte in ordine stabile; il saldo individuale non è confuso con i Punti Poké.
- La materia/lezione richiede almeno 18/30; il grado richiede media del grado ed esame finale entrambi almeno 26/30.
- La consegna concorrente o ripetuta dello stesso tentativo non produce due risultati o due serie di risposte.
- Catalogo, cartoleria, Punti Poké, progressi esistenti e community non subiscono regressioni.
