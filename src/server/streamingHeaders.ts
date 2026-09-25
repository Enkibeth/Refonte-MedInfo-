/**
 * En-têtes des réponses EN FLUX (chat, simulation ECOS, analyse de document).
 *
 * Sur Vercel, le streaming passait tel quel. Chez Hostinger, la réponse traverse le serveur
 * web (LiteSpeed) puis, si le domaine l'active, le CDN `hcdn` : deux intermédiaires qui
 * peuvent mettre le flux en tampon ou le recompresser — le symptôme est une réponse qui
 * n'apparaît qu'à la toute fin, voire une coupure. Ces deux en-têtes standard le leur
 * interdisent explicitement :
 *
 *   - `Cache-Control: no-cache, no-transform` — `no-transform` (RFC 9111 §5.2.2.6) interdit
 *     à un intermédiaire de modifier le corps, recompression comprise ;
 *   - `X-Accel-Buffering: no` — désactive la mise en tampon côté proxy (nginx, LiteSpeed).
 *
 * Sans effet sur un hébergeur qui ne tamponne pas : on les pose partout plutôt que de
 * dépendre de la plateforme.
 */
export const STREAMING_RESPONSE_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'Cache-Control': 'no-cache, no-transform',
  'X-Accel-Buffering': 'no',
});
