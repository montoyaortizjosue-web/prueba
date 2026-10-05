// Renderiza fotos de ejemplo con el motor real en Chromium y guarda los JPEG en test-output/.
// Uso: npm run dev (otra terminal) y luego: node scripts/render-samples.mjs [url]
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5173';
mkdirSync('test-output', { recursive: true });

// Inserta un segmento EXIF con Orientation=6 (rotar 90° horario) tras el SOI del JPEG.
function withOrientation6(bytes) {
  const exif = [
    0xff, 0xe1, 0x00, 0x1e, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // APP1 "Exif\0\0"
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // TIFF big-endian
    0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x06, 0x00, 0x00, // Orientation=6
    0x00, 0x00, 0x00, 0x00,
  ];
  return [...bytes.slice(0, 2), ...exif, ...bytes.slice(2)];
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
await page.goto(`${base}/harness.html`);
await page.waitForFunction(() => typeof window.run === 'function');

const samples = [
  { name: 'vertical 9x16.jpg', w: 1080, h: 1920, label: 'VERT' },
  { name: 'cuadrada.jpg', w: 1200, h: 1200, label: 'CUAD' },
  { name: 'horizontal.jpg', w: 1920, h: 1080, label: 'HORIZ' },
  { name: 'exif-rotada.jpg', w: 1600, h: 900, label: 'EXIF', exif: true }, // guardada apaisada, se muestra vertical
];

for (const s of samples) {
  let bytes = await page.evaluate(([w, h, l]) => window.makeJpeg(w, h, l), [s.w, s.h, s.label]);
  if (s.exif) bytes = withOrientation6(bytes);
  for (const color of ['plum', 'pink']) {
    const res = await page.evaluate(
      ([f, o]) => window.run(f, o),
      [{ name: s.name, bytes, type: 'image/jpeg' }, { format: 'auto', color }],
    );
    const [size, b64] = res.split('|');
    const out = `test-output/${s.name.replace(/\.jpg$/, '').replace(/\s+/g, '-')}-${color}.jpg`;
    writeFileSync(out, Buffer.from(b64, 'base64'));
    console.log(out, 'foto abierta a', size);
  }
}
await browser.close();
