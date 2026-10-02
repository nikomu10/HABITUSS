# HABITUSS · Plano a PowerPoint

Sube la foto de un plano → la IA (Gemini o Claude) lo interpreta → descargas un PowerPoint (.pptx) con el plano
redibujado en figuras editables.

**Estado: Fases 1 y 2 completas** (subir + interpretar + descargar PowerPoint), con clave de acceso
y opción de instalar como app.

> Esta guía es para **ti (el administrador)**, que lo publicas UNA sola vez.
> Para tus compañeros existe otra, más corta: [`GUIA_USUARIOS.md`](GUIA_USUARIOS.md).

---

## ¿Cómo funciona? (en 30 segundos)

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La página que ve el usuario: sube la foto, la comprime, muestra el resultado y descarga el PowerPoint. |
| `generar-pptx.js` | Arma el PowerPoint (portada, plano a escala, foto, dudas, tabla). Corre en el navegador del usuario. |
| `api/interpretar.js` | La "cocina" en Vercel: guarda tu llave secreta, comprueba la clave de acceso, habla con la IA (Gemini o Claude) y valida la respuesta. |
| `manifest.webmanifest`, `sw.js`, `icons/` | Permiten **instalar** la página como app con ícono propio. |
| `vercel.json`, `package.json`, `.gitignore` | Configuración mínima. |

La llave de Anthropic **solo** vive en el servidor (Vercel). Nunca está en `index.html`.

---

## PARTE A. Conseguir lo necesario (una sola vez)

1. **Node.js** 18 o superior: https://nodejs.org (botón "LTS"). Comprueba con `node --version`.
2. **Cuenta en Vercel** (gratis): https://vercel.com/signup
3. **La llave de la IA**. Elige UNA de las dos (la app usa Gemini si encuentra su llave, y si no, Claude):

   **Opción 1 · Gemini de Google (tiene plan GRATUITO):**
   - Entra a https://aistudio.google.com/apikey con tu cuenta de Google (puede ser la del correo de HABITUSS).
   - Pulsa **Create API key** y copia la llave.
   - ⚠ **No confundir:** tener "Gemini" en tu correo o en la app (suscripción) **no** es lo mismo que la API.
     La llave se saca en *Google AI Studio*, como arriba. Si tu correo de empresa es de Google Workspace y
     no te deja entrar, puede que el administrador del dominio deba habilitarlo; o usa un Gmail personal.
   - ⚠ **Privacidad:** en el plan gratuito, Google indica que el contenido enviado **puede usarse para mejorar
     sus productos**. Los planos pueden revelar el nombre y la dirección del prestador. No subas planos de
     clientes que exijan confidencialidad, o usa un plan de pago de Gemini (que no lo hace).
   - Límites: el plan gratuito tiene un tope de consultas por minuto/día. Para uso ligero alcanza.

   **Opción 2 · Claude de Anthropic (de pago por uso, centavos por plano):**
   - https://console.anthropic.com → *Billing* (cargar saldo) → *API Keys* → *Create Key* (empieza por `sk-ant-...`).

   **No compartas la llave ni la subas a GitHub.**
4. **Vercel CLI** (simula Vercel en tu computador): en la terminal, `npm install -g vercel`

---

## PARTE B. Probarlo en tu computador

1. Abre una terminal dentro de la carpeta del proyecto.
2. Crea un archivo llamado **`.env.local`** (con el punto al inicio) con estas líneas:
   ```
   GEMINI_API_KEY=PEGA-AQUI-TU-LLAVE-DE-GEMINI
   CLAVE_ACCESO=invéntate-una-clave-para-tu-equipo
   ```
   - `GEMINI_API_KEY`: tu llave de Google AI Studio. (Si usas Claude en vez de Gemini, escribe
     `ANTHROPIC_API_KEY=sk-ant-...` y no pongas la de Gemini.)
   - `GEMINI_MODEL` (opcional): si Google cambia o retira el modelo y la app da error de "model not found",
     agrega una línea como `GEMINI_MODEL=gemini-2.5-flash`. Por defecto usa `gemini-3.8-flash`.
   - `CLAVE_ACCESO`: la contraseña que escribirán tus compañeros (una sola vez por equipo).
     Si la dejas vacía o no la pones, **cualquiera con el enlace podrá gastar tu saldo**.
   Este archivo está en `.gitignore`, así que no se sube a GitHub.
