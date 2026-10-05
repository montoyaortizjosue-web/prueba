import { useCallback, useEffect, useRef, useState } from 'react';
import { composite, decodeBlob, release, renderVideo } from './lib';
import type { Photo, StyleOptions } from './types';

export interface Rendered {
  blob: Blob;
  url: string;
  /** Extensión de salida: jpg para fotos; mp4 o webm para videos. */
  ext: string;
}

export interface VideoProgress {
  index: number;
  total: number;
  fraction: number;
  name: string;
}

/**
 * Procesa las fotos con el estilo elegido y guarda los resultados en caché
 * (por foto + estilo). Libera con revokeObjectURL todo lo que ya no se usa.
 * Solo procesa las primeras `limit` fotos (1 para la vista previa).
 */
export function useRendered(photos: Photo[], options: StyleOptions, limit: number) {
  const cache = useRef(new Map<string, Rendered>());
  const videoCache = useRef(new Map<string, Rendered>());
  const abort = useRef<AbortController | null>(null);
  const [, bump] = useState(0);
  const [videoProgress, setVideoProgress] = useState<VideoProgress | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const optsKey = `${options.format}|${options.color}|${options.text}`;

  useEffect(() => {
    const ids = new Set(photos.map((p) => p.id));
    for (const map of [cache.current, videoCache.current]) {
      for (const [key, r] of map) {
        const sep = key.indexOf('|');
        if (!ids.has(key.slice(0, sep)) || key.slice(sep + 1) !== optsKey) {
          URL.revokeObjectURL(r.url);
          map.delete(key);
        }
      }
    }
    bump((n) => n + 1);

    const todo = photos.slice(0, limit).filter((p) => !cache.current.has(`${p.id}|${optsKey}`));
    if (todo.length === 0) {
      setBusy(false);
      return;
    }

    let cancelled = false;
    setBusy(true);
    setError(null);
    (async () => {
      try {
        for (const p of todo) {
          const source = await decodeBlob(p.blob);
          let blob: Blob;
          try {
            blob = await composite(source, options);
          } finally {
            release(source);
          }
          if (cancelled) return;
          cache.current.set(`${p.id}|${optsKey}`, { blob, url: URL.createObjectURL(blob), ext: 'jpg' });
          bump((n) => n + 1);
        }
        setBusy(false);
      } catch {
        if (!cancelled) {
          setError('No se pudo preparar una de las fotos. Intenta quitarla y volver a subirla.');
          setBusy(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // `options` se resume en optsKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, optsKey, limit]);

  useEffect(
    () => () => {
      abort.current?.abort();
      for (const map of [cache.current, videoCache.current]) {
        for (const r of map.values()) URL.revokeObjectURL(r.url);
        map.clear();
      }
    },
    [],
  );

  /** Prepara los videos pendientes, uno por uno. Debe llamarse desde un toque. */
  const prepareVideos = useCallback(async () => {
    const todo = photos.filter((p) => p.kind === 'video' && p.file && !videoCache.current.has(`${p.id}|${optsKey}`));
    if (todo.length === 0 || abort.current) return;
    const ctl = new AbortController();
    abort.current = ctl;
    setVideoError(null);
    try {
      for (let i = 0; i < todo.length; i++) {
        const p = todo[i];
        const report = (fraction: number) => setVideoProgress({ index: i + 1, total: todo.length, fraction, name: p.name });
        report(0);
        const res = await renderVideo(p.file!, options, { signal: ctl.signal, onProgress: report });
        if (ctl.signal.aborted) return;
        videoCache.current.set(`${p.id}|${optsKey}`, { blob: res.blob, url: URL.createObjectURL(res.blob), ext: res.ext });
        bump((n) => n + 1);
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setVideoError(
          (e as Error).message === 'unsupported'
            ? 'Este navegador no puede preparar videos. Usa Chrome (Android) o Safari actualizado (iPhone).'
            : 'No se pudo preparar un video. Vuelve a intentarlo o quítalo e inténtalo con otro.',
        );
      }
    } finally {
      abort.current = null;
      setVideoProgress(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, optsKey]);

  const cancelVideos = useCallback(() => abort.current?.abort(), []);

  const get = useCallback(
    (id: string) => cache.current.get(`${id}|${optsKey}`),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [optsKey, photos],
  );
  const getVideo = useCallback(
    (id: string) => videoCache.current.get(`${id}|${optsKey}`),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [optsKey, photos],
  );
  return { get, busy, error, getVideo, prepareVideos, cancelVideos, videoProgress, videoError };
}
