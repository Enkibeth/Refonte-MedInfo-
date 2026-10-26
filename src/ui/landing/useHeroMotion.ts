import { useEffect, useRef } from 'react';
import { Platform, type View } from 'react-native';

/**
 * Mouvement piloté du premier écran (web) — ADR-0047.
 *
 *  - Profondeur au pointeur (souris seulement) : la position du pointeur dans le bandeau est
 *    écrite en variables CSS (`--lx-mx`, `--lx-my`, de -0,5 à 0,5) ; la photographie et la
 *    carte s'y décalent de quelques pixels en sens opposés (landingCss.ts). Une écriture par
 *    image affichée au plus, aucune mise à jour d'état React.
 *  - Hors de la fenêtre, le bandeau porte `data-off="1"` : ses animations en boucle sont
 *    suspendues (aucun travail de rendu pour un tracé que personne ne voit).
 *
 * Rien sous prefers-reduced-motion, ni au doigt, ni en natif.
 */
export function useHeroMotion<T extends View>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const node = ref.current as unknown as HTMLElement | null;
    if (!node) return;
    const cleanups: (() => void)[] = [];

    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) node.dataset.off = entry.isIntersecting ? '0' : '1';
      });
      observer.observe(node);
      cleanups.push(() => observer.disconnect());
    }

    const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (fine && !reduced) {
      let frame = 0;
      const set = (x: number, y: number) => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          node.style.setProperty('--lx-mx', x.toFixed(3));
          node.style.setProperty('--lx-my', y.toFixed(3));
        });
      };
      const onMove = (event: PointerEvent) => {
        if (event.pointerType !== 'mouse') return;
        const rect = node.getBoundingClientRect();
        set((event.clientX - rect.left) / rect.width - 0.5, (event.clientY - rect.top) / rect.height - 0.5);
      };
      const onLeave = () => set(0, 0);
      node.addEventListener('pointermove', onMove);
      node.addEventListener('pointerleave', onLeave);
      cleanups.push(() => {
        cancelAnimationFrame(frame);
        node.removeEventListener('pointermove', onMove);
        node.removeEventListener('pointerleave', onLeave);
      });
    }
    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);
  return ref;
}
