# Poke Study — Gradi accademici, test e pagelle

## Principio generale

Poke Study non è suddiviso in anni scolastici. Il percorso è organizzato in gradi accademici progressivi. Ogni grado comprende lezioni distribuite tra tutte e cinque le materie già presenti nel progetto.

## Gradi proposti

### Grado I — Fondamenti
Riconoscimento e classificazione delle cinque macrocategorie; lettura dei dati essenziali del Pokédex; tipi e categorie di base; funzioni comuni di strumenti, bacche, mosse e reperti.

### Grado II — Conoscenza e relazioni
Tipi, statistiche, abilità, evoluzioni e forme; effetti e compatibilità degli strumenti; proprietà e utilizzi documentati di bacche e materiali; caratteristiche delle mosse; relazioni tra fossili, reperti e Pokémon.

### Grado III — Applicazione
Efficacia dei tipi; interpretazione delle statistiche; scelta di strumenti e risorse in scenari pratici; valutazione contestuale delle mosse; problemi che combinano più materie.

### Grado IV — Sintesi e approfondimento
Confronti tra Pokémon e mosse; scenari multidisciplinari; differenze tra giochi e generazioni; eccezioni alle regole; prove cumulative e ragionamento su più indizi.

I gradi sono una progressione interna al gioco, non corrispondono a una durata reale. La sequenza e i prerequisiti delle singole lezioni vanno definiti nel programma di ogni grado.

## Test al termine di ogni lezione

- Ogni lezione obbligatoria termina con un test dedicato.
- Il voto è espresso in decimi, da 1 a 10.
- Il giocatore può ripetere lo stesso test tutte le volte che desidera; a ogni tentativo il sistema propone domande casuali selezionate dal database pertinente alla lezione.
- Ogni tentativo riceve un voto in decimi e viene conservato nello storico.
- Il voto effettivo della lezione è la media aritmetica di **tutti** i tentativi svolti per quel test, inclusi quelli insufficienti.
- La lezione è superata e quella successiva si sblocca quando la media effettiva raggiunge almeno **6/10**. Finché la media è inferiore a 6/10, il test può essere ripetuto.
- Le domande valutano gli obiettivi spiegati nella lezione e non introducono conoscenze mai presentate.

## Pagella del grado

La pagella mostra:
- il voto di ciascuna delle cinque materie;
- le lezioni completate e quelle ancora da superare per ogni materia;
- lo storico dei test e dei tentativi;
- la media complessiva del grado;
- lo stato: **In corso**, **Da completare** oppure **Superato**.

Il voto di una materia è la media aritmetica dei voti effettivi delle lezioni superate di quella materia; ogni voto effettivo di lezione è già la media di tutti i tentativi del relativo test. La media complessiva del grado è la media aritmetica dei cinque voti di materia, con uguale peso per ciascuna materia.

Se una materia non ha voti registrati o rimangono lezioni obbligatorie incomplete, la pagella è provvisoria e il grado non può essere superato.

## Requisiti per superare un grado

Devono essere soddisfatte entrambe le condizioni:

1. tutte le lezioni obbligatorie del grado sono state completate superando i test con almeno 6/10;
2. la media complessiva della pagella è almeno **8/10**.

Se tutte le lezioni sono completate ma la media è inferiore a 8/10, il grado resta in corso. Le regole per recuperare o migliorare i voti delle lezioni già superate saranno definite separatamente; in ogni caso, i nuovi tentativi devono essere aggiunti allo storico e concorrere alla media del test senza cancellare i risultati precedenti.

I calcoli usano i voti non arrotondati; l'arrotondamento è solo visivo e non può trasformare una media inferiore a 8 in un grado superato.

## Regole editoriali per test e pagelle

- Ogni domanda ha risposta corretta verificata, spiegazione e fonte.
- Le domande devono essere coerenti con il grado e con le lezioni già completate.
- Le prove devono distribuire le domande in modo equilibrato tra gli argomenti previsti.
- I dati specifici di una generazione o di un gioco devono essere identificati chiaramente.
- Le lezioni e le domande possono essere revisionate senza modificare retroattivamente lo storico dei voti già ottenuti.

## Nota di implementazione

Questa specifica definisce il comportamento desiderato, ma non implementa ancora schermate, salvataggi o calcolo dei voti. Restano da definire le regole per recuperare o migliorare voti quando il grado è completo ma la media complessiva è inferiore a 8/10, oltre alla composizione precisa dei gradi.
