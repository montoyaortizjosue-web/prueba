export type FormatId = '9x16' | '4x5' | '1x1';
export type FormatOption = FormatId | 'auto';

export interface FormatSpec {
  width: number;
  height: number;
  top: number;
  bottom: number;
  margin: number;
}

export const FORMATS: Record<FormatId, FormatSpec> = {
  '9x16': { width: 1080, height: 1920, top: 130, bottom: 120, margin: 50 },
  '4x5': { width: 1080, height: 1350, top: 190, bottom: 160, margin: 40 },
  '1x1': { width: 1080, height: 1080, top: 170, bottom: 150, margin: 40 },
};

export const CORNER_RADIUS = 36;
export const FOOTER_SIZE = 34;
export const FOOTER_SPACING = 0.25;
export const LOGO_EM_MAX = 84;
export const LOGO_TEXT_OFFSET = 0.81;
export const LOGO_BLOCK_TOP = -0.98;
export const LOGO_BLOCK_BOTTOM = 0.27;

export function resolveFormat(option: FormatOption, photoW: number, photoH: number): FormatId {
  if (option !== 'auto') return option;
  const ratio = photoH / photoW;
  if (ratio >= 1.4) return '9x16';
  if (ratio >= 0.9) return '4x5';
  return '1x1';
}

export interface PhotoRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Foto completa (contain) y centrada en el área central. */
export function photoRect(spec: FormatSpec, photoW: number, photoH: number): PhotoRect {
  const areaW = spec.width - 2 * spec.margin;
  const areaH = spec.height - spec.top - spec.bottom;
  const scale = Math.min(areaW / photoW, areaH / photoH);
  const w = photoW * scale;
  const h = photoH * scale;
  return {
    x: spec.margin + (areaW - w) / 2,
    y: spec.top + (areaH - h) / 2,
    w,
    h,
  };
}

export interface LogoLayout {
  em: number;
  x0: number;
  /** Línea base del texto; el lazo se dibuja en y = base - em. */
  base: number;
  textX: number;
  total: number;
}

export function logoLayout(spec: FormatSpec, textWidth: (em: number) => number): LogoLayout {
  const em = Math.min(spec.top * 0.52, LOGO_EM_MAX);
  const total = LOGO_TEXT_OFFSET * em + textWidth(em);
  const x0 = (spec.width - total) / 2;
  const blockTop = LOGO_BLOCK_TOP * em;
  const blockBottom = LOGO_BLOCK_BOTTOM * em;
  const base = spec.top / 2 + 6 - (blockTop + blockBottom) / 2;
  return { em, x0, base, textX: x0 + LOGO_TEXT_OFFSET * em, total };
}

/** Línea base para centrar verticalmente texto en mayúsculas. */
export function footerBaseline(photo: PhotoRect, canvasH: number, capHeight: number): number {
  const centre = (photo.y + photo.h + canvasH) / 2;
  return centre + capHeight / 2;
}

/** Posición x de cada letra con separación proporcional, centrada como bloque. */
export function spacedLetterXs(widths: number[], spacing: number, canvasW: number): number[] {
  const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(widths.length - 1, 0);
  let x = (canvasW - total) / 2;
  return widths.map((w) => {
    const at = x;
    x += w + spacing;
    return at;
  });
}

/** Los celulares (iOS) fallan en silencio con canvas de más de ~16,7 MP. */
export const MAX_CANVAS_AREA = 12_000_000;

/**
 * Tamaños intermedios al reducir hacia el destino: primero un salto directo si la
 * foto es enorme (para no crear canvas gigantes) y luego de mitad en mitad.
 */
export function halvingSteps(srcW: number, srcH: number, dstW: number, dstH: number, maxArea = MAX_CANVAS_AREA) {
  const steps: Array<{ w: number; h: number }> = [];
  let w = srcW;
  let h = srcH;
  if (w * h > maxArea) {
    const k = Math.sqrt(maxArea / (w * h));
    const jw = Math.floor(w * k);
    const jh = Math.floor(h * k);
    if (jw >= dstW && jh >= dstH) {
      w = jw;
      h = jh;
      steps.push({ w, h });
    }
  }
  while (w / 2 >= dstW && h / 2 >= dstH) {
    w = Math.floor(w / 2);
    h = Math.floor(h / 2);
    steps.push({ w, h });
  }
  return steps;
}
