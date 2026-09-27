/**
 * Serializer CSV murni (tanpa dependensi) untuk ekspor laporan.
 *
 * Delimiter default ";" karena Excel edisi Indonesia memakai titik-koma
 * sebagai pemisah daftar — file langsung terbuka rapi tanpa import wizard.
 */

export type CsvCell = string | number | null | undefined;

export interface ToCsvOptions {
  /** Pemisah kolom, default ";" (Excel locale Indonesia). */
  delimiter?: string;
}

function escapeCell(value: CsvCell, delimiter: string): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "number" ? formatNumber(value) : value;
  if (s.includes('"') || s.includes(delimiter) || /[\n\r]/.test(s)) {
    s = `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

/** Angka desimal pakai koma (locale Indonesia) agar Excel mengenali. */
function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  const rounded = Math.round(n * 100) / 100;
  return String(rounded).replace(".", ",");
}

export function toCsv(
  headers: readonly string[],
  rows: readonly CsvCell[][],
  opts: ToCsvOptions = {},
): string {
  const d = opts.delimiter ?? ";";
  const lines = [headers, ...rows].map((row) =>
    row.map((cell) => escapeCell(cell, d)).join(d),
  );
  // \r\n + BOM: aman untuk Excel Windows maupun import via Google Sheets.
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/** Nama file aman untuk header Content-Disposition. */
export function csvFilename(parts: readonly string[]): string {
  const clean = parts
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .normalize("NFKD")
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
  return `${clean || "laporan"}.csv`;
}
