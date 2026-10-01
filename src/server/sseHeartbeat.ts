/**
 * Battement de cœur des réponses en flux SSE — `/api/chat` (2026-10).
 *
 * En mode Approfondi, le modèle réfléchit et lance ses recherches web SANS rien émettre :
 * aucun octet ne circule pendant parfois plus d'une minute. Or la réponse traverse le CDN
 * Hostinger puis LiteSpeed, dont les délais d'inactivité ne sont pas documentés (« reste non
 * mesuré : une génération de plus de 60 s », docs/09_DEPLOYMENT.md §6), et Safari iOS. Une
 * connexion jugée inactive par l'un d'eux est coupée : l'utilisateur ne voit rien arriver
 * alors que le serveur, lui, continue.
 *
 * Remède standard : un COMMENTAIRE SSE (`: keep-alive`) après chaque silence de
 * `SSE_HEARTBEAT_INTERVAL_MS`. Le parseur du client (eventsource-parser, utilisé par
 * l'AI SDK) ignore les lignes qui commencent par `:` et ne déclenche aucun événement pour
 * la ligne vide qui suit : invisible pour l'application, mais quelques octets qui
 * maintiennent la connexion vivante à chaque maillon.
 *
 * Garde : on n'écrit QU'ENTRE deux événements (dernier fragment terminé par un saut de
 * ligne) — jamais au milieu d'une ligne `data:` qu'un fragment aurait coupée.
 *
 * ⚠️ Réservé aux flux SSE (`text/event-stream`) : `/api/analyze` et `/api/ecos` diffusent du
 * texte brut, où ce commentaire apparaîtrait tel quel dans la réponse.
 */

/** Silence maximal avant un battement : bien sous les délais usuels de proxy (60 s). */
export const SSE_HEARTBEAT_INTERVAL_MS = 15_000;

const HEARTBEAT = new TextEncoder().encode(': keep-alive\n\n');
const LINE_FEED = 0x0a;

/**
 * Renvoie une réponse identique (statut, en-têtes, octets) dont le corps reçoit un
 * commentaire SSE après chaque silence de `intervalMs`. Ne lance jamais ; sans corps,
 * renvoie la réponse telle quelle.
 */
export function withSseHeartbeat(
  response: Response,
  { intervalMs = SSE_HEARTBEAT_INTERVAL_MS }: { intervalMs?: number } = {},
): Response {
  const source = response.body;
  if (!source) return response;
  const reader = source.getReader();

  let lastWrite = Date.now();
  // Fin d'événement SSE = ligne vide (« \n\n »). Un simple « \n » peut séparer deux lignes
  // `data:` d'un même événement : y glisser un battement le couperait en deux.
  let atEventBoundary = true;
  let lastByte = LINE_FEED;
  let timer: ReturnType<typeof setInterval> | undefined;
  const stopTimer = () => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  };

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      // Vérification au tiers de l'intervalle : un battement part entre 1× et 1,33× le délai.
      timer = setInterval(() => {
        if (!atEventBoundary || Date.now() - lastWrite < intervalMs) return;
        try {
          // Une copie à chaque fois : un maillon qui transférerait le tampon ne doit pas
          // vider les battements suivants.
          controller.enqueue(HEARTBEAT.slice());
          lastWrite = Date.now();
        } catch {
          stopTimer(); // flux déjà fermé : plus rien à entretenir
        }
      }, Math.max(10, Math.floor(intervalMs / 3)));
      // Le minuteur ne doit jamais retenir l'arrêt du processus à lui seul.
      (timer as { unref?: () => void }).unref?.();
    },
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          stopTimer();
          controller.close();
          return;
        }
        controller.enqueue(value);
        lastWrite = Date.now();
        if (value.length > 0) {
          const beforeLast = value.length >= 2 ? value[value.length - 2] : lastByte;
          lastByte = value[value.length - 1];
          atEventBoundary = lastByte === LINE_FEED && beforeLast === LINE_FEED;
        }
      } catch (error) {
        stopTimer();
        controller.error(error);
      }
    },
    cancel(reason) {
      // Client parti (onglet fermé, réseau coupé) : on libère la source. La génération, elle,
      // continue côté serveur (`consumeStream()` dans /api/chat) et sera archivée.
      stopTimer();
      return reader.cancel(reason);
    },
  });

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
