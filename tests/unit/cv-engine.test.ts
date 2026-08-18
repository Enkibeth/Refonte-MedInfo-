/**
 * Tests du MOTEUR du créateur de CV (`public/cv-builder.html`).
 *
 * Quatre endroits où une régression fait un dégât INVISIBLE — c'est-à-dire que
 * l'utilisateur envoie un CV cassé à un hôpital sans le savoir :
 *   1. la mesure du texte (elle décide des coupures de ligne ET du nombre de pages
 *      du PDF : si elle dérive, l'aperçu ment) ;
 *   2. la pagination (une entrée coupée en deux, un titre orphelin en bas de page) ;
 *   3. la migration de schéma (un CV enregistré il y a six mois doit s'ouvrir intact) ;
 *   4. le contraste (un accent trop clair est illisible à l'impression).
 */
import { describe, expect, it } from 'vitest';

import { CV, doc, entry } from './helpers/cvEngine';

const LOREM = 'Prise en charge des patients hospitalisés en autonomie supervisée, participation aux visites et aux transmissions quotidiennes du service.';

describe('cv-engine — mesure du texte', () => {
  it('mesure les polices PDF standard (Helvetica, Times) dans les quatre styles', () => {
    const w = (s: string, f: Record<string, unknown>) => CV.measureText(s, f);
    expect(w('', { family: 'helvetica', size: 10 })).toBe(0);
    expect(w('A', { family: 'helvetica', size: 1000 })).toBeGreaterThan(600);
    // Le gras est plus large que le romain, Times plus étroit qu'Helvetica.
    expect(w('Médecine', { family: 'helvetica', size: 10, bold: true }))
      .toBeGreaterThan(w('Médecine', { family: 'helvetica', size: 10 }));
    expect(w('Médecine', { family: 'times', size: 10 }))
      .toBeLessThan(w('Médecine', { family: 'helvetica', size: 10 }));
  });

  it('mesure linéairement avec la taille et additive sur la concaténation', () => {
    const f = { family: 'helvetica', size: 10 };
    const a = CV.measureText('Cardiologie', f);
    const b = CV.measureText('Cardiologie', { family: 'helvetica', size: 20 });
    expect(b).toBeCloseTo(a * 2, 6);
    expect(CV.measureText('Cardio', f) + CV.measureText('logie', f)).toBeCloseTo(a, 6);
  });

  it('compte l\'interlettrage des titres en majuscules', () => {
    const plain = CV.measureText('FORMATION', { family: 'helvetica', size: 10, bold: true });
    const tracked = CV.measureText('FORMATION', { family: 'helvetica', size: 10, bold: true, tracking: 1 });
    expect(tracked - plain).toBeCloseTo(8, 6); // 9 caractères → 8 espaces
  });

  it('remplace les caractères absents des polices PDF standard, et le signale', () => {
    expect(CV.toPdfText('Zoé 北京')).toBe('Zoé ??');
    expect(CV.unsupportedCharacters(doc([], {}, { fullName: 'Zoé Ω 北京' })).sort()).toEqual(['Ω', '京', '北']);
    expect(CV.unsupportedCharacters(doc([], {}, { fullName: 'Élodie Müller — œuvre « citée »' }))).toEqual([]);
  });
});

describe('cv-engine — coupure des lignes', () => {
  const font = { family: 'helvetica', size: 10 };

  it('ne dépasse jamais la largeur demandée', () => {
    const lines = CV.wrapText(LOREM, font, 140);
    expect(lines.length).toBeGreaterThan(1);
    lines.forEach((l: { text: string }) => {
      expect(CV.measureText(l.text, font)).toBeLessThanOrEqual(140 + 0.001);
    });
  });

  it('coupe sur les sauts de ligne explicites', () => {
    const lines = CV.wrapText('Premier\nDeuxième', font, 500);
    expect(lines.map((l: { text: string }) => l.text)).toEqual(['Premier', 'Deuxième']);
  });

  it('casse un mot insécable plus long que la colonne au lieu de déborder', () => {
    const lines = CV.wrapText('anticonstitutionnellement', font, 30);
    expect(lines.length).toBeGreaterThan(1);
    lines.forEach((l: { text: string }) => expect(CV.measureText(l.text, font)).toBeLessThanOrEqual(30.001));
    expect(lines.map((l: { text: string }) => l.text).join('')).toBe('anticonstitutionnellement');
  });

  it('conserve les index source (nécessaires au soulignement d\'un fragment)', () => {
    const source = LOREM;
    const lines = CV.wrapText(source, font, 140);
    lines.forEach((l: { text: string; start: number; end: number }) => {
      expect(source.slice(l.start, l.end)).toBe(l.text);
    });
  });

  it('ne perd aucun mot', () => {
    const words = (s: string) => s.split(/\s+/).filter(Boolean);
    const lines = CV.wrapText(LOREM, font, 90);
    expect(words(lines.map((l: { text: string }) => l.text).join(' '))).toEqual(words(LOREM));
  });
});

