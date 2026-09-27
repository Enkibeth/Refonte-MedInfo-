// Lancement Chromium commun aux scripts du banc. Playwright est importé depuis
// PLAYWRIGHT_MODULE (installation globale) ; proxy et confiance TLS sont optionnels :
//   BENCH_PROXY=http://hôte:port   BENCH_SPKI=<empreinte SPKI base64 du CA du proxy>
const playwright = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
export const chromium = playwright.chromium ?? playwright.default.chromium;

export function launch() {
  const args = [];
  if (process.env.BENCH_PROXY) args.push(`--proxy-server=${process.env.BENCH_PROXY}`, '--proxy-bypass-list=127.0.0.1;localhost');
  if (process.env.BENCH_SPKI) args.push(`--ignore-certificate-errors-spki-list=${process.env.BENCH_SPKI}`);
  return chromium.launch({ channel: 'chromium', args });
}
