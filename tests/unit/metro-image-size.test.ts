import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { adaptMetroSource } from '../../scripts/security/metro-image-size.mjs';
const rootRequire = createRequire(import.meta.url);
const require = createRequire(rootRequire.resolve('metro/package.json'));

describe('patched image-size decoder with Metro v1 compatibility', () => {
  it('handles both buffers and file paths with the same dimensions', () => {
    const pngPath = path.join(process.cwd(), 'assets/icon.png');
    const bytes = readFileSync(pngPath);
    const source = 'var _imageSize = _interopRequireDefault(require("image-size"));';
    const adapter = runInNewContext(`${adaptMetroSource(source)}; _imageSize.default`, { require });
    const fromBytes = adapter(bytes);
    expect(fromBytes.width).toBeGreaterThan(0);
    expect(adapter(pngPath)).toEqual(fromBytes);
    const dir = mkdtempSync(path.join(tmpdir(), 'image-size-test-'));
    try {
      const target = path.join(dir, 'copy.png');
      writeFileSync(target, bytes);
      expect(adapter(target)).toEqual(fromBytes);
    } finally { rmSync(dir, { recursive: true }); }
  });
  it('is idempotent across repeated builds', () => {
    const once = adaptMetroSource('var _imageSize = _interopRequireDefault(require("image-size"));');
    expect(adaptMetroSource(once)).toBe(once);
  });
  it('fails loudly if upstream changes its import', () => {
    expect(() => adaptMetroSource('different upstream source')).toThrow(/review/);
  });
});
