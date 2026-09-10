import * as XLSX from "xlsx";

export type ImportRow = Record<string, unknown>;

/** Lee un archivo CSV o Excel y devuelve las filas como objetos con cabecera. */
export async function parseSpreadsheet(file: File): Promise<ImportRow[]> {
  const buffer = await file.arrayBuffer();
  const book = XLSX.read(buffer, { type: "array", codepage: 65001 });
  const first = book.SheetNames[0];
  if (!first) return [];
  const sheet = book.Sheets[first];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<ImportRow>(sheet, { defval: "", raw: false });
  return rows.filter((r) => Object.values(r).some((v) => String(v ?? "").trim() !== ""));
}

/** Lee un archivo Excel con varias hojas y devuelve un mapa hoja -> filas. */
export async function parseWorkbook(file: File): Promise<Record<string, ImportRow[]>> {
  const buffer = await file.arrayBuffer();
  const book = XLSX.read(buffer, { type: "array", codepage: 65001 });
  const out: Record<string, ImportRow[]> = {};
  for (const name of book.SheetNames) {
    const sheet = book.Sheets[name];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<ImportRow>(sheet, { defval: "", raw: false });
    out[name] = rows.filter((r) => Object.values(r).some((v) => String(v ?? "").trim() !== ""));
  }
  return out;
}
