/** Outil de maintenance UI, indépendant du build et de l’hébergement. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.join(__dirname, '../..');
function readModule(name) {
  const source = fs.readFileSync(path.join(root, `src/ui/${name}.ts`), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require(id) {
    if (id === 'react-native') return { Platform: { OS: 'web', select: obj => obj.web ?? obj.default } };
    if (id === './tokens') return readModule('tokens');
    throw Error(`Import inattendu : ${id}`);
  }});
  return exports;
}
fs.writeFileSync(path.join(root, 'public/medinfo-tokens.css'), readModule('standaloneTheme').standaloneTokenCss());

const iconPaths = readModule('iconPaths').ICON_PATHS;
const names = ['arrowUp', 'chevronDown', 'trash', 'x', 'download', 'plus', 'check'];
fs.writeFileSync(path.join(root, 'public/medinfo-icons.svg'), '<svg xmlns="http://www.w3.org/2000/svg">' + names.map(name => `<symbol id="${name}" viewBox="0 0 24 24"><path d="${iconPaths[name]}" /></symbol>`).join('') + '</svg>\n');
