# Operatività del prototipo accademico

## Stato del rilascio

Il prototipo è sviluppato nel branch `feature/academic-pilot` e nella PR draft #3. La migrazione e la Edge Function sono versionate nel repository, ma **non sono state applicate o distribuite su un progetto Supabase remoto**. Non pubblicare il prototipo su produzione prima del collaudo in un progetto di test.

## Prerequisiti

- Il progetto Supabase deve avere già la tabella `public.community_identities` del sistema community, con `id` UUID e `token_hash` SHA-256 del token privato esistente.
- La configurazione frontend esistente deve valorizzare `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- La chiave `SUPABASE_SERVICE_ROLE_KEY` deve restare esclusivamente nell'ambiente server-side della Edge Function; non inserirla in variabili `VITE_*` né nel repository.

## Sequenza consigliata in ambiente di test

1. Verificare che lo schema community esistente sia applicato e che l'identità privata possa essere verificata.
2. Applicare la migrazione `supabase/migrations/20261014190000_academic_pilot.sql` tramite il normale flusso di migrazione del progetto Supabase.
3. Distribuire la funzione `academy` con la configurazione presente in `supabase/config.toml`. La funzione verifica il token privato dell'account esistente; per questo la verifica JWT automatica è disabilitata e l'autorizzazione viene applicata nel codice server.
4. Pubblicare il frontend di test e aprire Accademia con un'identità online valida.
5. Eseguire le verifiche di accettazione sotto riportate prima di promuovere migrazione o funzione a produzione.

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
