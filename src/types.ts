import type { FormatOption, FrameColor } from './lib';

export interface Photo {
  id: string;
  name: string;
  /** JPEG orientado y reducido (pesa poco; se decodifica solo al procesar). */
  blob: Blob;
  thumbUrl: string;
}

export interface StyleOptions {
  format: FormatOption;
  color: FrameColor;
  /** Texto inferior ya con debounce; vacío = sin texto. */
  text: string;
}
