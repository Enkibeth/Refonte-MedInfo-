/**
 * Repère « signal » de l'état vide du chat (web, ADR-0047) : un battement d'ECG à la couleur
 * de l'assistant, tracé une fois à l'ouverture. Décoratif ; rien sous reduced-motion
 * (le tracé est affiché d'emblée).
 */
export function PulseMark({ color }: { color: string }) {
  return (
    <svg width={44} height={16} viewBox="0 0 44 16" aria-hidden="true" focusable="false" style={{ display: 'block', flexShrink: 0, overflow: 'visible' }}>
      <path
        className="medinfo-pulse"
        d="M0 9 H12 L15 9 L17 11 L20 2 L23 14 L25 9 H31 Q34 6 37 9 H44"
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
