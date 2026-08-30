/**
 * Anneau de progression du chat — implémentation WEB (2026-08, demande Hugo : « laisse un
 * rond évolutif assez joli en mode raisonnement, recherche sur internet, rédaction »).
 *
 * Remplace la timeline « Étapes » retirée par l'ADR-0037 : le chat ne fait plus qu'UN appel
 * LLM, il n'y a plus de liste d'étapes à dérouler — mais l'attente reste, et elle mérite
 * d'être habitée. L'anneau se remplit à mesure que la génération avance, avec l'icône de
 * l'étape en son centre et trois pastilles qui marquent le chemin parcouru.
 *
 * Sur le web on dessine un SVG INLINE (même pattern que icons.web.tsx / CountryFlag.web.tsx,
 * zéro dépendance) : un cercle `stroke-dasharray` / `stroke-dashoffset` donne un arc EXACT
 * de longueur arbitraire, là où la même chose en `View` + `borderRadius` demanderait deux
 * demi-disques masqués et pivotés — fragile et impossible à vérifier autrement qu'à l'œil.
 *
 * Mouvement : la rotation lente et les transitions sont coupées sous
 * `prefers-reduced-motion` (05_DESIGN — tout mouvement doit être coupable).
 */
import {
  CHAT_PHASE_ORDER,
  chatPhaseView,
  isPhaseDone,
  type ChatPhase,
} from '@/ai/chat/statusPhases';
import { Icon } from '@/ui/icons';
import { tokens } from '@/ui/tokens';
import { useReducedMotion } from '@/ui/useReducedMotion';

const SIZE = 42;
const STROKE = 3;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

export function ChatStatusRing({
  phase,
  label,
  elapsed,
}: {
  phase: ChatPhase;
  /** Libellé déjà résolu (peut porter le détail d'une recherche en cours). */
  label: string;
  /** Compteur d'attente formaté (« 12 s »). */
  elapsed?: string | null;
}) {
  const reducedMotion = useReducedMotion();
  const view = chatPhaseView(phase);
  const color = phase === 'recovering' ? tokens.colors.textMuted : tokens.colors.accent;
  const dash = CIRCUMFERENCE * view.progress;

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}
      aria-live="polite"
      aria-label={label}
    >
      <div style={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{
            display: 'block',
            // Départ à midi, puis rotation lente : un anneau figé à 58 % laisserait croire
            // que tout s'est arrêté.
            transform: 'rotate(-90deg)',
            animation: reducedMotion ? undefined : 'medinfo-ring-spin 2.8s linear infinite',
            transformOrigin: '50% 50%',
          }}
          aria-hidden="true"
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={tokens.colors.border}
            strokeWidth={STROKE}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
            style={{
              transition: reducedMotion ? undefined : 'stroke-dasharray 700ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
        </svg>
        {/* L'icône est hors du SVG en rotation : elle doit rester droite. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <Icon name={view.icon} size={15} color={color} />
        </div>
        {!reducedMotion ? (
          <style>{`@keyframes medinfo-ring-spin { from { transform: rotate(-90deg); } to { transform: rotate(270deg); } }`}</style>
        ) : null}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: tokens.colors.textMuted,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {CHAT_PHASE_ORDER.map((step) => {
            const done = isPhaseDone(step, phase);
            const current = step === phase;
            return (
              <span
                key={step}
                style={{
                  width: current ? 14 : 5,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: done || current ? tokens.colors.accent : tokens.colors.border,
                  transition: reducedMotion ? undefined : 'width 300ms ease, background-color 300ms ease',
                }}
              />
            );
          })}
          {elapsed ? (
            <span style={{ marginLeft: 6, fontSize: 12, color: tokens.colors.textMuted }}>
              {elapsed}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
