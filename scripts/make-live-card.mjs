// Tarjeta del logo con número de contacto para un live (PNG).
// Uso: node scripts/make-live-card.mjs "+593 95 949 1374"
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const number = process.argv[2] ?? '+593 95 949 1374';
const font = (pkg, file) => readFileSync(`node_modules/@fontsource/${pkg}/files/${file}`).toString('base64');
const css = `
@font-face{font-family:Fredoka;font-weight:600;src:url(data:font/woff2;base64,${font('fredoka', 'fredoka-latin-600-normal.woff2')})}
@font-face{font-family:Nunito;font-weight:800;src:url(data:font/woff2;base64,${font('nunito', 'nunito-latin-800-normal.woff2')})}`;

const PATHS = {
  pata1: 'M37.13 26 L50.87 26 L25.87 99 L22.08 90 L12.13 99 Z',
  pata2: 'M50.87 26 L37.13 26 L62.13 99 L65.92 90 L75.87 99 Z',
  lazo1: 'M41 26 C34 14 12 -1 7 10 C3 19 3 32 6 40 C10 48 33 34 41 26 Z',
  lazo2: 'M47 26 C54 14 76 -1 81 10 C85 19 85 32 82 40 C78 48 55 34 47 26 Z',
  nudo: 'M43 17.5 H45 A5 5 0 0 1 50 22.5 V29.5 A5 5 0 0 1 45 34.5 H43 A5 5 0 0 1 38 29.5 V22.5 A5 5 0 0 1 43 17.5 Z',
};
// [archivo, ancho, alto, ancho total del logo]
const CARDS = [
  ['live-cards/ashanty-live-horizontal-1920x1080.png', 1920, 1080, 1100],
  ['live-cards/ashanty-live-vertical-1080x1920.png', 1080, 1920, 900],
];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
await page.setContent(`<style>${css}</style><p style="font-family:Fredoka;font-weight:600">a</p><p style="font-family:Nunito;font-weight:800">a</p>`);
await page.evaluate(() => Promise.all([document.fonts.load('600 80px Fredoka'), document.fonts.load('800 80px Nunito')]));
mkdirSync('live-cards', { recursive: true });

for (const [file, W, H, logoW] of CARDS) {
  const b64 = await page.evaluate(([W, H, logoW, number, PATHS]) => {
    const BG = '#42113C', PINK = '#FF5FA2', WHITE = '#FFFFFF';
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = BG; x.fillRect(0, 0, W, H);
    // tamaño del logo para que ocupe `logoW` de ancho (lazo + "shanty")
    x.font = '600 100px Fredoka';
    const per100 = 81 + x.measureText('shanty').width;
    const em = (logoW / per100) * 100;
    const total = 0.81 * em + (x.font = `600 ${em}px Fredoka`, x.measureText('shanty').width);
    const x0 = (W - total) / 2;

    const storeSize = em * 0.17, storeCap = storeSize * 0.7;
    const numSize = em * 0.3, numCap = numSize * 0.7;
    const gap1 = em * 0.22, gap2 = em * 0.34;
    const logoBottom = em + 0.27 * em;           // base + descendente
    const blockH = logoBottom + gap1 + storeCap + gap2 + numCap;
    const y0 = (H - blockH) / 2;
    const base = y0 + em;

    // lazo
    x.save(); x.translate(x0, y0); x.scale(em / 100, em / 100); x.lineJoin = 'round';
    x.fillStyle = PINK; x.strokeStyle = PINK; x.lineWidth = 2;
    for (const d of [PATHS.pata1, PATHS.pata2]) { const p = new Path2D(d); x.fill(p); x.stroke(p); }
    x.strokeStyle = BG; x.lineWidth = 2.5;
    for (const d of [PATHS.lazo1, PATHS.lazo2, PATHS.nudo]) { const p = new Path2D(d); x.fill(p); x.stroke(p); }
    x.restore();
    // "shanty"
    x.fillStyle = PINK; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    x.font = `600 ${em}px Fredoka`;
    x.fillText('shanty', x0 + 0.81 * em, base);

    // texto con separación entre letras, centrado
    const spaced = (text, size, spacing, color, baseline) => {
      x.font = `800 ${size}px Nunito`; x.fillStyle = color;
      const chars = Array.from(text);
      const widths = chars.map((ch) => x.measureText(ch).width);
      const gap = spacing * size;
      let px = (W - (widths.reduce((a, b) => a + b, 0) + gap * (chars.length - 1))) / 2;
      chars.forEach((ch, i) => { x.fillText(ch, px, baseline); px += widths[i] + gap; });
    };
    const storeBase = y0 + logoBottom + gap1 + storeCap;
    spaced('STORE', storeSize, 0.55, WHITE, storeBase);
    spaced(number, numSize, 0.08, PINK, storeBase + gap2 + numCap);
    return c.toDataURL('image/png').split(',')[1];
  }, [W, H, logoW, number, PATHS]);
  writeFileSync(file, Buffer.from(b64, 'base64'));
  console.log('listo', file);
}
await browser.close();
