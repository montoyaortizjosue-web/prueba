import { isAcceptedFile, isHeic, isVideoFile, MAX_PHOTOS, MAX_SIDE } from './files';
import { release } from './decode';
import { downscaleToCanvas } from './scale';
import { MAX_VIDEO_SECONDS, openVideoElement, videoRecordingSupported } from './video';
import type { Drawable } from './types';

export interface OpenedPhoto {
  name: string;
  /** JPEG ya orientado (EXIF aplicado) y reducido a MAX_SIDE: pesa poco en memoria. */
  blob: Blob;
  /** Miniatura JPEG para la lista. */
  thumb: Blob;
  width: number;
  height: number;
  kind: 'image' | 'video';
  /** Solo videos: el archivo original (se procesa después) y su duración en segundos. */
  file?: File;
  duration?: number;
}

export interface PhotoFailure {
  name: string;
  message: string;
}

export type Loader = (file: Blob) => Promise<Drawable>;

export interface PreparedPhoto {
  blob: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

/** Cada paso es inyectable para probar el orden de respaldo sin navegador. */
export interface OpenDeps {
  loaders: Loader[];
  convertHeic: (file: Blob) => Promise<Blob>;
  /** Reduce, valida y codifica; lanza si el resultado no sirve (así se prueba otro método). */
  prepare: (source: Drawable, maxSide: number) => Promise<PreparedPhoto>;
  /** Videos: cuadro de portada reducido + duración. */
  openVideo: (file: File, maxSide: number) => Promise<PreparedPhoto & { duration: number }>;
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

// Último recurso para fotos enormes: el navegador las decodifica ya reducidas.
const viaBitmapResized: Loader = async (file) => {
  if (typeof createImageBitmap !== 'function') throw new Error('createImageBitmap no disponible.');
  return createImageBitmap(file, { imageOrientation: 'from-image', resizeWidth: MAX_SIDE, resizeQuality: 'high' });
};

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo codificar.'))), 'image/jpeg', quality),
  );
}

/** Un canvas que falló en silencio queda totalmente transparente. */
function looksBlank(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return true;
  for (let i = 1; i <= 5; i++) {
    for (let j = 1; j <= 5; j++) {
      const x = Math.floor((canvas.width * i) / 6);
      const y = Math.floor((canvas.height * j) / 6);
      if (ctx.getImageData(x, y, 1, 1).data[3] !== 0) return false;
    }
  }
  return true;
}

async function prepare(source: Drawable, maxSide: number): Promise<PreparedPhoto> {
  const canvas = downscaleToCanvas(source, maxSide);
  try {
    if (looksBlank(canvas)) throw new Error('Canvas vacío.');
    // Las fotos con transparencia (PNG) quedan sobre blanco en vez de negro.
    const ctx = canvas.getContext('2d')!;
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas, 0.95);
    const thumb = await canvasToBlob(downscaleToCanvas(canvas, 240), 0.8);
    return { blob, thumb, width: canvas.width, height: canvas.height };
  } finally {
    canvas.width = canvas.height = 0; // libera la memoria ya
  }
}

async function convertHeic(file: Blob): Promise<Blob> {
  const { default: heic2any } = await import('heic2any');
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
  return Array.isArray(out) ? out[0] : out;
}

async function openVideo(file: File, maxSide: number) {
  if (!videoRecordingSupported()) throw new PhotoOpenError(MSG_VIDEO_UNSUPPORTED);
  const info = await openVideoElement(file);
  try {
    if (info.duration > MAX_VIDEO_SECONDS) throw new PhotoOpenError(MSG_VIDEO_LONG);
    const poster = await prepare(info.video, maxSide);
    return { ...poster, duration: info.duration };
  } finally {
    info.dispose();
  }
}

export const browserOpenDeps: OpenDeps = {
  loaders: [viaObjectUrl, viaDataUrl, viaBitmap, viaBitmapResized],
  convertHeic,
  prepare,
  openVideo,
};

/** Prueba cada método de lectura; si uno abre pero no se puede reducir, pasa al siguiente. */
async function tryLoaders(file: Blob, deps: OpenDeps, maxSide: number): Promise<PreparedPhoto | null> {
  for (const load of deps.loaders) {
    let source: Drawable | null = null;
    try {
      source = await load(file);
      return await deps.prepare(source, maxSide);
    } catch {
      // probar el siguiente método
    } finally {
      if (source) release(source);
    }
  }
  return null;
}

export const MSG_HEIC =
  'Es un archivo HEIC que no se pudo convertir. Ábrelo en tu galería y expórtalo o compártelo como JPG, o súbelo como JPG desde Google Fotos.';
export const MSG_BROKEN =
  'La foto está dañada o no se descargó por completo de Google Fotos. Descárgala primero al dispositivo y vuelve a subirla.';
export const MSG_VIDEO =
  'No se pudo abrir este video. Puede estar dañado, ser muy pesado para este dispositivo o tener un formato que el navegador no reconoce. Prueba con un MP4.';
export const MSG_VIDEO_LONG = `El video dura más de ${MAX_VIDEO_SECONDS / 60} minutos. Recórtalo y vuelve a subirlo.`;
export const MSG_VIDEO_UNSUPPORTED =
  'Este navegador no puede preparar videos. Usa Chrome (Android) o Safari actualizado (iPhone).';
export const MSG_FORMAT =
  'Este archivo no parece una foto compatible. Usa JPG, PNG, WebP, GIF, BMP, AVIF o HEIC.';


export class PhotoOpenError extends Error {}

export async function openFile(
  file: File,
  deps: OpenDeps = browserOpenDeps,
  maxSide: number = MAX_SIDE,
): Promise<OpenedPhoto> {
  if (!isAcceptedFile(file)) throw new PhotoOpenError(MSG_FORMAT);

  if (isVideoFile(file)) {
    try {
      const v = await deps.openVideo(file, maxSide);
      return { name: file.name, kind: 'video', file, ...v };
    } catch (e) {
      throw e instanceof PhotoOpenError ? e : new PhotoOpenError(MSG_VIDEO);
    }
  }

  let prepared = await tryLoaders(file, deps, maxSide);

  if (!prepared) {
    try {
      const jpeg = await deps.convertHeic(file);
      prepared = await tryLoaders(jpeg, deps, maxSide);
    } catch {
      // sin conversión posible: se informa abajo
    }
  }

  if (!prepared) throw new PhotoOpenError(isHeic(file) ? MSG_HEIC : MSG_BROKEN);
  return { name: file.name, kind: 'image', ...prepared };
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

