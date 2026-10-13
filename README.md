# Poké Study

Gioco fan-made di allenamento e scoperta del Pokédex Nazionale, ambientato in un portale scolastico digitale.

## Stack
- React + TypeScript
- Vite
- GitHub Pages

## Avvio locale
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Pubblicazione su GitHub Pages
Il workflow GitHub Actions in `.github/workflows/deploy.yml` pubblica automaticamente il progetto su GitHub Pages quando viene aggiornato il branch `main`. In **Settings → Pages**, seleziona **GitHub Actions** come source.

## Dati Pokémon
La prima versione carica l'elenco delle specie dal servizio pubblico PokéAPI. È richiesta una connessione Internet al primo caricamento. Le illustrazioni sono recuperate dal repository pubblico degli sprite Pokémon.

## Progetto
- Tutti i 1.025 Pokémon e tutti gli slot del Pokédex Nazionale sono disponibili fin dall'inizio, senza lezioni, turni o sblocchi.
- Le schede Pokémon vengono mostrate in ordine casuale e si possono trascinare negli slot numerati.
- Tentativi errati illimitati, senza penalità.
- +1 Punto Poké per ogni assegnazione corretta.
- Salvataggio locale di punteggio e progressi.
- Interfaccia ispirata ai portali scolastici e ai siti del 2007, adattata anche ai dispositivi mobili.

Questo è un progetto fan-made non ufficiale e non è affiliato a Nintendo, Game Freak o The Pokémon Company.
