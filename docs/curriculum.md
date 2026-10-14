# Poke Study — Programma didattico (bozza progettuale)

## Obiettivo

Definire una progressione scolastica coerente per lezioni, esercitazioni, verifiche ed esami di Poke Study, riutilizzando dati Pokémon verificabili senza trasformare le lezioni in una semplice sequenza di quiz casuali.

Questa è una specifica progettuale: non modifica ancora le schermate o le regole del gioco.

## Principi da preservare

- Mantenere il tema dell'accademia e lo stile visivo già presente nel portale.
- Conservare le cinque macrocategorie dell'archivio:
  1. Pokémon.
  2. Strumenti e oggetti.
  3. Bacche, ingredienti e materiali.
  4. Tecniche e macchine (incluse MT e altre macchine didatticamente pertinenti).
  5. Fossili, reperti e oggetti speciali.
- Le lezioni possono contenere carte miste; il formato di classificazione già previsto supporta fino a 15 carte per sessione.
- Una carta usata come domanda visiva non deve mostrare in anticipo la risposta che lo studente deve individuare.
- La catalogazione e lo sblocco delle informazioni del catalogo restano sistemi distinti dall'apprendimento: catalogare non deve rivelare automaticamente le informazioni descrittive.
- Non cambiare le valute, i costi degli sblocchi, il catalogo nazionale o i salvataggi esistenti in questa fase.
- I contenuti didattici devono poter essere revisionati e aggiornati senza duplicare dati canonici.

## Fonti dati e affidabilità

### Fonti primarie per dati strutturati

- **PokéAPI v2** — https://pokeapi.co/docs/v2
  - Specie, forme, tipi, statistiche, abilità, mosse, strumenti, bacche, evoluzioni, generazioni, regioni, Pokédex e macchine.
  - Usarla per importare dati strutturati e identificatori stabili, non come unica fonte per spiegazioni didattiche.
- **Pokédex ufficiale Pokémon** — https://www.pokemon.com/it/pokedex
  - Riferimento di controllo per le informazioni canoniche rivolte al giocatore.

### Fonti secondarie per approfondimenti

- **Bulbapedia** — https://bulbapedia.bulbagarden.net/
  - Consultazione per meccaniche, eccezioni e differenze tra giochi/generazioni.
  - Le informazioni importanti vanno confrontate con fonti primarie o con i giochi di riferimento.

### Regole editoriali

- Ogni fatto utilizzato in una domanda deve avere un riferimento alla fonte e, quando necessario, alla generazione o al gioco.
- Separare i dati oggettivi importati dalle spiegazioni scritte appositamente per Poke Study.
- Se una meccanica cambia tra generazioni, la domanda deve indicare la versione di riferimento oppure evitare l'ambiguità.
- Non presumere che tutte le descrizioni o immagini esterne siano liberamente riutilizzabili: verificare licenze, attribuzione e diritti prima di incorporarle nel repository.
- Prevedere stato editoriale: `draft`, `reviewed`, `published`, `deprecated`.
- Non generare domande d'esame pubblicabili direttamente da dati non verificati.

## Struttura del percorso

Il percorso viene suddiviso in quattro livelli didattici. I livelli sono una progressione interna al gioco, non una corrispondenza con livelli scolastici reali.

### Livello I — Osservazione e classificazione

Obiettivo: riconoscere le categorie fondamentali e interpretare dati semplici.

- **Pokémon:** riconoscimento visivo, nome, numero Pokédex, categoria, tipi e regione di appartenenza.
- **Strumenti e oggetti:** distinguere strumenti tenuti, strumenti utilizzabili e oggetti evolutivi; associare oggetto e funzione di base.
- **Bacche, ingredienti e materiali:** riconoscere bacche e materiali, categorie e usi principali documentati.
- **Tecniche e macchine:** distinguere una mossa da una macchina che la insegna; riconoscere nome e tipo della mossa.
- **Fossili, reperti e oggetti speciali:** distinguere fossili, reperti e oggetti con funzioni particolari.

Verifica: riconoscimento, classificazione e abbinamento diretto. Nessuna domanda deve dipendere da conoscenze non ancora presentate.

### Livello II — Relazioni e funzioni

Obiettivo: comprendere come gli elementi sono collegati tra loro.

