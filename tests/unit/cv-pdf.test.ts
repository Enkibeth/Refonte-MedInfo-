/**
 * Vérification du PDF RÉELLEMENT produit par le créateur de CV.
 *
 * Enjeu : les hôpitaux et CHU trient les candidatures avec des logiciels (ATS) qui
 * EXTRAIENT LE TEXTE du PDF. La version précédente de l'outil exportait une capture
 * d'écran (html2canvas) : le PDF était une image, l'ATS ne lisait rien, la
 * candidature était écartée sans être lue. Ce test génère le PDF avec le jsPDF
 * réellement servi par la page, puis relit le fichier octet par octet pour
 * garantir : du vrai texte, dans l'ordre de lecture, sans doublon caché, avec les
 * accents intacts et aucune page rastérisée.
 *
 * Il verrouille aussi l'égalité entre les métriques du moteur (qui décident des
 * coupures de ligne et du nombre de pages affichés dans l'aperçu) et celles que
 * jsPDF inscrit dans le PDF : si elles divergeaient, l'aperçu mentirait.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { CV, doc, entry } from './helpers/cvEngine';
import { readPdfRuns } from './helpers/pdfText';

const require = createRequire(import.meta.url);
const { jsPDF } = require('../../public/vendor/js/jspdf.umd.min.js');

const LOREM = 'Prise en charge des patients hospitalisés en autonomie supervisée, participation aux visites et aux transmissions du service.';

type Run = { x: number; y: number; text: string };

/** Les .ttf sous-ensemblés servis par la page, encodés comme le fait le navigateur. */
function fontData(entries: { key: string; file: string }[]): Record<string, string> {
  const dir = fileURLToPath(new URL('../../public/vendor/fonts/cv/', import.meta.url));
  const out: Record<string, string> = {};
  for (const entry of entries) out[entry.key] = readFileSync(dir + entry.file).toString('base64');
  return out;
}

function readPdf(buffer: Buffer): { pages: Run[][]; raw: string } {
  const { pages, raw } = readPdfRuns(buffer);
  return { pages, raw };
}

function build(document: Record<string, unknown>, options: Record<string, unknown> = {}) {
  const result = CV.layout(document);
  const fonts = options.fonts === false ? {} : fontData(CV.usedFonts(result));
  const pdf = CV.renderPdf(result, jsPDF, { fonts, ...options });
  return { result, buffer: Buffer.from(pdf.output('arraybuffer') as ArrayBuffer) };
}

const sample = () => doc(
  [
    { title: 'Profil', column: 'main', layout: 'text', entries: [{ description: ['Interne — œuvre « citée », déjà 3 semestres.'] }] },
    { title: 'Stages hospitaliers', column: 'main', layout: 'entries', entries: Array.from({ length: 14 }, (_, i) => entry('Stage ' + i, [LOREM, LOREM])) },
    { title: 'Langues', column: 'side', layout: 'ratings', entries: [{ title: 'Anglais', organisation: 'C1 — courant', rating: 4 }] },
    { title: 'Compétences', column: 'side', layout: 'tags', entries: [{ title: 'Échographie' }, { title: 'Sutures' }] },
  ],
  {},
  { headline: 'Interne en médecine interne', contacts: [{ icon: 'email', value: 'prenom.nom@exemple.fr', href: 'mailto:prenom.nom@exemple.fr' }] },
);

