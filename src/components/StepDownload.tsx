import { useState } from 'react';
import { canShareFiles, saveBlob, toFiles, zipPhotos } from '../download';
import { uniqueOutputNames } from '../lib';
import type { Rendered } from '../useRendered';
import type { Photo } from '../types';
import { StepShell } from './StepShell';

interface Props {
  photos: Photo[];
  get: (id: string) => Rendered | undefined;
  onRestart: () => void;
  onStatus: (s: string) => void;
  headingRef: React.Ref<HTMLHeadingElement>;
}

const shareSupported = canShareFiles();

export function StepDownload({ photos, get, onRestart, onStatus, headingRef }: Props) {
  const [working, setWorking] = useState(false);
  const items = photos.flatMap((p) => {
    const r = get(p.id);
    return r ? [{ photo: p, name: p.name, blob: r.blob, url: r.url }] : [];
  });
  const names = uniqueOutputNames(items.map((i) => i.name));

  const downloadZip = async () => {
    setWorking(true);
    onStatus('Creando el archivo zip…');
    try {
      saveBlob(await zipPhotos(items), 'ashanty-fotos.zip');
      onStatus('Listo: se descargó ashanty-fotos.zip');
    } catch {
      onStatus('No se pudo crear el zip. Descarga las fotos una por una.');
    } finally {
      setWorking(false);
    }
  };

  const share = async (list: typeof items) => {
    try {
      await navigator.share({ files: toFiles(list), title: 'Fotos Ashanty Store' });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') onStatus('No se pudo abrir el menú de compartir. Usa Descargar.');
    }
  };

  return (
    <StepShell
      ref={headingRef}
      title="Descarga tus fotos"
      help="¡Listo! Tus fotos ya tienen el marco y el logo de Ashanty."
      todo={[
        'Toca el botón de descargar y acepta la confirmación del navegador.',
        'Busca las fotos en la carpeta Descargas o en tu galería.',
        'Súbelas a TikTok, Instagram o WhatsApp.',
      ]}
    >
      <div className="actions">
        <button type="button" className="btn primary big" disabled={working || items.length === 0} onClick={downloadZip}>
          Descargar todas (.zip)
        </button>
        {shareSupported && (
          <button type="button" className="btn big" disabled={items.length === 0} onClick={() => share(items)}>
            Guardar en galería / Compartir
          </button>
        )}
      </div>

      <ul className="grid">
        {items.map((it, i) => (
          <li key={it.photo.id}>
            <img src={it.url} alt={`${it.name} con marco`} />
            <div className="row">
              <button type="button" className="btn small-btn" onClick={() => saveBlob(it.blob, names[i])}>
                Descargar<span className="sr-only"> {names[i]}</span>
              </button>
              {shareSupported && (
                <button type="button" className="btn small-btn" onClick={() => share([it])}>
                  Compartir<span className="sr-only"> {names[i]}</span>
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <button type="button" className="btn restart" onClick={onRestart}>
        Empezar de nuevo
      </button>
    </StepShell>
  );
}
