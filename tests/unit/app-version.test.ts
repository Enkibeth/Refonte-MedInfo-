import { describe, expect, it } from 'vitest';

import { bundleHashFromSrc, isStaleBuild } from '@/chat/appVersion';
import { entryBundleHash } from '../../server/lib/build-id.mjs';

describe('version servie / version exécutée', () => {
  it('lit l’empreinte du script d’entrée, absolu ou relatif, avec ou sans paramètre', () => {
    expect(bundleHashFromSrc('/_expo/static/js/web/entry-06ae2e4895fd33f5635cf35790bd2b81.js')).toBe('06ae2e4895fd33f5635cf35790bd2b81');
    expect(bundleHashFromSrc('https://medinfo-ai.com/_expo/static/js/web/entry-abcdef12.js?v=1')).toBe('abcdef12');
    expect(bundleHashFromSrc('/node_modules/expo-router/entry.bundle?platform=web')).toBeNull();
    expect(bundleHashFromSrc(null)).toBeNull();
  });

  it('serveur : une seule empreinte d’entrée, sinon aucune', () => {
    expect(entryBundleHash(['entry-abcdef12.js', 'chat-11111111.js', 'entry-abcdef12.js.map'])).toBe('abcdef12');
    expect(entryBundleHash(['entry-abcdef12.js', 'entry-12345678.js'])).toBeNull();
    expect(entryBundleHash([])).toBeNull();
  });

  it('« recharger » seulement si les deux versions sont connues et différentes', () => {
    expect(isStaleBuild('abcdef12', '12345678')).toBe(true);
    expect(isStaleBuild('abcdef12', 'abcdef12')).toBe(false);
    expect(isStaleBuild(null, 'abcdef12')).toBe(false);
    expect(isStaleBuild('abcdef12', null)).toBe(false);
  });
});
