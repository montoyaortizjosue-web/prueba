import type { Rendered } from '../useRendered';
import type { Photo } from '../types';
import { StepShell } from './StepShell';

interface Props {
  photos: Photo[];
  get: (id: string) => Rendered | undefined;
  busy: boolean;
  error: string | null;
  onRemove: (id: string) => void;
  headingRef: React.Ref<HTMLHeadingElement>;
}

export function StepReview({ photos, get, busy, error, onRemove, headingRef }: Props) {
  const ready = photos.filter((p) => get(p.id)).length;
  return (
    <StepShell
      ref={headingRef}
      title="Revisa tus fotos"
      help="Estas son tus fotos ya listas, con marco y logo."
      todo={[
        'Espera a que se preparen todas las fotos.',
        'Mira que todas se vean bien.',
        <>Si alguna no te gusta, toca <strong>Quitar</strong>.</>,
        <>Toca <strong>Siguiente</strong> para descargarlas.</>,
      ]}
    >
      {busy && (
        <p className="progress" role="status">
          Preparando foto {Math.min(ready + 1, photos.length)} de {photos.length}…
        </p>
      )}
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      {photos.length === 0 ? (
        <p className="muted">No quedan fotos. Vuelve atrás para subir más.</p>
      ) : (
        <ul className="grid">
          {photos.map((p) => {
            const r = get(p.id);
            return (
              <li key={p.id}>
                {r ? <img src={r.url} alt={`${p.name} con marco`} /> : <div className="skeleton">Preparando…</div>}
                <button type="button" className="btn small-btn" onClick={() => onRemove(p.id)}>
                  Quitar<span className="sr-only"> {p.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </StepShell>
  );
}
