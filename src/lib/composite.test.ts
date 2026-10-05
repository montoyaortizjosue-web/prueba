import { describe, expect, it } from 'vitest';
import { composite, type CompositeEnv } from './composite';
import { FORMATS, logoLayout, photoRect } from './layout';
import type { Drawable } from './types';

type Call = { fn: string; args: unknown[]; state: Record<string, unknown> };

/** Contexto 2D falso: registra cada llamada junto con el estilo vigente. */
function makeEnv() {
  const calls: Call[] = [];
  const canvases: Array<{ width: number; height: number }> = [];
  let ctxState: Record<string, unknown> = {};
  const ctx = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === 'measureText') {
          return (s: string) => {
            const size = Number(/(\d+(?:\.\d+)?)px/.exec(String(ctxState.font))?.[1] ?? 10);
            return { width: s.length * size * 0.5, actualBoundingBoxAscent: size * 0.7 };
          };
        }
        if (prop in ctxState) return ctxState[prop];
        return (...args: unknown[]) => {
          calls.push({ fn: prop, args, state: { ...ctxState } });
        };
      },
      set(_t, prop: string, v) {
        ctxState[prop] = v;
        return true;
      },
    },
  );
  const env: CompositeEnv = {
    createCanvas: (w, h) => {
      const c = { width: w, height: h, getContext: () => ctx };
      canvases.push(c);
      return c as unknown as HTMLCanvasElement;
    },
    createPath: (d) => ({ d }) as unknown as Path2D,
    ensureFonts: async () => {
      calls.push({ fn: 'ensureFonts', args: [], state: {} });
    },
    toBlob: async (_c, q) => new Blob([`jpeg@${q}`], { type: 'image/jpeg' }),
  };
  return { env, calls, canvases };
}

const photo = (w: number, h: number) => ({ width: w, height: h }) as unknown as Drawable;

describe('composite', () => {
  it('espera las fuentes antes de dibujar', async () => {
    const { env, calls } = makeEnv();
    await composite(photo(1000, 1000), {}, env);
    const fonts = calls.findIndex((c) => c.fn === 'ensureFonts');
    const firstDraw = calls.findIndex((c) => c.fn === 'fillRect');
    expect(fonts).toBeGreaterThanOrEqual(0);
    expect(fonts).toBeLessThan(firstDraw);
  });

  it('devuelve un JPEG de calidad 0.92 con el tamaño del formato', async () => {
    const { env, canvases } = makeEnv();
    const blob = await composite(photo(1080, 1920), { format: 'auto' }, env);
    expect(blob.type).toBe('image/jpeg');
    expect(await blob.text()).toBe('jpeg@0.92');
    expect(canvases[0]).toMatchObject({ width: 1080, height: 1920 });
  });

  it.each([
    ['plum', '#42113C', '#FF5FA2'],
    ['pink', '#FF5FA2', '#42113C'],
  ] as const)('color %s: fondo %s y elementos %s', async (color, bg, fg) => {
    const { env, calls } = makeEnv();
    await composite(photo(1000, 1000), { color }, env);
    expect(calls.find((c) => c.fn === 'fillRect')!.state.fillStyle).toBe(bg);
    const text = calls.filter((c) => c.fn === 'fillText');
    expect(text.length).toBeGreaterThan(1);
    for (const t of text) expect(t.state.fillStyle).toBe(fg);
  });

  it('dibuja el lazo con patas en fg y lazos/nudo con trazo de fondo', async () => {
    const { env, calls } = makeEnv();
    await composite(photo(1000, 1000), { color: 'plum' }, env);
    const strokes = calls.filter((c) => c.fn === 'stroke');
    expect(strokes.map((s) => [s.state.strokeStyle, s.state.lineWidth])).toEqual([
      ['#FF5FA2', 2],
      ['#FF5FA2', 2],
      ['#42113C', 2.5],
      ['#42113C', 2.5],
      ['#42113C', 2.5],
    ]);
    expect(strokes.every((s) => s.state.lineJoin === 'round')).toBe(true);
  });

  it('el logo queda centrado horizontalmente', async () => {
    const { env, calls } = makeEnv();
    await composite(photo(1000, 1000), { format: '4x5' }, env);
    const spec = FORMATS['4x5'];
    const translate = calls.find((c) => c.fn === 'translate')!;
    const logoText = calls.find((c) => c.fn === 'fillText' && c.args[0] === 'shanty')!;
    const l = logoLayout(spec, (em) => 'shanty'.length * em * 0.5);
    expect(translate.args[0]).toBeCloseTo(l.x0);
    expect(translate.args[1]).toBeCloseTo(l.base - l.em);
    expect(logoText.args[1]).toBeCloseTo(l.textX);
    expect(logoText.args[2]).toBeCloseTo(l.base);
    expect(logoText.state.font).toBe(`600 ${l.em}px Fredoka`);
  });

  it('dibuja la foto completa dentro del área, con esquinas redondeadas', async () => {
    const { env, calls } = makeEnv();
    await composite(photo(2000, 1000), { format: '1x1' }, env);
    const r = photoRect(FORMATS['1x1'], 2000, 1000);
    const draw = calls.filter((c) => c.fn === 'drawImage').at(-1)!;
    expect(draw.args.slice(5)).toEqual([r.x, r.y, r.w, r.h]);
    // sin recortar: el origen es la imagen entera (ya reducida a la mitad: 1000x500)
    expect(draw.args.slice(1, 5)).toEqual([0, 0, 1000, 500]);
    expect(calls.some((c) => c.fn === 'clip')).toBe(true);
    expect(calls.filter((c) => c.fn === 'arcTo').every((c) => c.args[4] === 36)).toBe(true);
  });

  it('texto inferior: MAYÚSCULAS, Nunito 800 34 px, letra por letra', async () => {
    const { env, calls } = makeEnv();
    await composite(photo(1000, 1000), { text: 'hola mundo' }, env);
    const letters = calls.filter((c) => c.fn === 'fillText' && c.state.font === '800 34px Nunito');
    expect(letters.map((l) => l.args[0]).join('')).toBe('HOLA MUNDO');
    const xs = letters.map((l) => l.args[1] as number);
    expect(xs[1] - xs[0]).toBeCloseTo(17 + 8.5); // ancho de letra + 0.25*34
  });

  it('usa el texto por defecto y omite el texto si está vacío', async () => {
    const a = makeEnv();
    await composite(photo(1000, 1000), {}, a.env);
    const def = a.calls.filter((c) => c.fn === 'fillText' && c.state.font === '800 34px Nunito');
    expect(def.map((l) => l.args[0]).join('')).toBe('ROPA IMPORTADA · 100% ONLINE');

    const b = makeEnv();
    await composite(photo(1000, 1000), { text: '' }, b.env);
    expect(b.calls.filter((c) => c.fn === 'fillText').map((c) => c.args[0])).toEqual(['shanty']);
  });

  it('reduce de mitad en mitad las fotos grandes', async () => {
    const { env, canvases } = makeEnv();
    await composite(photo(2000, 2000), { format: '1x1' }, env);
    // el primer canvas es el lienzo final; los siguientes son pasos intermedios
    expect(canvases.slice(1).map((c) => c.width)).toEqual([1000]);
  });
});
