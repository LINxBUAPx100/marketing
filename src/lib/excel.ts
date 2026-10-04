import { crc32, deflateRawSync } from "node:zlib";

// Generador mínimo de archivos .xlsx (Office Open XML) sin dependencias:
// un libro con hojas de texto, números, dinero y fechas, encabezado en negritas y filtros.

export type TipoColumna = "texto" | "numero" | "dinero" | "fecha" | "porcentaje";

export type Columna<T> = {
  titulo: string;
  valor: (fila: T) => string | number | Date | null | undefined;
  tipo?: TipoColumna;
  /** Ancho en caracteres. */
  ancho?: number;
};

export type Hoja<T = unknown> = { nombre: string; columnas: Columna<T>[]; filas: T[] };

// Índices de cellXfs en estilos(): 0 normal, 1 encabezado, 2 dinero, 3 fecha, 4 número, 5 porcentaje.
const ESTILO: Record<TipoColumna, number> = { texto: 0, dinero: 2, fecha: 3, numero: 4, porcentaje: 5 };

const escaparXml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Caracteres de control que XML no permite.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

/** 0 → A, 25 → Z, 26 → AA. */
export function letraColumna(i: number) {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Fecha → número de serie de Excel, en hora del centro de México. */
export function fechaExcel(d: Date) {
  return (d.getTime() - 6 * 3_600_000) / 86_400_000 + 25569;
}

function celda(ref: string, valor: string | number | Date | null | undefined, tipo: TipoColumna) {
  if (valor == null || valor === "") return "";
  const s = ESTILO[tipo] ? ` s="${ESTILO[tipo]}"` : "";
  if (valor instanceof Date) return `<c r="${ref}"${s}><v>${fechaExcel(valor)}</v></c>`;
  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) return "";
    // Dinero en centavos y porcentajes en puntos base se guardan como el valor que ve la persona.
    const v = tipo === "dinero" ? valor / 100 : tipo === "porcentaje" ? valor / 10000 : valor;
    return `<c r="${ref}"${s}><v>${v}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escaparXml(valor)}</t></is></c>`;
}

function hojaXml<T>(h: Hoja<T>) {
  const n = h.columnas.length;
  const ultima = letraColumna(Math.max(n - 1, 0));
  const anchos = h.columnas.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.ancho ?? (c.tipo === "fecha" ? 18 : c.tipo && c.tipo !== "texto" ? 14 : 24)}" customWidth="1"/>`).join("");
  const encabezado = `<row r="1">${h.columnas.map((c, i) => `<c r="${letraColumna(i)}1" t="inlineStr" s="1"><is><t>${escaparXml(c.titulo)}</t></is></c>`).join("")}</row>`;
  const filas = h.filas
    .map((f, r) => `<row r="${r + 2}">${h.columnas.map((c, i) => celda(`${letraColumna(i)}${r + 2}`, c.valor(f), c.tipo ?? "texto")).join("")}</row>`)
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<cols>${anchos}</cols><sheetData>${encabezado}${filas}</sheetData>` +
    (n ? `<autoFilter ref="A1:${ultima}${h.filas.length + 1}"/>` : "") +
    `</worksheet>`
  );
}

function estilos() {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy hh:mm"/></numFmts>` +
    `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
    `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EAF0"/></patternFill></fill></fills>` +
    `<borders count="1"><border/></borders>` +
    `<cellStyleXfs count="1"><xf/></cellStyleXfs>` +
    `<cellXfs count="6"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf numFmtId="164" applyNumberFormat="1"/><xf numFmtId="165" applyNumberFormat="1"/><xf numFmtId="4" applyNumberFormat="1"/><xf numFmtId="10" applyNumberFormat="1"/></cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
  );
}

/** Nombres de hoja válidos: sin []:*?/\, máximo 31 caracteres y sin repetirse. */
function nombresDeHoja(nombres: string[]) {
  const usados = new Set<string>();
  return nombres.map((n) => {
    const base = n.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Hoja";
    let nombre = base;
    for (let i = 2; usados.has(nombre.toLowerCase()); i++) nombre = `${base.slice(0, 28)} ${i}`;
    usados.add(nombre.toLowerCase());
    return nombre;
  });
}

/** Borra el tipo de las filas para juntar hojas distintas en un libro. */
export const hoja = <T,>(h: Hoja<T>) => h as unknown as Hoja;

export function libroExcel(lista: Hoja[]): Buffer {
  const nombres = nombresDeHoja(lista.map((h) => h.nombre));
  const archivos: [string, string][] = [
    [
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        lista.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
        `</Types>`,
    ],
    [
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      "xl/workbook.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` +
        nombres.map((n, i) => `<sheet name="${escaparXml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
        `</sheets>` +
        // Rango con nombre para que el filtro automático funcione al abrir.
        `<definedNames>${lista
          .map((h, i) => (h.columnas.length ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${escaparXml(nombres[i]).replace(/'/g, "''")}'!$A$1:$${letraColumna(h.columnas.length - 1)}$${h.filas.length + 1}</definedName>` : ""))
          .join("")}</definedNames></workbook>`,
    ],
    [
      "xl/_rels/workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        lista.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
        `<Relationship Id="rId${lista.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ],
    ["xl/styles.xml", estilos()],
    ...lista.map((h, i) => [`xl/worksheets/sheet${i + 1}.xml`, hojaXml(h)] as [string, string]),
  ];
  return zip(archivos.map(([nombre, contenido]) => ({ nombre, datos: Buffer.from(contenido, "utf8") })));
}

/** Empaqueta archivos en un .zip con compresión deflate. */
export function zip(archivos: { nombre: string; datos: Buffer }[]): Buffer {
  const locales: Buffer[] = [];
  const centrales: Buffer[] = [];
  let desplazamiento = 0;
  for (const a of archivos) {
    const nombre = Buffer.from(a.nombre, "utf8");
    const comprimido = deflateRawSync(a.datos);
    const crc = crc32(a.datos);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // versión necesaria
    local.writeUInt16LE(0x0800, 6); // nombres en UTF-8
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(0, 10); // hora
    local.writeUInt16LE(0x21, 12); // fecha: 1980-01-01
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(a.datos.length, 22);
    local.writeUInt16LE(nombre.length, 26);
    local.writeUInt16LE(0, 28);
    locales.push(local, nombre, comprimido);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comprimido.length, 20);
    central.writeUInt32LE(a.datos.length, 24);
    central.writeUInt16LE(nombre.length, 28);
    central.writeUInt32LE(desplazamiento, 42);
    centrales.push(central, nombre);
    desplazamiento += local.length + nombre.length + comprimido.length;
  }
  const directorio = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(archivos.length, 8);
  fin.writeUInt16LE(archivos.length, 10);
  fin.writeUInt32LE(directorio.length, 12);
  fin.writeUInt32LE(desplazamiento, 16);
  return Buffer.concat([...locales, directorio, fin]);
}
