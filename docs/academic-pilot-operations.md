# Operatività del prototipo accademico

## Stato del rilascio

Il prototipo è sviluppato nel branch `feature/academic-pilot` e nella PR draft #3. La migrazione `20261014182830_academic_pilot` è stata applicata al progetto Supabase `hfcdiixfdxvefgyqhapy`; la Edge Function `academy` è attiva alla versione 1. Il branch non è stato unito a `main` e non è stato pubblicato.

La migrazione `20261014203000_academic_points_campus_ranking.sql` è presente solo nel branch: non applicarla al progetto Supabase remoto senza approvazione esplicita. I test SQL automatici vanno eseguiti su un database locale e usa-e-getta, mai sul progetto live.

## Riconciliazione della cronologia migrazioni

- I file locali `player_state`, `server_matricola` e `blueberry_academy` usano le versioni registrate nel progetto remoto: `20261014131025`, `20261014131029` e `20261014131201`.
- La migrazione locale `20261014090000_community_foundation.sql` non compariva nella cronologia remota. Dopo la verifica degli oggetti esistenti, la versione è stata riconciliata con `supabase migration repair 20261014090000 --status applied`; la cronologia locale/remota è stata poi verificata.
- La migrazione `20261014194346_academic_question_counts.sql` registra la configurazione approvata: 5 domande per test lezione e 25 per esame finale di grado.
- Non eseguire `supabase db push` senza prima controllare `supabase migration list`. Non modificare direttamente la cronologia interna delle migrazioni via SQL.

## Prerequisiti

- Il progetto Supabase deve avere la tabella `public.community_identities`, con `id` UUID e `token_hash` SHA-256 del token privato esistente.
- La configurazione frontend esistente deve valorizzare `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- La chiave `SUPABASE_SERVICE_ROLE_KEY` deve restare esclusivamente nell'ambiente server-side della Edge Function; non inserirla in variabili `VITE_*` né nel repository.

## Stato delle verifiche

1. Confermato lo schema community esistente e la compatibilità del riferimento `community_identities.id/token_hash`.
2. Applicata la migrazione `supabase/migrations/20261014182830_academic_pilot.sql); la cronologia Supabase riporta la versione `20261014182830`.
3. Distribuita la funzione `academy` (versione 1, `verify_jwt = false)); il codice valida il token privato dell'account e usa la chiave service-role esclusivamente lato server.
4. Verificati via SQL le tabelle accademiche, RLS, i privilegi di `anon/authenticated`, le 3 lezioni pubblicate e le 33 domande attive.
5. Eseguito un test SQL transazionale della correzione, della media e del blocco del grado; la transazione è stata annullata e non ha lasciato dati di prova.
6. Completato il test HTTP della Edge Function: richiesta senza token respinta con `401`; richiesta con token privato valido ha restituito il curriculum in sola lettura.
7. La configurazione live è stata verificata: `questions_per_attempt = 5`, `questions_per_grade_exam = 25`.
8. Aggiunta la suite `supabase/tests/academic_points_campus_ranking.test.sql` per il registro punti e la classifica; il workflow CI ora avvia Supabase locale ed esegue `supabase test db`.
9. La suite nuova deve essere considerata verificata solo quando il job `database-tests` termina con esito positivo. La migrazione dei punti resta non applicata al progetto remoto finché non viene approvata.

## Parametri accademici approvati

- Test lezione: **5 domande**.
- Esame finale del grado: **25 domande**.
- Ogni test di lezione consegnato assegna 1 punto accademico; ogni esame finale di materia consegnato assegna 3 punti; ogni esame finale di grado consegnato assegna 5 punti.
- Non esistono bonus: l'accredito vale anche per tentativi insufficienti.
- L'esame finale di materia usa un default configurabile di 15 domande e soglia di 18/30 nel prototipo. Sono parametri del pilota, non una regola generale per materie future.
- I punti sono registrati lato server per tentativo, studente e campus. Il vincolo univoco sul tentativo impedisce doppi accrediti; la classifica somma gli accrediti registrati per ciascun campus.
- I Punti Poké restano separati dal saldo accademico.

## Copertura dei test SQL automatici

La suite verifica:

- importi esatti di 1, 3 e 5 punti per i tre tipi di tentativo;
- accredito anche quando il voto è insufficiente;
- una sola riga di registro per tentativo;
- saldo individuale e accademia associata;
- presenza e ordinamento della classifica dei tre campus;
- rifiuto di duplicati nel registro;
- impossibilità di aggiornare o cancellare lo storico dei punti.

Esecuzione locale, dopo aver avviato lo stack Supabase e applicato tutte le migrazioni del branch:

```sh
supabase start
supabase test db
```

Non eseguire questi test sul progetto Supabase live. I test sono transazionali e annullano i dati creati; l'ambiente di prova deve comunque essere isolato.

## Verifiche funzionali da preservare

- Un utente senza identità online non può iniziare né consegnare test.
- Un'identità non può leggere o modificare i tentativi di un'altra identità.
- La risposta corretta non compare nella risposta di avvio del test; la correzione avviene lato server.
- Ogni tentativo consegnato conserva domande, risposte, versioni, fonti, data di verifica e versione/soglia della valutazione.
- Le domande di uno stesso tentativo non si ripetono e le difficoltà vengono distribuite in modo bilanciato.
- I test supportano scelta multipla, vero/falso, abbinamenti, ordinamento, identificazione visiva e scenari.
- La media usa tutti i tentativi, compresi quelli insufficienti; i calcoli server-side non si limitano agli ultimi tentativi mostrati.
- La lezione successiva, l'esame finale di materia e l'esame finale di grado restano bloccati finché non sono soddisfatti i rispettivi prerequisiti.
- Un retry HTTP o una consegna duplicata non può raddoppiare l'accredito.
- La classifica mostra i tre campus ordinati per totale punti accademici, con parità risolte in ordine stabile; il saldo individuale non è confuso con i Punti Poké.
- La materia richiede almeno 18/30; il grado richiede media del grado ed esame finale entrambi almeno 26/30.
- Catalogo, Cartoleria, Punti Poké, progressi esistenti e community devono rimanere invariati dal nuovo sistema accademico.
