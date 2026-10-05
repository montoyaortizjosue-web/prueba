import { CORNER_RADIUS } from './layout';
import { browserEnv, drawFrameBase, traceRoundedRect, type CompositeEnv, type CompositeOptions } from './composite';

/** Máximo por video: tarda lo mismo que dura y se guarda en memoria. */
export const MAX_VIDEO_SECONDS = 300;
const FPS = 30;
const VIDEO_BITS = 6_000_000;
const AUDIO_BITS = 128_000;

export interface VideoResult {
  blob: Blob;
  ext: 'mp4' | 'webm';
}

const MIME_CANDIDATES: Array<{ mime: string; ext: 'mp4' | 'webm' }> = [
  { mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' },
  { mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
  { mime: 'video/mp4', ext: 'mp4' },
  { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
  { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
  { mime: 'video/webm', ext: 'webm' },
];

/** MP4 si el navegador lo permite (Safari, Chrome reciente); si no, WebM. */
export function pickRecorderMime(isSupported: (t: string) => boolean) {
  return MIME_CANDIDATES.find((c) => isSupported(c.mime)) ?? null;
}

export function videoRecordingSupported(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
    pickRecorderMime((t) => MediaRecorder.isTypeSupported(t)) !== null
  );
}

export const formatDuration = (seconds: number) => {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function once(target: EventTarget, ok: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = (err?: Error) => {
      clearTimeout(timer);
      target.removeEventListener(ok, onOk);
      target.removeEventListener('error', onErr);
      err ? reject(err) : resolve();
    };
    const onOk = () => done();
    const onErr = () => done(new Error('video error'));
    const timer = setTimeout(() => done(new Error('timeout')), timeoutMs);
    target.addEventListener(ok, onOk, { once: true });
    target.addEventListener('error', onErr, { once: true });
  });
}

function makeVideoElement(): HTMLVideoElement {
  const v = document.createElement('video');
  v.playsInline = true;
  v.setAttribute('playsinline', '');
  v.preload = 'auto';
  // iOS decodifica mejor si el elemento está en la página.
  Object.assign(v.style, { position: 'fixed', left: '0', top: '0', width: '1px', height: '1px', opacity: '0.01', pointerEvents: 'none' });
  document.body.appendChild(v);
  return v;
}

export interface VideoInfo {
  video: HTMLVideoElement;
  duration: number;
  /** Cierra el video y libera la URL. */
  dispose: () => void;
}

/** Abre un video, espera sus datos y se posiciona en un cuadro representativo. */
export async function openVideoElement(file: Blob): Promise<VideoInfo> {
  const video = makeVideoElement();
  const url = URL.createObjectURL(file);
  const dispose = () => {
    video.removeAttribute('src');
    video.load();
    video.remove();
    URL.revokeObjectURL(url);
  };
  try {
    video.muted = true;
    video.src = url;
    await once(video, 'loadedmetadata', 20_000);
    if (!video.videoWidth || !video.videoHeight) throw new Error('sin tamaño');
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    video.currentTime = Math.min(0.5, duration / 2);
    await once(video, 'seeked', 20_000);
    if (video.readyState < 2) await once(video, 'loadeddata', 20_000);
    return { video, duration, dispose };
  } catch (e) {
    dispose();
    throw e;
  }
}

// El audio de un <video> solo se puede capturar con un grafo WebAudio, y
// createMediaElementSource se llama una sola vez por elemento: se reutiliza.
interface Player {
  video: HTMLVideoElement;
  audio: MediaStreamAudioDestinationNode | null;
  ctx: AudioContext | null;
}
let player: Player | null = null;

function getPlayer(): Player {
  if (player) return player;
  const video = makeVideoElement();
  let audio: MediaStreamAudioDestinationNode | null = null;
  let ctx: AudioContext | null = null;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    audio = ctx.createMediaStreamDestination();
    ctx.createMediaElementSource(video).connect(audio); // no va a los parlantes
  } catch {
    audio = null; // sin audio, pero el video sale igual
  }
  player = { video, audio, ctx };
  return player;
}

export interface RenderVideoOptions {
  signal?: AbortSignal;
  /** 0 a 1 */
  onProgress?: (fraction: number) => void;
  env?: CompositeEnv;
}

/**
 * Pone el marco y el logo a un video "reproduciéndolo" sobre un canvas y
 * grabándolo con MediaRecorder (con su audio). Tarda lo que dura el video.
 * Debe iniciarse desde un toque del usuario (iOS no deja reproducir con sonido si no).
 */
export async function renderVideo(
  file: Blob,
  options: CompositeOptions,
  { signal, onProgress, env = browserEnv }: RenderVideoOptions = {},
): Promise<VideoResult> {
  const picked = pickRecorderMime((t) => MediaRecorder.isTypeSupported(t));
  if (!picked || typeof HTMLCanvasElement.prototype.captureStream !== 'function') {
    throw new Error('unsupported');
  }
  const abort = () => new DOMException('Cancelado', 'AbortError');
  if (signal?.aborted) throw abort();

  const { video, audio, ctx: audioCtx } = getPlayer();
  const url = URL.createObjectURL(file);
  let wakeLock: { release: () => Promise<void> } | null = null;
  let recorder: MediaRecorder | null = null;
  let stopLoop = false;
  const onVisibility = () => {
    // Si la pantalla se oculta el navegador congela los cuadros: se pausa todo.
    if (!recorder || recorder.state === 'inactive') return;
    if (document.hidden) {
      video.pause();
      if (recorder.state === 'recording') recorder.pause();
    } else {
      if (recorder.state === 'paused') recorder.resume();
      void video.play().catch(() => undefined);
    }
  };

  try {
    video.muted = false;
    video.volume = 1;
    video.src = url;
    await once(video, 'loadedmetadata', 20_000);
    if (!video.videoWidth || !video.videoHeight) throw new Error('sin tamaño');
    if (video.readyState < 2) await once(video, 'loadeddata', 20_000);
    video.currentTime = 0;
    if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume().catch(() => undefined);

    const base = await drawFrameBase(video.videoWidth, video.videoHeight, options, env);
    const canvas = env.createCanvas(base.width, base.height) as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const { rect } = base;
    const clip = new Path2D();
    traceRoundedRect(clip, rect.x, rect.y, rect.w, rect.h, CORNER_RADIUS);

    const draw = () => {
      ctx.drawImage(base.canvas as CanvasImageSource, 0, 0);
      ctx.save();
      ctx.clip(clip);
      ctx.drawImage(video, rect.x, rect.y, rect.w, rect.h);
      ctx.restore();
    };
    draw();

    const stream = canvas.captureStream(FPS);
    if (audio) for (const t of audio.stream.getAudioTracks()) stream.addTrack(t);
    recorder = new MediaRecorder(stream, {
      mimeType: picked.mime,
      videoBitsPerSecond: VIDEO_BITS,
      audioBitsPerSecond: AUDIO_BITS,
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const stopped = new Promise<void>((resolve) => (recorder!.onstop = () => resolve()));

    try {
      const lock = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
      wakeLock = (await lock?.request('screen')) ?? null;
    } catch {
      // opcional
    }
    document.addEventListener('visibilitychange', onVisibility);

    const finished = new Promise<void>((resolve, reject) => {
      const frame = () => {
        if (stopLoop) return;
        draw();
        const d = video.duration;
        if (Number.isFinite(d) && d > 0) onProgress?.(Math.min(1, video.currentTime / d));
        schedule();
      };
      const schedule = () =>
        'requestVideoFrameCallback' in video
          ? (video as HTMLVideoElement).requestVideoFrameCallback(frame)
          : requestAnimationFrame(frame);
      video.onended = () => resolve();
      video.onerror = () => reject(new Error('video error'));
      signal?.addEventListener('abort', () => reject(abort()), { once: true });
      recorder!.start(1000);
      video.play().then(schedule, reject);
    });

    await finished;
    draw();
    await new Promise((r) => setTimeout(r, 250)); // deja pasar el último cuadro
    stopLoop = true;
    recorder.stop();
    await stopped;
    onProgress?.(1);
    const type = picked.mime.split(';')[0];
    return { blob: new Blob(chunks, { type }), ext: picked.ext };
  } finally {
    stopLoop = true;
    document.removeEventListener('visibilitychange', onVisibility);
    video.onended = null;
    video.onerror = null;
    video.pause();
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
    void wakeLock?.release().catch(() => undefined);
  }
}
