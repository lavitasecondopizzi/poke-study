// Catalog generator intentionally reads only the versioned local database.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const ITEM_DIR = path.join(ROOT, 'public', 'images', 'items');
const DATA_DIR = path.join(ROOT, 'public', 'data');
const DB_DIR = path.join(ROOT, 'data', 'pokeapi', 'v2');

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

await mkdir(DATA_DIR, { recursive: true });

const itemIndex = await readJson(path.join(DB_DIR, 'item', 'index.json'));
const idByName = new Map(itemIndex.results.map(item => [
  item.name,
  Number(item.url.split('/').filter(Boolean).at(-1)),
]));

const files = await readdir(ITEM_DIR, { withFileTypes: true });
const localItems = files
  .filter(file => file.isFile() && file.name.toLowerCase().endsWith('.png'))
  .map(file => ({
    name: file.name.slice(0, -4),
    url: `/images/items/${file.name}`,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const items = [];
for (const item of localItems) {
  const id = idByName.get(item.name);
  let localizedName = item.name.replace(/-/g, ' ');

  if (id) {
    const detail = await readJson(path.join(DB_DIR, 'item', String(id), 'index.json'));
    localizedName = detail.names?.find(name => name.language?.name === 'it')?.name
      || detail.name
      || localizedName;
  }

  items.push({ ...item, localizedName });
}

await writeFile(path.join(DATA_DIR, 'items.json'), JSON.stringify(items));
console.log(`Catalogo strumenti generato dai dati locali: ${items.length} immagini.`);
const machineDir = path.join(DB_DIR, 'machine');
const moveDir = path.join(DB_DIR, 'move');
const machineIndex = await readJson(path.join(machineDir, 'index.json'));
const moveIndex = await readJson(path.join(moveDir, 'index.json'));
const itemDetails = new Map();
const moveDetails = new Map();
const itemIdByName = idByName;
const moveIdByName = new Map(moveIndex.results.map(move => [
  move.name,
  Number(move.url.split('/').filter(Boolean).at(-1)),
]));

function italianVersionName(name) {
  const labels = {
    'red-blue': 'Rosso e Blu',
    yellow: 'Giallo',
    'gold-silver': 'Oro e Argento',
    crystal: 'Cristallo',
    'ruby-sapphire': 'Rubino e Zaffiro',
    emerald: 'Smeraldo',
    'firered-leafgreen': 'Rosso Fuoco e Verde Foglia',
    'diamond-pearl': 'Diamante e Perla',
    platinum: 'Platino',
    'heartgold-soulsilver': 'Oro HeartGold e Argento SoulSilver',
    'black-white': 'Nero e Bianco',
    'black-2-white-2': 'Nero 2 e Bianco 2',
    'x-y': 'X e Y',
    'omega-ruby-alpha-sapphire': 'Rubino Omega e Zaffiro Alpha',
    'sun-moon': 'Sole e Luna',
    'ultra-sun-ultra-moon': 'Ultrasole e Ultraluna',
    'lets-go-pikachu-lets-go-eevee': 'Let’s Go Pikachu e Let’s Go Eevee',
    'sword-shield': 'Spada e Scudo',
    'brilliant-diamond-and-shining-pearl': 'Diamante Lucente e Perla Splendente',
    'legends-arceus': 'Leggende Pokémon: Arceus',
    'scarlet-violet': 'Scarlatto e Violetto',
  };
  return labels[name] || name.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

async function localizedResourceName(resourceDir, id, fallback, cache) {
  if (!id) return fallback;
  if (!cache.has(id)) {
    cache.set(id, (async () => {
      const detail = await readJson(path.join(resourceDir, String(id), 'index.json'));
      return detail.names?.find(name => name.language?.name === 'it')?.name
        || detail.name
        || fallback;
    })());
  }
  return cache.get(id);
}

const machineIds = machineIndex.results
  .map(machine => Number(machine.url.split('/').filter(Boolean).at(-1)))
  .filter(Number.isFinite);
const machineRecords = [];
const seenMachines = new Set();

for (const machineId of machineIds) {
  const machine = await readJson(path.join(machineDir, String(machineId), 'index.json'));
  if (!machine.item?.name || !machine.move?.name || !machine.version_group?.name) continue;
  const key = [machine.version_group.name, machine.item.name, machine.move.name].join('|');
  if (seenMachines.has(key)) continue;
  seenMachines.add(key);

  const itemId = itemIdByName.get(machine.item.name);
  const moveId = moveIdByName.get(machine.move.name);
  const [itemLabel, moveLabel] = await Promise.all([
    localizedResourceName(path.join(DB_DIR, 'item'), itemId, machine.item.name, itemDetails),
    localizedResourceName(moveDir, moveId, machine.move.name, moveDetails),
  ]);
  machineRecords.push({
    id: key,
    itemName: machine.item.name,
    itemLabel,
    moveName: machine.move.name,
    moveLabel,
    versionGroup: machine.version_group.name,
    versionLabel: italianVersionName(machine.version_group.name),
  });
}

machineRecords.sort((a, b) =>
  a.versionLabel.localeCompare(b.versionLabel, 'it')
  || a.itemLabel.localeCompare(b.itemLabel, 'it')
  || a.moveLabel.localeCompare(b.moveLabel, 'it'),
);
await writeFile(path.join(DATA_DIR, 'machines.json'), JSON.stringify(machineRecords));
console.log(`Archivio MT e tecniche generato: ${machineRecords.length} combinazioni macchina/mossa.`);

