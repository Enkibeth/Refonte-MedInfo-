/**
 * Mini-convertisseur markdown → HTML pour les exports « fenêtre d'impression »
 * (chat, analyse de document…). Gère titres `#`, listes `-`/`•`, gras `**`, italique `*`.
 * Suffisant pour des réponses IA ; pas un moteur markdown complet.
 */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

/** Titres (`#`..`###`), listes (`-`/`•`), paragraphes, gras/italique inline. */
export function markdownToHtml(md: string): string {
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
    if (/^#{1,3}\s+/.test(line)) {
      closeList();
      out.push(`<h3>${inline(line.replace(/^#{1,3}\s+/, ''))}</h3>`);
    } else if (/^\s*[-•]\s+/.test(line)) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inline(line.replace(/^\s*[-•]\s+/, ''))}</li>`);
    } else if (line.trim() === '') {
      closeList();
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join('\n');
}
