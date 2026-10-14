import { useMemo, useState } from 'react';
import {
  BookOpen, CheckCircle2, ChevronRight, FlaskConical, GraduationCap,
  Search, ShieldCheck, ShoppingBag, Sparkles, Trophy,
} from 'lucide-react';
import type { SavedProgress } from './types';
import type { ShopProduct } from './App';

const SCANNER_LEVELS = 20;
const RESEARCH_LEVELS = 12;
type ShopFilter = 'all' | 'available' | 'owned' | 'locked';

type CartoleriaProps = {
  academy: string;
  progress: SavedProgress;
  availableShopCount: number;
  shopProducts: ShopProduct[];
  inventory: string[];
  shopPricingReady: boolean;
  productUnlocked: (product: ShopProduct, inventory: string[], completedPokemon: number) => boolean;
  buyItem: (product: ShopProduct) => void;
  notice: string;
};

function productIcon(product: ShopProduct) {
  if (product.kind === 'active') return <FlaskConical size={22} />;
  if (product.kind === 'upgrade') return <ChevronRight size={22} />;
  if (product.kind === 'archive') return <BookOpen size={22} />;
  if (product.kind === 'cosmetic') return <GraduationCap size={22} />;
  if (product.kind === 'mode') return <Trophy size={22} />;
  return <Sparkles size={22} />;
}

function productTypeLabel(product: ShopProduct) {
  if (product.kind === 'active') return 'STRUMENTO ATTIVO';
  if (product.kind === 'passive') return 'VANTAGGIO PERMANENTE';
  if (product.kind === 'archive') return 'ARCHIVIO';
  if (product.kind === 'mode') return 'MODALITÀ';
  return 'PERSONALIZZAZIONE';
}

