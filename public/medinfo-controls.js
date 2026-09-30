/* Même famille SVG que l’application ; uniquement présentation des contrôles. */
window.medinfoDecorateControl = function (button) {
  if (button.tagName !== 'BUTTON' || button.querySelector('svg')) return button;
  var text = button.textContent.trim();
  var symbols = { '↑': ['arrowUp', 'Monter'], '↓': ['chevronDown', 'Descendre'], '🗑': ['trash', 'Supprimer'], '✕': ['x', 'Fermer'], '⤓': ['download', 'Exporter'], '＋': ['plus', 'Ajouter'], '✓': ['check', 'Valider'] };
  var first = Array.from(text)[0];
  var item = symbols[first];
  if (!item) return button;
  var label = button.getAttribute('aria-label') || button.title || text.slice(first.length).trim() || item[1];
  button.setAttribute('aria-label', label);
  button.title = label;
  button.textContent = text.slice(first.length).trim();
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'medinfo-icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '/medinfo-icons.svg#' + item[0]);
  svg.append(use);
  button.prepend(svg);
  return button;
};
document.addEventListener('DOMContentLoaded', function () { document.querySelectorAll('button').forEach(window.medinfoDecorateControl); });

/*
 * Chargement « proactif » des aides IA des pages autonomes (2026-09) — pendant de
 * src/ui/progress/stagedProgress.ts côté application : étapes RÉELLES de ce que fait la
 * route, avancées selon le temps écoulé (le serveur ne renvoie aucun point d'étape), la
 * dernière restant « en cours » jusqu'à la réponse ; barre jamais pleine ; message de
 * patience au-delà de `slowAfterMs`, sans durée promise.
 *
 *   var p = medinfoProgress({ title: '…', steps: [{ label: '…', afterMs: 0 }, …] });
 *   conteneur.append(p.el);   // le MÊME nœud peut être ré-attaché après un re-rendu
 *   …  p.stop();               // à la fin de l'appel (succès ou échec)
 */
window.medinfoProgress = function (opts) {
  var steps = opts.steps || [];
  var slowAfterMs = opts.slowAfterMs || 45000;
  var CEILING = 0.94;
  var start = Date.now();
  var root = document.createElement('div');
  root.className = 'mi-progress';
  root.setAttribute('role', 'progressbar');
  root.setAttribute('aria-busy', 'true');
  var head = document.createElement('div');
  head.className = 'mi-progress-head';
  var spin = document.createElement('span');
  spin.className = 'mi-progress-spin';
  spin.setAttribute('aria-hidden', 'true');
  var title = document.createElement('span');
  title.className = 'mi-progress-title';
  title.textContent = opts.title || 'Traitement en cours';
  var time = document.createElement('span');
  time.className = 'mi-progress-time';
  head.append(spin, title, time);
  var track = document.createElement('div');
  track.className = 'mi-progress-track';
  var fill = document.createElement('div');
  fill.className = 'mi-progress-fill';
  track.append(fill);
  var list = document.createElement('ol');
  list.className = 'mi-progress-steps';
  var items = steps.map(function (s) {
    var li = document.createElement('li');
    li.textContent = s.label;
    list.append(li);
    return li;
  });
  var slow = document.createElement('p');
  slow.className = 'mi-progress-slow';
  slow.hidden = true;
  slow.textContent = 'Toujours en cours — les contenus détaillés prennent parfois plus longtemps. Tu peux rester sur la page.';
  root.append(head, track, list, slow);

  var lastActive = -1;
  function tick() {
    var elapsed = Date.now() - start;
    var active = 0;
    for (var i = 0; i < steps.length; i++) if (elapsed >= steps[i].afterMs) active = i;
    var next = steps[active + 1] ? steps[active + 1].afterMs : null;
    var from = steps[active] ? steps[active].afterMs : 0;
    var span = next !== null ? next - from : Math.max(10000, slowAfterMs - from);
    var within = next !== null ? Math.min(1, (elapsed - from) / span) : 1 - Math.exp(-(elapsed - from) / span);
    var fraction = steps.length ? Math.min(CEILING, (active + within) / steps.length) : 0;
    fill.style.width = (Math.round(fraction * 1000) / 10) + '%';
    var secs = Math.floor(elapsed / 1000);
    time.textContent = secs < 60 ? secs + ' s' : Math.floor(secs / 60) + ' min ' + String(secs % 60).padStart(2, '0');
    if (active !== lastActive) {
      items.forEach(function (li, j) {
        li.className = j < active ? 'is-done' : j === active ? 'is-active' : '';
        if (j === active) li.setAttribute('aria-live', 'polite'); else li.removeAttribute('aria-live');
      });
      root.setAttribute('aria-label', (opts.title || '') + ' : ' + (steps[active] ? steps[active].label : ''));
      lastActive = active;
    }
    slow.hidden = elapsed < slowAfterMs;
  }
  tick();
  var timer = setInterval(tick, 500);
  return {
    el: root,
    stop: function () {
      clearInterval(timer);
      if (root.parentNode) root.parentNode.removeChild(root);
    },
  };
};
