/** Cualquier cosa que el canvas pueda dibujar y que tenga tamaño. */
export type Drawable =
  | HTMLCanvasElement
  | ImageBitmap
  | HTMLImageElement
  | OffscreenCanvas;

export function sizeOf(d: Drawable): { width: number; height: number } {
  if (typeof HTMLImageElement !== 'undefined' && d instanceof HTMLImageElement) {
    return { width: d.naturalWidth, height: d.naturalHeight };
  }
  return { width: d.width, height: d.height };
}
