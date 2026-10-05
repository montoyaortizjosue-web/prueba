// Recorre los 4 pasos con fotos de ejemplo y guarda capturas en test-output/shots.
// Uso: npm run build && npx vite preview --port 4173 (otra terminal) y: node scripts/screenshots.mjs [url]
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, readdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4173';
mkdirSync('test-output/shots', { recursive: true });
mkdirSync('test-output/samples', { recursive: true });

function withOrientation6(bytes) {
  const exif = [0xff,0xe1,0x00,0x1e,0x45,0x78,0x69,0x66,0x00,0x00,0x4d,0x4d,0x00,0x2a,0x00,0x00,0x00,0x08,
    0x00,0x01,0x01,0x12,0x00,0x03,0x00,0x00,0x00,0x01,0x00,0x06,0x00,0x00,0x00,0x00,0x00,0x00];
  return Buffer.from([...bytes.slice(0, 2), ...exif, ...bytes.slice(2)]);
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

// 1) Fotos de ejemplo
{
  const page = await browser.newPage();
  await page.goto('about:blank');
  const samples = [
    ['vertical-9x16.jpg', 1080, 1920, 'VERTICAL', false],
    ['cuadrada.jpg', 1200, 1200, 'CUADRADA', false],
    ['horizontal.jpg', 1920, 1080, 'HORIZONTAL', false],
    ['exif-rotada.jpg', 1600, 900, 'EXIF', true],
  ];
  for (const [name, w, h, label, exif] of samples) {
    const arr = await page.evaluate(async ([w, h, label]) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#2b8cff'); g.addColorStop(1, '#ffd23f'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = '#fff'; x.fillRect(0, 0, 40, 40); x.fillStyle = '#000';
      x.font = `bold ${Math.round(w / 8)}px sans-serif`; x.fillText(label, w * 0.1, h * 0.5);
      const b = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.95));
      return Array.from(new Uint8Array(await b.arrayBuffer()));
    }, [w, h, label]);
    writeFileSync(`test-output/samples/${name}`, exif ? withOrientation6(arr) : Buffer.from(arr));
  }
  await page.close();
}
const files = readdirSync('test-output/samples').map((f) => `test-output/samples/${f}`);

let problems = 0;
for (const [label, width, height] of [['390', 390, 844], ['1280', 1280, 800]]) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { console.log('ERROR de página:', e.message); problems++; });
  await page.goto(base);
  const check = async (name) => {
    const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    if (o.sw > o.cw) { console.log(`DESBORDE en ${name} @${label}: ${o.sw} > ${o.cw}`); problems++; }
    await page.screenshot({ path: `test-output/shots/${label}-${name}.png`, fullPage: true });
  };
  await page.setInputFiles('input[type=file]', [...files, 'test-output/samples/../../package.json']);
  await page.getByText('4 fotos listas').waitFor();
  await page.getByText('Entendido').first().waitFor();
  await check('1-fotos');
  await page.getByRole('button', { name: 'Entendido' }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByAltText(/Vista previa/).waitFor();
  await check('2-estilo');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.grid img').length === 4);
  await check('3-revisar');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: /Descargar todas/ }).waitFor();
  await check('4-descargar');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Descargar todas/ }).click()]);
  console.log(label, 'zip:', dl.suggestedFilename());
  await dl.saveAs(`test-output/${label}-ashanty-fotos.zip`);
  await ctx.close();
}
await browser.close();
console.log(problems ? `${problems} problema(s)` : 'Sin desbordes ni errores');
