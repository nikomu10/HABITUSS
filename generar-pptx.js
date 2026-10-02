// =====================================================================
// generar-pptx.js  ·  FASE 2: convierte el JSON del plano en un PowerPoint
// =====================================================================
// Se ejecuta en el NAVEGADOR (no en el servidor), usando la librería PptxGenJS.
//
// Idea clave: en el plano todo está en METROS, pero una diapositiva está en
// PULGADAS. Calculamos una "escala" (pulgadas por metro) para que el plano
// completo quepa en la diapositiva, y convertimos cada medida con ella.
//
// Todo se dibuja con FIGURAS y TEXTOS (nunca imágenes), para que en PowerPoint
// cada pieza se pueda mover y editar. La única imagen es la foto original,
// que va aparte en la diapositiva 3 como referencia.
// =====================================================================

// ---------- Colores y medidas generales (fáciles de cambiar) ----------
const COLORES = {
  azul: "1F4E79",        // color principal HABITUSS (cámbialo si tienes uno de marca)
  azulClaro: "E8F0F8",
  texto: "1C2630",
  gris: "5B6770",
  muro: "2B2B2B",
  espacio: "F4F7FA",     // relleno de las habitaciones
  bordeEspacio: "9FB3C8",
  puerta: "E67E22",      // naranja
  ventana: "2E86DE",     // azul claro
};
const FUENTE = "Calibri";

// Diapositiva 16:9 de PowerPoint = 13.33 x 7.5 pulgadas
const ANCHO_SLIDE = 13.333;
const ALTO_SLIDE = 7.5;

// Zona de la diapositiva 2 donde se dibuja el plano (en pulgadas)
const AREA = { x: 0.6, y: 1.15, w: 12.13, h: 5.0 };

// ---------- Utilidades pequeñas ----------
const num = (v) => (Number.isFinite(v) ? v : 0);

// Formato colombiano: coma decimal. 12.5 → "12,5"
const fmt = (n, dec = 1) => Number(n).toFixed(dec).replace(".", ",");

function fechaLarga(d = new Date()) {
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

// Parte una lista larga en grupos (para que no se salga de la diapositiva)
function enGrupos(lista, tam) {
  const grupos = [];
  for (let i = 0; i < lista.length; i += tam) grupos.push(lista.slice(i, i + tam));
  return grupos.length ? grupos : [[]];
}

// Título + línea decorativa + pie de página, comunes a las diapositivas 2-5
function encabezado(pptx, slide, titulo, datos) {
  slide.background = { color: "FFFFFF" };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: ANCHO_SLIDE, h: 0.12, fill: { color: COLORES.azul }, line: { color: COLORES.azul, width: 0 } });
  slide.addText(titulo, { x: 0.6, y: 0.3, w: 9.5, h: 0.6, fontFace: FUENTE, fontSize: 26, bold: true, color: COLORES.azul, margin: 0 });
  const sub = [datos.prestador, datos.direccion].filter(Boolean).join("  ·  ");
  if (sub) slide.addText(sub, { x: 0.6, y: 0.82, w: 12, h: 0.3, fontFace: FUENTE, fontSize: 12, color: COLORES.gris, margin: 0 });
  slide.addText("HABITUSS · Borrador generado con IA, verificar antes de usar", {
    x: 0.6, y: 7.05, w: 9, h: 0.3, fontFace: FUENTE, fontSize: 9, color: COLORES.gris, margin: 0,
  });
}

// ---------------------------------------------------------------------
// Calcula el rectángulo (en metros) que contiene TODO el plano
// ---------------------------------------------------------------------
function limitesDelPlano(p) {
  const xs = [], ys = [];
  p.espacios.forEach((e) => { xs.push(e.x, e.x + e.ancho); ys.push(e.y, e.y + e.alto); });
  p.muros.forEach((m) => { xs.push(m.x1, m.x2); ys.push(m.y1, m.y2); });
  [...p.puertas, ...p.ventanas].forEach((o) => {
    const mitad = o.ancho / 2;
    const horiz = o.orientacion === "horizontal";
    xs.push(o.x - (horiz ? mitad : 0), o.x + (horiz ? mitad : 0));
    ys.push(o.y - (horiz ? 0 : mitad), o.y + (horiz ? 0 : mitad));
  });
  p.textos.forEach((t) => { xs.push(t.x); ys.push(t.y); });
  const fx = xs.filter(Number.isFinite), fy = ys.filter(Number.isFinite);
  if (!fx.length || !fy.length) return null; // plano vacío
  return { minX: Math.min(...fx), maxX: Math.max(...fx), minY: Math.min(...fy), maxY: Math.max(...fy) };
}

