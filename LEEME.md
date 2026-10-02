# HABITUSS · Plano a PowerPoint

Sube la foto de un plano y la IA lo interpreta. (Fase 2: descargar un PowerPoint editable.)

**Estado actual: FASE 1** → subir imagen + interpretación con IA + ver el JSON en pantalla.

---

## ¿Cómo funciona? (en 30 segundos)

- `index.html` → la página que ve el usuario (comprime la imagen y la envía).
- `api/interpretar.js` → la "cocina": guarda tu llave secreta, habla con Claude y valida la respuesta.
- `vercel.json` y `package.json` → configuración mínima.

La llave de Anthropic **solo** vive en el servidor (Vercel). Nunca se escribe en `index.html`.

---

## PARTE A. Conseguir lo necesario (una sola vez)

1. **Node.js** (versión 18 o superior): descárgalo de https://nodejs.org (botón "LTS") e instálalo.
   Para comprobarlo, abre una terminal y escribe: `node --version`
2. **Cuenta en Vercel** (gratis): https://vercel.com/signup
3. **API key de Anthropic**: entra a https://console.anthropic.com → *API Keys* → *Create Key*.
   Copia la llave (empieza con `sk-ant-...`). Debes tener saldo/crédito cargado en la consola.
   **No la compartas ni la subas a GitHub.**
4. **Vercel CLI** (el programa que simula Vercel en tu computador). En la terminal:
   ```
   npm install -g vercel
   ```

---

## PARTE B. Probarlo en tu computador

1. Abre una terminal dentro de la carpeta del proyecto (`HABITUSS`).
2. Crea un archivo llamado **`.env.local`** (con el punto al inicio) con esta única línea:
   ```
   ANTHROPIC_API_KEY=sk-ant-PEGA-AQUI-TU-LLAVE
   ```
   Este archivo ya está en `.gitignore`, así que no se sube a GitHub.
3. Inicia el servidor local:
   ```
   vercel dev
   ```
   La primera vez te pedirá iniciar sesión y responder unas preguntas:
   - *Set up and develop?* → **Y**
   - *Link to existing project?* → **N** (crear uno nuevo)
   - Nombre del proyecto → el que quieras (ej. `habituss-planos`)
   - Lo demás: Enter (valores por defecto).
4. Abre en el navegador la dirección que aparece, normalmente **http://localhost:3000**
5. Sube una foto de un plano, pulsa **Interpretar plano** y espera (hasta ~1 minuto).
   Verás los conteos, las dudas de la IA y el JSON completo.

### ¿Qué revisar en la prueba de la Fase 1?
- ¿Detectó los espacios correctos y sus nombres?
- ¿Los números (x, y, ancho, alto) tienen sentido? Pruébalo con y sin "medida de referencia".
- ¿Las "dudas" son razonables?

Las coordenadas serán **aproximadas**, sobre todo con fotos torcidas o a mano alzada. Es normal;
por eso el resultado final es un borrador editable.

---

## PARTE C. Publicarlo en Vercel (cuando estés conforme)

1. En la terminal, dentro del proyecto:
   ```
   vercel
   ```
   (genera una versión de prueba) y luego:
   ```
   vercel --prod
   ```
   (la versión pública final).
2. **Pon la API key en Vercel** (la llave local `.env.local` NO se sube):
   - Entra a https://vercel.com → tu proyecto → **Settings** → **Environment Variables**.
   - Name: `ANTHROPIC_API_KEY` · Value: tu llave · marca Production, Preview y Development → **Save**.
   - Vuelve a ejecutar `vercel --prod` para que tome el cambio.
3. Vercel te dará una dirección tipo `https://habituss-planos.vercel.app`. ¡Ya funciona en cualquier computador o tablet!

> Cuidado: cualquiera que tenga el enlace puede usar la app y gastar tu saldo de Anthropic.
> Si la vas a compartir, avísame y agregamos una clave de acceso sencilla. También puedes
> poner un límite mensual de gasto en la consola de Anthropic.

---

## Problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| "Falta configurar ANTHROPIC_API_KEY" | No existe `.env.local` o está mal escrito | Revisa el nombre exacto y reinicia `vercel dev` |
| Error 401 de la API | Llave incorrecta | Genera otra en la consola de Anthropic |
| Error 429 / 402 | Sin saldo o demasiadas consultas | Revisa tu crédito en la consola |
| "No pude interpretar el plano" | Foto borrosa u oscura | Foto más nítida, de frente y con buena luz |
| Tarda demasiado | Imagen compleja | Espera hasta 1 min; si falla, prueba una foto más sencilla |