3. Inicia el servidor local: `vercel dev`
   La primera vez te pide iniciar sesión y responder unas preguntas:
   *Set up and develop?* → **Y** · *Link to existing project?* → **N** · nombre → el que quieras · lo demás → Enter.
4. Abre **http://localhost:3000**
5. Sube un plano, pulsa **Interpretar plano** (puede tardar hasta 1 minuto) y luego **Descargar PowerPoint**.
   Si te pide la clave de acceso, escribe la que pusiste en `.env.local`.

### ¿Qué revisar en la prueba?
- ¿Detectó los espacios y nombres correctos? Prueba con y sin "medida de referencia".
- Abre el .pptx en PowerPoint y comprueba que puedes **mover y editar cada muro, espacio, puerta y texto**.
- Las coordenadas son **aproximadas**, sobre todo con fotos torcidas o a mano alzada. El PowerPoint es un
  **borrador editable**, no un plano certificado. La diapositiva de "dudas" te dice qué revisar.

---

## PARTE C. Publicarlo en Vercel

1. En la terminal, dentro del proyecto: `vercel` (versión de prueba) y luego `vercel --prod` (versión pública).
2. **Pon las variables en Vercel** (el `.env.local` NO se sube):
   - https://vercel.com → tu proyecto → **Settings** → **Environment Variables**.
   - Crea **dos**: `GEMINI_API_KEY` (o `ANTHROPIC_API_KEY` si usas Claude) y `CLAVE_ACCESO`.
     Marca Production, Preview y Development → **Save**.
   - Vuelve a ejecutar `vercel --prod` para que tome el cambio.
   - **Sin terminal:** también puedes importar el repositorio desde https://vercel.com → *Add New… → Project*,
     elegir HABITUSS, dejar *Framework Preset* en **Other**, agregar las variables en *Environment Variables* y pulsar **Deploy**.
3. Vercel te da una dirección tipo `https://habituss-planos.vercel.app`. **Esa es la que compartes con tu equipo**,
   junto con la clave de acceso.
4. Recomendado: en la consola de Anthropic fija un **límite mensual de gasto** (*Settings → Limits*).

> **Para actualizar la app más adelante:** cambias los archivos y ejecutas `vercel --prod`.
> Todos los usuarios reciben la versión nueva solos, sin reinstalar nada.

---

## PARTE D. Instalarla como app (opcional, para cada usuario)

Detalles en [`GUIA_USUARIOS.md`](GUIA_USUARIOS.md). En resumen:
- **Chrome o Edge (Windows/Mac/Android):** botón **«⬇ Instalar app»** arriba a la derecha de la página
  (o el ícono de instalar en la barra de direcciones).
- **iPad/iPhone (Safari):** botón Compartir → **Añadir a pantalla de inicio**.

La app instalada **necesita internet**, porque la interpretación la hace Claude en línea.

---

## Problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| "Falta configurar GEMINI_API_KEY (o ANTHROPIC_API_KEY)" | No existe `.env.local` o la variable en Vercel | Revisa el nombre exacto y reinicia `vercel dev` / en Vercel haz *Redeploy* |
| Error 404 "model not found" de Gemini | Google renombró o retiró el modelo | Agrega la variable `GEMINI_MODEL=gemini-2.5-flash` y vuelve a publicar |
| Error 429 de Gemini | Superaste el límite del plan gratuito | Espera unos minutos o al día siguiente |
| Pide la clave de acceso siempre | La clave no coincide con `CLAVE_ACCESO` | Revisa mayúsculas/espacios; si la cambiaste, cada usuario debe escribir la nueva |
| Error 400/401/403 de la API | Llave incorrecta o sin permiso | Genera otra llave (AI Studio o consola de Anthropic) |
| Error 402 de Anthropic | Sin saldo | Carga crédito o cambia a Gemini |
| "No pude interpretar el plano" | Foto borrosa u oscura | Foto más nítida, de frente y con buena luz |
| "No se cargó la herramienta de PowerPoint" | Sin internet o bloqueo de `cdn.jsdelivr.net` | Revisa la conexión; en redes con filtros pide que permitan ese sitio |
| No aparece «Instalar app» | Ya está instalada, o el navegador no lo permite (Firefox, Safari) | Usa Chrome o Edge; en iPad usa *Añadir a pantalla de inicio* |
