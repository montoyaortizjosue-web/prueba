// Prueba de estrés: casos difíciles de fotos. Uso: npx vite preview --port 4173 y node scripts/stress.mjs
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://localhost:4173';
const dir = 'test-output/stress';
const all = readdirSync(dir);
const special = all.filter((f) => !f.startsWith('lote-')).map((f) => `${dir}/${f}`);
const lote = all.filter((f) => f.startsWith('lote-')).map((f) => `${dir}/${f}`);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--js-flags=--max-old-space-size=512'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('crash', () => errs.push('CRASH'));
await page.goto(base);

async function upload(files, label) {
  const t = Date.now();
  await page.setInputFiles('input[type=file]', files);
  await page.waitForFunction(() => !document.querySelector('.progress'), null, { timeout: 180000 });
  const info = await page.evaluate(() => ({
    listas: document.querySelector('.count')?.textContent ?? '0',
    fallos: [...document.querySelectorAll('.errors li')].map((li) => li.innerText.replace(/\n+/g, ' | ').slice(0, 130)),
  }));
  console.log(`\n[${label}] ${((Date.now() - t) / 1000).toFixed(1)}s -> ${info.listas}`);
  info.fallos.forEach((f) => console.log('   ✗', f));
}

await upload(special, 'casos difíciles');
// Procesar todas y verificar que cada foto sale bien
await page.getByRole('button', { name: 'Siguiente' }).click();
await page.getByRole('button', { name: 'Siguiente' }).click();
await page.waitForFunction(() => document.querySelectorAll('.grid img').length === document.querySelectorAll('.grid li').length && document.querySelectorAll('.grid li').length > 0, null, { timeout: 120000 });
const sizes = await page.evaluate(async () =>
  Promise.all([...document.querySelectorAll('.grid img')].map(async (i) => { await i.decode(); return `${i.alt.split(' con')[0]}: ${i.naturalWidth}x${i.naturalHeight}`; })));
console.log('\nResultados procesados:\n  ' + sizes.join('\n  '));
await page.screenshot({ path: 'test-output/stress-review.png', fullPage: true });

// Reiniciar y probar tanda de 30 + extras
await page.getByRole('button', { name: 'Siguiente' }).click();
await page.getByRole('button', { name: 'Empezar de nuevo' }).click();
await upload(lote, 'lote de 33 fotos (máx. 30)');
await page.getByRole('button', { name: 'Siguiente' }).click();
await page.getByRole('button', { name: 'Siguiente' }).click();
await page.waitForFunction(() => document.querySelectorAll('.grid img').length === 30, null, { timeout: 180000 });
console.log('\nLote procesado: 30 fotos listas en Revisar');
const mem = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) + ' MB heap JS' : 'n/d');
console.log('Memoria:', mem);
console.log(errs.length ? 'ERRORES de página: ' + errs.join(' / ') : '\nSin errores de página ni caídas');
await browser.close();
