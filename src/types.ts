import type { FormatOption, FrameColor } from './lib';

export interface Photo {
  id: string;
  name: string;
  /** JPEG orientado y reducido (pesa poco; se decodifica solo al procesar). */
  blob: Blob;
  thumbUrl: string;
  kind: 'image' | 'video';
  /** Solo videos: archivo original y duración (s). `blob` es el cuadro de portada. */
  file?: File;
  duration?: number;
}

export interface StyleOptions {
  format: FormatOption;
  color: FrameColor;
  /** Texto inferior ya con debounce; vacío = sin texto. */
  text: string;
}