function ProductCard({
  product, products, inventory, progress, shopPricingReady, productUnlocked, buyItem,
}: {
  product: ShopProduct;
  products: ShopProduct[];
  inventory: string[];
  progress: SavedProgress;
  shopPricingReady: boolean;
  productUnlocked: CartoleriaProps['productUnlocked'];
  buyItem: CartoleriaProps['buyItem'];
}) {
  const owned = inventory.includes(product.id);
  const completedPokemon = progress.completedIds.length;
  const unlocked = productUnlocked(product, inventory, completedPokemon);
  const upgradeIds = product.id === 'scanner'
    ? Array.from({ length: SCANNER_LEVELS - 1 }, (_, index) => 'scanner-upgrade-' + (index + 2))
    : product.id === 'research'
      ? Array.from({ length: RESEARCH_LEVELS - 1 }, (_, index) => 'research-upgrade-' + (index + 2))
      : product.id === 'multi-select-1'
        ? Array.from({ length: 7 }, (_, index) => 'multi-select-' + (index + 2))
        : [];
  const upgrades = upgradeIds.map(id => products.find(entry => entry.id === id)).filter((entry): entry is ShopProduct => Boolean(entry));
  const purchasedUpgrades = upgrades.filter(upgrade => inventory.includes(upgrade.id)).length;
  const currentLevel = (owned ? 1 : 0) + purchasedUpgrades;
  const nextUpgrade = owned ? upgrades.find(upgrade => !inventory.includes(upgrade.id)) : undefined;
  const purchaseProduct = nextUpgrade ?? product;
  const isUpgradeAction = owned && Boolean(nextUpgrade);
  const purchaseUnlocked = owned
    ? Boolean(nextUpgrade && productUnlocked(nextUpgrade, inventory, completedPokemon))
    : unlocked;
  const canBuy = !owned
    ? unlocked && progress.points >= product.cost && shopPricingReady
    : Boolean(nextUpgrade && purchaseUnlocked && progress.points >= purchaseProduct.cost && shopPricingReady);
  const requirements = [
    ...(product.requires ?? []).map(id => ({
      label: 'Acquista ' + (products.find(entry => entry.id === id)?.name ?? id),
      done: inventory.includes(id),
    })),
    ...(product.requiredPokemon ? [{
      label: 'Cataloga ' + product.requiredPokemon + ' Pokémon (' + Math.min(completedPokemon, product.requiredPokemon) + '/' + product.requiredPokemon + ')',
      done: completedPokemon >= product.requiredPokemon,
      ratio: Math.min(1, completedPokemon / product.requiredPokemon),
    }] : []),
  ];
  const requirementProgress = requirements.length
    ? requirements.reduce((sum, item) => sum + ('ratio' in item ? item.ratio : item.done ? 1 : 0), 0) / requirements.length
    : unlocked ? 1 : 0;
  const displayDescription = owned && nextUpgrade ? nextUpgrade.description : product.description;
  const displayCost = owned && nextUpgrade ? nextUpgrade.cost : product.cost;
  const status = owned && !nextUpgrade
    ? 'Livello massimo'
    : owned
      ? 'Posseduto'
      : unlocked
        ? progress.points < product.cost ? 'Punti insufficienti' : 'Disponibile'
        : 'Requisiti in corso';
  const requirement = product.requirementLabel
    ?? (product.requires?.length
      ? 'Acquista prima: ' + product.requires.map(id => products.find(entry => entry.id === id)?.name ?? id).join(', ')
      : product.requiredPokemon
        ? 'Cataloga almeno ' + product.requiredPokemon + ' Pokémon'
        : 'Nessun requisito aggiuntivo');

  return (
    <article className={'shop-card shop-card-refactor ' + (owned ? 'is-owned ' : '') + (!unlocked && !owned ? 'is-locked ' : '') + (canBuy ? 'is-affordable' : '')}>
      <div className={'shop-product-icon shop-product-icon-' + product.kind}>{productIcon(product)}</div>
      <div className="shop-product-content">
        <div className="shop-product-topline">
          <span className="shop-product-type">{productTypeLabel(product)}</span>
          <span className={'shop-product-status ' + (owned && !nextUpgrade ? 'shop-product-owned' : canBuy ? 'shop-product-ready' : !unlocked && !owned ? 'shop-product-locked-status' : '')}>{status}</span>
        </div>
        <h3>{product.name}{upgrades.length > 0 && <span className="shop-level-count">{Math.max(owned ? 1 : 0, currentLevel)}/{upgrades.length + 1}</span>}</h3>
        <p>{displayDescription}</p>
        {upgrades.length > 0 && (
          <div className="shop-level-track" role="progressbar" aria-label={'Livello di ' + product.name} aria-valuemin={0} aria-valuemax={upgrades.length + 1} aria-valuenow={Math.max(owned ? 1 : 0, currentLevel)}>
            <span style={{ width: (currentLevel / (upgrades.length + 1) * 100) + '%' }} />
          </div>
        )}
        {!owned && requirements.length > 0 && (
          <div className="shop-requirement-progress">
            <div className="shop-requirement-copy"><strong>{unlocked ? 'Requisiti completati' : 'Completa i requisiti per sbloccare'}</strong><span>{Math.round(requirementProgress * 100)}%</span></div>
            <div className="shop-level-track"><span style={{ width: (requirementProgress * 100) + '%' }} /></div>
            <ul>{requirements.map((item, index) => <li className={item.done ? 'requirement-done' : ''} key={index}><span aria-hidden="true">{item.done ? '✓' : '○'}</span>{item.label}</li>)}</ul>
          </div>
        )}
        {owned && nextUpgrade && (
          <div className="shop-next-upgrade"><strong>Livello successivo · {currentLevel + 1}/{upgrades.length + 1}</strong><span>{nextUpgrade.name}: {nextUpgrade.description}</span></div>
        )}
        {!owned && requirements.length === 0 && <div className="shop-product-requirement requirement-met"><span aria-hidden="true">✓</span>{requirement}</div>}
        <div className="shop-product-footer">
          <div className="shop-price"><strong>₱ {displayCost.toLocaleString('it-IT')}</strong><span>Punti Poké</span></div>
          {owned && !nextUpgrade
            ? <button type="button" className="shop-buy-button shop-buy-disabled" disabled>Livello massimo</button>
            : !purchaseUnlocked
              ? <span className="shop-requirements-waiting">Requisiti da completare</span>
              : <button type="button" className="shop-buy-button" disabled={!canBuy} onClick={() => buyItem(purchaseProduct)}>{isUpgradeAction ? 'Aggiorna' : 'Acquista'}</button>}
        </div>
      </div>
    </article>
  );
}