- **Pokémon:** relazioni evolutive, tipi primari/secondari, abilità e differenze tra specie e forme.
- **Strumenti e oggetti:** effetti, condizioni d'uso, compatibilità e differenze tra oggetti simili.
- **Bacche, ingredienti e materiali:** effetti, sapori o proprietà quando supportati dai dati del gioco di riferimento, e usi nella serie.
- **Tecniche e macchine:** potenza, precisione, PP, categoria di danno, tipo e compatibilità d'apprendimento, quando applicabili.
- **Fossili, reperti e oggetti speciali:** relazione tra reperto, Pokémon ricostruito o funzione; condizioni necessarie per usarlo.

Verifica: abbinamenti motivati, confronti a coppie e domande su relazioni esplicite.

### Livello III — Applicazione

Obiettivo: applicare le conoscenze a casi pratici, dichiarando sempre le regole del gioco di riferimento.

- **Pokémon:** valutare efficacia dei tipi, interpretare statistiche di base e ricostruire una linea evolutiva.
- **Strumenti e oggetti:** scegliere l'oggetto adatto a una situazione descritta.
- **Bacche, ingredienti e materiali:** individuare il materiale o la bacca adatta allo scopo dichiarato.
- **Tecniche e macchine:** scegliere una mossa in base a tipo, categoria, potenza, precisione o effetto, senza ridurre la valutazione al solo valore numerico.
- **Fossili, reperti e oggetti speciali:** risolvere scenari che richiedono di collegare più indizi verificati.

Verifica: casi pratici, scelta motivata e quesiti che combinano due o più concetti già studiati.

### Livello IV — Sintesi e specializzazione

Obiettivo: collegare conoscenze provenienti da più materie.

- Confrontare Pokémon in base a tipi, statistiche e abilità.
- Risolvere scenari che richiedono strumenti e oggetti appropriati.
- Collegare mosse, tipi ed effetti a un contesto di gioco definito.
- Distinguere informazioni universali da regole specifiche di una generazione.
- Interpretare più indizi senza ricorrere a dettagli mai insegnati.

Verifica: prove miste e cumulative. Le domande devono misurare ragionamento e conoscenze insegnate, non nozioni casuali o trivia non introdotti.

## Materie e unità didattiche

| Materia | Unità proposte |
| --- | --- |
| Pokémon | 1. Anatomia dei dati Pokédex; 2. Tipi; 3. Statistiche; 4. Abilità; 5. Evoluzioni e forme; 6. Regioni e generazioni; 7. Efficacia e confronti |
| Strumenti e oggetti | 1. Classificazione; 2. Oggetti utilizzabili; 3. Strumenti tenuti; 4. Oggetti evolutivi; 5. Cura e status; 6. Effetti e compatibilità; 7. Scelta contestuale |
| Bacche, ingredienti e materiali | 1. Riconoscimento; 2. Proprietà; 3. Effetti e utilizzi; 4. Raccolta e combinazioni quando supportate; 5. Scelta del materiale in uno scenario |
| Tecniche e macchine | 1. Anatomia di una mossa; 2. Tipi e categorie; 3. Potenza e precisione; 4. PP ed effetti; 5. Macchine e compatibilità; 6. Efficacia in contesto; 7. Confronto tra alternative |
| Fossili, reperti e oggetti speciali | 1. Classificazione; 2. Fossili e Pokémon associati; 3. Reperti; 4. Oggetti speciali; 5. Condizioni d'uso; 6. Casi di applicazione |

L'ordine effettivo delle unità deve rispettare prerequisiti e disponibilità dei dati verificati. Non tutte le unità devono essere rese obbligatorie se il gioco di riferimento non offre informazioni sufficienti.

## Struttura standard di una lezione

Ogni lezione pubblicata deve includere:

1. **Identità:** ID stabile, titolo, materia, livello e stato editoriale.
2. **Obiettivi:** da uno a tre risultati osservabili che lo studente deve raggiungere.
3. **Prerequisiti:** lezioni o concetti richiesti.
4. **Spiegazione:** testo originale, breve e diviso in sezioni.
5. **Esempi:** almeno un esempio concreto per ogni concetto centrale.
6. **Esercitazione:** carte e domande di allenamento, separate dalla valutazione finale.
7. **Riepilogo:** concetti da ricordare.
8. **Fonti e versione:** riferimenti consultati e generazione/gioco applicabile.

