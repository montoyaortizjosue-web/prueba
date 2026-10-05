export const MAX_NAME_LENGTH = 40;

/** Nombre sin extensión, sin tildes ni caracteres raros, máximo 40 caracteres. */
export function cleanName(fileName: string): string {
  const base = fileName.replace(/\.[^./\\]+$/, '');
  const clean = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_NAME_LENGTH)
    .replace(/-+$/g, '');
  return clean || 'foto';
}

export function outputName(fileName: string, ext = 'jpg'): string {
  return `${cleanName(fileName)}-ashanty.${ext}`;
}

/** Evita nombres repetidos dentro del zip: foto-ashanty.jpg, foto-2-ashanty.jpg… */
export function uniqueOutputNames(fileNames: string[], exts: string[] = []): string[] {
  const seen = new Map<string, number>();
  return fileNames.map((original, i) => {
    const base = cleanName(original);
    const ext = exts[i] ?? 'jpg';
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? `${base}-ashanty.${ext}` : `${base}-${n}-ashanty.${ext}`;
  });
}
