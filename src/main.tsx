import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/fredoka/600.css';
import '@fontsource/nunito/800.css';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service worker: deja la app lista para usarse sin internet después de la primera visita.
registerSW({ immediate: true });
