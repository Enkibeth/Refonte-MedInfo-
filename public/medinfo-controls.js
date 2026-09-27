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
