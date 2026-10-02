// =====================================================================
// /api/interpretar  ·  FUNCIÓN SERVERLESS (la "cocina" de la app)
// =====================================================================
// Qué hace, en simple:
//   1. Recibe desde la página una imagen (ya comprimida) y datos opcionales.
//   2. Se la envía a la IA (Gemini o Claude) pidiéndole SOLO un JSON con el plano.
//   3. Valida que el JSON tenga la forma correcta.
//      Si no es válido, reintenta UNA vez. Si falla otra vez, devuelve un error claro.
//   4. Devuelve el JSON a la página.
//
// La API key vive SOLO aquí, en una variable de entorno (GEMINI_API_KEY o
// ANTHROPIC_API_KEY). El navegador del usuario nunca la ve.
// =====================================================================

const MODELO = "claude-sonnet-5-5";
const URL_API = "https://api.anthropic.com/v1/messages";

// ---------------------------------------------------------------------
// 1) El "prompt": las instrucciones que le damos a Claude
// ---------------------------------------------------------------------
function construirPrompt({ prestador, direccion, referencia }) {
  return `Eres un asistente experto en leer planos arquitectónicos de instalaciones de salud en Colombia.
Se te entrega la foto o boceto de un plano (a mano o impreso). Debes interpretarlo y devolver
ÚNICAMENTE un objeto JSON válido, sin texto antes ni después, sin comentarios y sin bloques de código markdown.

CONTEXTO (opcional, puede estar vacío):
- Prestador: ${prestador || "(no indicado)"}
- Dirección: ${direccion || "(no indicada)"}
- Medida de referencia para la escala: ${referencia || "(no indicada; estima la escala con elementos típicos como puertas de ~0.9 m)"}

SISTEMA DE COORDENADAS (muy importante):
- Todas las medidas están en METROS.
- El origen (0, 0) es la esquina SUPERIOR IZQUIERDA del plano completo.
- x crece hacia la derecha; y crece hacia ABAJO.
- Ningún valor debe ser negativo.

FORMATO EXACTO DE LA RESPUESTA:
{
  "espacios": [ { "nombre": "string", "x": número, "y": número, "ancho": número, "alto": número, "area_m2": número } ],
  "muros":    [ { "x1": número, "y1": número, "x2": número, "y2": número } ],
  "puertas":  [ { "x": número, "y": número, "ancho": número, "orientacion": "horizontal" | "vertical" } ],
  "ventanas": [ { "x": número, "y": número, "ancho": número, "orientacion": "horizontal" | "vertical" } ],
  "textos":   [ { "texto": "string", "x": número, "y": número } ],
  "dudas":    [ "string" ]
}

REGLAS:
- espacios: cada habitación/área es un rectángulo (x, y = esquina superior izquierda). area_m2 = ancho × alto,
  salvo que el plano indique explícitamente otra área. Si un espacio no es rectangular, aproxímalo con el
  rectángulo que mejor lo represente y anótalo en "dudas".
- muros: segmentos rectos. Incluye los muros exteriores y los divisorios. Un segmento por tramo recto.
- puertas y ventanas: (x, y) es su CENTRO. "ancho" es su longitud en metros.
  "orientacion" es "horizontal" si está en un muro horizontal, "vertical" si está en un muro vertical.
- textos: rótulos o notas del plano que NO sean el nombre de un espacio (cotas, notas, norte, etc.).
- dudas: lista todo lo que no pudiste interpretar con seguridad (texto ilegible, escala incierta,
  elementos ambiguos, medidas estimadas). Si no hay dudas, usa una lista vacía [].
- Si no hay elementos de un tipo, devuelve una lista vacía [] (nunca omitas las llaves).
- No inventes espacios que no se vean en la imagen. Prefiere anotar una duda antes que adivinar.
- Si el plano tiene cotas o una medida de referencia, úsalas para calcular la escala real.`;
}

// ---------------------------------------------------------------------
// 2) Validación del JSON (¿tiene la forma que necesitamos?)
// ---------------------------------------------------------------------
const esNumero = (v) => typeof v === "number" && Number.isFinite(v);
const esTexto = (v) => typeof v === "string";

// Devuelve una lista de problemas encontrados. Lista vacía = JSON válido.
function validarPlano(p) {
  const errores = [];
  if (!p || typeof p !== "object" || Array.isArray(p)) {
    return ["La respuesta no es un objeto JSON."];
  }

  // Cada sección: qué campos numéricos y de texto debe tener cada elemento
  const reglas = {
    espacios: { num: ["x", "y", "ancho", "alto", "area_m2"], txt: ["nombre"] },
    muros: { num: ["x1", "y1", "x2", "y2"], txt: [] },
    puertas: { num: ["x", "y", "ancho"], txt: ["orientacion"] },
    ventanas: { num: ["x", "y", "ancho"], txt: ["orientacion"] },
    textos: { num: ["x", "y"], txt: ["texto"] },
  };

  for (const [seccion, regla] of Object.entries(reglas)) {
    if (!Array.isArray(p[seccion])) {
      errores.push(`Falta la lista "${seccion}".`);
      continue;
    }
    p[seccion].forEach((el, i) => {
      for (const c of regla.num) {
        if (!esNumero(el?.[c])) errores.push(`${seccion}[${i}].${c} debe ser un número.`);
      }
      for (const c of regla.txt) {
        if (!esTexto(el?.[c])) errores.push(`${seccion}[${i}].${c} debe ser texto.`);
      }
    });
  }

  // Puertas y ventanas: la orientación solo puede tener dos valores
  for (const s of ["puertas", "ventanas"]) {
    (p[s] || []).forEach((el, i) => {
      if (el?.orientacion !== "horizontal" && el?.orientacion !== "vertical") {
        errores.push(`${s}[${i}].orientacion debe ser "horizontal" o "vertical".`);
      }
    });
  }

  if (!Array.isArray(p.dudas) || !p.dudas.every(esTexto)) {
    errores.push('"dudas" debe ser una lista de textos.');
  }
  return errores;
}

