// Construit un vrai .xlsx avec la copie vendored de SheetJS (celle que la page charge)
// pour que la fumigation teste EXACTEMENT le lecteur livré. Utilisé par partiel-smoke.mjs.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.resolve(here, '../../public/vendor/js/xlsx.full.min.js'), 'utf-8');
const sandbox = { window: {}, global: {}, console, TextDecoder, TextEncoder, Date, Math };
sandbox.self = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const XLSX = sandbox.XLSX || sandbox.window.XLSX;
export function buildWorkbook(rows) {
  // Les cellules restent des CHAÎNES (« 7,5 ») : c'est le cas réel d'un export de
  // scolarité et le piège que la page doit savoir lire.
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Notes');
  return Buffer.from(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
}
