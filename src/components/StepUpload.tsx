import { useRef, useState, type DragEvent } from 'react';
import { MAX_PHOTOS, type PhotoFailure } from '../lib';
import type { Photo } from '../types';
import { StepShell } from './StepShell';

interface Props {
  photos: Photo[];
  errors: PhotoFailure[];
  progress: { current: number; total: number } | null;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  onDismissError: (index: number) => void;
  headingRef: React.Ref<HTMLHeadingElement>;
}

export function StepUpload({ photos, errors, progress, onAdd, onRemove, onDismissError, headingRef }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const busy = progress !== null;

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (!busy) onAdd(Array.from(e.dataTransfer.files));
  };

  return (
    <StepShell
      ref={headingRef}
      title="Sube tus fotos"
      help="Elige las fotos de ropa que quieres enmarcar con el logo de Ashanty."
      todo={[
        <>Toca el botón <strong>Elegir fotos</strong>.</>,
        'Marca varias fotos de tu galería.',
        'Espera a que aparezcan las miniaturas.',
        <>Toca <strong>Siguiente</strong>.</>,
      ]}
    >
      <div
        className={`drop${over ? ' over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <p>Arrastra tus fotos aquí o</p>
        <button type="button" className="btn primary" disabled={busy} onClick={() => input.current?.click()}>
          Elegir fotos
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept="image/*"
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (files.length) onAdd(files);
          }}
        />
        <p className="small">Hasta {MAX_PHOTOS} fotos por tanda.</p>
      </div>

      {progress && (
        <p className="progress" role="status">
          Abriendo foto {progress.current} de {progress.total}…
        </p>
      )}

      {errors.length > 0 && (
        <ul className="errors" aria-label="Fotos con problemas">
          {errors.map((er, i) => (
            <li key={`${er.name}-${i}`}>
              <div>
                <strong>{er.name}</strong>
                <span>{er.message}</span>
              </div>
              <button type="button" className="btn small-btn" onClick={() => onDismissError(i)}>
                Entendido
              </button>
            </li>
          ))}
        </ul>
      )}

      {photos.length > 0 && (
        <>
          <h3 className="count">
            {photos.length} {photos.length === 1 ? 'foto lista' : 'fotos listas'}
          </h3>
          <ul className="thumbs">
            {photos.map((p) => (
              <li key={p.id}>
                <img src={p.thumbUrl} alt={`Miniatura de ${p.name}`} />
                <button type="button" className="btn small-btn" onClick={() => onRemove(p.id)}>
                  Quitar<span className="sr-only"> {p.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="tips">
        <h3>Consejos</h3>
        <ul>
          <li>Se aceptan JPG, PNG, WebP, GIF, BMP, AVIF y HEIC.</li>
          <li>Las fotos HEIC (iPhone) se convierten solas.</li>
          <li>Si tus fotos están en Google Fotos, descárgalas primero al dispositivo.</li>
          <li>Tus fotos no salen de tu dispositivo: todo se hace aquí, sin subirlas a internet.</li>
        </ul>
      </div>
    </StepShell>
  );
}