export default function Cartoleria({
  academy, progress, availableShopCount, shopProducts, inventory, shopPricingReady,
  productUnlocked, buyItem, notice,
}: CartoleriaProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ShopFilter>('all');
  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('it-IT');
    return shopProducts
      .filter(product => product.kind !== 'upgrade')
      .filter(product => {
        if (!normalizedQuery) return true;
        return [product.name, product.description, product.requirementLabel ?? '']
          .some(value => value.toLocaleLowerCase('it-IT').includes(normalizedQuery));
      })
      .filter(product => {
        const owned = inventory.includes(product.id);
        const unlocked = productUnlocked(product, inventory, progress.completedIds.length);
        if (filter === 'owned') return owned;
        if (filter === 'available') {
          if (!owned) return unlocked && progress.points >= product.cost && shopPricingReady;
          const upgradeIds = product.id === 'scanner'
            ? Array.from({ length: SCANNER_LEVELS - 1 }, (_, index) => 'scanner-upgrade-' + (index + 2))
            : product.id === 'research'
              ? Array.from({ length: RESEARCH_LEVELS - 1 }, (_, index) => 'research-upgrade-' + (index + 2))
              : product.id === 'multi-select-1'
                ? Array.from({ length: 7 }, (_, index) => 'multi-select-' + (index + 2))
                : [];
          const nextUpgrade = upgradeIds.map(id => shopProducts.find(entry => entry.id === id))
            .find((entry): entry is ShopProduct => Boolean(entry && !inventory.includes(entry.id)));
          return Boolean(nextUpgrade && productUnlocked(nextUpgrade, inventory, progress.completedIds.length)
            && progress.points >= nextUpgrade.cost && shopPricingReady);
        }
        if (filter === 'locked') return !owned && !unlocked;
        return true;
      })
      .sort((left, right) => left.cost - right.cost || left.name.localeCompare(right.name, 'it'));
  }, [shopProducts, query, filter, inventory, productUnlocked, progress.completedIds.length, progress.points, shopPricingReady]);

  const superAiuti = visibleProducts.filter(product => product.category === 'super-aiuti');
  const strumenti = visibleProducts.filter(product => product.category === 'oggetti');
  const ownedCount = shopProducts.filter(product => product.kind !== 'upgrade' && inventory.includes(product.id)).length;

  function renderSection(title: string, description: string, products: ShopProduct[], id: string) {
    if (!products.length) return null;
    return (
      <section className="shop-refactor-section" aria-labelledby={id}>
        <div className="shop-refactor-section-heading">
          <div><span className="shop-refactor-section-eyebrow">CATALOGO</span><h2 id={id}>{title}</h2><p>{description}</p></div>
          <span className="shop-refactor-section-count">{products.length} {products.length === 1 ? 'articolo' : 'articoli'}</span>
        </div>
        <div className="shop-grid shop-grid-refactor">
          {products.map(product => <ProductCard key={product.id} product={product} products={shopProducts} inventory={inventory} progress={progress} shopPricingReady={shopPricingReady} productUnlocked={productUnlocked} buyItem={buyItem} />)}
        </div>
      </section>
    );
  }

  return (
    <div className={'cartoleria-page academy-theme-' + academy}>
      <div className="breadcrumb">Home / Servizi / <b>Cartoleria</b></div>
      <header className="shop-hero shop-hero-refactor">
        <div className="shop-hero-copy">
          <span className="eyebrow"><ShoppingBag size={14} /> NEGOZIO DELL’ACCADEMIA</span>
          <h1>Cartoleria</h1>
          <p>Strumenti, aiuti e archivi per il tuo percorso di studio. Tutto il catalogo è disponibile in un’unica pagina e utilizza i Punti Poké.</p>
          <div className="shop-hero-badges"><span><ShieldCheck size={14}/> Prezzi e progressi conservati</span><span><CheckCircle2 size={14}/> {availableShopCount} articoli acquistabili</span></div>
        </div>
        <div className="shop-wallets shop-wallets-refactor">
          <div className="shop-wallet shop-wallet-poke"><span className="shop-wallet-icon">₱</span><div><small>IL TUO SALDO</small><strong>{progress.points.toLocaleString('it-IT')}</strong><span>Punti Poké disponibili</span></div></div>
          <div className="shop-wallet shop-wallet-owned"><span className="shop-wallet-icon"><ShoppingBag size={20}/></span><div><small>GIÀ SBLOCCATI</small><strong>{ownedCount.toLocaleString('it-IT')}</strong><span>Aiuti e strumenti</span></div></div>
        </div>
      </header>

      <section className="shop-refactor-toolbar" aria-label="Cerca e filtra il catalogo">
        <label className="shop-refactor-search"><Search size={18}/><span className="sr-only">Cerca nel catalogo</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Cerca uno strumento, un aiuto o un archivio…" /></label>
        <label className="shop-refactor-filter"><span>Mostra</span><select value={filter} onChange={event => setFilter(event.target.value as ShopFilter)}><option value="all">Tutto il catalogo</option><option value="available">Acquistabili ora</option><option value="owned">Già sbloccati</option><option value="locked">Da sbloccare</option></select></label>
        <div className="shop-refactor-summary"><strong>{visibleProducts.length}</strong><span>di {shopProducts.filter(product => product.kind !== 'upgrade').length} articoli</span></div>
      </section>

      {notice && <div className="notice-inline shop-refactor-notice" role="status">{notice}</div>}

      {visibleProducts.length === 0
        ? <div className="shop-refactor-empty"><Search size={25}/><strong>Nessun articolo trovato</strong><p>Modifica la ricerca o scegli un altro filtro per visualizzare il catalogo.</p><button type="button" onClick={() => { setQuery(''); setFilter('all'); }}>Mostra tutto il catalogo</button></div>
        : <>
            {renderSection('Aiuti, archivi e funzioni speciali', 'Sblocchi permanenti, raccolte consultabili e funzioni aggiuntive.', superAiuti, 'shop-super-aiuti-title')}
            {renderSection('Strumenti di catalogazione', 'Supporti e potenziamenti per rendere più efficace la catalogazione.', strumenti, 'shop-strumenti-title')}
          </>}
    </div>
  );
}