describe('cv-engine — migration de schéma', () => {
  const legacy = {
    personalInfo: {
      firstName: 'Marie', lastName: 'Durand', headline: 'Interne en cardiologie',
      email: 'marie@exemple.fr', phone: '06 00 00 00 00', city: 'Lyon', country: 'France',
      nationality: 'française', website: 'https://exemple.fr', photoUrl: '',
    },
    summary: 'Un résumé de profil.',
    experiences: [{ id: 'a', title: 'Externe', institution: 'CHU', location: 'Lyon', startDate: '2020', endDate: '', isCurrent: true, description: 'Desc', bullets: ['b1', 'b2'] }],
    education: [{ id: 'b', degree: 'DFASM', institution: 'Faculté', startDate: '2019', endDate: '2022' }],
    researchProjects: [], personalProjects: [], references: [],
    certificates: [{ id: 'c', title: 'AFGSU 2', subtitle: 'Niveau 2', score: '', date: '2023' }],
    languages: [{ id: 'd', name: 'Anglais', levelLabel: 'C1', level: 4 }],
    interests: [{ id: 'e', label: 'Course à pied' }],
  };

  it('convertit les rubriques figées de la v1 en sections libres, sans rien perdre', () => {
    const migrated = CV.migrate(legacy);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.header.fullName).toBe('Marie Durand');
    expect(migrated.header.contacts.map((c: { icon: string }) => c.icon)).toEqual(['phone', 'email', 'location', 'globe', 'id']);
    const titles = migrated.sections.map((s: { title: string }) => s.title);
    expect(titles).toEqual(['Profil', 'Expérience professionnelle', 'Formation', 'Certifications', 'Langues', "Centres d'intérêt"]);
    const xp = migrated.sections[1].entries[0];
    expect(xp.title).toBe('Externe');
    expect(xp.date).toBe('2020 – présent');
    expect(xp.organisation).toBe('CHU · Lyon');
    expect(xp.bullets).toEqual(['b1', 'b2']);
    expect(migrated.sections[4].layout).toBe('ratings');
    expect(migrated.sections[4].entries[0].rating).toBe(4);
    expect(migrated.sections[5].layout).toBe('tags');
  });

  it('est idempotente (v2 → v2 ne change rien)', () => {
    const once = CV.migrate(legacy);
    const twice = CV.migrate(JSON.parse(JSON.stringify(once)));
    expect(twice.sections).toEqual(once.sections);
    expect(twice.header).toEqual(once.header);
    expect(twice.theme).toEqual(once.theme);
  });

  it('ne casse jamais sur une entrée absurde', () => {
    [null, undefined, 42, 'texte', [], { sections: 'non' }, { schemaVersion: 2, sections: [null, 3] }].forEach((bad) => {
      const out = CV.migrate(bad);
      expect(out.schemaVersion).toBe(2);
      expect(Array.isArray(out.sections)).toBe(true);
      expect(out.theme.baseSize).toBeGreaterThan(0);
    });
  });

  it('rejette une photo qui n\'est pas une image en data-URI', () => {
    expect(CV.normalizePhoto({ dataUrl: 'https://exemple.fr/photo.jpg' })).toBeNull();
    expect(CV.normalizePhoto({ dataUrl: 'data:text/html;base64,AAAA' })).toBeNull();
    expect(CV.normalizePhoto({ dataUrl: 'data:image/png;base64,AAAA' })!.shape).toBe('rounded');
  });

  it('borne un thème hors limites au lieu de le rejeter', () => {
    const t = CV.normalizeTheme({ baseSize: 99, lineHeight: 0.1, accent: 'pas-une-couleur', margins: { top: -50 }, sidebar: { width: 9999 } });
    expect(t.baseSize).toBeLessThanOrEqual(12);
    expect(t.lineHeight).toBeGreaterThanOrEqual(1);
    expect(t.accent).toMatch(/^#[0-9a-f]{6}$/i);
    expect(t.margins.top).toBeGreaterThanOrEqual(14);
    expect(t.sidebar.width).toBeLessThanOrEqual(280);
  });
});

