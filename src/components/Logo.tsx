import { BOW_PATHS } from '../lib';

export function Logo() {
  return (
    <span className="logo" role="img" aria-label="Ashanty Store">
      <svg viewBox="0 0 88 100" aria-hidden="true" focusable="false">
        <g fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d={BOW_PATHS.pata1} />
          <path d={BOW_PATHS.pata2} />
        </g>
        <g fill="currentColor" stroke="var(--logo-bg)" strokeWidth="2.5" strokeLinejoin="round">
          <path d={BOW_PATHS.lazo1} />
          <path d={BOW_PATHS.lazo2} />
          <path d={BOW_PATHS.nudo} />
        </g>
      </svg>
      <span aria-hidden="true">shanty</span>
    </span>
  );
}
