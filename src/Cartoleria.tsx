import type { Dispatch, SetStateAction } from 'react';
import { BookOpen, ChevronRight, FlaskConical, GraduationCap, ShoppingBag, Trophy } from 'lucide-react';
import type { SavedProgress } from './types';
import type { ShopProduct, ShopTab } from './App';

const SCANNER_LEVELS = 20;
const RESEARCH_LEVELS = 12;

type CartoleriaProps = {
  academy: string;
  progress: SavedProgress;
  availableShopCount: number;
  shopProducts: ShopProduct[];
  inventory: string[];
  shopPricingReady: boolean;
  shopTab: ShopTab;
  setShopTab: Dispatch<SetStateAction<ShopTab>>;
  productUnlocked: (product: ShopProduct, inventory: string[], completedPokemon: number) => boolean;
  buyItem: (product: ShopProduct) => void;
  notice: string;
};

export default function Cartoleria({
  academy, progress, availableShopCount, shopProducts, inventory, shopPricingReady,
  shopTab, setShopTab, productUnlocked, buyItem, notice,
}: CartoleriaProps) {
  return (
    <div className={`cartoleria-page academy-theme-${academy}`}>
      <>
                  <div className="breadcrumb">Home / Servizi / <b>Cartoleria</b></div>
                  <section className="shop-hero">
                    <div className="shop-hero-copy">
                      <span className="eyebrow">NEGOZIO DELL’ACCADEMIA</span>
                      <h1>Cartoleria</h1>
                      <p>Investi i punti guadagnati per sbloccare strumenti, potenziamenti e nuovi archivi. Gli acquisti permanenti restano nel tuo profilo.</p>
                    </div>
                    <div className="shop-wallets">
                      <div className="shop-wallet shop-wallet-poke"><span className="shop-wallet-icon">✦</span><div><small>IL TUO SALDO</small><strong>{progress.points.toLocaleString('it-IT')}</strong><span>Punti Poké</span></div></div>
                      <div className="shop-wallet shop-wallet-exam"><span className="shop-wallet-icon">★</span><div><small>IL TUO SALDO</small><strong>{progress.examPoints.toLocaleString('it-IT')}</strong><span>Punti esame</span></div></div>
                    </div>
                  </section>
                  <section className="shop-guide-strip">
                    <div><span className="shop-guide-number">01</span><div><strong>Scegli una sezione</strong><small>Strumenti e potenziamenti oppure contenuti speciali.</small></div></div>
                    <div><span className="shop-guide-number">02</span><div><strong>Controlla i requisiti</strong><small>Le schede indicano cosa serve per sbloccare ogni acquisto.</small></div></div>
                    <div><span className="shop-guide-number">03</span><div><strong>Acquista e usa</strong><small>Gli elementi acquistati restano disponibili.</small></div></div>
                  </section>
                  <div className="shop-section-heading"><div><span className="eyebrow">CATALOGO</span><h2>Cosa vuoi sbloccare?</h2></div><span className="shop-available-count">{availableShopCount} acquistabili ora</span></div>
                  <div className="shop-tabs" role="tablist" aria-label="Sezioni della cartoleria">
                    <button role="tab" aria-selected={shopTab === 'oggetti'} className={shopTab === 'oggetti' ? 'active' : ''} onClick={() => setShopTab('oggetti')}>
                      <span className="shop-tab-icon"><ShoppingBag size={19}/></span><span><strong>Strumenti e potenziamenti</strong><small>Paghi in Punti Poké</small></span><span className="shop-tab-count">{shopProducts.filter(product => product.category === 'oggetti' && !inventory.includes(product.id) && productUnlocked(product, inventory, progress.completedIds.length) && (product.currency !== 'poke' || shopPricingReady) && progress.points >= product.cost).length}</span>
                    </button>
                    <button role="tab" aria-selected={shopTab === 'super-aiuti'} className={shopTab === 'super-aiuti' ? 'active' : ''} onClick={() => setShopTab('super-aiuti')}>
                      <span className="shop-tab-icon"><Trophy size={19}/></span><span><strong>Archivi e contenuti speciali</strong><small>Paghi in Punti esame</small></span><span className="shop-tab-count">{shopProducts.filter(product => product.category === 'super-aiuti' && !inventory.includes(product.id) && productUnlocked(product, inventory, progress.completedIds.length) && progress.examPoints >= product.cost).length}</span>
                    </button>
                  </div>
                  {notice && <div className="notice-inline" role="status">{notice}</div>}
                  <div className="shop-catalog-intro"><div><strong>{shopTab === 'oggetti' ? 'Strumenti per la tua ricerca' : 'Premi per i tuoi progressi'}</strong><p>{shopTab === 'oggetti' ? 'Gli strumenti attivi aiutano durante la classificazione; i livelli successivi migliorano quelli già acquistati.' : 'Usa i Punti esame ottenuti completando le prove per sbloccare archivi, modalità e personalizzazioni.'}</p></div><span>{shopProducts.filter(product => product.category === shopTab).length} articoli</span></div>
                  <div className="shop-grid shop-grid-refactor">
                    {shopProducts.filter(product => product.category === shopTab && product.kind !== 'upgrade').sort((left, right) => left.cost - right.cost || left.name.localeCompare(right.name, 'it')).map(product => {
                      const owned = inventory.includes(product.id);
                      const unlocked = productUnlocked(product, inventory, progress.completedIds.length);
                      const balance = product.currency === 'poke' ? progress.points : progress.examPoints;
                      const upgradeIds = product.id === 'scanner' ? Array.from({ length: SCANNER_LEVELS - 1 }, (_, index) => `scanner-upgrade-${index + 2}`) : product.id === 'research' ? Array.from({ length: RESEARCH_LEVELS - 1 }, (_, index) => `research-upgrade-${index + 2}`) : product.id === 'multi-select-1' ? Array.from({ length: 7 }, (_, index) => `multi-select-${index + 2}`) : [];
                      const upgrades = upgradeIds.map(id => shopProducts.find(entry => entry.id === id)).filter((entry): entry is ShopProduct => Boolean(entry));
                      const purchasedUpgrades = upgrades.filter(upgrade => inventory.includes(upgrade.id)).length;
                      const currentLevel = (owned ? 1 : 0) + purchasedUpgrades;
                      const nextUpgrade = owned ? upgrades.find(upgrade => !inventory.includes(upgrade.id)) : undefined;
                      const purchaseProduct = nextUpgrade ?? product;
                      const isUpgradeAction = owned && Boolean(nextUpgrade);
                      const purchaseUnlocked = owned ? Boolean(nextUpgrade && productUnlocked(nextUpgrade, inventory, progress.completedIds.length)) : unlocked;
                      const purchaseBalance = purchaseProduct.currency === 'poke' ? progress.points : progress.examPoints;
                      const canBuy = !owned ? unlocked && balance >= product.cost && (product.currency !== 'poke' || shopPricingReady) : Boolean(nextUpgrade && purchaseUnlocked && purchaseBalance >= purchaseProduct.cost && (purchaseProduct.currency !== 'poke' || shopPricingReady));
                      const requirement = product.requirementLabel ?? (product.requires?.length ? `Acquista prima: ${product.requires.map(id => shopProducts.find(entry => entry.id === id)?.name ?? id).join(', ')}` : product.requiredPokemon ? `Cataloga almeno ${product.requiredPokemon} Pokémon` : 'Nessun requisito aggiuntivo');
                      const requirements = [...(product.requires ?? []).map(id => ({ label: `Acquista ${shopProducts.find(entry => entry.id === id)?.name ?? id}`, done: inventory.includes(id) })), ...(product.requiredPokemon ? [{ label: `Cataloga ${product.requiredPokemon} Pokémon (${Math.min(progress.completedIds.length, product.requiredPokemon)}/${product.requiredPokemon})`, done: progress.completedIds.length >= product.requiredPokemon, ratio: Math.min(1, progress.completedIds.length / product.requiredPokemon) }] : [])];
                      const requirementProgress = requirements.length ? requirements.reduce((sum, item) => sum + ('ratio' in item ? item.ratio : item.done ? 1 : 0), 0) / requirements.length : unlocked ? 1 : 0;
                      const displayDescription = owned && nextUpgrade ? nextUpgrade.description : product.description;
                      const displayCost = owned && nextUpgrade ? nextUpgrade.cost : product.cost;
                      const displayCurrency = owned && nextUpgrade ? nextUpgrade.currency : product.currency;
                      const status = owned && !nextUpgrade ? 'Livello massimo' : owned ? 'Posseduto' : unlocked ? balance < product.cost ? 'Punti insufficienti' : 'Disponibile' : 'Requisiti in corso';
                      const icon = product.kind === 'active' ? <FlaskConical size={23}/> : product.kind === 'upgrade' ? <ChevronRight size={23}/> : product.kind === 'archive' ? <BookOpen size={23}/> : product.kind === 'cosmetic' ? <GraduationCap size={23}/> : product.kind === 'mode' ? <Trophy size={23}/> : <BookOpen size={23}/>;
                      return <article className={`shop-card shop-card-refactor ${owned ? 'is-owned' : ''} ${!unlocked && !owned ? 'is-locked' : ''} ${canBuy ? 'is-affordable' : ''}`} key={product.id}>
                        <div className={`shop-product-icon shop-product-icon-${product.kind}`}>{icon}</div>
                        <div className="shop-product-content">
                          <div className="shop-product-topline"><span className="shop-product-type">{product.kind === 'active' ? 'STRUMENTO ATTIVO' : product.kind === 'passive' ? 'VANTAGGIO PERMANENTE' : product.kind === 'archive' ? 'ARCHIVIO' : product.kind === 'mode' ? 'MODALITÀ' : 'PERSONALIZZAZIONE'}</span><span className={`shop-product-status ${owned && !nextUpgrade ? 'shop-product-owned' : canBuy ? 'shop-product-ready' : !unlocked && !owned ? 'shop-product-locked-status' : ''}`}>{status}</span></div>
                          <h3>{product.name}{upgrades.length > 0 && <span className="shop-level-count">{Math.max(owned ? 1 : 0, currentLevel)}/{upgrades.length + 1}</span>}</h3>
                          <p>{displayDescription}</p>
                          {upgrades.length > 0 && <div className="shop-level-track" aria-label={`Livello ${currentLevel} di ${upgrades.length + 1}`}><span style={{width:`${currentLevel / (upgrades.length + 1) * 100}%`}}/></div>}
                          {!owned && requirements.length > 0 && <div className="shop-requirement-progress"><div className="shop-requirement-copy"><strong>{unlocked ? 'Requisiti completati' : 'Completa i requisiti per sbloccare'}</strong><span>{Math.round(requirementProgress * 100)}%</span></div><div className="shop-level-track"><span style={{width:`${requirementProgress * 100}%`}}/></div><ul>{requirements.map((item,index)=><li className={item.done ? 'requirement-done' : ''} key={index}><span>{item.done ? '✓' : '○'}</span>{item.label}</li>)}</ul></div>}
                          {owned && nextUpgrade && <div className="shop-next-upgrade"><strong>Livello successivo · {currentLevel + 1}/{upgrades.length + 1}</strong><span>{nextUpgrade.name}: {nextUpgrade.description}</span></div>}
                          {!owned && requirements.length === 0 && <div className="shop-product-requirement requirement-met"><span>✓</span>{requirement}</div>}
                          <div className="shop-product-footer"><div className="shop-price"><strong>{displayCost.toLocaleString('it-IT')}</strong><span>{displayCurrency === 'poke' ? 'Punti Poké' : 'Punti esame'}</span></div>
                            {owned && !nextUpgrade ? <button className="shop-buy-button shop-buy-disabled" disabled>Livello massimo</button>
                              : !purchaseUnlocked ? <span className="shop-requirements-waiting">Requisiti da completare</span>
                              : <button className="shop-buy-button" disabled={!canBuy} onClick={() => buyItem(purchaseProduct)}>{isUpgradeAction ? 'Aggiorna' : 'Acquista'}</button>}
                          </div>
                        </div>
                      </article>;
                    })}
                  </div>
                </>
    </div>
  );
}
