import type { Drawable } from './types';
import { sizeOf } from './types';
import { halvingSteps } from './layout';

export type CanvasFactory = (w: number, h: number) => HTMLCanvasElement | OffscreenCanvas;

export const domCanvas: CanvasFactory = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function context(c: HTMLCanvasElement | OffscreenCanvas): Ctx {
  const ctx = c.getContext('2d') as Ctx | null;
  if (!ctx) throw new Error('No se pudo crear el lienzo (canvas).');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

/**
 * Dibuja `src` en (dx, dy, dw, dh) reduciendo de mitad en mitad para que
 * la foto no quede pixelada.
 */
export function drawScaled(
  ctx: Ctx,
  src: Drawable,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  createCanvas: CanvasFactory = domCanvas,
): void {
  const { width, height } = sizeOf(src);
  let current: Drawable = src;
  for (const step of halvingSteps(width, height, dw, dh)) {
    const tmp = createCanvas(step.w, step.h);
    const tctx = context(tmp);
    const { width: cw, height: ch } = sizeOf(current);
    tctx.drawImage(current as CanvasImageSource, 0, 0, cw, ch, 0, 0, step.w, step.h);
    current = tmp as Drawable;
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const { width: cw, height: ch } = sizeOf(current);
  ctx.drawImage(current as CanvasImageSource, 0, 0, cw, ch, dx, dy, dw, dh);
}

/** Copia `src` a un canvas nuevo de como máximo `maxSide` px por el lado largo. */
export function downscaleToCanvas(
  src: Drawable,
  maxSide: number,
  createCanvas: CanvasFactory = domCanvas,
): HTMLCanvasElement {
  const { width, height } = sizeOf(src);
  const k = Math.min(1, maxSide / Math.max(width, height));
  const w = Math.max(1, Math.round(width * k));
  const h = Math.max(1, Math.round(height * k));
  const out = createCanvas(w, h) as HTMLCanvasElement;
  drawScaled(context(out), src, 0, 0, w, h, createCanvas);
  return out;
}