describe('cv-pdf — métriques identiques à celles inscrites dans le PDF', () => {
  const CORPUS = [
    'Diplôme de formation approfondie en sciences médicales',
    'CHU de Lyon — Service de cardiologie',
    'œuvre « citée » — 20 % (n = 143)',
    'AaBbCc 0123456789 ,.;:!?()[]/',
    'Élodie Müller-Nguyên',
  ];

  it('mesure exactement comme jsPDF, pour les SEPT familles (sinon l\'aperçu mentirait)', () => {
    const dir = fileURLToPath(new URL('../../public/vendor/fonts/cv/', import.meta.url));
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    CV.FONT_FAMILIES.forEach((family: { key: string; builtin: boolean }) => {
      CV.FONT_STYLES.forEach((style: string) => {
        if (!family.builtin) {
          const entry = CV.fontFile(family.key, style);
          pdf.addFileToVFS(entry.file, readFileSync(dir + entry.file).toString('base64'));
          pdf.addFont(entry.file, family.key, style);
        }
        pdf.setFont(family.key, style);
        pdf.setFontSize(11);
        const bold = style === 'bold' || style === 'bolditalic';
        const italic = style === 'italic' || style === 'bolditalic';
        CORPUS.forEach((text) => {
          const engine = CV.measureText(text, { family: family.key, size: 11, bold, italic });
          expect(Math.abs(engine - pdf.getTextWidth(text)), family.key + '/' + style + ' — ' + text)
            .toBeLessThan(0.001);
        });
      });
    });
  });

  it('livre bien les fichiers de chaque famille embarquée', () => {
    const dir = fileURLToPath(new URL('../../public/vendor/fonts/cv/', import.meta.url));
    CV.FONT_FAMILIES.filter((f: { builtin: boolean }) => !f.builtin).forEach((family: { key: string; label: string }) => {
      CV.FONT_STYLES.forEach((style: string) => {
        const entry = CV.fontFile(family.key, style);
        expect(existsSync(dir + entry.file), family.label + ' — ' + entry.file).toBe(true);
      });
      // La licence OFL accompagne obligatoirement la police redistribuée.
      expect(existsSync(dir + family.key + '-OFL.txt'), 'licence de ' + family.label).toBe(true);
    });
  });
});

describe('cv-pdf — polices embarquées', () => {
  const withFamily = (key: string) => doc(
    [{ title: 'Stages hospitaliers', column: 'main', layout: 'entries', entries: [entry('Externe en cardiologie', ['Suivi des patients hospitalisés.'])] }],
    { fontFamily: key },
    { headline: 'Interne — œuvre « citée »' },
  );

  it('embarque la police ET garde le texte extractible (table ToUnicode)', () => {
    const { buffer } = build(withFamily('inter'));
    expect(/\/FontFile2/.test(buffer.toString('latin1')), 'police embarquée').toBe(true);
    expect(/Identity-H/.test(buffer.toString('latin1')), 'encodage Identity-H').toBe(true);
    // Sans ToUnicode, ce PDF serait un mur de numéros de glyphes pour un ATS.
    const flat = readPdfRuns(buffer).pages.flat().map((r) => r.text);
    expect(flat).toContain('Camille Rousseau');
    expect(flat.join(' ')).toContain('œuvre « citée »');
    expect(flat.join(' ')).toContain('Externe en cardiologie');
    expect(flat.join(' ')).not.toContain('\uFFFD');
  });

  it('reste extractible dans les cinq familles livrées', () => {
    CV.FONT_FAMILIES.filter((f: { builtin: boolean }) => !f.builtin).forEach((family: { key: string; label: string }) => {
      const { buffer } = build(withFamily(family.key));
      const flat = readPdfRuns(buffer).pages.flat().map((r) => r.text).join(' ');
      expect(flat, family.label).toContain('Camille Rousseau');
      expect(flat, family.label).toContain('œuvre « citée »');
    });
  });

  it('n\'embarque QUE les graisses réellement écrites', () => {
    const result = CV.layout(withFamily('inter'));
    const used = CV.usedFonts(result).map((f: { key: string }) => f.key).sort();
    // Ce CV n'a ni titre en italique de famille de titres distincte : romain, gras, italique.
    expect(used.every((k: string) => k.indexOf('inter:') === 0)).toBe(true);
    expect(used.length).toBeLessThanOrEqual(4);
    expect(used).toContain('inter:normal');
  });

  it('associe une police de titres différente sans perdre l\'extraction', () => {
    const d = doc(
      [{ title: 'Formation', column: 'main', layout: 'entries', entries: [entry('DFASM')] }],
      { fontFamily: 'inter', headingFamily: 'ebgaramond' },
    );
    const result = CV.layout(d);
    const families = CV.usedFonts(result).map((f: { family: string }) => f.family);
    expect(new Set(families).size).toBe(2);
    const { buffer } = build(d);
    expect(readPdfRuns(buffer).pages.flat().map((r) => r.text)).toContain('FORMATION');
  });

  it('sans les fichiers de police, l\'export ne casse pas : repli lisible', () => {
    // Réseau coupé au moment de l'export : mieux vaut un PDF en Helvetica qu'aucun PDF.
    const { buffer } = build(withFamily('inter'), { fonts: false });
    const raw = buffer.toString('latin1');
    expect(/\/FontFile2/.test(raw)).toBe(false);
    const flat = readPdfRuns(buffer).pages.flat().map((r) => r.text).join(' ');
    expect(flat).toContain('Camille Rousseau');
    expect(flat).toContain('œuvre « citée »');
  });

  it('reste raisonnable en poids avec la police embarquée', () => {
    const { buffer } = build(withFamily('inter'));
    expect(buffer.length).toBeLessThan(150_000);
  });
});

