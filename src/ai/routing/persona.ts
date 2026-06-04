/**
 * Routing par persona (02_ARCHITECTURE §2, §4 ; ADR-0006 amendé par ADR-0011).
 *
 * public + student + professional sont actifs. La SÉLECTION/vérif du rôle pro est sortie
 * du report (ADR-0011) ; les features CLINIQUES pro restent gelées par ADR-0006 et le pro
 * reste soumis à la safe-box complète (aucun triage/diagnostic individualisé).
 *
 * ⚠️ Mapping PUR persona → groupe de routes. Ne déclenche AUCUNE logique médicale
 * (pas de triage, pas de wizard, pas de diagnostic — 01_REGULATION §5).
 */
import type { Persona } from '@/ai/prompts/_schema';

export type RouteGroup = '(chat)' | '(account)' | '(auth)';

export interface PersonaRoute {
  persona: Persona;
  /** Reporté hors MVP si false (ADR-0006). */
  enabledInMvp: boolean;
  /** Groupe de routes Expo Router servi à cette persona une fois authentifiée. */
  group: RouteGroup;
}

export const PERSONA_ROUTES: Record<Persona, PersonaRoute> = {
  public: { persona: 'public', enabledInMvp: true, group: '(chat)' },
  student: { persona: 'student', enabledInMvp: true, group: '(chat)' },
  professional: { persona: 'professional', enabledInMvp: true, group: '(chat)' },
};

export function isPersonaEnabled(persona: Persona): boolean {
  return PERSONA_ROUTES[persona].enabledInMvp;
}

export type PersonaResolution =
  | { allowed: true; group: RouteGroup }
  | { allowed: false; reason: 'reported_post_mvp'; group: RouteGroup };

/**
 * Résout la destination d'une persona authentifiée.
 * `professional` est routable mais non activé → `allowed:false` (aucune feature pro servie).
 */
export function resolvePersonaRoute(persona: Persona): PersonaResolution {
  const route = PERSONA_ROUTES[persona];
  if (!route.enabledInMvp) {
    return { allowed: false, reason: 'reported_post_mvp', group: route.group };
  }
  return { allowed: true, group: route.group };
}
