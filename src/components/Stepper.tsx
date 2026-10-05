const STEPS = ['Fotos', 'Estilo', 'Revisar', 'Descargar'];

export function Stepper({ current }: { current: number }) {
  return (
    <nav aria-label="Progreso">
      <ol className="stepper">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={i < current ? 'done' : i === current ? 'current' : ''}
            aria-current={i === current ? 'step' : undefined}
          >
            <span className="dot" aria-hidden="true">
              {i < current ? '✓' : i + 1}
            </span>
            <span className="label">{label}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
