import {
  BOW_PATHS,
  DEFAULT_TEXT,
  FOOTER_FONT_FAMILY,
  FOOTER_FONT_WEIGHT,
  LOGO_FONT_FAMILY,
  LOGO_FONT_WEIGHT,
  LOGO_TEXT,
  PALETTES,
  type FrameColor,
} from './brand';
import {
  CORNER_RADIUS,
  FOOTER_SIZE,
  FOOTER_SPACING,
  FORMATS,
  footerBaseline,
  logoLayout,
  photoRect,
  resolveFormat,
  spacedLetterXs,
  type FormatOption,
} from './layout';
import { domCanvas, drawScaled, type CanvasFactory } from './scale';
import { sizeOf, type Drawable } from './types';

export interface CompositeOptions {
  format?: FormatOption;
  color?: FrameColor;
  text?: string;
}

export const JPEG_QUALITY = 0.92;

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Dependencias del navegador, inyectables para poder probar sin DOM. */
export interface CompositeEnv {
  createCanvas: CanvasFactory;
  createPath: (d: string) => Path2D;
  ensureFonts: () => Promise<void>;
  toBlob: (canvas: HTMLCanvasElement | OffscreenCanvas, quality: number) => Promise<Blob>;
}

export async function loadBrandFonts(): Promise<void> {
  await Promise.all([
    document.fonts.load(`${LOGO_FONT_WEIGHT} 84px ${LOGO_FONT_FAMILY}`, LOGO_TEXT),
    document.fonts.load(`${FOOTER_FONT_WEIGHT} 34px ${FOOTER_FONT_FAMILY}`, 'ABC'),
  ]);
}

export const browserEnv: CompositeEnv = {
  createCanvas: domCanvas,
  createPath: (d) => new Path2D(d),
  ensureFonts: loadBrandFonts,
  toBlob: (canvas, quality) =>
    new Promise((resolve, reject) => {
      if ('convertToBlob' in canvas) {
        canvas.convertToBlob({ type: 'image/jpeg', quality }).then(resolve, reject);
        return;
      }
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('No se pudo generar el JPEG.'))),
        'image/jpeg',
        quality,
      );
    }),
};

function roundedRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

function drawBow(ctx: Ctx, env: CompositeEnv, x: number, y: number, size: number, bg: string, fg: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  ctx.lineJoin = 'round';
  ctx.fillStyle = fg;
  ctx.strokeStyle = fg;
  ctx.lineWidth = 2;
  for (const d of [BOW_PATHS.pata1, BOW_PATHS.pata2]) {
    const p = env.createPath(d);
    ctx.fill(p);
    ctx.stroke(p);
  }
  ctx.strokeStyle = bg;
  ctx.lineWidth = 2.5;
  for (const d of [BOW_PATHS.lazo1, BOW_PATHS.lazo2, BOW_PATHS.nudo]) {
    const p = env.createPath(d);
    ctx.fill(p);
    ctx.stroke(p);
  }
  ctx.restore();
}

function drawLogo(ctx: Ctx, env: CompositeEnv, spec: (typeof FORMATS)['9x16'], bg: string, fg: string) {
  const fontFor = (em: number) => `${LOGO_FONT_WEIGHT} ${em}px ${LOGO_FONT_FAMILY}`;
  const layout = logoLayout(spec, (em) => {
    ctx.font = fontFor(em);
    return ctx.measureText(LOGO_TEXT).width;
  });
  drawBow(ctx, env, layout.x0, layout.base - layout.em, layout.em, bg, fg);
  ctx.font = fontFor(layout.em);
  ctx.fillStyle = fg;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(LOGO_TEXT, layout.textX, layout.base);
}

function drawFooter(ctx: Ctx, text: string, photoBottomRect: ReturnType<typeof photoRect>, canvasW: number, canvasH: number, fg: string) {
  const upper = text.toUpperCase();
  if (!upper.trim()) return;
  ctx.font = `${FOOTER_FONT_WEIGHT} ${FOOTER_SIZE}px ${FOOTER_FONT_FAMILY}`;
  ctx.fillStyle = fg;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const letters = Array.from(upper);
  const widths = letters.map((l) => ctx.measureText(l).width);
  const xs = spacedLetterXs(widths, FOOTER_SPACING * FOOTER_SIZE, canvasW);
  const cap = ctx.measureText('H').actualBoundingBoxAscent || FOOTER_SIZE * 0.7;
  const y = footerBaseline(photoBottomRect, canvasH, cap);
  letters.forEach((l, i) => ctx.fillText(l, xs[i], y));
}

/** Compone la foto con el marco y el logo de Ashanty y devuelve un JPEG. */
export async function composite(
  image: Drawable,
  options: CompositeOptions = {},
  env: CompositeEnv = browserEnv,
): Promise<Blob> {
  const { width: iw, height: ih } = sizeOf(image);
  if (!iw || !ih) throw new Error('La imagen no tiene tamaño.');

  const spec = FORMATS[resolveFormat(options.format ?? 'auto', iw, ih)];
  const { bg, fg } = PALETTES[options.color ?? 'plum'];
  const text = options.text ?? DEFAULT_TEXT;

  await env.ensureFonts();

  const canvas = env.createCanvas(spec.width, spec.height);
  const ctx = canvas.getContext('2d') as Ctx | null;
  if (!ctx) throw new Error('No se pudo crear el lienzo (canvas).');

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, spec.width, spec.height);

  drawLogo(ctx, env, spec, bg, fg);

  const rect = photoRect(spec, iw, ih);
  ctx.save();
  roundedRectPath(ctx, rect.x, rect.y, rect.w, rect.h, CORNER_RADIUS);
  ctx.clip();
  drawScaled(ctx, image, rect.x, rect.y, rect.w, rect.h, env.createCanvas);
  ctx.restore();

  drawFooter(ctx, text, rect, spec.width, spec.height, fg);

  return env.toBlob(canvas, JPEG_QUALITY);
}
