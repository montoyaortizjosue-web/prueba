import { describe, expect, it, vi } from 'vitest';
import { MSG_BROKEN, MSG_FORMAT, MSG_HEIC, openFile, openFiles, type OpenDeps } from './openFile';
import type { Drawable } from './types';

const fakeImage = { width: 4000, height: 3000 } as unknown as Drawable;
const fakeCanvas = (w: number, h: number) => ({ width: w, height: h }) as unknown as HTMLCanvasElement;

function deps(over: Partial<OpenDeps> = {}): OpenDeps {
  return {
    loaders: [async () => fakeImage],
    convertHeic: async () => new Blob(['jpeg']),
    toCanvas: (_s, max) => fakeCanvas(max, (max * 3) / 4),
    ...over,
  };
}

const file = (name: string, type = 'image/jpeg') => new File(['x'], name, { type });
const fail = () => Promise.reject(new Error('no'));

describe('openFile', () => {
  it('reduce a 2000 px por el lado largo', async () => {
    const toCanvas = vi.fn((_s: Drawable, max: number) => fakeCanvas(max, 1500));
    const p = await openFile(file('a.jpg'), deps({ toCanvas }));
    expect(toCanvas).toHaveBeenCalledWith(fakeImage, 2000);
    expect(p).toMatchObject({ name: 'a.jpg', width: 2000, height: 1500 });
  });

  it('prueba los métodos en orden y se queda con el primero que funciona', async () => {
    const calls: string[] = [];
    const d = deps({
      loaders: [
        async () => (calls.push('url'), fail()),
        async () => (calls.push('dataurl'), fail()),
        async () => (calls.push('bitmap'), fakeImage),
      ],
    });
    await openFile(file('a.jpg'), d);
    expect(calls).toEqual(['url', 'dataurl', 'bitmap']);
  });

  it('no sigue probando tras el primer éxito', async () => {
    const second = vi.fn(async () => fakeImage);
    await openFile(file('a.jpg'), deps({ loaders: [async () => fakeImage, second] }));
    expect(second).not.toHaveBeenCalled();
  });

  it('acepta archivos sin MIME si la extensión es de foto', async () => {
    await expect(openFile(file('IMG_1.HEIC', ''), deps())).resolves.toBeTruthy();
  });

  it('rechaza archivos que no son foto', async () => {
    await expect(openFile(file('a.pdf', 'application/pdf'), deps())).rejects.toThrow(MSG_FORMAT);
  });

  it('si todo falla, convierte con heic2any y reintenta', async () => {
    let n = 0;
    const loader = async () => (++n <= 1 ? fail() : fakeImage);
    const convertHeic = vi.fn(async () => new Blob(['jpeg']));
    const p = await openFile(file('a.heic', ''), deps({ loaders: [loader], convertHeic }));
    expect(convertHeic).toHaveBeenCalledOnce();
    expect(p.name).toBe('a.heic');
  });

  it('HEIC no convertible -> mensaje de HEIC', async () => {
    const d = deps({ loaders: [fail], convertHeic: fail });
    await expect(openFile(file('a.heic', ''), d)).rejects.toThrow(MSG_HEIC);
  });

  it('foto dañada -> mensaje de Google Fotos', async () => {
    const d = deps({ loaders: [fail], convertHeic: fail });
    await expect(openFile(file('a.jpg'), d)).rejects.toThrow(MSG_BROKEN);
    expect(MSG_BROKEN).toMatch(/Google Fotos/);
  });
});

describe('openFiles', () => {
  it('una foto mala no detiene las demás y se informa su nombre', async () => {
    const bad = file('mala.jpg');
    const d = deps({
      loaders: [async (b) => (b === bad ? fail() : fakeImage)],
      convertHeic: fail,
    });
    const progress: string[] = [];
    const r = await openFiles([file('a.jpg'), bad, file('c.jpg')], {
      deps: d,
      onProgress: (i, t) => progress.push(`${i}/${t}`),
    });
    expect(r.photos.map((p) => p.name)).toEqual(['a.jpg', 'c.jpg']);
    expect(r.errors).toEqual([{ name: 'mala.jpg', message: MSG_BROKEN }]);
    expect(progress).toEqual(['1/3', '2/3', '3/3']);
  });

  it('máximo 30 fotos por tanda', async () => {
    const files = Array.from({ length: 33 }, (_, i) => file(`f${i}.jpg`));
    const r = await openFiles(files, { deps: deps() });
    expect(r.photos).toHaveLength(30);
    expect(r.errors.map((e) => e.name)).toEqual(['f30.jpg', 'f31.jpg', 'f32.jpg']);
  });

  it('descuenta las fotos ya cargadas', async () => {
    const r = await openFiles([file('a.jpg'), file('b.jpg')], { deps: deps(), existing: 29 });
    expect(r.photos).toHaveLength(1);
    expect(r.errors).toHaveLength(1);
  });
});