describe('cv-pdf — le fichier produit', () => {
  it('contient du VRAI TEXTE extractible, pas une image', () => {
    const { buffer } = build(sample());
    const { pages, raw } = readPdf(buffer);
    expect(pages.length).toBeGreaterThan(1);
    const flat = pages.flat().map((r) => r.text);
    expect(flat).toContain('Camille Rousseau');
    expect(flat.some((t) => t.includes('Stage 0'))).toBe(true);
    // Aucune page rastérisée : ni JPEG plein cadre, ni image de fond.
    expect(/\/Filter\s*\/DCTDecode/.test(raw)).toBe(false);
    expect(/\/Subtype\s*\/Image/.test(raw)).toBe(false);
  });

  it('a autant de pages que l\'aperçu en annonce', () => {
    const { result, buffer } = build(sample());
    expect(readPdf(buffer).pages.length).toBe(result.pageCount);
  });

  it('conserve les accents, ligatures et signes typographiques français', () => {
    const { buffer } = build(sample());
    const flat = readPdf(buffer).pages.flat().map((r) => r.text).join(' ');
    expect(flat).toContain('œuvre « citée »');
    expect(flat).toContain('médecine interne');
    expect(flat).toContain('hospitalisés');
  });

  it('écrit le texte dans l\'ordre de lecture attendu par un ATS', () => {
    const { result, buffer } = build(sample());
    const fromPdf = readPdf(buffer).pages.map((runs) => runs.map((r) => r.text).join('\n')).join('\n\f\n');
    expect(fromPdf).toBe(CV.extractText(result));
  });

  it('ne superpose jamais deux textes au même endroit (pas de calque masqué)', () => {
    const { buffer } = build(sample());
    const seen = new Set<string>();
    readPdf(buffer).pages.forEach((runs) => {
      runs.forEach((r) => {
        const key = r.x.toFixed(1) + '|' + r.y.toFixed(1) + '|' + r.text;
        expect(seen.has(key), 'texte dupliqué : ' + r.text).toBe(false);
        seen.add(key);
      });
    });
  });

  it('renseigne les métadonnées du document', () => {
    const d = sample();
    d.meta.title = 'CV Camille Rousseau';
    const { buffer } = build(d);
    const raw = buffer.toString('latin1');
    expect(raw).toContain('/Title (CV Camille Rousseau)');
    expect(raw).toContain('/Author (Camille Rousseau)');
  });

  it('dérive un nom de fichier sans accent ni espace', () => {
    const d = doc([], {}, { fullName: 'Élodie Müller Nguyên' });
    expect(CV.pdfFileName(d, new Date('2026-03-07T10:00:00Z'))).toBe('CV-Elodie-Muller-Nguyen-2026-03-07.pdf');
  });

  it('reste rapide et léger sur un CV de trois pages', () => {
    const heavy = doc([{ title: 'Publications', column: 'main', layout: 'entries', entries: Array.from({ length: 60 }, (_, i) => entry('Publication ' + i, [LOREM])) }]);
    const started = Date.now();
    const { result, buffer } = build(heavy);
    expect(result.pageCount).toBeGreaterThanOrEqual(3);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(buffer.length).toBeLessThan(400_000);
  });

  it('supporte 200 entrées sans exploser', () => {
    const big = doc([{ title: 'Publications', column: 'main', layout: 'entries', entries: Array.from({ length: 200 }, (_, i) => entry('Réf ' + i)) }]);
    const started = Date.now();
    const result = CV.layout(big);
    expect(Date.now() - started).toBeLessThan(1500);
    expect(result.pageCount).toBeGreaterThan(3);
  });
});
