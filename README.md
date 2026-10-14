# Poké Study

Portale scolastico fan-made per studiare e catalogare il mondo Pokémon: specie, strumenti, bacche e materiali, MT e tecniche, fossili e reperti.

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

## Catalogo e lezioni
- Archivio consultabile con ricerca, categorie e paginazione indipendente da 15 elementi per pagina.
- Tutti i 1.025 Pokémon disponibili fin dall'inizio.
- Lezioni di classificazione con un massimo di 15 carte miste per sessione.
- Entità suddivise in Pokémon, strumenti e oggetti, bacche/ingredienti/materiali, MT e tecniche, reperti e oggetti speciali.
- Tentativi errati senza penalità e +1 Punto Poké per ogni classificazione corretta.
- Salvataggio locale di punteggio, progressi e acquisti.
- Interfaccia scolastica responsive e supporto PWA/offline per le risorse già scaricate.

Le specie e gli oggetti vengono caricati da risorse pubbliche; il primo caricamento del catalogo completo degli oggetti richiede una connessione Internet. Le illustrazioni sono recuperate dal repository pubblico degli sprite Pokémon.

Questo è un progetto fan-made non ufficiale e non è affiliato a Nintendo, Game Freak o The Pokémon Company.

## Bacheca community (foundation in progress)

La prima tranche del backend condiviso è documentata in [docs/community-backend.md](docs/community-backend.md). Include lo schema Supabase, una Edge Function con token privato e il client TypeScript; la Bacheca online non è ancora esposta nell'interfaccia finché il flusso di iscrizione non può associare in sicurezza il profilo del gioco all'identità remota. Le variabili locali vanno in `.env.local` (ignorato da Git); non committare mai chiavi service-role.
