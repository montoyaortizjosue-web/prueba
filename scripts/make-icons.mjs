// Genera los íconos de la app (lazo rosa sobre fondo ciruela) en public/.
// Uso: node scripts/make-icons.mjs
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const PATHS = {
  pata1: 'M37.13 26 L50.87 26 L25.87 99 L22.08 90 L12.13 99 Z',
  pata2: 'M50.87 26 L37.13 26 L62.13 99 L65.92 90 L75.87 99 Z',
  lazo1: 'M41 26 C34 14 12 -1 7 10 C3 19 3 32 6 40 C10 48 33 34 41 26 Z',
  lazo2: 'M47 26 C54 14 76 -1 81 10 C85 19 85 32 82 40 C78 48 55 34 47 26 Z',
  nudo: 'M43 17.5 H45 A5 5 0 0 1 50 22.5 V29.5 A5 5 0 0 1 45 34.5 H43 A5 5 0 0 1 38 29.5 V22.5 A5 5 0 0 1 43 17.5 Z',
};
const BG = '#42113C';
const FG = '#FF5FA2';

// ícono vectorial (favicon)
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="${BG}"/><g transform="translate(18 15) scale(.64)"><g fill="${FG}" stroke="${FG}" stroke-width="2" stroke-linejoin="round"><path d="${PATHS.pata1}"/><path d="${PATHS.pata2}"/></g><g fill="${FG}" stroke="${BG}" stroke-width="2.5" stroke-linejoin="round"><path d="${PATHS.lazo1}"/><path d="${PATHS.lazo2}"/><path d="${PATHS.nudo}"/></g></g></svg>\n`;
writeFileSync('public/favicon.svg', svg);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
// tamaño, proporción del lazo respecto al lado (el maskable deja zona segura del 80%)
const jobs = [
  ['icons/icon-192.png', 192, 0.62],
  ['icons/icon-512.png', 512, 0.62],
  ['icons/maskable-512.png', 512, 0.5],
  ['icons/apple-touch-icon.png', 180, 0.62],
];
for (const [file, size, frac] of jobs) {
  const b64 = await page.evaluate(([size, frac, PATHS, BG, FG]) => {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d');
    x.fillStyle = BG; x.fillRect(0, 0, size, size);
    const h = size * frac, k = h / 100, w = 88 * k;
    x.save(); x.translate((size - w) / 2, (size - h) / 2); x.scale(k, k); x.lineJoin = 'round';
    x.fillStyle = FG; x.strokeStyle = FG; x.lineWidth = 2;
    for (const d of [PATHS.pata1, PATHS.pata2]) { const p = new Path2D(d); x.fill(p); x.stroke(p); }
    x.strokeStyle = BG; x.lineWidth = 2.5;
    for (const d of [PATHS.lazo1, PATHS.lazo2, PATHS.nudo]) { const p = new Path2D(d); x.fill(p); x.stroke(p); }
    x.restore();
    return c.toDataURL('image/png').split(',')[1];
  }, [size, frac, PATHS, BG, FG]);
  writeFileSync(`public/${file}`, Buffer.from(b64, 'base64'));
  console.log('listo', file);
}
await browser.close();
