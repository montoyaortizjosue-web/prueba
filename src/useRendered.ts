import { useCallback, useEffect, useRef, useState } from 'react';
import { composite, decodeBlob, release } from './lib';
import type { Photo, StyleOptions } from './types';

export interface Rendered {
  blob: Blob;
  url: string;
}

/**
 * Procesa las fotos con el estilo elegido y guarda los resultados en caché
 * (por foto + estilo). Libera con revokeObjectURL todo lo que ya no se usa.
 * Solo procesa las primeras `limit` fotos (1 para la vista previa).
 */
export function useRendered(photos: Photo[], options: StyleOptions, limit: number) {
  const cache = useRef(new Map<string, Rendered>());
  const [, bump] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const optsKey = `${options.format}|${options.color}|${options.text}`;

  useEffect(() => {
    const ids = new Set(photos.map((p) => p.id));
    for (const [key, r] of cache.current) {
      const sep = key.indexOf('|');
      if (!ids.has(key.slice(0, sep)) || key.slice(sep + 1) !== optsKey) {
        URL.revokeObjectURL(r.url);
        cache.current.delete(key);
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
          cache.current.set(`${p.id}|${optsKey}`, { blob, url: URL.createObjectURL(blob) });
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
      for (const r of cache.current.values()) URL.revokeObjectURL(r.url);
      cache.current.clear();
    },
    [],
  );

  const get = useCallback(
    (id: string) => cache.current.get(`${id}|${optsKey}`),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [optsKey, photos],
  );
  return { get, busy, error };
}
