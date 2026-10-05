import { createRoot } from 'react-dom/client';

// Marcador de la etapa 1: la interfaz llega en la etapa 2.
createRoot(document.getElementById('root')!).render(
  <p style={{ fontFamily: 'sans-serif', padding: 24 }}>
    Ashanty Editor — motor de imagen listo. La interfaz llega en la etapa 2.
  </p>,
);
