import { describe, expect, it, vi } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

vi.mock('react-native', () => ({
  Platform: { OS: 'web', select: (values: { web?: unknown; default?: unknown }) => values.web ?? values.default },
}));

import { INTERACTION_CSS, STATE_LAYER } from '@/ui/interaction';
import { tokens } from '@/ui/tokens';

/**
 * Contrat des états d'interaction (05_DESIGN §5, §7) : couche d'état CSS des contrôles faits
 * main, et garde-fous contre le retour des motifs qui faisaient « prototype ».
 */
describe('couche d’état des contrôles (src/ui/interaction.ts)', () => {
  it('pose une couche au survol et à l’appui, jamais sur un contrôle désactivé', () => {
    for (const feedback of ['layer', 'light']) {
      expect(INTERACTION_CSS).toContain(`[data-tap="${feedback}"]:not([aria-disabled="true"]):hover::after`);
      expect(INTERACTION_CSS).toContain(`[data-tap="${feedback}"]:not([aria-disabled="true"]):active::after`);
    }
    expect(INTERACTION_CSS).toContain('[data-tap="link"]:not([aria-disabled="true"]):hover [dir="auto"]');
    expect(INTERACTION_CSS).toContain('[data-tap][aria-disabled="true"] { cursor: not-allowed; }');
  });

  it('réserve le survol aux appareils qui survolent (pas d’état collant au doigt)', () => {
    const hoverBlock = INTERACTION_CSS.slice(INTERACTION_CSS.indexOf('@media (hover: hover)'));
    expect(hoverBlock).toContain(':hover::after');
    expect(INTERACTION_CSS.slice(0, INTERACTION_CSS.indexOf('@media (hover: hover)'))).not.toContain(':hover');
  });

  it('épouse l’arrondi du contrôle sans intercepter les clics', () => {
    expect(INTERACTION_CSS).toContain('border-radius: inherit');
    expect(INTERACTION_CSS).toContain('pointer-events: none');
    expect(INTERACTION_CSS).toContain(`background-color: ${tokens.colors.text}`);
  });

  it('reste une nuance (assombrir sans masquer le contenu), l’appui plus marqué que le survol', () => {
    for (const layer of Object.values(STATE_LAYER)) {
      expect(layer.hover).toBeGreaterThan(0);
      expect(layer.pressed).toBeGreaterThan(layer.hover);
      expect(layer.pressed).toBeLessThanOrEqual(0.2);
    }
  });

  it('est injectée dans le document web, avec la densité tactile des puces', () => {
    const html = readFileSync('app/+html.tsx', 'utf8');
    expect(html).toContain('${INTERACTION_CSS}');
    expect(html).toContain('${CHIP_CSS}');
  });
});

describe('garde-fous', () => {
  it('n’utilise plus TouchableOpacity (flash à 20 % d’opacité, aucun survol) — <Touchable> à la place', () => {
    const hits = execSync("grep -rln 'TouchableOpacity' app src --include='*.tsx' | grep -v 'src/ui/Touchable.tsx' || true", { encoding: 'utf8' }).trim();
    expect(hits).toBe('');
  });

  it('n’atténue plus l’opacité du bouton principal à l’appui ni au repos désactivé', () => {
    const button = readFileSync('src/ui/Button.tsx', 'utf8');
    expect(button).not.toMatch(/pressed:\s*\{\s*opacity/);
    expect(button).toContain('accentVividPressed');
    expect(button).toContain('NEUTRAL_DISABLED');
  });
});
