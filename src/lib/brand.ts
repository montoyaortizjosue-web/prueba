export const PLUM = '#42113C';
export const PINK = '#FF5FA2';
export const CREAM = '#FFF6F9';

export const DEFAULT_TEXT = 'ROPA IMPORTADA · 100% ONLINE';

export const LOGO_FONT_FAMILY = 'Fredoka';
export const LOGO_FONT_WEIGHT = 600;
export const LOGO_TEXT = 'shanty';
export const FOOTER_FONT_FAMILY = 'Nunito';
export const FOOTER_FONT_WEIGHT = 800;

/** El lazo vive en un viewBox de 88x100. */
export const BOW_VIEWBOX = { width: 88, height: 100 } as const;

export const BOW_PATHS = {
  pata1: 'M37.13 26 L50.87 26 L25.87 99 L22.08 90 L12.13 99 Z',
  pata2: 'M50.87 26 L37.13 26 L62.13 99 L65.92 90 L75.87 99 Z',
  lazo1: 'M41 26 C34 14 12 -1 7 10 C3 19 3 32 6 40 C10 48 33 34 41 26 Z',
  lazo2: 'M47 26 C54 14 76 -1 81 10 C85 19 85 32 82 40 C78 48 55 34 47 26 Z',
  nudo: 'M43 17.5 H45 A5 5 0 0 1 50 22.5 V29.5 A5 5 0 0 1 45 34.5 H43 A5 5 0 0 1 38 29.5 V22.5 A5 5 0 0 1 43 17.5 Z',
} as const;

export type FrameColor = 'plum' | 'pink';

export interface Palette {
  bg: string;
  fg: string;
}

export const PALETTES: Record<FrameColor, Palette> = {
  plum: { bg: PLUM, fg: PINK },
  pink: { bg: PINK, fg: PLUM },
};