// ---------------------------------------------------------------------
// DIAPOSITIVA 2: el plano redibujado
// ---------------------------------------------------------------------
function dibujarPlano(pptx, slide, p) {
  const lim = limitesDelPlano(p);
  if (!lim) {
    slide.addText("La IA no detectó elementos para dibujar. Revisa la diapositiva 3 (foto original).", {
      x: 0.6, y: 3, w: 12, h: 1, fontFace: FUENTE, fontSize: 18, color: COLORES.gris, align: "center",
    });
    return;
  }

  // Tamaño del plano en metros (mínimo 1 m para no dividir entre cero)
  const anchoM = Math.max(lim.maxX - lim.minX, 1);
  const altoM = Math.max(lim.maxY - lim.minY, 1);

  // ESCALA: pulgadas de diapositiva por cada metro real
  const escala = Math.min(AREA.w / anchoM, AREA.h / altoM);

  // Para centrar el plano dentro del área disponible
  const origenX = AREA.x + (AREA.w - anchoM * escala) / 2;
  const origenY = AREA.y + (AREA.h - altoM * escala) / 2;

  // Convierten metros del plano → pulgadas de la diapositiva
  const X = (m) => origenX + (m - lim.minX) * escala;
  const Y = (m) => origenY + (m - lim.minY) * escala;
  const L = (m) => m * escala;

  // ---- 1) Espacios: un rectángulo con su nombre y área adentro ----
  p.espacios.forEach((e) => {
    const w = L(e.ancho), h = L(e.alto);
    // Tamaño de letra proporcional al espacio, entre 6 y 14 pt
    let fs = Math.max(6, Math.min(14, Math.min(w, h) * 9));
    // Ancho aproximado de una letra = 0,6 × el tamaño de letra (en puntos; 72 pt = 1 pulgada)
    const caracteresPorLinea = (w * 72) / (fs * 0.6);
    // Si el nombre es largo, reducir para que quepa en máximo 2 líneas
    if (e.nombre.length > caracteresPorLinea * 2) {
      fs = Math.max(6, fs * ((caracteresPorLinea * 2) / e.nombre.length));
    }
    // Una palabra no se parte: la más larga debe caber en una línea
    const palabraLarga = Math.max(...e.nombre.split(/\s+/).map((s) => s.length), 1);
    fs = Math.max(6, Math.min(fs, ((w - 0.1) * 72) / (palabraLarga * 0.6)));
    slide.addText(
      [
        { text: e.nombre, options: { bold: true, breakLine: true } },
        { text: fmt(e.area_m2) + " m²", options: { bold: false } },
      ],
      {
        shape: pptx.ShapeType.rect, x: X(e.x), y: Y(e.y), w, h,
        fontFace: FUENTE, fontSize: fs, color: COLORES.texto, align: "center", valign: "middle",
        fill: { color: COLORES.espacio }, line: { color: COLORES.bordeEspacio, width: 0.75 },
        margin: 2,
      }
    );
  });

  // ---- 2) Muros: cada uno es una línea gruesa independiente ----
  p.muros.forEach((m) => {
    const dx = m.x2 - m.x1, dy = m.y2 - m.y1;
    slide.addShape(pptx.ShapeType.line, {
      x: X(Math.min(m.x1, m.x2)), y: Y(Math.min(m.y1, m.y2)),
      w: L(Math.abs(dx)), h: L(Math.abs(dy)),
      // Una línea se dibuja de esquina sup-izq a inf-der; si va en la otra
      // diagonal hay que voltearla.
      flipV: dx * dy < 0,
      line: { color: COLORES.muro, width: 4 },
    });
  });

  // ---- 3) Ventanas y puertas: figuras simples de distinto color ----
  const GROSOR = 0.1; // pulgadas
  const dibujarAbertura = (o, color) => {
    const horiz = o.orientacion === "horizontal";
    const w = horiz ? L(o.ancho) : GROSOR;
    const h = horiz ? GROSOR : L(o.ancho);
    slide.addShape(pptx.ShapeType.rect, {
      x: X(o.x) - w / 2, y: Y(o.y) - h / 2, w, h,
      fill: { color }, line: { color: "FFFFFF", width: 0.5 },
    });
  };
  p.ventanas.forEach((o) => dibujarAbertura(o, COLORES.ventana));
  p.puertas.forEach((o) => dibujarAbertura(o, COLORES.puerta));

  // ---- 4) Textos sueltos (cotas, notas, etc.) ----
  p.textos.forEach((t) => {
    slide.addText(t.texto, {
      x: X(t.x), y: Y(t.y), w: Math.max(1.2, t.texto.length * 0.09), h: 0.3,
      fontFace: FUENTE, fontSize: 9, italic: true, color: COLORES.gris, margin: 0,
    });
  });

  barraDeEscala(pptx, slide, escala);
  leyenda(pptx, slide);
}

