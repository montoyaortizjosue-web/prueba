import { describe, expect, it } from 'vitest';
import { cleanName, outputName, uniqueOutputNames } from './filename';
import { isAcceptedFile, isHeic, isVideoFile } from './files';

describe('nombres de salida', () => {
  it('quita extensión, tildes y caracteres raros', () => {
    expect(outputName('Vestido Azúl (1).JPG')).toBe('vestido-azul-1-ashanty.jpg');
    expect(outputName('Niño & Señora—ñandú.png')).toBe('nino-senora-nandu-ashanty.jpg');
  });
  it('máximo 40 caracteres en el nombre limpio', () => {
    const n = cleanName('a'.repeat(100) + '.jpg');
    expect(n).toHaveLength(40);
  });
  it('no termina en guion tras recortar', () => {
    expect(cleanName('a'.repeat(39) + ' bbb.jpg')).toBe('a'.repeat(39));
  });
  it('usa "foto" si queda vacío', () => {
    expect(outputName('日本語.heic')).toBe('foto-ashanty.jpg');
  });
  it('respeta la extensión de cada archivo (videos)', () => {
    expect(uniqueOutputNames(['a.mov', 'a.jpg'], ['mp4', 'jpg'])).toEqual(['a-ashanty.mp4', 'a-2-ashanty.jpg']);
    expect(outputName('Clip Final.MOV', 'webm')).toBe('clip-final-ashanty.webm');
  });
  it('evita repetidos', () => {
    expect(uniqueOutputNames(['a.jpg', 'a.png', 'b.jpg'])).toEqual([
      'a-ashanty.jpg',
      'a-2-ashanty.jpg',
      'b-ashanty.jpg',
    ]);
  });
});

describe('archivos aceptados', () => {
  it('por MIME', () => {
    expect(isAcceptedFile({ name: 'x', type: 'image/webp' })).toBe(true);
  });
  it('por extensión cuando el MIME viene vacío', () => {
    for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif', 'heic', 'heif', 'HEIC']) {
      expect(isAcceptedFile({ name: `foto.${ext}`, type: '' })).toBe(true);
    }
  });
  it('rechaza lo que no es foto', () => {
    expect(isAcceptedFile({ name: 'a.pdf', type: 'application/pdf' })).toBe(false);
    expect(isAcceptedFile({ name: 'a', type: '' })).toBe(false);
  });
  it('detecta HEIC', () => {
    expect(isHeic({ name: 'a.HEIC', type: '' })).toBe(true);
    expect(isHeic({ name: 'a', type: 'image/heif' })).toBe(true);
    expect(isHeic({ name: 'a.jpg', type: 'image/jpeg' })).toBe(false);
  });
});

describe('videos aceptados', () => {
  it('por MIME y por extensión', () => {
    expect(isVideoFile({ name: 'x', type: 'video/quicktime' })).toBe(true);
    for (const e of ['mp4', 'MOV', 'webm', 'm4v', '3gp']) expect(isAcceptedFile({ name: `v.${e}`, type: '' })).toBe(true);
    expect(isVideoFile({ name: 'a.jpg', type: 'image/jpeg' })).toBe(false);
  });
});
