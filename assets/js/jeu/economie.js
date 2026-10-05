// Economie : argent, prix des arbres et sac de mycelium.
import { BAG_GRAINS, BAG_COST, TREE_COST_MAX_MULT, TREE_COST_STEP } from './config.js';
import { partie, moneyEl, moneyVal, monde } from './etat.js';
import { savePlayerIfChanged } from './sauvegarde.js';

export function updateMoneyUI() {
  if (partie.moneyRevealed && moneyEl) moneyEl.classList.remove('d-none');
  if (moneyVal) moneyVal.textContent = partie.money;
}
export function earn(amount) {
  // En demo l'argent est cache (mycelium gratuit, voir ensureBag) mais s'accumule en
  // silence : le joueur le retrouve quand le jeu complet se debloque.
  partie.money += amount;
  if (!partie.DEMO && window.sporaSfx) sporaSfx.play('coin'); 
  partie.moneyRevealed = true;
  updateMoneyUI();
  savePlayerIfChanged();
}
// Assure qu'un sac est pret a verser : offre le tout premier, sinon facture BAG_COST
// si les fonds le permettent. Retourne false (et ne change rien) si on ne peut pas payer.
export function ensureBag() {
  if (partie.bagGrainsLeft > 0) return true;
  if (partie.DEMO || !partie.usedFreeBag) { partie.usedFreeBag = true; partie.bagGrainsLeft = BAG_GRAINS; return true; }
  if (partie.money < BAG_COST) return false;
  partie.money -= BAG_COST;
  partie.bagGrainsLeft = BAG_GRAINS;
  updateMoneyUI();
  return true;
}
export function nextTreeCost() {
  var planted = 0;
  for (var i = 0; i < monde.trees.length; i++) if (monde.trees[i].planted) planted++;
  return Math.min(planted, TREE_COST_MAX_MULT) * TREE_COST_STEP;
}