// Claude a veces envuelve el JSON en ```json ... ```; esto lo limpia.
function extraerJSON(texto) {
  const ini = texto.indexOf("{");
  const fin = texto.lastIndexOf("}");
  if (ini === -1 || fin === -1 || fin < ini) throw new Error("No se encontró JSON en la respuesta.");
  return JSON.parse(texto.slice(ini, fin + 1));
}

// ---------------------------------------------------------------------
// 3) ¿Con qué IA hablamos?  Se decide según las variables de Vercel:
//    - Si existe GEMINI_API_KEY  → Google Gemini (tiene plan gratuito)
//    - Si no, y existe ANTHROPIC_API_KEY → Claude (de pago por uso)
// ---------------------------------------------------------------------
const proveedorActivo = () =>
  process.env.GEMINI_API_KEY ? "gemini" : process.env.ANTHROPIC_API_KEY ? "claude" : null;

// Modelo de Gemini. Si Google lo renombra, se cambia con la variable GEMINI_MODEL en Vercel.
const modeloGemini = () => process.env.GEMINI_MODEL || "gemini-3.8-flash";

// Errores de conexión/credenciales: reintentar no ayuda
function errorDeApi(mensaje) {
  const e = new Error(mensaje);
  e.esDeApi = true;
  return e;
}

// ---- Opción A: Google Gemini. Devuelve el TEXTO de la respuesta ----
async function preguntarGemini({ imagen, tipoMime, prompt }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modeloGemini()}:generateContent`;
  const respuesta = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY, // ← la llave secreta
    },
    body: JSON.stringify({
      contents: [
        { parts: [{ inline_data: { mime_type: tipoMime, data: imagen } }, { text: prompt }] },
      ],
      // Pedimos que responda directamente en JSON
      generationConfig: { response_mime_type: "application/json", temperature: 0.2, maxOutputTokens: 8192 },
    }),
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw errorDeApi(`La API de Gemini respondió ${respuesta.status}: ${detalle.slice(0, 300)}`);
  }
  const datos = await respuesta.json();
  const partes = datos.candidates?.[0]?.content?.parts || [];
  const texto = partes.map((p) => p.text || "").join("");
  if (!texto) throw new Error("Gemini no devolvió texto (puede haber bloqueado la imagen).");
  return texto;
}

// ---- Opción B: Claude (Anthropic). Devuelve el TEXTO de la respuesta ----
async function preguntarClaude({ imagen, tipoMime, prompt }) {
  const respuesta = await fetch(URL_API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY, // ← la llave secreta
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: 8000,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: tipoMime, data: imagen } },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw errorDeApi(`La API de Anthropic respondió ${respuesta.status}: ${detalle.slice(0, 300)}`);
  }

  const datos = await respuesta.json();
  return (datos.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
}

// ---------------------------------------------------------------------
// 4) Una consulta a la IA elegida + validación. Lanza error si algo sale mal.
// ---------------------------------------------------------------------
async function interpretarUnaVez({ imagen, tipoMime, prompt }) {
  const preguntar = proveedorActivo() === "gemini" ? preguntarGemini : preguntarClaude;
  const texto = await preguntar({ imagen, tipoMime, prompt });
  const plano = extraerJSON(texto);
  const problemas = validarPlano(plano);
  if (problemas.length) {
    throw new Error("El JSON no tiene la forma esperada: " + problemas.slice(0, 5).join(" "));
  }
  return plano;
}

// ---------------------------------------------------------------------
// 5) El "handler": lo que Vercel ejecuta cuando la página llama a /api/interpretar
// ---------------------------------------------------------------------
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Usa el método POST." });
  }
  if (!proveedorActivo()) {
    return res.status(500).json({
      ok: false,
      error: "Falta configurar GEMINI_API_KEY (o ANTHROPIC_API_KEY) en el servidor. Revisa el LEEME.md.",
    });
  }

  // CLAVE DE ACCESO de la empresa (opcional pero MUY recomendada).
  // Si en Vercel existe la variable CLAVE_ACCESO, la página debe enviar esa misma
  // clave; si no coincide, se rechaza la petición ANTES de gastar dinero en la IA.
  const claveEsperada = process.env.CLAVE_ACCESO;
  if (claveEsperada && req.headers["x-clave-acceso"] !== claveEsperada) {
    return res.status(401).json({
      ok: false,
      codigo: "clave",
      error: "Clave de acceso incorrecta o vacía.",
    });
  }

  const { imagen, tipoMime, prestador, direccion, referencia } = req.body || {};
  if (!imagen || !["image/jpeg", "image/png"].includes(tipoMime)) {
    return res.status(400).json({ ok: false, error: "Falta la imagen o no es JPG/PNG." });
  }

  const prompt = construirPrompt({ prestador, direccion, referencia });

  // Intento 1 y, si el JSON falla, intento 2 (un solo reintento)
  let ultimoError;
  for (let intento = 1; intento <= 2; intento++) {
    try {
      const plano = await interpretarUnaVez({ imagen, tipoMime, prompt });
      return res.status(200).json({ ok: true, plano, intentos: intento });
    } catch (e) {
      ultimoError = e;
      console.error(`Intento ${intento} falló:`, e.message);
      if (e.esDeApi) break; // no tiene sentido reintentar un error de API
    }
  }

  return res.status(502).json({
    ok: false,
    error:
      "No pude interpretar el plano. Prueba con una foto más nítida y bien iluminada. " +
      "Detalle técnico: " + ultimoError.message,
  });
}
