# Ashanty Editor

Web app de **Ashanty Store** para ponerle el marco y el logo de la marca a fotos y videos de ropa importada.
Todo se procesa **en el navegador**: no hay servidor y las fotos y videos nunca salen del dispositivo.
Se despliega como sitio estático y se puede **instalar en el celular** y usar **sin internet** después de la primera visita.

## Qué hace

1. **Fotos**: subes fotos (JPG, PNG, WebP, GIF, BMP, AVIF, HEIC) o videos (MP4, MOV, WebM, hasta 5 minutos). Máximo 30 por tanda.
2. **Estilo**: eliges formato (Automático, TikTok/Stories 9:16, Feed 4:5, Cuadrado), color del marco (Ciruela o Rosa) y el texto de abajo.
3. **Revisar**: ves todo ya con marco y logo y quitas lo que no quieras. Los videos se preparan aquí.
4. **Descargar**: `.zip` con todo, **Descargar todo** (archivos sueltos), descarga por foto y, en celulares que lo permiten, **Guardar en galería / Compartir**.

Notas:
- Los videos se preparan en tiempo real (uno de 30 s tarda unos 30 s) y hay que dejar la pantalla abierta. Salen en MP4 si el navegador lo permite, y si no en WebM.
- Funciona en Chrome (Android y PC), Safari reciente (iPhone) y Edge. Las fotos HEIC se convierten solas si el navegador no las abre.

## Cómo correrlo en tu computadora

Necesitas [Node.js](https://nodejs.org) 20 o más nuevo.

```bash
npm install
npm run dev        # abre http://localhost:5173
```

Otros comandos:

```bash
npm test           # pruebas unitarias (Vitest)
npm run build      # genera la carpeta dist/ lista para publicar
npm run preview    # prueba el build en http://localhost:4173
```

## Cómo hacer el build

```bash
npm run build
```

Se crea la carpeta `dist/` con el sitio completo (incluye el service worker y el manifest para instalarlo).
Esa carpeta es lo único que hay que publicar.

## Cómo desplegarlo gratis

Como lo usa una sola persona, cualquier plan gratuito alcanza.

### Opción A: Netlify, subiendo la carpeta (la más fácil, sin GitHub)

1. Ejecuta `npm run build`.
2. Entra a <https://app.netlify.com/drop> y crea una cuenta gratis si te lo pide.
3. Arrastra la carpeta **`dist`** a la zona que dice "Drag and drop your site folder here".
4. En unos segundos te da un link como `https://nombre-aleatorio.netlify.app`. Ábrelo en el celular.
5. Opcional: en *Site configuration → Change site name* ponle un nombre fácil (por ejemplo `ashanty-editor`).

Para actualizar la app: vuelve a hacer el build y arrastra `dist` otra vez en la sección *Deploys* de tu sitio.

### Opción B: Netlify conectado a GitHub (se actualiza solo)

1. Sube este proyecto a un repositorio de GitHub.
2. En <https://app.netlify.com> toca **Add new site → Import an existing project** y elige GitHub.
3. Selecciona el repositorio. Netlify toma la configuración de `netlify.toml` (comando `npm run build`, carpeta `dist`).
4. Toca **Deploy**. Cada vez que subas cambios a la rama principal, se vuelve a publicar solo.

### Opción C: Vercel

1. Sube el proyecto a GitHub.
2. Entra a <https://vercel.com>, crea una cuenta gratis con tu GitHub y toca **Add New → Project**.
3. Elige el repositorio. Vercel detecta Vite solo (comando `npm run build`, carpeta `dist`). No cambies nada.
4. Toca **Deploy**. Te da un link como `https://nombre.vercel.app`.

### Opción D: GitHub Pages o Cloudflare Pages

Funcionan igual de bien con la carpeta `dist`. En GitHub Pages el sitio queda en una subcarpeta (`usuario.github.io/repositorio/`), así que antes del build cambia `base` en `vite.config.ts` a `'/nombre-del-repositorio/'`.

## Instalarla en el celular

Abre el link una vez **con internet**. Después:

- **Android (Chrome):** menú ⋮ → **Instalar app** (o *Agregar a pantalla principal*).
- **iPhone (Safari):** botón Compartir → **Agregar a pantalla de inicio**.

Desde la primera visita la app queda guardada y abre también sin internet.
Cuando publicas una versión nueva, la app se actualiza sola la siguiente vez que se abre con internet.

## Cómo está hecho

- Vite + React + TypeScript, CSS plano con variables (modo claro/oscuro según el sistema).
- Fuentes autoalojadas: Fredoka 600 y Nunito 800 (`@fontsource`). No usa CDN.
- `src/lib/`: motor de imagen y video (marco, logo, lectura robusta de fotos, EXIF, HEIC con `heic2any` bajo demanda, reducción de mitad en mitad, videos con canvas + `MediaRecorder`).
- PWA con `vite-plugin-pwa` (manifest, service worker y íconos generados desde el lazo).
- Zip con `jszip` (se carga solo cuando se necesita).

### Scripts de verificación (opcionales, requieren Chromium)

Con `npm run build && npx vite preview --port 4173` corriendo en otra terminal:

```bash
node scripts/screenshots.mjs     # recorre los 4 pasos a 390 px y 1280 px
node scripts/stress.mjs          # fotos enormes, PNG transparente, tandas de 30...
node scripts/video-test.mjs      # videos con audio de punta a punta
node scripts/offline-test.mjs    # PWA: manifest y uso sin conexión
node scripts/make-icons.mjs      # regenera los íconos en public/
```

`screenshots.mjs` crea sus propias fotos de ejemplo en `test-output/samples`; `video-test.mjs` y `offline-test.mjs` usan esas fotos (córrelos después de `screenshots.mjs`) y `offline-test.mjs` también necesita el video que crea `video-test.mjs`. `stress.mjs` usa archivos de `test-output/stress` (fotos enormes, dañadas, etc.) que hay que generar aparte.
