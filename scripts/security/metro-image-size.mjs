/** Metro 0.84 expects image-size v1's callable/path API. Keep that contract with
 * the patched v2 decoder; do not downgrade Expo to satisfy npm audit. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const MARKER = '/* medinfo: image-size v2 compatibility */';
const OLD_IMPORT = 'var _imageSize = _interopRequireDefault(require("image-size"));';

export function adaptMetroSource(source) {
  if (source.includes(MARKER)) return source;
  if (source.split(OLD_IMPORT).length !== 2) {
    throw new Error('Metro image-size import changed: review the compatibility adapter before building.');
  }
  return source.replace(OLD_IMPORT, `${MARKER}
var _imageSize = { default: function(input) {
  return require("image-size").imageSize(
    typeof input === "string" ? require("node:fs").readFileSync(input) : input
  );
} };`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const assetsPath = path.join(path.dirname(require.resolve('metro/package.json')), 'src/Assets.js');
  const source = readFileSync(assetsPath, 'utf8');
  const patched = adaptMetroSource(source);
  if (patched !== source) writeFileSync(assetsPath, patched);
}
