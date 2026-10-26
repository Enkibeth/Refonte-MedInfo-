import { tokens } from '@/ui/tokens';

/**
 * CSS de l'accueil, direction « Moniteur » (ADR-0047) — web seulement, injecté par
 * `<LandingStyle />` dans la page (le pré-rendu le contient : premier affichage juste).
 *
 * Trois rôles :
 *  1. Mise en page par plage (le pré-rendu est fait sans fenêtre : les styles JS valent la
 *     variante compacte, le CSS corrige les plages plus larges avec `!important`).
 *  2. Mouvement : animations `transform` / `opacity` (et `clip-path` pour les révélations),
 *     jamais de propriété de mise en page animée en boucle. Chaque état FINAL d'animation est
 *     un état lisible : sous prefers-reduced-motion (règle globale d'app/+html.tsx : durées
 *     quasi nulles), tout s'affiche directement à sa place.
 *  3. Bouton « Figer » : `lx-paused` sur la racine suspend toutes les animations (WCAG 2.2.2).
 *
 * Sélecteurs : `[data-mi~="…"]` posé par `lx()` / `mi()` ; états par `data-*` (`data-on`,
 * `data-i`, `data-d`…). Valeurs de couleur : tokens uniquement.
 */
const n = tokens.colors.night;
const p = tokens.colors.personas;
const EASE_OUT = 'cubic-bezier(.19,1,.22,1)';
const EASE_IN_OUT = 'cubic-bezier(.65,0,.35,1)';
const from = (bp: number) => `@media (min-width: ${bp}px)`;
const below = (bp: number) => `@media (max-width: ${bp - 1}px)`;

/** Rang d'un élément dans une séquence : `data-d="3"` → `--lx-d: 3`. */
const steps = Array.from({ length: 24 }, (_, i) => `[data-d="${i}"]{--lx-d:${i}}`).join('');
const timelineSteps = Array.from({ length: 6 }, (_, i) => `[data-s="${i}"]{--lx-s:${i}}`).join('');

const mint = (alpha: number) => `rgba(92,225,176,${alpha})`;
const grid = (alpha: number) => `rgba(188,197,230,${alpha})`;

/** Papier millimétré d'ECG : 1 mm (8 px) et 5 mm (40 px). */
const ECG_PAPER = `
  background-image:
    linear-gradient(${grid(0.1)} 1px, transparent 1px),
    linear-gradient(90deg, ${grid(0.1)} 1px, transparent 1px),
    linear-gradient(${grid(0.045)} 1px, transparent 1px),
    linear-gradient(90deg, ${grid(0.045)} 1px, transparent 1px);
  background-size: 40px 40px, 40px 40px, 8px 8px, 8px 8px;`;

/** Tracé répété de l'appel final (SVG en data-URI, blanc translucide). */
const CLOSING_TRACE = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="120" viewBox="0 0 720 120"><path d="M0 60 L40 60 Q55 51 70 60 L90 60 L96 66 L104 14 L112 76 L118 60 L150 60 Q174 44 198 60 L360 60 L400 60 Q415 51 430 60 L450 60 L456 66 L464 14 L472 76 L478 60 L510 60 Q534 44 558 60 L720 60" fill="none" stroke="#ffffff" stroke-opacity="0.28" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>',
)}")`;

