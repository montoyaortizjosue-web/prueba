import { describe, expect, it } from 'vitest';
import { formatDuration, pickRecorderMime } from './video';

describe('pickRecorderMime', () => {
  it('prefiere MP4 si el navegador lo permite', () => {
    expect(pickRecorderMime(() => true)).toMatchObject({ ext: 'mp4' });
    expect(pickRecorderMime((t) => t.startsWith('video/mp4'))).toMatchObject({ ext: 'mp4' });
  });
  it('si no, WebM', () => {
    expect(pickRecorderMime((t) => t.startsWith('video/webm'))).toMatchObject({ ext: 'webm', mime: 'video/webm;codecs=vp9,opus' });
    expect(pickRecorderMime((t) => t === 'video/webm')).toMatchObject({ ext: 'webm', mime: 'video/webm' });
  });
  it('si no hay nada, null', () => {
    expect(pickRecorderMime(() => false)).toBeNull();
  });
});

describe('formatDuration', () => {
  it('m:ss', () => {
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(125.4)).toBe('2:05');
  });
});
