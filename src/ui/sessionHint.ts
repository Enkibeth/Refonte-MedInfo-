/**
 * Présentation publique d'un outil dès le PRÉ-RENDU, sans flash pour les comptes connectés.
 *
 * Le pré-rendu ne connaît pas la session : RoleGate y rend à la fois la présentation publique
 * de l'outil (src/ui/ToolPreview.tsx, lue par les moteurs et les aperçus de liens) et
 * l'indicateur de chargement. Un script de tête (app/+html.tsx), exécuté AVANT le premier
 * affichage, marque `<html data-session-hint>` si ce navigateur avait une session
 * (`SESSION_HINT_KEY`, src/auth/bootGuard.ts) : les règles ci-dessous montrent alors
 * l'indicateur au lieu de la présentation. React n'hydrate que `#root` : l'attribut posé sur
 * `<html>` ne crée aucun écart d'hydratation. CSP : l'empreinte du script est calculée par le
 * serveur comme pour tout script inline (server/lib/security.mjs).
 */
import { SESSION_HINT_KEY } from '@/auth/bootGuard';

export const SESSION_HINT_ATTRIBUTE = 'data-session-hint';

/** Script de tête (texte exact : son empreinte CSP est calculée au service). */
export const SESSION_HINT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(SESSION_HINT_KEY)})==='1')document.documentElement.setAttribute('${SESSION_HINT_ATTRIBUTE}','')}catch(e){}`;

/**
 * `gate-pending` : présentation affichée pendant l'amorçage de l'authentification ;
 * `gate-loading` : indicateur de chargement, caché par défaut (visiteur probable).
 */
export const SESSION_HINT_CSS = `
[data-mi~="gate-loading"] { display: none !important; }
html[${SESSION_HINT_ATTRIBUTE}] [data-mi~="gate-loading"] { display: flex !important; }
html[${SESSION_HINT_ATTRIBUTE}] [data-mi~="gate-pending"] { display: none !important; }
`;
