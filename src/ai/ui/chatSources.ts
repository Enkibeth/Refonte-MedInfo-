/** Helpers purs pour le panneau/toggle sources du chat (04_CHATBOT §9). */
import type { UIMessage, UIMessagePart, UIDataTypes, UITools } from 'ai';

export interface Citation {
  title: string;
  emitter: string;
  url?: string;
  excerpt?: string;
}

export function collectLatestCitations(messages: UIMessage[]): Citation[] {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const parts = (messages[i]?.parts ?? []) as UIMessagePart<UIDataTypes, UITools>[];
    for (let j = parts.length - 1; j >= 0; j -= 1) {
      const part = parts[j] as any;
      const toolName: string = part?.toolName ?? part?.type?.replace('tool-', '') ?? '';
      if (toolName === 'show_sources' && Array.isArray(part?.output?.citations)) {
        return part.output.citations;
      }
    }
  }
  return [];
}
