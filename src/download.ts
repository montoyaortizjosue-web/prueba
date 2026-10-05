import { uniqueOutputNames } from './lib';

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // En celulares la descarga puede tardar en arrancar: no revocar de inmediato.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function zipPhotos(items: Array<{ name: string; blob: Blob; ext?: string }>): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const names = uniqueOutputNames(items.map((i) => i.name), items.map((i) => i.ext ?? 'jpg'));
  items.forEach((item, i) => zip.file(names[i], item.blob));
  return zip.generateAsync({ type: 'blob', compression: 'STORE' });
}

export function toFiles(items: Array<{ name: string; blob: Blob; ext?: string }>): File[] {
  const names = uniqueOutputNames(items.map((i) => i.name), items.map((i) => i.ext ?? 'jpg'));
  return items.map((item, i) => new File([item.blob], names[i], { type: item.blob.type || 'image/jpeg' }));
}

export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  if (typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File([''], 'a.jpg', { type: 'image/jpeg' })] });
  } catch {
    return false;
  }
}
