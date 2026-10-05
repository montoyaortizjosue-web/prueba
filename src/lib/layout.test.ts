import { describe, expect, it } from 'vitest';
import {
  FORMATS,
  footerBaseline,
  halvingSteps,
  logoLayout,
  photoRect,
  resolveFormat,
  spacedLetterXs,
} from './layout';

describe('resolveFormat', () => {
  it('respeta un formato explícito', () => {
    expect(resolveFormat('1x1', 100, 400)).toBe('1x1');
  });
  it('auto: vertical alta -> 9x16', () => {
    expect(resolveFormat('auto', 1080, 1920)).toBe('9x16');
    expect(resolveFormat('auto', 100, 140)).toBe('9x16'); // límite 1.4
  });
  it('auto: retrato moderado y cuadrada -> 4x5', () => {
    expect(resolveFormat('auto', 1000, 1250)).toBe('4x5');
    expect(resolveFormat('auto', 1000, 900)).toBe('4x5'); // límite 0.9
    expect(resolveFormat('auto', 1000, 1000)).toBe('4x5');
  });
  it('auto: horizontal -> 1x1', () => {
    expect(resolveFormat('auto', 1600, 900)).toBe('1x1');
  });
});

describe('formatos', () => {
  it('tienen las medidas pedidas', () => {
    expect(FORMATS['9x16']).toEqual({ width: 1080, height: 1920, top: 130, bottom: 120, margin: 50 });
    expect(FORMATS['4x5']).toEqual({ width: 1080, height: 1350, top: 190, bottom: 160, margin: 40 });
    expect(FORMATS['1x1']).toEqual({ width: 1080, height: 1080, top: 170, bottom: 150, margin: 40 });
  });
});

describe('photoRect (contain, sin recortar)', () => {
  it.each([
    ['9x16', 1080, 1920],
    ['4x5', 1000, 1250],
    ['1x1', 1600, 900],
    ['1x1', 500, 2000],
  ] as const)('%s con foto %ix%i queda dentro del área y centrada', (id, pw, ph) => {
    const spec = FORMATS[id];
    const r = photoRect(spec, pw, ph);
    expect(r.x).toBeGreaterThanOrEqual(spec.margin - 1e-6);
    expect(r.x + r.w).toBeLessThanOrEqual(spec.width - spec.margin + 1e-6);
    expect(r.y).toBeGreaterThanOrEqual(spec.top - 1e-6);
    expect(r.y + r.h).toBeLessThanOrEqual(spec.height - spec.bottom + 1e-6);
    expect(r.w / r.h).toBeCloseTo(pw / ph, 6);
    expect(r.x + r.w / 2).toBeCloseTo(spec.width / 2, 6);
    expect(r.y + r.h / 2).toBeCloseTo(spec.top + (spec.height - spec.top - spec.bottom) / 2, 6);
  });
  it('toca el borde del área en el lado limitante', () => {
    const spec = FORMATS['4x5'];
    const wide = photoRect(spec, 2000, 1000);
    expect(wide.w).toBeCloseTo(spec.width - 2 * spec.margin, 6);
  });
});

describe('logoLayout', () => {
  it('em = min(top*0.52, 84)', () => {
    expect(logoLayout(FORMATS['9x16'], () => 0).em).toBeCloseTo(67.6);
    expect(logoLayout(FORMATS['4x5'], () => 0).em).toBe(84);
    expect(logoLayout(FORMATS['1x1'], () => 0).em).toBe(84);
  });
  it('queda centrado: x0 + total/2 = ancho/2', () => {
    const spec = FORMATS['9x16'];
    const l = logoLayout(spec, (em) => 3.1 * em);
    expect(l.total).toBeCloseTo(0.81 * l.em + 3.1 * l.em);
    expect(l.x0 + l.total / 2).toBeCloseTo(spec.width / 2);
    expect(l.textX).toBeCloseTo(l.x0 + 0.81 * l.em);
  });
  it('base = top/2 + 6 - (blockTop+blockBottom)/2', () => {
    const spec = FORMATS['9x16'];
    const l = logoLayout(spec, () => 0);
    const expected = spec.top / 2 + 6 - (-0.98 * l.em + 0.27 * l.em) / 2;
    expect(l.base).toBeCloseTo(expected);
  });
  it('el logo cabe en la franja superior', () => {
    for (const spec of Object.values(FORMATS)) {
      const l = logoLayout(spec, () => 0);
      expect(l.base - l.em).toBeGreaterThanOrEqual(0);
      expect(l.base + 0.27 * l.em).toBeLessThanOrEqual(spec.top);
    }
  });
});

describe('texto inferior', () => {
  it('centra las letras con separación 0.25', () => {
    const xs = spacedLetterXs([10, 10, 10], 8.5, 1080);
    const total = 30 + 17;
    expect(xs[0]).toBeCloseTo((1080 - total) / 2);
    expect(xs[1] - xs[0]).toBeCloseTo(18.5);
    expect(xs[2] + 10 - xs[0]).toBeCloseTo(total);
  });
  it('línea base centra el texto en el espacio bajo la foto', () => {
    const photo = { x: 0, y: 200, w: 100, h: 1500 };
    const b = footerBaseline(photo, 1920, 24);
    expect(b - 12).toBeCloseTo((1700 + 1920) / 2);
  });
});

describe('halvingSteps', () => {
  it('reduce de mitad en mitad sin pasarse del destino', () => {
    expect(halvingSteps(2000, 1000, 500, 250)).toEqual([
      { w: 1000, h: 500 },
      { w: 500, h: 250 },
    ]);
  });
  it('sin pasos si la reducción es menor a 2x', () => {
    expect(halvingSteps(1000, 1000, 600, 600)).toEqual([]);
  });
  it('fotos enormes: primer salto directo bajo el límite de área, luego mitades', () => {
    const steps = halvingSteps(12000, 9000, 1080, 810);
    expect(steps[0].w * steps[0].h).toBeLessThanOrEqual(12_000_000);
    expect(steps.every((s) => s.w * s.h <= 12_000_000)).toBe(true);
    const last = steps.at(-1)!;
    expect(last.w).toBeGreaterThanOrEqual(1080);
    expect(last.h).toBeGreaterThanOrEqual(810);
  });
  it('sin pasos al ampliar', () => {
    expect(halvingSteps(100, 100, 400, 400)).toEqual([]);
  });
});
