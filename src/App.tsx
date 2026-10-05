import { useCallback, useEffect, useRef, useState } from 'react';
import { Logo } from './components/Logo';
import { StepDownload } from './components/StepDownload';
import { StepReview } from './components/StepReview';
import { StepStyle } from './components/StepStyle';
import { StepUpload } from './components/StepUpload';
import { Stepper } from './components/Stepper';
import { DEFAULT_TEXT, openFiles, type PhotoFailure } from './lib';
import type { Photo, StyleOptions } from './types';
import { useRendered } from './useRendered';

const TEXT_DEBOUNCE_MS = 350;
let nextId = 1;

export default function App() {
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [errors, setErrors] = useState<PhotoFailure[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [status, setStatus] = useState('');
  const [format, setFormat] = useState<StyleOptions['format']>('auto');
  const [color, setColor] = useState<StyleOptions['color']>('plum');
  const [textDraft, setTextDraft] = useState(DEFAULT_TEXT);
  const [text, setText] = useState(DEFAULT_TEXT);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const thumbs = useRef(new Map<string, string>());

  // Debounce del texto inferior
  useEffect(() => {
    const t = setTimeout(() => setText(textDraft), TEXT_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [textDraft]);

  // Al cambiar de paso: scroll arriba y foco en el título
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, [step]);

  // Liberar miniaturas al cerrar
  useEffect(() => {
    const map = thumbs.current;
    return () => {
      for (const url of map.values()) URL.revokeObjectURL(url);
      map.clear();
    };
  }, []);

  const options: StyleOptions = { format, color, text };
  const limit = step === 1 ? 1 : step >= 2 ? photos.length : 0;
  const { get, busy, error } = useRendered(photos, options, limit);

  const addFiles = useCallback(
    async (files: File[]) => {
      setProgress({ current: 0, total: files.length });
      setStatus('Abriendo fotos…');
      try {
        const result = await openFiles(files, {
          existing: photos.length,
          onProgress: (current, total) => setProgress({ current, total }),
        });
        const added: Photo[] = result.photos.map((p) => {
          const id = String(nextId++);
          const thumbUrl = URL.createObjectURL(p.thumb);
          thumbs.current.set(id, thumbUrl);
          return { id, name: p.name, blob: p.blob, thumbUrl };
        });
        setPhotos((prev) => [...prev, ...added]);
        setErrors((prev) => [...prev, ...result.errors]);
        setStatus(
          `${added.length} ${added.length === 1 ? 'foto agregada' : 'fotos agregadas'}` +
            (result.errors.length ? `, ${result.errors.length} con problemas` : ''),
        );
      } catch {
        setErrors((prev) => [
          ...prev,
          { name: 'Fotos', message: 'Algo salió mal al abrir las fotos. Vuelve a elegirlas.' },
        ]);
      } finally {
        setProgress(null);
      }
    },
    [photos.length],
  );

  const removePhoto = useCallback((id: string) => {
    const url = thumbs.current.get(id);
    if (url) URL.revokeObjectURL(url);
    thumbs.current.delete(id);
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    setStatus('Foto quitada');
  }, []);

  const restart = () => {
    for (const url of thumbs.current.values()) URL.revokeObjectURL(url);
    thumbs.current.clear();
    setPhotos([]);
    setErrors([]);
    setStep(0);
    setStatus('Empezaste de nuevo');
  };

  const allReady = photos.length > 0 && photos.every((p) => get(p.id));
  const ready = [photos.length > 0 && !progress, photos.length > 0, allReady && !busy, true][step];
  const first = photos[0];

  return (
    <div className="app">
      <header className="top">
        <Logo />
        <span className="store">Ashanty Store · Editor de fotos</span>
      </header>
      <Stepper current={step} />

      <main>
        {step === 0 && (
          <StepUpload
            photos={photos}
            errors={errors}
            progress={progress}
            onAdd={addFiles}
            onRemove={removePhoto}
            onDismissError={(i) => setErrors((prev) => prev.filter((_, j) => j !== i))}
            headingRef={heading}
          />
        )}
        {step === 1 && first && (
          <StepStyle
            options={options}
            textDraft={textDraft}
            onFormat={setFormat}
            onColor={setColor}
            onText={setTextDraft}
            previewUrl={get(first.id)?.url}
            previewBusy={busy}
            previewError={error}
            firstName={first.name}
            headingRef={heading}
          />
        )}
        {step === 2 && (
          <StepReview photos={photos} get={get} busy={busy} error={error} onRemove={removePhoto} headingRef={heading} />
        )}
        {step === 3 && (
          <StepDownload photos={photos} get={get} onRestart={restart} onStatus={setStatus} headingRef={heading} />
        )}
      </main>

      <footer className="nav">
        <button type="button" className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>
          Atrás
        </button>
        {step < 3 && (
          <button type="button" className="btn primary" disabled={!ready} onClick={() => setStep(step + 1)}>
            Siguiente
          </button>
        )}
      </footer>

      <div className="sr-only" role="status" aria-live="polite">
        {status}
      </div>
    </div>
  );
}
