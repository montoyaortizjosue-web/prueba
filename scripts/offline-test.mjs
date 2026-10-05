// Verifica la PWA: manifest, service worker y uso completo sin conexión.
// Uso: npm run build && npx vite preview --port 4173 y node scripts/offline-test.mjs
import { chromium } from 'playwright-core';
const base = process.argv[2] ?? 'http://localhost:4173';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(base);
const mani = await page.evaluate(async () => {
  const href = document.querySelector('link[rel=manifest]')?.href;
  const m = await (await fetch(href)).json();
  return { name: m.name, display: m.display, icons: m.icons.map((i) => `${i.sizes}${i.purpose === 'maskable' ? ' maskable' : ''}`) };
});
console.log('Manifest:', JSON.stringify(mani));
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForFunction(async () => (await caches.keys()).length > 0);
const cached = await page.evaluate(async () => { const k = await caches.keys(); return (await (await caches.open(k[0])).keys()).length; });
console.log('Service worker activo; archivos guardados:', cached);

await ctx.setOffline(true);
await page.reload();
await page.getByText('Sube tus fotos y videos').waitFor();
console.log('Recarga SIN internet: la app abre');
const files = ['vertical-9x16.jpg', 'cuadrada.jpg'].map((f) => 'test-output/samples/' + f).concat('test-output/videos/vertical.webm');
await page.setInputFiles('input[type=file]', files);
await page.getByText('2 fotos y 1 video listos').waitFor({ timeout: 30000 });
await page.getByRole('button', { name: 'Siguiente' }).click();
await page.getByAltText(/Vista previa/).waitFor();
await page.getByRole('button', { name: 'Siguiente' }).click();
await page.getByRole('button', { name: 'Preparar video' }).click();
await page.waitForFunction(() => document.querySelectorAll('.grid video').length === 1, null, { timeout: 30000 });
await page.getByRole('button', { name: 'Siguiente' }).click();
const [zip] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Descargar todas/ }).click()]);
console.log('Sin internet: fotos + video procesados y zip descargado:', zip.suggestedFilename());
console.log('Errores de página:', errs.length ? errs.join(' / ') : 0);
await browser.close();