describe('cv-engine — pagination', () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => entry('Stage ' + i, [LOREM, LOREM]));

  it('ne coupe jamais une entrée entre deux pages', () => {
    const d = doc([{ title: 'Stages', column: 'main', layout: 'entries', entries: many(24) }]);
    const result = CV.layout(d);
    expect(result.pageCount).toBeGreaterThan(1);
    // Chaque entrée du document apparaît sur UNE SEULE page.
    const pageOfTitle = new Map<string, Set<number>>();
    result.pages.forEach((pg: any, index: number) => {
      pg.prims.filter((p: any) => p.t === 'text' && /^Stage \d+$/.test(p.s)).forEach((p: any) => {
        if (!pageOfTitle.has(p.s)) pageOfTitle.set(p.s, new Set());
        pageOfTitle.get(p.s)!.add(index);
      });
    });
    expect(pageOfTitle.size).toBe(24);
    pageOfTitle.forEach((pages) => expect(pages.size).toBe(1));
  });

  it('ne laisse jamais un titre de rubrique orphelin en bas de page', () => {
    // Une rubrique dont le titre tomberait juste en bas : le titre part avec sa 1re entrée.
    for (let n = 8; n <= 20; n++) {
      const d = doc([
        { title: 'Formation', column: 'main', layout: 'entries', entries: many(n) },
        { title: 'Recherche', column: 'main', layout: 'entries', entries: many(3) },
      ]);
      const result = CV.layout(d);
      result.pages.forEach((pg: any) => {
        const texts = pg.prims.filter((p: any) => p.t === 'text').map((p: any) => p.s);
        const at = texts.indexOf('RECHERCHE');
        if (at >= 0) {
          expect(texts.length, 'titre RECHERCHE seul en bas de page (n=' + n + ')').toBeGreaterThan(at + 1);
        }
      });
    }
  });

  it('respecte un saut de page forcé', () => {
    const d = doc([
      { title: 'Formation', column: 'main', layout: 'entries', entries: many(2) },
      { title: 'Publications', column: 'main', layout: 'entries', pageBreakBefore: true, entries: many(2) },
    ]);
    const result = CV.layout(d);
    expect(result.pageCount).toBe(2);
    const page2 = result.pages[1].prims.filter((p: any) => p.t === 'text').map((p: any) => p.s);
    expect(page2[0]).toBe('PUBLICATIONS');
  });

  it('signale une entrée plus haute qu\'une page entière au lieu de la masquer', () => {
    const huge = entry('Monstre', Array.from({ length: 60 }, () => LOREM));
    const result = CV.layout(doc([{ title: 'Stages', column: 'main', layout: 'entries', entries: [huge] }]));
    expect(result.warnings.some((w: any) => w.code === 'oversize')).toBe(true);
  });

  it('fait vivre les deux colonnes indépendamment', () => {
    const d = doc([
      { title: 'Stages', column: 'main', layout: 'entries', entries: many(20) },
      { title: 'Langues', column: 'side', layout: 'ratings', entries: [{ title: 'Anglais', organisation: 'C1', rating: 4 }] },
    ]);
    const result = CV.layout(d);
    expect(result.pageCount).toBeGreaterThan(1);
    const page1 = result.pages[0].prims.filter((p: any) => p.t === 'text').map((p: any) => p.s);
    expect(page1).toContain('LANGUES');   // le bandeau reste en page 1
  });

  it('avertit quand la dernière page est presque vide', () => {
    const d = doc([{ title: 'Stages', column: 'main', layout: 'entries', entries: many(13) }]);
    const result = CV.layout(d);
    if (result.pageCount > 1 && result.pages[result.pageCount - 1].fill < 0.6) {
      expect(result.warnings.some((w: any) => w.code === 'underfilled')).toBe(true);
    }
    expect(result.pages.every((p: any) => p.fill >= 0 && p.fill <= 1)).toBe(true);
  });

  it('rend le texte dans l\'ordre de lecture : en-tête, colonne principale, bandeau', () => {
    const d = doc([
      { title: 'Formation', column: 'main', layout: 'entries', entries: [entry('DFASM')] },
      { title: 'Langues', column: 'side', layout: 'ratings', entries: [{ title: 'Anglais', rating: 4 }] },
    ], {}, { headline: 'Interne' });
    const text = CV.extractText(CV.layout(d)).split('\n');
    expect(text.indexOf('Camille Rousseau')).toBe(0);
    expect(text.indexOf('FORMATION')).toBeLessThan(text.indexOf('LANGUES'));
  });
});

