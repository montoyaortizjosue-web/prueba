import { formatDuration } from '../lib';
import type { Rendered, VideoProgress } from '../useRendered';
import type { Photo } from '../types';
import { StepShell } from './StepShell';

interface Props {
  photos: Photo[];
  get: (id: string) => Rendered | undefined;
  getVideo: (id: string) => Rendered | undefined;
  busy: boolean;
  error: string | null;
  videoProgress: VideoProgress | null;
  videoError: string | null;
  onPrepareVideos: () => void;
  onCancelVideos: () => void;
  onRemove: (id: string) => void;
  headingRef: React.Ref<HTMLHeadingElement>;
}

export function StepReview({
  photos,
  get,
  getVideo,
  busy,
  error,
  videoProgress,
  videoError,
  onPrepareVideos,
  onCancelVideos,
  onRemove,
  headingRef,
}: Props) {
  const ready = photos.filter((p) => get(p.id)).length;
  const videos = photos.filter((p) => p.kind === 'video');
  const pending = videos.filter((p) => !getVideo(p.id));
  const pendingSeconds = pending.reduce((sum, p) => sum + (p.duration ?? 0), 0);

  return (
    <StepShell
      ref={headingRef}
      title="Revisa tus fotos"
      help="Estas son tus fotos y videos ya listos, con marco y logo."
      todo={[
        'Espera a que se preparen todas las fotos.',
        ...(videos.length ? [<>Si hay videos, toca <strong>Preparar videos</strong> y deja la pantalla abierta hasta que termine.</>] : []),
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

      {pending.length > 0 && (
        <div className="video-box">
          {videoProgress ? (
            <>
              <p className="progress" role="status">
                Preparando video {videoProgress.index} de {videoProgress.total}… {Math.round(videoProgress.fraction * 100)}%
              </p>
              <progress max={1} value={videoProgress.fraction} aria-label="Avance del video" />
              <p className="small">No cierres esta pantalla ni cambies de app hasta que termine.</p>
              <button type="button" className="btn small-btn" onClick={onCancelVideos}>
                Cancelar
              </button>
            </>
          ) : (
            <>
              <p>
                <strong>
                  {pending.length === 1 ? '1 video por preparar' : `${pending.length} videos por preparar`}
                </strong>
                . Tarda más o menos lo que dura{pending.length === 1 ? '' : 'n'} ({formatDuration(pendingSeconds)}).
              </p>
              <button type="button" className="btn primary" onClick={onPrepareVideos}>
                Preparar {pending.length === 1 ? 'video' : 'videos'}
              </button>
            </>
          )}
          {videoError && (
            <p className="error-box" role="alert">
              {videoError}
            </p>
          )}
        </div>
      )}

      {photos.length === 0 ? (
        <p className="muted">No quedan fotos. Vuelve atrás para subir más.</p>
      ) : (
        <ul className="grid">
          {photos.map((p) => {
            const r = get(p.id);
            const v = p.kind === 'video' ? getVideo(p.id) : undefined;
            return (
              <li key={p.id}>
                {v ? (
                  <video src={v.url} controls playsInline preload="metadata" aria-label={`${p.name} con marco`} />
                ) : r ? (
                  <div className="media">
                    <img src={r.url} alt={`${p.name} con marco`} />
                    {p.kind === 'video' && <span className="badge-video">Video · falta preparar</span>}
                  </div>
                ) : (
                  <div className="skeleton">Preparando…</div>
                )}
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
