import { isAcceptedFile, isHeic, MAX_PHOTOS, MAX_SIDE } from './files';
import { downscaleToCanvas } from './scale';
import type { Drawable } from './types';

export interface OpenedPhoto {
  name: string;
  /** Foto ya orientada (EXIF aplicado) y reducida a MAX_SIDE. */
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export interface PhotoFailure {
  name: string;
  message: string;
}

export type Loader = (file: Blob) => Promise<Drawable>;

/** Cada paso es inyectable para probar el orden de respaldo sin navegador. */
export interface OpenDeps {
  loaders: Loader[];
  convertHeic: (file: Blob) => Promise<Blob>;
  toCanvas: (source: Drawable, maxSide: number) => HTMLCanvasElement;
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) reject(new Error('Imagen vacía.'));
      else resolve(img);
    };
    img.onerror = () => reject(new Error('El navegador no pudo abrir la imagen.'));
    img.src = src;
  });
}

// Los navegadores actuales aplican la orientación EXIF al dibujar un <img>
// (image-orientation: from-image es el valor por defecto) y en createImageBitmap.
const viaObjectUrl: Loader = async (file) => {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    if (typeof img.decode === 'function') await img.decode().catch(() => undefined);
    return img;
  } finally {
    // La imagen ya está decodificada; si no, el siguiente método lo intenta.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
};

const viaDataUrl: Loader = async (file) => loadImage(await readAsDataUrl(file));

const viaBitmap: Loader = async (file) => {
  if (typeof createImageBitmap !== 'function') throw new Error('createImageBitmap no disponible.');
  return createImageBitmap(file, { imageOrientation: 'from-image' });
};

async function convertHeic(file: Blob): Promise<Blob> {
  const { default: heic2any } = await import('heic2any');
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
  return Array.isArray(out) ? out[0] : out;
}

export const browserOpenDeps: OpenDeps = {
  loaders: [viaObjectUrl, viaDataUrl, viaBitmap],
  convertHeic,
  toCanvas: (source, maxSide) => downscaleToCanvas(source, maxSide),
};

async function tryLoaders(file: Blob, loaders: Loader[]): Promise<Drawable | null> {
  for (const load of loaders) {
    try {
      return await load(file);
    } catch {
      // probar el siguiente método
    }
  }
  return null;
}

export const MSG_HEIC =
  'Es un archivo HEIC que no se pudo convertir. Ábrelo en tu galería y expórtalo o compártelo como JPG, o súbelo como JPG desde Google Fotos.';
export const MSG_BROKEN =
  'La foto está dañada o no se descargó por completo de Google Fotos. Descárgala primero al dispositivo y vuelve a subirla.';
export const MSG_FORMAT =
  'Este archivo no parece una foto compatible. Usa JPG, PNG, WebP, GIF, BMP, AVIF o HEIC.';

export class PhotoOpenError extends Error {}

export async function openFile(
  file: File,
  deps: OpenDeps = browserOpenDeps,
  maxSide: number = MAX_SIDE,
): Promise<OpenedPhoto> {
  if (!isAcceptedFile(file)) throw new PhotoOpenError(MSG_FORMAT);

  let source = await tryLoaders(file, deps.loaders);

  if (!source) {
    try {
      const jpeg = await deps.convertHeic(file);
      source = await tryLoaders(jpeg, deps.loaders);
    } catch {
      // sin conversión posible: se informa abajo
    }
  }

  if (!source) throw new PhotoOpenError(isHeic(file) ? MSG_HEIC : MSG_BROKEN);

  const canvas = deps.toCanvas(source, maxSide);
  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) source.close();
  return { name: file.name, canvas, width: canvas.width, height: canvas.height };
}

export interface OpenFilesResult {
  photos: OpenedPhoto[];
  errors: PhotoFailure[];
}

export interface OpenFilesOptions {
  /** Fotos que ya hay cargadas (el máximo es por tanda de 30). */
  existing?: number;
  max?: number;
  onProgress?: (current: number, total: number, name: string) => void;
  deps?: OpenDeps;
}

/** Abre las fotos una por una; si una falla, las demás continúan. */
export async function openFiles(files: File[], opts: OpenFilesOptions = {}): Promise<OpenFilesResult> {
  const max = opts.max ?? MAX_PHOTOS;
  const room = Math.max(0, max - (opts.existing ?? 0));
  const photos: OpenedPhoto[] = [];
  const errors: PhotoFailure[] = [];
  const accepted = files.slice(0, room);

  for (const f of files.slice(room)) {
    errors.push({ name: f.name, message: `Se pasó del máximo de ${max} fotos por tanda. Súbela en otra tanda.` });
  }

  for (let i = 0; i < accepted.length; i++) {
    const f = accepted[i];
    opts.onProgress?.(i + 1, accepted.length, f.name);
    try {
      photos.push(await openFile(f, opts.deps));
    } catch (e) {
      errors.push({ name: f.name, message: e instanceof PhotoOpenError ? e.message : MSG_BROKEN });
    }
  }
  return { photos, errors };
}

