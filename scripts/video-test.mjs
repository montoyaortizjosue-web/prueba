// Genera videos con audio, los sube a la app, los prepara y verifica el resultado.
// Uso: npx vite preview --port 4173 y node scripts/video-test.mjs
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.argv[2] ?? 'http://localhost:4173';
mkdirSync('test-output/videos', { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });

// 1) Videos de ejemplo (3 s, con un tono de audio)
const gen = await browser.newPage();
await gen.goto('about:blank');
for (const [name, w, h] of [['horizontal.webm', 640, 360], ['vertical.webm', 360, 640]]) {
  const bytes = await gen.evaluate(async ([w, h]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    const ac = new AudioContext(); const osc = ac.createOscillator(); const dst = ac.createMediaStreamDestination();
    osc.connect(dst); osc.start();
    const stream = c.captureStream(30); dst.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
    const chunks = []; rec.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise((r) => (rec.onstop = r));
    rec.start(200);
    const t0 = performance.now();
    await new Promise((res) => {
      const f = () => {
        const t = (performance.now() - t0) / 3000;
        x.fillStyle = `hsl(${t * 300},80%,55%)`; x.fillRect(0, 0, w, h);
        x.fillStyle = '#fff'; x.fillRect(t * (w - 60), h / 2 - 30, 60, 60);
        x.fillStyle = '#000'; x.font = 'bold 40px sans-serif'; x.fillText('VIDEO', 20, 50);
        t < 1 ? requestAnimationFrame(f) : res();
      };
      f();
    });
    rec.stop(); await done; osc.stop();
    return Array.from(new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer()));
  }, [w, h]);
  writeFileSync(`test-output/videos/${name}`, Buffer.from(bytes));
}
await gen.close();

// 2) La app
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(base);
await page.setInputFiles('input[type=file]', [
  'test-output/videos/horizontal.webm', 'test-output/videos/vertical.webm',
  'test-output/samples/cuadrada.jpg', 'test-output/samples/vertical-9x16.jpg',
]);
await page.getByText('2 fotos y 2 videos listos').waitFor({ timeout: 30000 });
console.log('Subida OK: 2 fotos y 2 videos');
await page.screenshot({ path: 'test-output/shots/video-1-subida.png', fullPage: true });
await page.getByRole('button', { name: 'Siguiente' }).click();
await page.getByAltText(/Vista previa/).waitFor();
await page.getByRole('button', { name: 'Siguiente' }).click();
await page.getByRole('button', { name: 'Preparar videos' }).waitFor();
console.log('Siguiente deshabilitado antes de preparar:', await page.getByRole('button', { name: 'Siguiente' }).isDisabled());
await page.screenshot({ path: 'test-output/shots/video-2-revisar.png', fullPage: true });
const t = Date.now();
await page.getByRole('button', { name: 'Preparar videos' }).click();
await page.getByText(/Preparando video 1 de 2/).waitFor();
await page.screenshot({ path: 'test-output/shots/video-3-progreso.png' });
await page.waitForFunction(() => document.querySelectorAll('.grid video').length === 2, null, { timeout: 60000 });
console.log(`2 videos preparados en ${((Date.now() - t) / 1000).toFixed(1)} s (duran 3 s cada uno)`);

// 3) Verificar los videos resultantes: tamaño, duración y audio
const info = await page.evaluate(async () => {
  const out = [];
  for (const v of document.querySelectorAll('.grid video')) {
    v.muted = false; v.volume = 1;
    await new Promise((r) => (v.readyState >= 1 ? r() : v.addEventListener('loadedmetadata', r, { once: true })));
    if (!Number.isFinite(v.duration)) { v.currentTime = 1e9; await new Promise((r) => v.addEventListener('timeupdate', r, { once: true })); v.currentTime = 0; }
    await v.play().catch(() => {});
    await new Promise((r) => setTimeout(r, 1200));
    out.push({ size: `${v.videoWidth}x${v.videoHeight}`, dur: Math.round(v.duration * 10) / 10, audioBytes: v.webkitAudioDecodedByteCount, type: v.src.slice(0, 5) });
    v.pause();
  }
  return out;
});
console.log('Videos resultantes:', JSON.stringify(info));
await page.screenshot({ path: 'test-output/shots/video-4-listos.png', fullPage: true });
await page.getByRole('button', { name: 'Siguiente' }).click();
await page.getByRole('button', { name: 'Descargar todo' }).waitFor();
const names = [];
page.on('download', (d) => names.push(d.suggestedFilename()));
await page.getByRole('button', { name: 'Descargar todo' }).click();
await page.waitForFunction(() => document.querySelector('[role=status]')?.textContent?.includes('Listo'), null, { timeout: 15000 });
console.log('Descargas:', names.join(', '));
const [zip] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Descargar todas/ }).click()]);
await zip.saveAs('test-output/videos/zip-con-videos.zip');
const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
await page.screenshot({ path: 'test-output/shots/video-5-descargar.png', fullPage: true });
console.log('Desborde horizontal:', o, '| errores de página:', errs.length ? errs.join(' / ') : 0);
await browser.close();
