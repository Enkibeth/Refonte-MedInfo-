import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');
const home = read('app/index.tsx');

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]);
}

// Refonte créative 2026-10 (ADR-0047) : l'accueil est composé dans app/index.tsx à partir
// des sections de src/ui/landing/ (textes dans copy.ts). Les invariants ci-dessous valent
// pour l'ensemble de ces fichiers.
const landingFiles = files('src/ui/landing');
const landing = [home, ...landingFiles.map(read)].join('\n');
const copy = read('src/ui/landing/copy.ts');

describe('accueil orienté produit, cadre préservé', () => {
  it('met en avant les usages sans recopier le long énoncé juridique', () => {
    expect(copy).toContain("line1: [['Une', 'question'], ['de', 'santé,']]");
    expect(copy).toContain("line2: [['trois', 'niveaux'], ['de', 'réponse.']]");
    expect(copy).toContain('simulation ECOS et révisions');
    expect(landing).not.toContain('INTENDED_PURPOSE');
    expect(home).toContain('{getAiDisclosure()}');
    expect(home).toContain('<SiteFooter />');
    expect(home).toMatch(/\b15\b.*112/);
    expect(copy).toMatch(/composez le 15 \(SAMU\) ou le 112/);
    expect(read('app/(legal)/legal.tsx')).toContain('{INTENDED_PURPOSE}');
  });

  it('présente le modèle comme un défaut de version, pas comme une garantie de runtime', () => {
    expect(copy).toContain('Le chat fonctionne aujourd’hui avec GPT-6 Luna.');
    expect(read('src/ai/providers/featureModel.ts')).toMatch(/chat:\s*\{ modelId: 'gpt-6-luna'/);
    expect(landing).not.toMatch(/meilleur modèle|tous les derniers modèles|réponses garanties/i);
  });

  it('conserve les photographies validées et documente la photo de bibliothèque réutilisée', () => {
    const native = read('src/ui/LandingPhoto.tsx');
    const web = read('src/ui/LandingPhoto.web.tsx');
    expect(native).toContain('medical-study.jpg');
    expect(web).toContain('medical-study-640.webp');
    for (const photo of ['work', 'sources']) {
      expect(native).toContain(`${photo}.jpg`);
      expect(web).toContain(`${photo}-1000.webp`);
    }
    // Photo « bibliothèque » (Pexels, déjà livrée et licenciée) : onglet Étudiants.
    expect(native).toContain('study.jpg');
    expect(web).toContain('study-1000.webp');
    expect(read('assets/landing/README.md')).toContain('`study*`');
  });
});

describe('accueil « Moniteur » : honnêteté des démonstrations (ADR-0047)', () => {
  it('signale chaque aperçu d’interface comme fictif, à l’écran et aux lecteurs d’écran', () => {
    const parts = read('src/ui/landing/MockParts.tsx');
    expect(parts).toContain('>Contenu fictif<');
    expect(parts).toContain('Aperçu de l’interface, contenu fictif');
    expect(read('src/ui/landing/Showcase.tsx')).toContain('Les contenus des aperçus sont fictifs.');
    expect(read('src/ui/landing/ReadingCard.tsx')).toContain('HERO_COPY.cardLabel');
    expect(copy).toContain('Exemple d’affichage');
  });

  it('dérive les outils et leurs accès du registre de visibilité, jamais d’une liste recopiée', () => {
    for (const file of ['AccessMatrix.tsx', 'AudienceSwitcher.tsx']) {
      expect(read(`src/ui/landing/${file}`), file).toContain('APP_FEATURES');
    }
    // Compte connecté : même règle que la navigation (isFeatureVisible) pour lier un outil.
    expect(home).toContain('isFeatureVisible(feature.id, persona, { isAdmin })');
  });

  it('n’affiche aucun chiffre d’usage, avis ni badge inventé', () => {
    expect(landing).not.toMatch(/utilisateurs satisfaits|\d[\d\s]*\s?(utilisateurs|étudiants inscrits|avis)|★|note moyenne|recommandé par/i);
  });

  it('respecte la typographie française dans les textes de l’accueil', () => {
    const literals = [...copy.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)].map((m) => m[1]);
    expect(literals.length).toBeGreaterThan(40);
    for (const text of literals) {
      expect(text, text).not.toMatch(/ [:;?!»]|« /);
    }
  });

  it('peut figer chaque animation et rend l’état final sous prefers-reduced-motion', () => {
    const css = read('src/ui/landing/landingCss.ts');
    expect(css).toContain('[data-mi~="lx-paused"] *');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(home).toContain("accessibilityRole=\"button\"");
    expect(home).toContain('aria-pressed={paused}');
    // Défilement lié à la position : seulement si l'utilisateur n'a rien demandé.
    expect(css).toMatch(/@supports \(animation-timeline: view\(\)\) \{\s*@media \(prefers-reduced-motion: no-preference\)/);
  });
});

describe('bandeau « Moniteur » des outils (ADR-0047)', () => {
  it('annonce l’audience réelle de chaque outil, dérivée du registre', async () => {
    const src = read('src/ui/ToolScreenHeader.tsx');
    expect(src).toContain('audienceLabel(meta?.personas ?? [])');
    expect(src).not.toContain('kicker="Outil MedInfo AI"');
    const { audienceLabel } = await import('@/ui/audienceLabel');
    const { APP_FEATURES } = await import('@/ai/routing/featureVisibility');
    const label = (id: string) => audienceLabel(APP_FEATURES.find((f) => f.id === id)!.personas);
    expect(label('ecos')).toBe('Outil · Étudiants');
    expect(label('audio')).toBe('Outil · Professionnels');
    expect(label('document')).toBe('Outil · Grand public');
    expect(label('cv-builder')).toBe('Outil · Étudiants et professionnels');
    expect(audienceLabel([])).toBe('Outil MedInfo AI');
  });
});

describe('couverture des fondations du thème', () => {
  it('charge les mêmes polices locales dans Expo web et les quatre outils HTML', () => {
    const root = read('app/+html.tsx');
    expect(root).not.toContain('fonts.googleapis.com');
    const css = read('public/vendor/fonts/fonts.css');
    // Expo web déclare ses polices inline (préchargées, sans feuille bloquante) : chaque
    // fichier qu'il référence doit exister ET être celui de la feuille des outils HTML.
    const rootFiles = [...root.matchAll(/file: '([^']+\.woff2)'/g)].map((m) => m[1]);
    expect(rootFiles.length).toBeGreaterThanOrEqual(4);
    for (const file of rootFiles) {
      expect(existsSync(join('public/vendor/fonts', file)), file).toBe(true);
      expect(css, file).toContain(`url('${file}')`);
    }
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
    expect(read('src/ui/AppMobileHeader.tsx')).toContain('featureTint');
    expect(read('app/(chat)/dashboard.tsx')).toContain('featureTint');
  });
});
