/** Anneau de statut : une phase observée, sans pourcentage de progression supposé. */
import { chatPhaseView, type ChatPhase } from '@/ai/chat/statusPhases';
import { Icon } from '@/ui/icons';
import { tokens } from '@/ui/tokens';

const SIZE = tokens.size.ring;
const STROKE = tokens.size.stroke;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

export function ChatStatusRing({ phase, label, elapsed }: { phase: ChatPhase; label: string; elapsed?: string | null }) {
  const color = phase === 'recovering' ? tokens.colors.textMuted : tokens.colors.accent;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.space.md, minHeight: tokens.size.controlMd }}>
      <div aria-hidden="true" style={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ display: 'block', transform: 'rotate(-90deg)' }}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={tokens.colors.border} strokeWidth={STROKE} />
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={color} strokeWidth={STROKE} strokeDasharray={`${C / 2} ${C / 2}`} strokeLinecap="round" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={chatPhaseView(phase).icon} size={tokens.size.iconSm} color={color} />
        </div>
      </div>
      <div style={{ minWidth: 0, fontFamily: tokens.font.sans, color: tokens.colors.textMuted, ...tokens.type.label, lineHeight: `${tokens.type.label.lineHeight}px` }}>
        <div role="status" aria-live="polite" aria-atomic="true">{label}</div>
        {elapsed ? <div aria-hidden="true" style={{ ...tokens.type.caption, lineHeight: `${tokens.type.caption.lineHeight}px` }}>{elapsed}</div> : null}
      </div>
    </div>
  );
}