export const LANDING_CSS = `
/* ── Accueil « Moniteur » (src/ui/landing/landingCss.ts) ── */
${steps}${timelineSteps}
${below(768)} { [data-mi~="ge768"] { display: none !important; } }
${from(768)} { [data-mi~="lt768"] { display: none !important; } }
[data-mi~="lx-sr"] { position: absolute !important; width: 1px !important; height: 1px !important; overflow: hidden !important; clip-path: inset(50%) !important; white-space: nowrap !important; }

/* Conteneur de page : marges 16 → 24 px. */
${from(640)} { [data-mi~="lx-container"] { padding-left: ${tokens.space.xl}px !important; padding-right: ${tokens.space.xl}px !important; } }
${from(640)} {
  [data-mi~="landing-actions"] { flex-direction: row !important; align-items: center !important; flex-wrap: wrap !important; }
  [data-mi~="landing-actions"] > * { align-self: auto !important; width: auto !important; }
}

/* ── 1. Premier écran ─────────────────────────────────────────────────────── */
[data-mi~="lx-hero-bg"] {
  background:
    radial-gradient(ellipse 50% 55% at 80% 70%, rgba(0,103,255,.32), transparent 70%),
    radial-gradient(ellipse 30% 40% at 4% 0%, ${mint(0.1)}, transparent 70%),
    linear-gradient(180deg, ${n.base} 0%, ${n.deep} 100%);
}
[data-mi~="lx-hero-bg"]::before {
  content: ""; position: absolute; inset: 0; ${ECG_PAPER}
  -webkit-mask-image: radial-gradient(ellipse 80% 75% at 55% 42%, #000 15%, transparent 80%);
  mask-image: radial-gradient(ellipse 80% 75% at 55% 42%, #000 15%, transparent 80%);
}
${from(640)} {
  [data-mi~="lx-h1"] { font-size: clamp(52px, 8.2vw, 96px) !important; line-height: 1 !important; letter-spacing: -0.028em !important; }
}
/* Mots du titre : chacun monte de sous son cache. */
[data-mi~="lx-nw"] { white-space: nowrap !important; }
[data-mi~="lx-w"] { display: inline-block !important; overflow: hidden; vertical-align: top; padding: 0 .09em .16em; margin: 0 -.09em -.16em; }
[data-mi~="lx-wi"] { display: inline-block !important; animation: lx-rise 1100ms ${EASE_OUT} both; animation-delay: calc(var(--lx-d, 0) * 65ms + 120ms); }
@keyframes lx-rise { from { transform: translate3d(0, 112%, 0) rotate(3deg); } to { transform: none; } }
[data-mi~="lx-in"] { animation: lx-fade-up 900ms ${EASE_OUT} both; animation-delay: calc(var(--lx-d, 0) * 120ms + 700ms); }
@keyframes lx-fade-up { from { opacity: 0; transform: translate3d(0, 14px, 0); } to { opacity: 1; transform: none; } }

/* Tracé du moniteur : nouvelle courbe derrière la barre de balayage, ancienne devant elle. */
[data-mi~="lx-trace"] { overflow: hidden; }
[data-mi~="lx-trace-new"] { animation: lx-trace-new 5600ms linear infinite; }
@keyframes lx-trace-new { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
[data-mi~="lx-trace-old"] { opacity: 0; animation: lx-trace-old 5600ms linear 5600ms infinite; animation-fill-mode: none; }
@keyframes lx-trace-old { from { opacity: .55; clip-path: inset(0 0 0 5%); } to { opacity: .55; clip-path: inset(0 0 0 100%); } }
[data-mi~="lx-trace-scan"] {
  background: linear-gradient(90deg, transparent calc(100% - 96px), ${mint(0.1)} calc(100% - 8px), ${n.mint} calc(100% - 2px), transparent 100%);
  -webkit-mask-image: linear-gradient(180deg, transparent, #000 30%, #000 70%, transparent);
  mask-image: linear-gradient(180deg, transparent, #000 30%, #000 70%, transparent);
  animation: lx-trace-scan 5600ms linear infinite;
}
@keyframes lx-trace-scan { from { transform: translate3d(-100%, 0, 0); } to { transform: translate3d(0, 0, 0); } }
[data-mi~="lx-node"] { transform-box: fill-box; transform-origin: center; animation: lx-node 2800ms ease-out infinite; }
@keyframes lx-node { 0% { transform: scale(1); opacity: 1; } 70%, 100% { transform: scale(2.3); opacity: 0; } }

/* Photographie : révélée par une barre de balayage, puis posée (léger recul). */
[data-mi~="lx-sweep"] { animation: lx-wipe 1400ms ${EASE_IN_OUT} 450ms both; }
@keyframes lx-wipe { from { clip-path: inset(0 100% 0 0 round 16px); } to { clip-path: inset(0 0 0 0 round 16px); } }
[data-mi~="lx-sweep"]::after {
  content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 2px; transform: translateX(-100%);
  background: ${n.mint}; box-shadow: 0 0 22px 7px ${mint(0.55)}; pointer-events: none;
  animation: lx-scanline 1400ms ${EASE_IN_OUT} 450ms both;
}
@keyframes lx-scanline { 0% { left: 0; opacity: 1; } 90% { opacity: 1; } 100% { left: 100%; opacity: 0; } }
[data-mi~="lx-sweep"] img { animation: lx-settle 2400ms ${EASE_OUT} 450ms both; }
@keyframes lx-settle { from { transform: scale(1.12); } to { transform: none; } }
[data-mi~="lx-card-slot"] { animation: lx-card-in 1000ms ${EASE_OUT} 1300ms both; }
/* Profondeur au pointeur (useHeroMotion) : photo et carte en sens opposés. */
[data-mi~="lx-sweep"] { transform: translate3d(calc(var(--lx-mx, 0) * 16px), calc(var(--lx-my, 0) * 10px), 0); transition: transform 900ms ${EASE_OUT}; }
[data-mi~="lx-card"] { transform: translate3d(calc(var(--lx-mx, 0) * -22px), calc(var(--lx-my, 0) * -14px), 0); transition: transform 900ms ${EASE_OUT}; }
[data-mi~="lx-hero"][data-off="1"] *, [data-mi~="lx-hero"][data-off="1"] *::before, [data-mi~="lx-hero"][data-off="1"] *::after { animation-play-state: paused !important; }
@keyframes lx-card-in { from { opacity: 0; transform: translate3d(0, 28px, 0) scale(.97); } to { opacity: 1; transform: none; } }

/* Carte « trois lectures » : 12 s, une lecture toutes les 4 s, segments d'avancement. */
[data-mi~="lx-readings"] { display: grid !important; }
[data-mi~="lx-read"] { grid-area: 1 / 1; animation: 12s linear 2600ms infinite both; }
[data-mi~="lx-read-1"] { animation-name: lx-read-a; }
[data-mi~="lx-read-2"] { opacity: 0; animation-name: lx-read-b; }
[data-mi~="lx-read-3"] { opacity: 0; animation-name: lx-read-c; }
@keyframes lx-read-a { 0%, 30% { opacity: 1; transform: none; } 33.3%, 97% { opacity: 0; transform: translate3d(0, -6px, 0); } 100% { opacity: 1; transform: none; } }
@keyframes lx-read-b { 0%, 30% { opacity: 0; transform: translate3d(0, 6px, 0); } 33.3%, 63.6% { opacity: 1; transform: none; } 66.6%, 100% { opacity: 0; transform: translate3d(0, -6px, 0); } }
@keyframes lx-read-c { 0%, 63.6% { opacity: 0; transform: translate3d(0, 6px, 0); } 66.6%, 97% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translate3d(0, -6px, 0); } }
[data-mi~="lx-seg"] { animation: 12s linear 2600ms infinite both; }
[data-mi~="lx-seg-1"] { animation-name: lx-seg-a; }
[data-mi~="lx-seg-2"] { animation-name: lx-seg-b; }
[data-mi~="lx-seg-3"] { animation-name: lx-seg-c; }
@keyframes lx-seg-a { 0% { opacity: 1; transform: scaleX(0); } 33.3%, 99.9% { opacity: 1; transform: scaleX(1); } 100% { opacity: 1; transform: scaleX(0); } }
@keyframes lx-seg-b { 0%, 33.3% { opacity: 1; transform: scaleX(0); } 66.6%, 99.9% { opacity: 1; transform: scaleX(1); } 100% { opacity: 1; transform: scaleX(0); } }
@keyframes lx-seg-c { 0%, 66.6% { opacity: 1; transform: scaleX(0); } 99.9% { opacity: 1; transform: scaleX(1); } 100% { opacity: 1; transform: scaleX(0); } }

/* Tablette : photo décalée à droite, carte posée en bas à gauche. */
@media (min-width: 640px) and (max-width: 1023px) {
  [data-mi~="lx-hero-visual"] { padding-left: 16% !important; padding-bottom: 88px !important; }
  [data-mi~="lx-card-slot"] { position: absolute !important; left: 0; bottom: 0; width: 360px; margin-top: 0 !important; padding: 0 !important; }
}
${from(1024)} {
  [data-mi~="lx-hero"] { padding-top: ${tokens.space['3xl']}px !important; padding-bottom: ${tokens.space['4xl']}px !important; }
  [data-mi~="lx-hero-row"] { flex-direction: row !important; align-items: flex-start !important; column-gap: ${tokens.space['4xl']}px !important; }
  [data-mi~="lx-hero-copy"] { flex: 0 0 38% !important; }
  /* La photographie monte sur le tracé (qui passe derrière elle) ; la carte se pose en bas
     à gauche, sur les mains, jamais sur les visages. */
  [data-mi~="lx-hero-visual"] { flex: 1 1 0% !important; margin-top: -104px !important; }
  [data-mi~="lx-hero-visual"] [data-mi~="lx-sweep"] > :first-child { aspect-ratio: 3 / 2 !important; }
  [data-mi~="lx-card-slot"] { position: absolute !important; left: -44px; bottom: 36px; width: 372px; margin-top: 0 !important; padding: 0 !important; }
  [data-mi~="lx-trace-band"] { margin-top: ${tokens.space['2xl']}px !important; margin-bottom: ${tokens.space['2xl']}px !important; }
}

/* Petit ordinateur : la photo reste sous le tracé (sinon elle masque les trois nœuds). */
@media (min-width: 1024px) and (max-width: 1279px) {
  [data-mi~="lx-hero-copy"] { flex: 0 0 42% !important; }
  [data-mi~="lx-hero-visual"] { margin-top: -16px !important; }
}

/* ── 2. Trois assistants ──────────────────────────────────────────────────── */
[data-mi~="lx-tab-ind"] { left: 4px !important; width: calc((100% - 8px) / 3) !important; transition: transform 520ms ${EASE_OUT}; }
[data-mi~="lx-tabs"][data-i="1"] [data-mi~="lx-tab-ind"] { transform: translateX(100%); }
[data-mi~="lx-tabs"][data-i="2"] [data-mi~="lx-tab-ind"] { transform: translateX(200%); }
[data-mi~="lx-panel-text"] { animation: lx-panel-in 700ms ${EASE_OUT} both; }
@keyframes lx-panel-in { from { opacity: 0; transform: translate3d(-18px, 0, 0); } to { opacity: 1; transform: none; } }
[data-mi~="lx-panel-photo"] { animation: lx-wipe-down 900ms ${EASE_IN_OUT} both; }
@keyframes lx-wipe-down { from { clip-path: inset(0 0 100% 0 round 20px); } to { clip-path: inset(0 0 0 0 round 20px); } }
[data-mi~="lx-panel-mock"] { animation: lx-card-in 800ms ${EASE_OUT} 220ms both; }
${from(1024)} {
  [data-mi~="lx-aud"] { padding-top: ${tokens.space['4xl'] + tokens.space['2xl']}px !important; padding-bottom: ${tokens.space['4xl'] + tokens.space.xl}px !important; }
  [data-mi~="lx-aud-head"] { flex-direction: row !important; align-items: flex-end !important; justify-content: space-between !important; column-gap: ${tokens.space['3xl']}px !important; }
  [data-mi~="lx-tabs"] { align-self: auto !important; width: 520px !important; flex-shrink: 0 !important; }
  [data-mi~="lx-panel"] { flex-direction: row !important; align-items: center !important; column-gap: ${tokens.space['4xl']}px !important; }
  [data-mi~="lx-panel-text"] { flex: 0 0 44% !important; }
  [data-mi~="lx-panel-visual"] { flex: 1 1 0% !important; padding-bottom: 0 !important; }
  [data-mi~="lx-panel-photo"] { width: 66% !important; }
  [data-mi~="lx-panel-mock"] { position: absolute !important; left: 0; bottom: 32px; width: 60% !important; margin-top: 0 !important; }
}

/* ── 3. Au-delà du chat (défilement narratif) ─────────────────────────────── */
[data-mi~="lx-mock"] [data-mi~="lx-a"] { animation-duration: 760ms; animation-timing-function: ${EASE_OUT}; animation-fill-mode: both; animation-delay: calc(var(--lx-d, 0) * 110ms + 180ms); }
[data-mi~="lx-mock"]:not([data-on="1"]) [data-mi~="lx-a"] { animation-play-state: paused; }
[data-mi~="lx-a"][data-k="grow"] { animation-name: lx-k-grow; transform-origin: left center; }
[data-mi~="lx-a"][data-k="rise"] { animation-name: lx-k-rise; }
[data-mi~="lx-a"][data-k="pop"] { animation-name: lx-k-pop; }
[data-mi~="lx-a"][data-k="bar"] { animation-name: lx-k-bar; transform-origin: center bottom; }
[data-mi~="lx-a"][data-k="fade"] { animation-name: lx-k-fade; }
[data-mi~="lx-a"][data-k="check"] { animation-name: lx-k-check; }
@keyframes lx-k-grow { from { transform: scaleX(0); } to { transform: none; } }
@keyframes lx-k-rise { from { opacity: 0; transform: translate3d(0, 10px, 0); } to { opacity: 1; transform: none; } }
@keyframes lx-k-pop { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: none; } }
@keyframes lx-k-bar { from { transform: scaleY(0); } to { transform: none; } }
@keyframes lx-k-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes lx-k-check { 0% { opacity: 0; transform: scale(.3); } 60% { opacity: 1; transform: scale(1.15); } 100% { opacity: 1; transform: none; } }
@property --lx-p { syntax: '<percentage>'; inherits: false; initial-value: 100%; }
[data-mi~="lx-ring"] {
  border-color: transparent !important;
  background: conic-gradient(${p.student.accent} var(--lx-p), ${p.student.soft} 0);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px));
  animation: lx-ring 7s linear 300ms both;
}
[data-mi~="lx-mock"]:not([data-on="1"]) [data-mi~="lx-ring"] { animation-play-state: paused; }
@keyframes lx-ring { from { --lx-p: 100%; } to { --lx-p: 58%; } }
[data-mi~="lx-stage-mock"] { animation: lx-stage-in 640ms ${EASE_OUT} both; transform-origin: 50% 0; }
@keyframes lx-stage-in { from { opacity: 0; transform: perspective(1200px) translate3d(0, 26px, 0) rotateX(7deg); } to { opacity: 1; transform: none; } }
[data-mi~="lx-stage-dot"] { transition: width 420ms ${EASE_OUT}, background-color 420ms ease; }
${below(1024)} {
  [data-mi~="lx-chapters"] {
    flex-direction: row !important; align-items: stretch !important; column-gap: ${tokens.space.lg}px !important; row-gap: 0 !important;
    overflow-x: auto; scroll-snap-type: x mandatory; overscroll-behavior-x: contain; scrollbar-width: none;
    margin-left: -${tokens.space.lg}px; margin-right: -${tokens.space.lg}px; padding: 4px ${tokens.space.lg}px ${tokens.space.md}px;
    scroll-padding-left: ${tokens.space.lg}px;
  }
  [data-mi~="lx-chapters"]::-webkit-scrollbar { display: none; }
  [data-mi~="lx-chap"] { flex: 0 0 min(86%, 440px) !important; scroll-snap-align: start; }
}
@media (min-width: 640px) and (max-width: 1023px) {
  [data-mi~="lx-chapters"] { margin-left: -${tokens.space.xl}px; margin-right: -${tokens.space.xl}px; padding-left: ${tokens.space.xl}px; padding-right: ${tokens.space.xl}px; scroll-padding-left: ${tokens.space.xl}px; }
}
${from(1024)} {
  [data-mi~="lx-show"] { padding-top: ${tokens.space['4xl'] + tokens.space.lg}px !important; padding-bottom: ${tokens.space['4xl']}px !important; }
  [data-mi~="lx-show-body"] { flex-direction: row !important; align-items: stretch !important; column-gap: ${tokens.space['4xl']}px !important; }
  [data-mi~="lx-chapters"] { flex: 0 0 38% !important; row-gap: 0 !important; }
  [data-mi~="lx-chap"] { min-height: 560px; justify-content: center !important; opacity: .32; transition: opacity 480ms ease; }
  [data-mi~="lx-chap"][data-active="1"] { opacity: 1; }
  [data-mi~="lx-stage"] { position: sticky !important; top: 120px; }
}

/* ── 4. Qui accède à quoi ─────────────────────────────────────────────────── */
[data-mi~="lx-row"] { position: relative; }
[data-mi~="lx-row-arrow"] { transition: transform 260ms ${EASE_OUT}; }
@media (hover: hover) {
  [data-mi~="lx-row"]:not([data-mi~="lx-row-locked"]):hover { background-color: ${tokens.colors.background}; }
  [data-mi~="lx-row"]:not([data-mi~="lx-row-locked"]):hover [data-mi~="lx-row-arrow"] { transform: translateX(4px); }
}
${from(1024)} {
  [data-mi~="lx-matrix"] { padding-top: ${tokens.space['4xl'] + tokens.space.lg}px !important; padding-bottom: ${tokens.space['4xl'] + tokens.space.lg}px !important; }
  [data-mi~="lx-matrix-head"] { flex-direction: row !important; align-items: flex-end !important; justify-content: space-between !important; column-gap: ${tokens.space['3xl']}px !important; }
}

/* ── 5. Méthode ───────────────────────────────────────────────────────────── */
[data-mi~="lx-method-grid"] { ${ECG_PAPER}
  -webkit-mask-image: radial-gradient(ellipse 60% 70% at 0% 30%, #000 10%, transparent 75%);
  mask-image: radial-gradient(ellipse 60% 70% at 0% 30%, #000 10%, transparent 75%);
}
[data-mi~="lx-tl-fill"] { transform-origin: center top; animation: lx-tl-fill 4200ms cubic-bezier(.45,0,.2,1) 300ms both; }
@keyframes lx-tl-fill { from { transform: scaleY(0); } to { transform: none; } }
[data-mi~="lx-tl-step"] { animation: lx-tl-step 600ms ease-out both; animation-delay: calc(var(--lx-s, 1) * 1050ms - 750ms); }
@keyframes lx-tl-step { from { opacity: .32; } to { opacity: 1; } }
[data-mi~="lx-tl-node"] { animation: lx-tl-node 900ms ease-out both; animation-delay: calc(var(--lx-s, 1) * 1050ms - 750ms); }
@keyframes lx-tl-node { 0% { box-shadow: 0 0 0 0 ${mint(0)}; } 35% { box-shadow: 0 0 0 9px ${mint(0.22)}; } 100% { box-shadow: 0 0 0 0 ${mint(0)}; } }
[data-mi~="lx-timeline"]:not([data-on="1"]) [data-mi~="lx-tl-fill"],
[data-mi~="lx-timeline"]:not([data-on="1"]) [data-mi~="lx-tl-step"],
[data-mi~="lx-timeline"]:not([data-on="1"]) [data-mi~="lx-tl-node"] { animation-play-state: paused; }
${from(1024)} {
  [data-mi~="lx-method"] { padding-top: ${tokens.space['4xl'] + tokens.space.xl}px !important; padding-bottom: ${tokens.space['4xl'] + tokens.space.xl}px !important; }
  [data-mi~="lx-method-cols"] { flex-direction: row !important; column-gap: ${tokens.space['4xl'] + tokens.space['2xl']}px !important; }
}

/* ── 6. Questions fréquentes ──────────────────────────────────────────────── */
${from(1024)} {
  [data-mi~="lx-faq-cols"] { flex-direction: row !important; align-items: flex-start !important; column-gap: ${tokens.space['4xl']}px !important; }
  [data-mi~="lx-faq-head"] { flex: 0 0 32% !important; position: sticky !important; top: 120px; }
  [data-mi~="lx-faq"] { flex-direction: row !important; column-gap: ${tokens.space['2xl']}px !important; }
  [data-mi~="lx-faq"] > :first-child { flex: 0 0 40% !important; }
  [data-mi~="lx-faq"] > :last-child { flex: 1 1 0% !important; padding-left: 0 !important; }
}

/* ── 7. Appel final ───────────────────────────────────────────────────────── */
[data-mi~="lx-closing"] {
  background:
    radial-gradient(ellipse 45% 80% at 100% 100%, rgba(12,20,56,.35), transparent 70%),
    ${tokens.colors.accentVivid} !important;
}
[data-mi~="lx-closing-trace"] {
  background-image: ${CLOSING_TRACE}; background-repeat: repeat-x; background-position: 0 calc(100% + 28px); background-size: 720px 120px;
  animation: lx-drift 24s linear infinite;
}
@keyframes lx-drift { from { background-position: 0 calc(100% + 28px); } to { background-position: -720px calc(100% + 28px); } }
${from(640)} { [data-mi~="lx-closing-title"] { font-size: clamp(44px, 6vw, 80px) !important; line-height: 1.02 !important; letter-spacing: -0.025em !important; } }
${from(1024)} {
  [data-mi~="lx-closing"] { padding-top: ${tokens.space['4xl'] + tokens.space['2xl']}px !important; padding-bottom: ${tokens.space['4xl'] + tokens.space['3xl']}px !important; }
  [data-mi~="lx-closing-row"] { flex-direction: row !important; align-items: flex-end !important; justify-content: space-between !important; column-gap: ${tokens.space['4xl']}px !important; }
  [data-mi~="lx-closing-row"] > :last-child { flex: 0 0 420px !important; }
}

/* ── Défilement : quelques détails liés à la position (navigateurs compatibles) ── */
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    [data-mi~="lx-rule"] { transform-origin: left center; animation: lx-k-grow linear both; animation-timeline: view(); animation-range: entry 30% cover 30%; }
    [data-mi~="lx-dot"] { animation: lx-k-pop linear both; animation-timeline: view(); animation-range: entry 20% cover 25%; }
    [data-mi~="lx-closing-title"] { animation: lx-k-rise linear both; animation-timeline: view(); animation-range: entry 10% cover 35%; }
  }
}

/* ── Focus clavier sur fond sombre : l'anneau bleu (#0052D6) n'y atteint pas 3:1. ── */
[data-mi~="lx-hero"] :focus-visible, [data-mi~="lx-method"] :focus-visible, [data-mi~="lx-closing"] :focus-visible { outline-color: ${n.text} !important; }

/* ── Figer / réduction des animations ─────────────────────────────────────── */
[data-mi~="lx-paused"] *, [data-mi~="lx-paused"] *::before, [data-mi~="lx-paused"] *::after { animation-play-state: paused !important; }
@media (prefers-reduced-motion: reduce) {
  [data-mi~="lx-pause"], [data-mi~="lx-trace-scan"], [data-mi~="lx-trace-old"] { display: none !important; }
  /* L'état de repos de chaque élément animé EST son état final : on retire l'animation. */
  [data-mi~="lx-node"], [data-mi~="lx-read"], [data-mi~="lx-seg"], [data-mi~="lx-closing-trace"],
  [data-mi~="lx-a"], [data-mi~="lx-ring"], [data-mi~="lx-tl-fill"], [data-mi~="lx-tl-step"], [data-mi~="lx-tl-node"] { animation: none !important; }
}
`;
