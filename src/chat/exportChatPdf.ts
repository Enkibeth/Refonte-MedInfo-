/**
 * Export PDF d'une conversation de chat via la fenêtre d'impression du navigateur
 * (même approche sans dépendance que src/audio/exportPdf.ts).
 */
import { formatInlineCitations } from '@/ai/chat/parseAssistantMessage';
import { escapeHtml, markdownToHtml } from '@/ui/miniMarkdown';

export interface ChatPdfMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function exportChatToPdf({
  title,
  chatbotLabel,
  messages,
}: {
  title: string;
  chatbotLabel: string;
  messages: ChatPdfMessage[];
}): void {
  if (typeof window === 'undefined') return;
  const win = window.open('', '_blank', 'width=820,height=1000');
  if (!win) return;

  const date = new Date().toLocaleString('fr-FR');
  const body = messages
    .map((m) =>
      m.role === 'user'
        ? `<div class="q"><div class="who">Question</div>${markdownToHtml(m.content)}</div>`
        : `<div class="a"><div class="who">Réponse — ${escapeHtml(chatbotLabel)}</div>${markdownToHtml(formatInlineCitations(m.content))}</div>`,
    )
    .join('\n');

  win.document.write(`<!doctype html>
<html lang="fr"><head><meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { margin: 20mm; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0E1626; line-height: 1.5; }
  header { border-bottom: 2px solid #2563EB; padding-bottom: 8px; margin-bottom: 16px; }
  h1 { font-size: 20px; margin: 0 0 2px; color: #1E40AF; }
  .meta { color: #5D6B80; font-size: 12px; }
  .who { font-size: 11px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; color: #2563EB; margin-bottom: 4px; }
  .q { background: #EEF4FF; border-radius: 8px; padding: 10px 14px; margin: 12px 0 8px; }
  .a { padding: 4px 2px 12px; border-bottom: 1px solid #EAEEF5; }
  h3 { font-size: 14px; color: #2563EB; margin: 12px 0 4px; }
  p { margin: 5px 0; font-size: 13px; }
  ul { margin: 5px 0; padding-left: 20px; }
  li { font-size: 13px; margin: 2px 0; }
  footer { margin-top: 24px; border-top: 1px solid #DDE3ED; padding-top: 8px; color: #5D6B80; font-size: 11px; }
</style></head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">MedInfo AI — ${escapeHtml(chatbotLabel)} — exporté le ${escapeHtml(date)}</div>
  </header>
  ${body}
  <footer>Conversation générée avec une IA d'information en santé — ne remplace pas un avis médical individuel.</footer>
</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}