// Barra de escala gráfica:  0 ——— 1 m ——— 2 m
function barraDeEscala(pptx, slide, escala) {
  // Elegimos un paso "redondo" (0,5 / 1 / 2 / 5 / 10 m) que quepa en ~4 pulgadas
  const pasos = [0.5, 1, 2, 5, 10, 20, 50];
  let paso = pasos[0];
  for (const c of pasos) if (2 * c * escala <= 4) paso = c;

  const y = 6.45, x0 = 0.6, largo = paso * escala; // largo de cada tramo
  const etiqueta = (txt, x) =>
    slide.addText(txt, { x: x - 0.4, y: y + 0.14, w: 0.8, h: 0.25, fontFace: FUENTE, fontSize: 10, align: "center", color: COLORES.texto, margin: 0 });

  // Dos tramos: uno negro y otro blanco (como en los mapas)
  slide.addShape(pptx.ShapeType.rect, { x: x0, y, w: largo, h: 0.12, fill: { color: "000000" }, line: { color: "000000", width: 0.75 } });
  slide.addShape(pptx.ShapeType.rect, { x: x0 + largo, y, w: largo, h: 0.12, fill: { color: "FFFFFF" }, line: { color: "000000", width: 0.75 } });
  etiqueta("0", x0);
  etiqueta(fmt(paso, paso % 1 ? 1 : 0) + " m", x0 + largo);
  etiqueta(fmt(paso * 2, (paso * 2) % 1 ? 1 : 0) + " m", x0 + 2 * largo);
}

// Leyenda de colores (abajo a la derecha)
function leyenda(pptx, slide) {
  const items = [
    { txt: "Muro", color: COLORES.muro },
    { txt: "Puerta", color: COLORES.puerta },
    { txt: "Ventana", color: COLORES.ventana },
  ];
  let x = 9.2;
  items.forEach((it) => {
    slide.addShape(pptx.ShapeType.rect, { x, y: 6.52, w: 0.35, h: 0.1, fill: { color: it.color }, line: { color: it.color, width: 0 } });
    slide.addText(it.txt, { x: x + 0.42, y: 6.43, w: 0.8, h: 0.28, fontFace: FUENTE, fontSize: 11, color: COLORES.texto, margin: 0 });
    x += 1.2;
  });
}

