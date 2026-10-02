/**
 * Historique transmis au modèle du chat — TEXTE SEUL (2026-10).
 *
 * Le client renvoie à chaque tour toute la conversation sous forme de messages UI. Jusqu'ici
 * ils passaient tels quels dans `convertToModelMessages`, avec tout ce que le flux y avait
 * déposé : parts de RÉFLEXION et d'appels à la RECHERCHE WEB, chacune porteuse de
 * l'identifiant de l'élément stocké chez OpenAI. Le SDK OpenAI les rejoue alors en
 * `item_reference` (option `store`, active par défaut) : l'API réinjecte la réflexion et le
 * contenu des recherches web de TOUS les tours précédents. Mesuré en production
 * (2026-10-01) : de 46 000 à 228 000 tokens d'entrée en neuf tours d'une même conversation,
 * et 44 600 tokens pour un simple « ? » envoyé après une réponse avortée — contexte, latence
 * et coût qui gonflent à chaque tour, pour un contenu que le modèle n'a pas à relire.
 *
 * On ne garde donc que ce que la conversation CONTIENT : le texte des messages utilisateur et
 * assistant — exactement ce que restitue l'historique archivé quand on rouvre une
 * conversation. Le modèle relance une recherche si un tour l'exige.
 *
 * Effets de bord voulus (défense en profondeur) :
 *  - un message de rôle `system` envoyé par le client n'atteint plus le modèle ;
 *  - une part `file` glissée dans un message ne contourne plus la garde de la pièce jointe
 *    (réservée aux comptes vérifiés, transmise par le seul champ `attachment`) ;
 *  - aucun identifiant d'élément OpenAI fourni par le client n'est rejoué.
 *
 * Module PUR (server-safe), testé dans tests/unit/chat-model-history.test.ts.
 */
import { mentionedAttachmentName } from '@/ai/chat/attachment';

export interface ChatHistoryMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: { type: 'text'; text: string }[];
}

/** Texte d'un message UI : ses parts `text` concaténées (comme l'affichage et l'archive). */
function textOf(message: Record<string, unknown>): string {
  if (Array.isArray(message.parts)) {
    return message.parts
      .map((part) => {
        const p = part as { type?: unknown; text?: unknown } | null;
        return p?.type === 'text' && typeof p.text === 'string' ? p.text : '';
      })
      .join('');
  }
  return typeof message.content === 'string' ? message.content : '';
}

/**
 * Réduit les messages reçus du client à leur texte (rôles utilisateur et assistant).
 * Un message sans texte — la réponse avortée d'un tour qui n'a produit que de la réflexion
 * et des recherches — disparaît : il n'apporte rien au modèle et c'est lui qui rejouait le
 * plus de contexte.
 */
export function sanitizeChatHistory(raw: unknown): ChatHistoryMessage[] {
  if (!Array.isArray(raw)) return [];
  const history: ChatHistoryMessage[] = [];
  raw.forEach((value, index) => {
    if (!value || typeof value !== 'object') return;
    const message = value as Record<string, unknown>;
    const role = message.role;
    if (role !== 'user' && role !== 'assistant') return;
    const text = textOf(message);
    if (!text.trim()) return;
    const id = typeof message.id === 'string' && message.id ? message.id : `message-${index}`;
    history.push({ id, role, parts: [{ type: 'text', text }] });
  });
  return history;
}

/**
 * Consigne quand l'historique cite une pièce jointe que le modèle ne reçoit PAS dans cette
 * requête (pur, testé). Le document n'est jamais conservé (ADR-0034) : il n'est transmis
 * qu'avec le message auquel il est joint. Sans cette consigne, le modèle ne voyait qu'un nom
 * de fichier et répondait « je ne vois pas le contenu dans le fil » — ou, pire dans un
 * contexte médical, pouvait commenter un document qu'il n'a jamais vu.
 *
 * @param attachedName nom du document transmis avec CETTE requête (null s'il n'y en a pas) :
 *   ses mentions dans l'historique ne sont pas « antérieures » — c'est le même fichier, joint
 *   au dernier message (ex. renvoyé après un tour resté sans réponse).
 */
export function buildPriorAttachmentSection(
  history: readonly ChatHistoryMessage[],
  { attachedName }: { attachedName: string | null },
): string {
  const unseen = history
    .filter((m) => m.role === 'user')
    .map((m) => mentionedAttachmentName(m.parts[0]?.text ?? ''))
    .some((name) => name !== null && name !== attachedName);
  if (!unseen) return '';
  return (
    `\n\nPIÈCES JOINTES ANTÉRIEURES\n` +
    `Les documents mentionnés « Pièce jointe : … » dans les messages précédents ne te sont pas ` +
    `transmis dans cette requête : ils ne sont jamais conservés, par confidentialité. ` +
    `Appuie-toi sur ce que tu en as dit dans tes réponses précédentes. Si la question exige ` +
    `un document que tu n'as pas analysé, dis-le en une phrase et invite l'utilisateur à le ` +
    `joindre à nouveau (trombone). Ne décris et n'interprète JAMAIS un document qui ne t'est ` +
    `pas transmis.`
  );
}
