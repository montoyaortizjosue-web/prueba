export const MAX_PHOTOS = 30;
export const MAX_SIDE = 2000;

const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif', 'heic', 'heif'];

export function extensionOf(name: string): string {
  const m = /\.([^./\\]+)$/.exec(name);
  return m ? m[1].toLowerCase() : '';
}

/** Acepta por tipo MIME o, si el navegador no lo informa, por extensión. */
export function isAcceptedFile(file: { name: string; type: string }): boolean {
  if (file.type && file.type.startsWith('image/')) return true;
  return EXTENSIONS.includes(extensionOf(file.name));
}

export function isHeic(file: { name: string; type: string }): boolean {
  const ext = extensionOf(file.name);
  return /hei[cf]/i.test(file.type) || ext === 'heic' || ext === 'heif';
}
