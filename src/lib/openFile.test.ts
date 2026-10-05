import { describe, expect, it, vi } from 'vitest';
import { MSG_BROKEN, MSG_FORMAT, MSG_HEIC, MSG_VIDEO, openFile, openFiles, type OpenDeps } from './openFile';
import type { Drawable } from './types';

const fakeImage = { width: 4000, height: 3000 } as unknown as Drawable;
const prepared = (w: number, h: number) => ({ blob: new Blob(['j']), thumb: new Blob(['t']), width: w, height: h });

function deps(over: Partial<OpenDeps> = {}): OpenDeps {
  return {
    loaders: [async () => fakeImage],
    convertHeic: async () => new Blob(['jpeg']),
    prepare: async (_s, max) => prepared(max, (max * 3) / 4),
    openVideo: async () => ({ ...prepared(1080, 1920), duration: 12 }),
    ...over,
  };
}

const file = (name: string, type = 'image/jpeg') => new File(['x'], name, { type });
const fail = () => Promise.reject(new Error('no'));

describe('openFile', () => {
  it('reduce a 2000 px por el lado largo', async () => {
    const prepare = vi.fn(async (_s: Drawable, max: number) => prepared(max, 1500));
    const p = await openFile(file('a.jpg'), deps({ prepare }));
    expect(prepare).toHaveBeenCalledWith(fakeImage, 2000);
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

  it('si un método abre la foto pero no se puede reducir, prueba el siguiente', async () => {
    const calls: string[] = [];
    const a = { id: 'a' } as unknown as Drawable;
    const b = { id: 'b' } as unknown as Drawable;
    const d = deps({
      loaders: [async () => a, async () => b],
      prepare: async (src) => {
        calls.push((src as unknown as { id: string }).id);
        if (src === a) throw new Error('canvas demasiado grande');
        return prepared(10, 10);
      },
    });
    await expect(openFile(file('enorme.jpg'), d)).resolves.toMatchObject({ width: 10 });
    expect(calls).toEqual(['a', 'b']);
  });

  it('foto dañada -> mensaje de Google Fotos', async () => {
    const d = deps({ loaders: [fail], convertHeic: fail });
    await expect(openFile(file('a.jpg'), d)).rejects.toThrow(MSG_BROKEN);
    expect(MSG_BROKEN).toMatch(/Google Fotos/);
  });
});

describe('videos', () => {
  it('abre un video y guarda el archivo original y la duración', async () => {
    const f = file('clip.mp4', 'video/mp4');
    const v = await openFile(f, deps());
    expect(v).toMatchObject({ kind: 'video', file: f, duration: 12, width: 1080 });
  });
  it('acepta .mov sin MIME', async () => {
    await expect(openFile(file('IMG_1.MOV', ''), deps())).resolves.toMatchObject({ kind: 'video' });
  });
  it('video que no abre -> mensaje claro en español', async () => {
    const d = deps({ openVideo: () => Promise.reject(new Error('x')) });
    await expect(openFile(file('a.mp4', 'video/mp4'), d)).rejects.toThrow(MSG_VIDEO);
  });
  it('las fotos siguen siendo kind=image', async () => {
    await expect(openFile(file('a.jpg'), deps())).resolves.toMatchObject({ kind: 'image' });
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
