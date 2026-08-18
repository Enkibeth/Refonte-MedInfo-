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
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

import { CV, doc, entry } from './helpers/cvEngine';

const require = createRequire(import.meta.url);
const { jsPDF } = require('../../public/vendor/js/jspdf.umd.min.js');

const LOREM = 'Prise en charge des patients hospitalisés en autonomie supervisée, participation aux visites et aux transmissions du service.';

/** cp1252 : les seuls codes qui diffèrent d'Unicode dans un PDF WinAnsi. */
const HIGH: Record<number, string> = {
  128: '€', 130: '‚', 131: 'ƒ', 132: '„', 133: '…', 134: '†', 135: '‡', 136: 'ˆ', 137: '‰',
  138: 'Š', 139: '‹', 140: 'Œ', 142: 'Ž', 145: '‘', 146: '’', 147: '“', 148: '”', 149: '•',
  150: '–', 151: '—', 152: '˜', 153: '™', 154: 'š', 155: '›', 156: 'œ', 158: 'ž', 159: 'Ÿ',
};

type Run = { x: number; y: number; text: string };

/** Extracteur minimal : jsPDF écrit des flux non compressés, lisibles tels quels. */
function readPdf(buffer: Buffer): { pages: Run[][]; raw: string } {
  const raw = buffer.toString('latin1');
  const objects: Record<string, string> = {};
  const re = /(\d+) 0 obj([\s\S]*?)endobj/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) objects[m[1]] = m[2];
  const contents = [...raw.matchAll(/\/Type \/Page\b[\s\S]*?\/Contents (\d+) 0 R/g)].map((x) => x[1]);
  const decode = (s: string) => {
    let out = '';
    for (let i = 0; i < s.length; i++) out += HIGH[s.charCodeAt(i)] || s.charAt(i);
    return out;
  };
  const pages = contents.map((id) => {
    const stream = (objects[id] || '').match(/stream\r?\n([\s\S]*?)endstream/);
    if (!stream) return [];
    return [...stream[1].matchAll(/([-\d.]+) ([-\d.]+) Td\s*\(((?:\\.|[^\\()])*)\)\s*Tj/g)].map((x) => ({
      x: Number(x[1]), y: Number(x[2]), text: decode(x[3].replace(/\\([()\\])/g, '$1')),
    }));
  });
  return { pages, raw };
}

function build(document: Record<string, unknown>) {
  const result = CV.layout(document);
  const pdf = CV.renderPdf(result, jsPDF, {});
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
  it('mesure exactement comme jsPDF (sinon l\'aperçu mentirait sur la pagination)', () => {
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const corpus = [
      'Diplôme de formation approfondie en sciences médicales',
      'CHU de Lyon — Service de cardiologie',
      'œuvre « citée » — 20 % (n = 143)',
      'AaBbCc 0123456789 ,.;:!?()[]/',
      'Élodie Müller-Nguyên',
    ];
    (['helvetica', 'times'] as const).forEach((family) => {
      ([['normal', false, false], ['bold', true, false], ['italic', false, true], ['bolditalic', true, true]] as const).forEach(([style, bold, italic]) => {
        pdf.setFont(family, style);
        pdf.setFontSize(11);
        corpus.forEach((text) => {
          const engine = CV.measureText(text, { family, size: 11, bold, italic });
          expect(Math.abs(engine - pdf.getTextWidth(text)), family + '/' + style + ' — ' + text).toBeLessThan(0.001);
        });
      });
    });
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
