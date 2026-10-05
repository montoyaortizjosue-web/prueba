export const MAX_PHOTOS = 30;
export const MAX_SIDE = 2000;

const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif', 'heic', 'heif'];

export function extensionOf(name: string): string {
  const m = /\.([^./\\]+)$/.exec(name);
  return m ? m[1].toLowerCase() : '';
}

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'm4v', 'webm', '3gp', 'mkv'];

export function isVideoFile(file: { name: string; type: string }): boolean {
  if (file.type && file.type.startsWith('video/')) return true;
  return VIDEO_EXTENSIONS.includes(extensionOf(file.name));
}

/** Acepta por tipo MIME o, si el navegador no lo informa, por extensión. */
export function isAcceptedFile(file: { name: string; type: string }): boolean {
  if (file.type && file.type.startsWith('image/')) return true;
  return EXTENSIONS.includes(extensionOf(file.name)) || isVideoFile(file);
}

export function isHeic(file: { name: string; type: string }): boolean {
  const ext = extensionOf(file.name);
  return /hei[cf]/i.test(file.type) || ext === 'heic' || ext === 'heif';
}
