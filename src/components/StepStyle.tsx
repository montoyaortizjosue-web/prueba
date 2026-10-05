import type { FormatOption, FrameColor } from '../lib';
import { DEFAULT_TEXT } from '../lib';
import type { StyleOptions } from '../types';
import { StepShell } from './StepShell';

const FORMATS: Array<[FormatOption, string]> = [
  ['auto', 'Automático'],
  ['9x16', 'TikTok / Stories 9:16'],
  ['4x5', 'Feed 4:5'],
  ['1x1', 'Cuadrado'],
];
const COLORS: Array<[FrameColor, string]> = [
  ['plum', 'Ciruela'],
  ['pink', 'Rosa'],
];

interface Props {
  options: StyleOptions;
  textDraft: string;
  onFormat: (f: FormatOption) => void;
  onColor: (c: FrameColor) => void;
  onText: (t: string) => void;
  previewUrl: string | undefined;
  previewBusy: boolean;
  previewError: string | null;
  firstName: string;
  headingRef: React.Ref<HTMLHeadingElement>;
}

function Radios<T extends string>(props: {
  legend: string;
  name: string;
  value: T;
  items: Array<[T, string]>;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="field">
      <legend>{props.legend}</legend>
      <div className="chips">
        {props.items.map(([v, label]) => (
          <label key={v} className="chip">
            <input
              type="radio"
              name={props.name}
              value={v}
              checked={props.value === v}
              onChange={() => props.onChange(v)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function StepStyle(p: Props) {
  return (
    <StepShell
      ref={p.headingRef}
      title="Elige el estilo"
      help="Así se verá tu primera foto. Cambia las opciones y mira el resultado al instante."
      todo={[
        'Mira la vista previa.',
        'Elige el formato donde vas a publicar.',
        'Elige el color del marco.',
        <>Cambia o borra el texto de abajo si quieres, y toca <strong>Siguiente</strong>.</>,
      ]}
    >
      <div className="style-layout">
        <div className="preview" aria-live="polite">
          {p.previewUrl ? (
            <img src={p.previewUrl} alt={`Vista previa de ${p.firstName} con marco y logo`} />
          ) : (
            <p className="muted">{p.previewError ?? 'Preparando vista previa…'}</p>
          )}
          {p.previewBusy && p.previewUrl && <span className="badge">Actualizando…</span>}
        </div>
        <div className="controls">
          <Radios legend="Formato" name="format" value={p.options.format} items={FORMATS} onChange={p.onFormat} />
          <Radios legend="Color del marco" name="color" value={p.options.color} items={COLORS} onChange={p.onColor} />
          <div className="field">
            <label htmlFor="footer-text">Texto de abajo</label>
            <input
              id="footer-text"
              type="text"
              className="text-input"
              value={p.textDraft}
              maxLength={60}
              placeholder={DEFAULT_TEXT}
              onChange={(e) => p.onText(e.target.value)}
              autoComplete="off"
            />
            <p className="small">Déjalo vacío si no quieres texto.</p>
          </div>
        </div>
      </div>
    </StepShell>
  );
}