describe('cv-engine — ajustement au nombre de pages', () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => entry('Stage ' + i, [LOREM]));

  it('resserre le moins possible pour atteindre la cible', () => {
    const d = doc([{ title: 'Stages', column: 'main', layout: 'entries', entries: many(16) }]);
    const before = CV.layout(d).pageCount;
    expect(before).toBeGreaterThan(1);
    const fit = CV.fitToPages(d, before - 1);
    expect(fit.ok).toBe(true);
    expect(fit.changed).toBe(true);
    const after = CV.layout(Object.assign({}, d, { theme: fit.theme })).pageCount;
    expect(after).toBeLessThanOrEqual(before - 1);
    // Les valeurs restent lisibles.
    expect(fit.theme.baseSize).toBeGreaterThanOrEqual(8);
    expect(fit.theme.lineHeight).toBeGreaterThanOrEqual(1.08);
  });

  it('ne fait rien si le CV tient déjà', () => {
    const d = doc([{ title: 'Stages', column: 'main', layout: 'entries', entries: many(2) }]);
    const fit = CV.fitToPages(d, 2);
    expect(fit.ok).toBe(true);
    expect(fit.changed).toBe(false);
    expect(fit.theme).toEqual(d.theme);
  });

  it('ÉCHOUE HONNÊTEMENT plutôt que de rendre le CV illisible', () => {
    const d = doc([{ title: 'Stages', column: 'main', layout: 'entries', entries: many(60) }]);
    const fit = CV.fitToPages(d, 1);
    expect(fit.ok).toBe(false);
    expect(fit.changed).toBe(false);
    expect(fit.theme).toEqual(d.theme);          // le thème n'est PAS modifié
    expect(fit.message).toMatch(/Impossible/);
  });
});

describe('cv-engine — contraste (WCAG 2.1)', () => {
  it('calcule les rapports de référence', () => {
    expect(CV.contrastRatio('#000000', '#ffffff')).toBe(21);
    expect(CV.contrastRatio('#ffffff', '#ffffff')).toBe(1);
    expect(CV.contrastRatio('#767676', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(CV.contrastRatio('#777777', '#ffffff')).toBeLessThan(4.54);
    expect(CV.contrastRatio('#1e3a5f', '#ffffff')).toBe(CV.contrastRatio('#ffffff', '#1e3a5f'));
  });

  it('signale un accent trop clair sur le fond réellement utilisé', () => {
    const pale = doc([{ title: 'Langues', column: 'side', layout: 'tags', entries: [{ title: 'Anglais' }] }], { accent: '#ffe066' });
    const report = CV.contrastReport(pale);
    expect(report.some((c: any) => !c.ok)).toBe(true);
    expect(report.some((c: any) => c.label.indexOf('bandeau') >= 0)).toBe(true);
  });

  it('valide les cinq palettes livrées', () => {
    CV.THEME_PRESETS.forEach((preset: { key: string; label: string }) => {
      const d = doc([{ title: 'Langues', column: 'side', layout: 'tags', entries: [{ title: 'Anglais' }] }], CV.defaultTheme(preset.key));
      CV.contrastReport(d).forEach((c: any) => {
        expect(c.ok, preset.label + ' — ' + c.label + ' : ' + c.ratio).toBe(true);
      });
    });
  });
});

describe('cv-engine — nettoyage d\'un collage', () => {
  it('sépare paragraphes et puces, quel que soit le marqueur', () => {
    const out = CV.cleanPastedText('Intro\n\n• Une puce\n- Deux\n2. Trois\nSuite du paragraphe\n');
    expect(out.paragraphs).toEqual(['Intro', 'Suite du paragraphe']);
    expect(out.bullets).toEqual(['Une puce', 'Deux', 'Trois']);
  });

  it('supprime les caractères invisibles et les espaces insécables de Word', () => {
    const out = CV.cleanPastedText('Service de​ cardiologie﻿');
    expect(out.paragraphs).toEqual(['Service de cardiologie']);
  });

  it('ne renvoie rien pour une entrée vide', () => {
    expect(CV.cleanPastedText('')).toEqual({ paragraphs: [], bullets: [] });
    expect(CV.cleanPastedText(null)).toEqual({ paragraphs: [], bullets: [] });
  });
});

describe('cv-engine — modèles livrés', () => {
  it('produit trois modèles valides, sans donnée inventée', () => {
    expect(CV.TEMPLATES.length).toBe(3);
    CV.TEMPLATES.forEach((tpl: { key: string }) => {
      const d = CV.buildTemplate(tpl.key);
      expect(d.schemaVersion).toBe(2);
      expect(d.sections.length).toBeGreaterThan(2);
      expect(d.header.fullName).toBe('');           // jamais un nom inventé
      const result = CV.layout(d);
      expect(result.pageCount).toBeGreaterThanOrEqual(1);
      expect(result.warnings.filter((w: any) => w.code === 'oversize')).toEqual([]);
    });
  });
});