Le carte visive devono mantenere la regola di non mostrare la risposta prima della selezione. Le spiegazioni possono invece rivelare i dati pertinenti dopo che il concetto è stato introdotto.

## Struttura standard di verifica ed esame

- **Esercitazione:** feedback immediato, ripetibile e a bassa pressione; serve a imparare, non a bloccare la progressione.
- **Verifica di unità:** controlla gli obiettivi della singola lezione o di un piccolo gruppo di lezioni.
- **Esame di materia:** prova cumulativa con domande estratte da un insieme revisionato, non soltanto dall'ultima lezione.
- **Esame finale di livello:** integra più materie e include applicazione, oltre al riconoscimento.

### Formati di domanda ammessi

- Scelta multipla con una sola risposta corretta, salvo indicazione esplicita.
- Abbinamento tra elementi.
- Classificazione in categorie.
- Identificazione da immagine, senza nome o risposta anticipata.
- Ordinamento di passaggi o evoluzioni, quando non ambiguo.
- Caso pratico con risposta selezionata.
- Risposta breve soltanto quando è possibile validarla senza ambiguità.

### Criteri di qualità

- Ogni domanda deve avere una risposta corretta verificata, una spiegazione della risposta e una fonte.
- I distrattori devono essere plausibili, ma non corretti secondo la versione indicata.
- Evitare domande doppie, formulazioni ingannevoli e risposte ricavabili da indizi grammaticali.
- Bilanciare le domande per argomento e difficoltà.
- Evitare di riproporre in serie lo stesso elemento o la stessa nozione.
- Non usare una domanda d'esame se la fonte è in conflitto, il dato è incompleto o la risposta dipende da una versione non dichiarata.

### Soglia di superamento proposta

Usare inizialmente una soglia del **70%** per verifiche ed esami, con possibilità di ripetizione. La soglia è una proposta di design da confermare durante il bilanciamento, non una regola già implementata. Il gioco deve registrare il tentativo e gli argomenti da ripassare; non deve cancellare progressi preesistenti.

## Modello dati editoriale suggerito

Separare le entità canoniche dalle lezioni e dalle domande.

- `source_records`: URL, nome fonte, data di consultazione, tipo di fonte e note sui diritti.
- `canonical_facts`: entità, proprietà, valore, identificatore esterno, generazione/gioco e riferimento alla fonte.
- `subjects`: ID, titolo, descrizione e ordine.
- `lessons`: ID stabile, materia, livello, titolo, contenuto, prerequisiti e stato editoriale.
- `questions`: ID stabile, formato, testo, risposte possibili, risposta corretta, spiegazione, difficoltà e stato editoriale.
- `question_facts`: collegamento tra domanda e fatti canonici che la sostengono.
- `assessments`: ID, tipo, regole di selezione delle domande, soglia e numero di tentativi.
- `assessment_blueprints`: quote per materia, unità e difficoltà, per evitare prove sbilanciate.
- `student_progress`: lezioni completate, verifiche, tentativi, punteggi e argomenti da ripassare.

Gli ID devono restare stabili tra le versioni. L'archivio editoriale non deve essere mescolato ai dati locali già usati per salvataggi, catalogazione, PP o acquisti. L'eventuale sincronizzazione online va progettata in una fase separata, compatibile con la fondazione Supabase già presente sul branch dedicato.

## Piano di realizzazione

1. Approvare il programma e i prerequisiti.
2. Definire lo schema editoriale e le regole di validazione.
3. Creare un primo campione di lezioni e domande revisionate per una sola materia.
4. Verificare difficoltà, chiarezza, bilanciamento e funzionamento degli esami.
5. Estendere il catalogo didattico alle altre materie.
6. Collegare il sistema all'interfaccia dell'accademia senza alterare catalogo, economie o salvataggi.
7. Automatizzare i controlli sui dati importati e sulle domande prima della pubblicazione.

## Riferimenti

- PokéAPI v2: https://pokeapi.co/docs/v2
- PokéAPI repository e licenza: https://github.com/PokeAPI/pokeapi
- Pokédex ufficiale: https://www.pokemon.com/it/pokedex
- Bulbapedia: https://bulbapedia.bulbagarden.net/

Poke Study è un progetto fan-made non ufficiale. Pokémon e i relativi nomi e contenuti appartengono ai rispettivi titolari.
