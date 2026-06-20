/** @vitest-environment happy-dom */
/**
 * Vérifie le comportement de rendu RÉEL de l'éditeur de présentations
 * (`public/presentation.html`) en chargeant son script inliné dans un DOM (happy-dom).
 *
 * Couvre deux points de la revue de code :
 *  - #6 : la frappe ne doit pas reconstruire tout l'éditeur (perte de focus/caret) ;
 *  - #12 : les deux moteurs de rendu (aperçu HTML ↔ export PPTX) ne doivent pas diverger
 *          en couverture des types de slide.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

interface MipInternals {
  buildPres: (Pptx: unknown, deck: unknown) => unknown;
  createSlide: (type: string) => Record<string, unknown>;
  slidePreview: (slide: unknown, theme: string, meta: unknown, idx: number, total: number) => unknown;
  SLIDE_TYPES: Record<string, unknown>;
  RENDERERS: Record<string, unknown>;
}

let MIP: MipInternals;

function loadEditor(): MipInternals {
  const html = readFileSync(resolve(__dirname, '../../public/presentation.html'), 'utf8');
  // Le <script> inliné (sans attribut) — la balise CDN est `<script src=...>` et ne matche pas.
  const script = html.split('<script>')[1].split('</script>')[0];
  document.body.innerHTML = '<div id="app"></div>';
  // Expose quelques internes (eval strict ne les fuit pas) pour les assertions de cohérence.
  const expose =
    '\n;globalThis.__MIP__={buildPres,createSlide,slidePreview,SLIDE_TYPES,RENDERERS};';
  (0, eval)(script + expose);
  return (globalThis as unknown as { __MIP__: MipInternals }).__MIP__;
}

beforeAll(() => {
  vi.useFakeTimers(); // neutralise setInterval(autosaveTick) + les setTimeout de debounce
  MIP = loadEditor();
});
afterAll(() => vi.useRealTimers());

function editorFieldByLabel(label: string): HTMLInputElement | HTMLTextAreaElement | null {
  const fields = Array.from(document.querySelectorAll('.mip-editor .mip-field'));
  const f = fields.find((el) => el.querySelector('label')?.textContent === label);
  return (f?.querySelector('textarea, input.mip-input') as HTMLInputElement | HTMLTextAreaElement) ?? null;
}

describe('saisie dans l’éditeur (#6 — pas de rebuild complet)', () => {
  it('conserve le focus et met l’aperçu à jour pendant la frappe', () => {
    const input = editorFieldByLabel('Titre principal');
    expect(input).toBeTruthy();
    if (!input) return;

    input.focus();
    expect(document.activeElement).toBe(input);

    const unique = 'Cardio-' + Math.random().toString(36).slice(2);
    input.value = unique;
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // Le nœud d'édition n'a PAS été détruit → focus/caret préservés.
    expect(input.isConnected).toBe(true);
    expect(document.activeElement).toBe(input);
    // L'aperçu (panneau droit) reflète la saisie en direct.
    expect(document.getElementById('mip-right')?.textContent ?? '').toContain(unique);
  });
});

describe('cohérence aperçu/PPTX (#12 — anti-divergence)', () => {
  it('chaque type de slide a un renderer PPTX et un aperçu HTML', () => {
    for (const type of Object.keys(MIP.SLIDE_TYPES)) {
      expect(typeof MIP.RENDERERS[type], `RENDERERS manquant pour "${type}"`).toBe('function');
      const slide = MIP.createSlide(type);
      expect(
        () => MIP.slidePreview(slide, 'v2', { title: 'T', author: 'A' }, 1, 1),
        `slidePreview a échoué pour "${type}"`,
      ).not.toThrow();
    }
  });

  it('buildPres traverse tous les types sans erreur (stub PptxGenJS)', () => {
    class FakeSlide {
      set background(_v: unknown) {}
      addText() { return this; }
      addShape() { return this; }
    }
    class FakePptx {
      layout = '';
      author = '';
      company = '';
      title = '';
      addSlide() { return new FakeSlide(); }
    }
    const slides = Object.keys(MIP.SLIDE_TYPES).map((t) => MIP.createSlide(t));
    const deck = { meta: { title: 'T', author: 'A' }, theme: 'v2', options: {}, slides };
    expect(() => MIP.buildPres(FakePptx, deck)).not.toThrow();
  });
});

// Tests de CARACTÉRISATION : figent la sortie EXACTE des deux moteurs pour permettre une
// factorisation sûre (toute différence d'appel PPTX ou de HTML d'aperçu casse le snapshot).
describe('consolidation sûre — sortie figée (caractérisation)', () => {
  const META = {
    title: 'Titre deck', subtitle: 'Sous-titre', author: 'Dr Exemple',
    affiliation: 'CHU', contact: 'a@b.fr', context: 'Staff', date: '2026',
  };
  const allSlides = () => Object.keys(MIP.SLIDE_TYPES).map((t) => MIP.createSlide(t));

  it('séquence d’appels PptxGenJS identique pour tous les types', () => {
    const log: unknown[] = [];
    class RecSlide {
      set background(v: unknown) { log.push(['bg', v]); }
      addText(...a: unknown[]) { log.push(['addText', ...a]); return this; }
      addShape(...a: unknown[]) { log.push(['addShape', ...a]); return this; }
      addImage(...a: unknown[]) { log.push(['addImage', ...a]); return this; }
    }
    class RecPptx {
      set layout(v: unknown) { log.push(['layout', v]); }
      set author(v: unknown) { log.push(['author', v]); }
      set company(v: unknown) { log.push(['company', v]); }
      set title(v: unknown) { log.push(['title', v]); }
      addSlide() { log.push(['addSlide']); return new RecSlide(); }
    }
    MIP.buildPres(RecPptx, { meta: META, theme: 'v2', options: { showFooter: true, showSlideNumbers: true }, slides: allSlides() });
    expect(log).toMatchSnapshot();
  });

  it('HTML d’aperçu identique pour tous les types', () => {
    const html = Object.keys(MIP.SLIDE_TYPES).map(
      (t) => (MIP.slidePreview(MIP.createSlide(t), 'v2', META, 1, 3) as { outerHTML: string }).outerHTML,
    );
    expect(html).toMatchSnapshot();
  });
});