// ---------------------------------------------------------------------
// FUNCIÓN PRINCIPAL
//   PptxGenJS : la librería (la pasamos como parámetro para poder probarla)
//   plano     : el JSON que devolvió la IA
//   datos     : { prestador, direccion }
//   foto      : { dataUrl, ancho, alto }  (la imagen original comprimida)
// Devuelve el objeto "pptx"; quien la llama decide si lo descarga.
// ---------------------------------------------------------------------
function generarPPTX(PptxGenJS, plano, datos, foto) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 pulgadas (16:9)
  pptx.author = "HABITUSS";
  pptx.company = "HABITUSS";
  pptx.title = "Plano - " + (datos.prestador || "Prestador");

  // ===== Diapositiva 1: Portada =====
  const s1 = pptx.addSlide();
  s1.background = { color: COLORES.azul };
  s1.addText("Plano de distribución", { x: 0.9, y: 1.7, w: 11.5, h: 0.9, fontFace: FUENTE, fontSize: 40, bold: true, color: "FFFFFF", margin: 0 });
  s1.addShape(pptx.ShapeType.rect, { x: 0.9, y: 2.75, w: 1.6, h: 0.07, fill: { color: COLORES.puerta }, line: { color: COLORES.puerta, width: 0 } });
  s1.addText(datos.prestador || "Prestador no indicado", { x: 0.9, y: 3.1, w: 11.5, h: 0.6, fontFace: FUENTE, fontSize: 28, color: "FFFFFF", margin: 0 });
  s1.addText(datos.direccion || "Dirección no indicada", { x: 0.9, y: 3.75, w: 11.5, h: 0.45, fontFace: FUENTE, fontSize: 18, color: "CFE0F1", margin: 0 });
  s1.addText(fechaLarga(), { x: 0.9, y: 4.3, w: 11.5, h: 0.4, fontFace: FUENTE, fontSize: 16, color: "CFE0F1", margin: 0 });
  s1.addText("Elaborado por HABITUSS", { x: 0.9, y: 6.4, w: 11.5, h: 0.5, fontFace: FUENTE, fontSize: 18, bold: true, color: "FFFFFF", margin: 0 });

  // ===== Diapositiva 2: Plano redibujado =====
  const s2 = pptx.addSlide();
  encabezado(pptx, s2, "Plano redibujado", datos);
  dibujarPlano(pptx, s2, plano);

  // ===== Diapositiva 3: Foto original =====
  const s3 = pptx.addSlide();
  encabezado(pptx, s3, "Foto original (referencia)", datos);
  if (foto && foto.dataUrl) {
    // Ajustar la foto al área disponible SIN deformarla
    const areaW = 12.13, areaH = 5.7;
    const r = Math.min(areaW / foto.ancho, areaH / foto.alto);
    const w = foto.ancho * r, h = foto.alto * r;
    s3.addImage({
      data: foto.dataUrl.replace(/^data:/, ""), // PptxGenJS espera "image/jpeg;base64,..."
      x: 0.6 + (areaW - w) / 2, y: 1.2 + (areaH - h) / 2, w, h,
    });
  }

  // ===== Diapositiva 4: Dudas de la IA (se divide si son muchas) =====
  const GRUPO_DUDAS = 9;
  enGrupos(plano.dudas, GRUPO_DUDAS).forEach((grupo, i) => {
    const s4 = pptx.addSlide();
    encabezado(pptx, s4, i === 0 ? "Dudas para revisar" : "Dudas para revisar (continuación)", datos);
    if (!plano.dudas.length) {
      s4.addText("La IA no reportó dudas. Aun así, compara el plano redibujado con la foto original.", {
        x: 0.6, y: 1.6, w: 12, h: 1, fontFace: FUENTE, fontSize: 18, color: COLORES.gris, margin: 0,
      });
    } else {
      s4.addText(
        grupo.map((d) => ({ text: d, options: { bullet: true, breakLine: true } })),
        { x: 0.6, y: 1.4, w: 12.1, h: 5.4, fontFace: FUENTE, fontSize: grupo.length > 6 ? 15 : 18, color: COLORES.texto, valign: "top", paraSpaceAfter: 8, margin: 0 }
      );
    }
  });

  // ===== Diapositiva 5: Tabla resumen de espacios (se divide si son muchos) =====
  const FILAS_POR_SLIDE = 11;
  const total = plano.espacios.reduce((s, e) => s + num(e.area_m2), 0);
  const celda = (txt, opts = {}) => ({ text: String(txt), options: { fontFace: FUENTE, fontSize: 14, color: COLORES.texto, ...opts } });
  const cab = (txt, align) => celda(txt, { bold: true, color: "FFFFFF", fill: { color: COLORES.azul }, align });
  const grupos = enGrupos(plano.espacios, FILAS_POR_SLIDE);

  grupos.forEach((grupo, gi) => {
    const s5 = pptx.addSlide();
    encabezado(pptx, s5, gi === 0 ? "Resumen de espacios" : "Resumen de espacios (continuación)", datos);
    const filas = [[cab("#", "center"), cab("Espacio", "left"), cab("Área (m²)", "right")]];
    grupo.forEach((e, i) => {
      const fondo = { fill: { color: i % 2 ? "FFFFFF" : COLORES.azulClaro } };
      filas.push([
        celda(gi * FILAS_POR_SLIDE + i + 1, { align: "center", ...fondo }),
        celda(e.nombre, { align: "left", ...fondo }),
        celda(fmt(e.area_m2, 2), { align: "right", ...fondo }),
      ]);
    });
    // La fila de total solo va en la última diapositiva
    if (gi === grupos.length - 1) {
      filas.push([
        celda("", { fill: { color: "D5DDE5" } }),
        celda("TOTAL", { bold: true, align: "left", fill: { color: "D5DDE5" } }),
        celda(fmt(total, 2), { bold: true, align: "right", fill: { color: "D5DDE5" } }),
      ]);
    }
    s5.addTable(filas, { x: 0.6, y: 1.35, w: 12.1, colW: [1, 8.1, 3], rowH: 0.4, border: { type: "solid", color: "D5DDE5", pt: 0.75 } });
    if (gi === grupos.length - 1) {
      s5.addText("Áreas estimadas por IA a partir de la imagen: verificar con medición en sitio.", {
        x: 0.6, y: 6.6, w: 12, h: 0.3, fontFace: FUENTE, fontSize: 11, italic: true, color: COLORES.gris, margin: 0,
      });
    }
  });

  return pptx;
}
