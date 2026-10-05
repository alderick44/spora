// Panneau de debug : curseurs pour changer les reglages en direct.
import { DEBUG_FIELDS, getDebugVar, setDebugVar } from './config.js';
import { debugPanel, partie, treasureCountEl, speedWrap, debugToggleBtn } from './etat.js';

var debugDefaults = null;
// Section repliable du panneau d'options : en-tete bouton (aria-expanded) + corps.
var sectionSeq = 0;
function makeSection(title, open) {
  var id = 'logo-explosion-sec-' + (sectionSeq++);
  var sec = document.createElement('div');
  sec.className = 'logo-explosion-debug-section';
  var head = document.createElement('button');
  head.type = 'button';
  head.className = 'logo-explosion-debug-head';
  head.setAttribute('aria-controls', id);
  head.textContent = title;
  var body = document.createElement('div');
  body.className = 'logo-explosion-debug-body';
  body.id = id;
  function setOpen(o) {
    head.setAttribute('aria-expanded', o ? 'true' : 'false');
    body.hidden = !o;
  }
  head.addEventListener('click', function () { setOpen(body.hidden); });
  setOpen(open);
  sec.appendChild(head);
  sec.appendChild(body);
  return { sec: sec, body: body };
}
function buildDebugPanel() {
  if (!debugPanel || partie.debugBuilt) return;
  partie.debugBuilt = true;
  debugDefaults = {};
  var groups = [], byGroup = {};
  for (var i = 0; i < DEBUG_FIELDS.length; i++) {
    var f = DEBUG_FIELDS[i];
    debugDefaults[f[1]] = getDebugVar(f[1]);
    if (!byGroup[f[0]]) { byGroup[f[0]] = []; groups.push(f[0]); }
    byGroup[f[0]].push(f);
  }
  var frag = document.createDocumentFragment();
  // Compteur de tresors : plus flottant sur la scene, en tete du panneau (voir updateTreasureUI).
  if (treasureCountEl) {
    frag.appendChild(treasureCountEl);
    if (partie.treasureDefs.length) treasureCountEl.classList.remove('d-none');
  }
  // Meteo, vitesse et gazon (anciennement la barre en bas a gauche) : seule section ouverte.
  if (speedWrap) {
    var wx = makeSection('Météo et rythme', true);
    wx.body.appendChild(speedWrap);
    speedWrap.classList.remove('d-none');
    frag.appendChild(wx.sec);
  }
  groups.forEach(function (g) {
    var gs = makeSection(g, false);
    var fs = gs.body;
    byGroup[g].forEach(function (f) {
      var key = f[1], min = f[3], max = f[4], step = f[5];
      var row = document.createElement('div');
      row.className = 'logo-explosion-debug-row';
      var label = document.createElement('label');
      label.textContent = f[2];
      label.setAttribute('for', 'dbg-' + key);
      var input = document.createElement('input');
      input.type = 'range'; input.id = 'dbg-' + key;
      input.min = min; input.max = max; input.step = step;
      input.value = getDebugVar(key);
      var out = document.createElement('output');
      out.textContent = input.value;
      input.addEventListener('input', function () {
        var v = parseFloat(this.value);
        setDebugVar(key, v);
        out.textContent = v;
      });
      row.appendChild(label); row.appendChild(input); row.appendChild(out);
      fs.appendChild(row);
    });
    frag.appendChild(gs.sec);
  });
  var resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'logo-explosion-debug-reset';
  resetBtn.textContent = 'Réinitialiser les valeurs';
  resetBtn.addEventListener('click', function () {
    for (var k in debugDefaults) setDebugVar(k, debugDefaults[k]);
    var inputs = debugPanel.querySelectorAll('input[id^="dbg-"]');
    for (var j = 0; j < inputs.length; j++) {
      var inp = inputs[j], key2 = inp.id.slice(4);
      inp.value = debugDefaults[key2];
      inp.nextSibling.textContent = inp.value;
    }
  });
  frag.appendChild(resetBtn);
  debugPanel.appendChild(frag);
}

// Ouvre ou ferme le panneau : appele a chaque clic sur son bouton. Ce module n'est charge
// qu'au premier clic (voir principal.js).
export function toggleDebug() {
  buildDebugPanel();
  var opening = debugPanel.classList.contains('d-none');
  debugPanel.classList.toggle('d-none', !opening);
  debugToggleBtn.classList.toggle('is-active', opening);
  debugToggleBtn.setAttribute('aria-pressed', opening ? 'true' : 'false');
}
