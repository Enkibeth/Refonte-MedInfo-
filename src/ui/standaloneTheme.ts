import { tokens } from './tokens';

/** Contrat partagé des quatre pages autonomes. Générer via scripts/design/sync-web-theme.cjs. */
export const standaloneVariables: Record<string, string> = {
  bg: tokens.colors.background, surface: tokens.colors.surface, card: tokens.colors.surface,
  bg2: tokens.colors.surfaceAlt, cardalt: tokens.colors.surfaceAlt, sunken: tokens.colors.surfaceSunken,
  ink: tokens.colors.text, ink2: tokens.colors.textSubtle, 'ink-2': tokens.colors.textSubtle,
  muted: tokens.colors.textMuted, muted2: tokens.colors.textSubtle, 'ink-3': tokens.colors.textMuted,
  line: tokens.colors.borderStrong, 'rule-2': tokens.colors.borderStrong,
  rule: tokens.colors.border, linef: tokens.colors.border, 'line-fine': tokens.colors.border,
  'control-line': tokens.colors.borderControl, 'vivid-pressed': tokens.colors.accentVividPressed,
  'shadow-control': '0 1px 2px rgba(20,32,52,.06)',
  accent: tokens.colors.accent, 'accent-deep': tokens.colors.accentDeep, 'accent-soft': tokens.colors.accentSurface,
  'accent-tint': tokens.colors.accentSurfaceStrong, vivid: tokens.colors.accentVivid, 'vivid-deep': tokens.colors.accentVividStrong,
  a1: tokens.colors.accent, a1s: tokens.colors.accentSurface, a1m: tokens.colors.accentSurfaceStrong,
  a2: tokens.colors.textMuted, a2s: tokens.colors.surfaceAlt, a2m: tokens.colors.borderStrong,
  danger: tokens.colors.danger, err: tokens.colors.danger, 'danger-soft': tokens.colors.dangerBackground, errbg: tokens.colors.dangerBackground,
  success: tokens.colors.success, ok: tokens.colors.success, 'success-soft': tokens.colors.successBackground, oks: tokens.colors.successBackground,
  warn: tokens.colors.warningText, 'warn-ink': tokens.colors.warningText,
  'warn-bg': tokens.colors.warningBackground, 'warn-soft': tokens.colors.warningBackground, warns: tokens.colors.warningBackground, 'warn-line': tokens.colors.warningText,
  radius: `${tokens.radius.md}px`, 'radius-sm': `${tokens.radius.sm}px`, 'r-xs': `${tokens.radius.xs}px`, 'r-sm': `${tokens.radius.sm}px`, 'r-md': `${tokens.radius.md}px`, 'r-lg': `${tokens.radius.lg}px`,
  'shadow-rest': 'none', 'shadow-card': 'none', 'shadow-pop': '0 4px 12px rgba(20,32,52,.08)',
  sans: tokens.font.sans, 'brand-serif': tokens.font.serif, display: tokens.font.display,
  control: `${tokens.size.controlMd}px`, 'space-sm': `${tokens.space.sm}px`, 'space-md': `${tokens.space.md}px`, 'space-lg': `${tokens.space.lg}px`, 'space-xl': `${tokens.space.xl}px`,
  'font-body': `${tokens.type.body.fontSize}px`, 'font-label': `${tokens.type.label.fontSize}px`, 'font-caption': `${tokens.type.caption.fontSize}px`,
};

export function standaloneTokenCss(): string {
  return `/* Généré depuis src/ui/tokens.ts. Ne pas modifier à la main. */\n:root {\n${Object.entries(standaloneVariables).map(([key, value]) => `  --${key}: ${value};`).join('\n')}\n}\n`;
}
