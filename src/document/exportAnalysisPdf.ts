/**
 * Export PDF d'un résultat d'analyse/traduction de document via la fenêtre
 * d'impression du navigateur (même approche sans dépendance que le chat).
 * Le document source n'est jamais inclus — seulement le résultat produit et,
 * le cas échéant, les passages cités (déjà présents à l'écran).
 */
import { escapeHtml, markdownToHtml } from '@/ui/miniMarkdown';
import { citationPagesLabel, type DocumentCitation } from '@/document/citations';

export function exportAnalysisToPdf({
  title,
  markdown,
  citations = [],
}: {
  title: string;
  markdown: string;
  citations?: DocumentCitation[];
}): void {
  if (typeof window === 'undefined') return;
  const win = window.open('', '_blank', 'width=820,height=1000');
  if (!win) return;

  const date = new Date().toLocaleString('fr-FR');
  const citationsHtml = citations.length
    ? `<section class="cites"><h2>Passages du document cités</h2>${citations
        .map((c) => {
          const pages = citationPagesLabel(c);
          return `<blockquote>« ${escapeHtml(c.text)} »${pages ? `<span class="pg">${escapeHtml(pages)}</span>` : ''}</blockquote>`;
        })
        .join('')}</section>`
    : '';

  win.document.write(`<!doctype html>
<html lang="fr"><head><meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { margin: 20mm; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0E1626; line-height: 1.5; }
  header { border-bottom: 2px solid #2563EB; padding-bottom: 8px; margin-bottom: 16px; }
  h1 { font-size: 20px; margin: 0 0 2px; color: #1E40AF; }
  .meta { color: #5D6B80; font-size: 12px; }
  h2 { font-size: 13px; color: #1E40AF; margin: 18px 0 6px; }
  h3 { font-size: 14px; color: #2563EB; margin: 12px 0 4px; }
  p { margin: 5px 0; font-size: 13px; }
  ul { margin: 5px 0; padding-left: 20px; }
  li { font-size: 13px; margin: 2px 0; }
  .cites blockquote { margin: 6px 0; padding: 8px 12px; background: #EEF4FF; border-left: 3px solid #2563EB; border-radius: 6px; font-size: 12px; font-style: italic; }
  .cites .pg { display: block; font-style: normal; font-weight: 700; color: #5D6B80; margin-top: 4px; }
  footer { margin-top: 24px; border-top: 1px solid #DDE3ED; padding-top: 8px; color: #5D6B80; font-size: 11px; }
</style></head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">MedInfo AI — exporté le ${escapeHtml(date)}</div>
  </header>
  ${markdownToHtml(markdown)}
  ${citationsHtml}
  <footer>Résultat produit par une IA d'information en santé — ne remplace pas une consultation médicale.</footer>
</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}
