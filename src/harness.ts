// Solo desarrollo: lo usa scripts/render-samples.mjs. No entra en el build.
import '@fontsource/fredoka/600.css';
import '@fontsource/nunito/800.css';
import { composite, openFile } from './lib';

declare global {
  interface Window {
    run: (file: { name: string; bytes: number[]; type: string }, opts: object) => Promise<string>;
    makeJpeg: (w: number, h: number, label: string) => Promise<number[]>;
  }
}

window.makeJpeg = async (w, h, label) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#2b8cff');
  g.addColorStop(1, '#ffd23f');
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  x.fillStyle = '#fff';
  x.fillRect(0, 0, 40, 40); // esquina superior izquierda marcada
  x.fillStyle = '#000';
  x.font = `bold ${Math.round(w / 8)}px sans-serif`;
  x.fillText(label, w * 0.1, h * 0.5);
  const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.95));
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
};

window.run = async (f, opts) => {
  const file = new File([new Uint8Array(f.bytes)], f.name, { type: f.type });
  const photo = await openFile(file);
  const out = await composite(photo.canvas, opts);
  const buf = new Uint8Array(await out.arrayBuffer());
  let s = '';
  for (const b of buf) s += String.fromCharCode(b);
  return `${photo.width}x${photo.height}|${btoa(s)}`;
};
