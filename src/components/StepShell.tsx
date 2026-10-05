import { forwardRef, type ReactNode } from 'react';

interface Props {
  title: string;
  help: string;
  todo: ReactNode[];
  children: ReactNode;
}

export const StepShell = forwardRef<HTMLHeadingElement, Props>(function StepShell(
  { title, help, todo, children },
  ref,
) {
  return (
    <section className="step">
      <h2 ref={ref} tabIndex={-1}>
        {title}
      </h2>
      <p className="help">{help}</p>
      <aside className="todo" aria-label="Qué hacer ahora">
        <h3>Qué hacer ahora</h3>
        <ol>
          {todo.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
      </aside>
      {children}
    </section>
  );
});
