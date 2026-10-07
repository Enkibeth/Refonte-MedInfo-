import { useEffect, useRef } from 'react';

import { subscribeHandoff, takeHandoff, type HandoffFor, type HandoffTool } from '@/chat/moduleHandoff';

/**
 * Reprend la demande du chat destinée à cet outil (ADR-0044) : au montage, puis à chaque
 * nouvelle demande tant que l'écran reste monté (onglet conservé par le navigateur).
 * Lu dans un effet, donc jamais pendant l'hydratation du pré-rendu web.
 *
 * `enabled` faux : la demande attend dans le relais (données de l'écran pas encore prêtes,
 * plateforme sans l'outil) ; elle expire si elle n'est pas reprise à temps.
 */
export function useModuleHandoff<T extends HandoffTool>(
  tool: T,
  onReceive: (handoff: HandoffFor<T>) => void,
  enabled = true,
): void {
  const callback = useRef(onReceive);
  callback.current = onReceive;
  useEffect(() => {
    if (!enabled) return;
    const consume = () => {
      const handoff = takeHandoff(tool);
      if (handoff) callback.current(handoff);
    };
    consume();
    return subscribeHandoff(tool, consume);
  }, [tool, enabled]);
}
