import type { Drawable } from './types';

/** Abre un Blob de imagen (ya sin EXIF) para dibujarlo. Cerrar con `release`. */
export async function decodeBlob(blob: Blob): Promise<Drawable> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob);
    } catch {
      // probar con <img>
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export function release(d: Drawable) {
  if (typeof ImageBitmap !== 'undefined' && d instanceof ImageBitmap) d.close();
}
