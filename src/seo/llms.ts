/**
 * `/llms.txt` — index du site destiné aux assistants IA (convention llmstxt.org).
 *
 * Les moteurs conversationnels lisent de plus en plus ce fichier pour résumer un site et
 * choisir les pages à citer. Construit à partir des MÊMES sources que les balises SEO et le
 * sitemap (`PAGE_SEO`, `DEFAULT_DESCRIPTION`) : aucune promesse propre à ce fichier, donc
 * aucune dérive possible avec le reste du site. Module PUR, testé
 * (`tests/unit/seo-llms.test.ts`), servi par `app/llms.txt+api.ts`.
 */
import { DEFAULT_DESCRIPTION, PAGE_SEO, SITE_NAME, canonicalUrl, type PageSeoKey } from '@/seo/meta';

const SECTIONS: { title: string; pages: PageSeoKey[] }[] = [
  { title: 'Pages principales', pages: ['home', 'chat', 'blog', 'pricing', 'about', 'contact'] },
  {
    title: 'Outils',
    pages: ['document', 'ecos', 'revision', 'partiel', 'scores', 'presentation', 'cvBuilder', 'article', 'audio'],
  },
  { title: 'Informations légales', pages: ['legal', 'mentionsLegales', 'cgu', 'confidentialite'] },
];

/** Limites d'usage reprises du pied de page et de la FAQ (finalité du service). */
const USAGE_LIMITS = [
  'MedInfo AI fournit de l’information médicale générale, jamais un diagnostic ni un avis médical individuel.',
  'En cas d’urgence, composez le 15 (SAMU) ou le 112.',
  'Les réponses du chat sont générées par une IA : vérifier la date, le contexte et le niveau de preuve des références citées.',
];

export function buildLlmsTxt(): string {
  const lines: string[] = [`# ${SITE_NAME}`, '', `> ${DEFAULT_DESCRIPTION}`, ''];
  lines.push('## Limites d’usage', '');
  for (const limit of USAGE_LIMITS) lines.push(`- ${limit}`);
  lines.push('');
  for (const section of SECTIONS) {
    lines.push(`## ${section.title}`, '');
    for (const key of section.pages) {
      const page = PAGE_SEO[key];
      lines.push(`- [${page.title}](${canonicalUrl(page.path)}): ${page.description}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
