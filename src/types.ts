import type { FormatOption, FrameColor } from './lib';

export interface Photo {
  id: string;
  name: string;
  canvas: HTMLCanvasElement;
  thumbUrl: string;
}

export interface StyleOptions {
  format: FormatOption;
  color: FrameColor;
  /** Texto inferior ya con debounce; vacío = sin texto. */
  text: string;
}
