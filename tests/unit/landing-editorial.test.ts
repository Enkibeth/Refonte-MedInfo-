import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');
const home = read('app/index.tsx');

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]);
}

describe('accueil orienté produit, cadre préservé', () => {
  it('met en avant les usages sans recopier le long énoncé juridique', () => {
    expect(home).toContain('L’IA pour apprendre.');
    expect(home).toContain('ECOS & révisions');
    expect(home).not.toContain('INTENDED_PURPOSE');
    expect(home).toContain('{getAiDisclosure()}');
    expect(home).toContain('<SiteFooter />');
    expect(home).toMatch(/\b15\b.*112/);
    expect(read('app/(legal)/legal.tsx')).toContain('{INTENDED_PURPOSE}');
  });

  it('présente le modèle comme un défaut de version, pas comme une garantie de runtime', () => {
    expect(home).toContain('GPT-6 Luna est le modèle de chat configuré par défaut dans cette version.');
    expect(read('src/ai/providers/featureModel.ts')).toMatch(/chat:\s*\{ modelId: 'gpt-6-luna'/);
    expect(home).not.toMatch(/meilleur modèle|tous les derniers modèles|réponses garanties/i);
  });

  it('change seulement la photo d’étude ; les deux photos validées sont conservées', () => {
    const native = read('src/ui/LandingPhoto.tsx');
    const web = read('src/ui/LandingPhoto.web.tsx');
    expect(native).toContain('medical-study.jpg');
    expect(web).toContain('medical-study-640.webp');
    for (const photo of ['work', 'sources']) {
      expect(native).toContain(`${photo}.jpg`);
      expect(web).toContain(`${photo}-1000.webp`);
    }
  });
});

describe('couverture des fondations du thème', () => {
  it('charge les mêmes polices locales dans Expo web et les quatre outils HTML', () => {
    const root = read('app/+html.tsx');
    expect(root).toContain('href="/vendor/fonts/fonts.css"');
    expect(root).not.toContain('fonts.googleapis.com');
    const css = read('public/vendor/fonts/fonts.css');
    for (const family of ['Inter', 'Schibsted Grotesk', 'Source Serif 4', 'JetBrains Mono']) {
      expect(css).toContain(`font-family: '${family}'`);
    }
    for (const match of css.matchAll(/src: url\('([^']+)'\)/g)) {
      expect(existsSync(join('public/vendor/fonts', match[1])), match[1]).toBe(true);
    }
    for (const page of ['article', 'cv-builder', 'presentation', 'partiel']) {
      expect(read(`public/${page}.html`)).toContain('href="/vendor/fonts/fonts.css"');
    }
  });

  it('chaque page applicative consomme les tokens ou le conteneur légal partagé', () => {
    const pages = files('app').filter(file => file.endsWith('.tsx')
      && !basename(file).startsWith('_') && !basename(file).startsWith('+'));
    expect(pages.length).toBeGreaterThanOrEqual(26);
    for (const page of pages) {
      expect(/tokens|<LegalScreen/.test(read(page)), page).toBe(true);
    }
    expect(read('src/ui/LegalScreen.tsx')).toContain('tokens.colors.background');
    expect(read('src/ui/shell/AppShell.tsx')).toContain('tokens.colors.surfaceAlt');
    expect(read('src/ui/AppTabBar.tsx')).toContain('featureTint');
    expect(read('app/(chat)/dashboard.tsx')).toContain('featureTint');
  });
});
