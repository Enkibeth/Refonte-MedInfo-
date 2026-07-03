/**
 * Export PDF d'un document audio via la fenêtre d'impression du navigateur (web, sans
 * dépendance). On ouvre une fenêtre dédiée avec une mise en page sobre puis on déclenche
 * l'impression : l'utilisateur choisit « Enregistrer au format PDF ».
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Mini markdown → HTML (titres ##, gras **…**, listes -). Suffisant pour un compte rendu. */
function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^##\s+/.test(line)) {
      closeList();
      out.push(`<h2>${inline(line.replace(/^##\s+/, ''))}</h2>`);
    } else if (/^\s*-\s+/.test(line)) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inline(line.replace(/^\s*-\s+/, ''))}</li>`);
    } else if (line.trim() === '') {
      closeList();
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join('\n');

  function inline(s: string): string {
    return escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
  }
}

export interface ExportPdfInput {
  title: string;
  createdAt: string;
  report?: string | null;
  transcription: string;
}

export function exportDocumentToPdf({ title, createdAt, report, transcription }: ExportPdfInput): void {
  if (typeof window === 'undefined') return;
  const win = window.open('', '_blank', 'width=820,height=1000');
  if (!win) return;

  const date = new Date(createdAt).toLocaleString('fr-FR');
  const bodyHtml = report
    ? markdownToHtml(report)
    : `<pre class="transcription">${escapeHtml(transcription)}</pre>`;

  win.document.write(`<!doctype html>
<html lang="fr"><head><meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { margin: 20mm; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0E1626; line-height: 1.5; }
  header { border-bottom: 2px solid #2563EB; padding-bottom: 8px; margin-bottom: 16px; }
  h1 { font-size: 20px; margin: 0 0 2px; color: #1E40AF; }
  .meta { color: #5D6B80; font-size: 12px; }
  h2 { font-size: 15px; color: #2563EB; margin: 18px 0 6px; }
  p { margin: 6px 0; font-size: 13px; }
  ul { margin: 6px 0; padding-left: 20px; }
  li { font-size: 13px; margin: 2px 0; }
  pre.transcription { white-space: pre-wrap; font-family: inherit; font-size: 13px; }
  footer { margin-top: 24px; border-top: 1px solid #DDE3ED; padding-top: 8px; color: #5D6B80; font-size: 11px; }
</style></head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">MedInfo AI — généré le ${escapeHtml(date)}</div>
  </header>
  ${bodyHtml}
  <footer>Compte rendu généré par IA — à vérifier et valider par le professionnel de santé.</footer>
</body></html>`);
  win.document.close();
  win.focus();
  // Laisse le temps au rendu avant l'impression.
  setTimeout(() => win.print(), 300);
}
