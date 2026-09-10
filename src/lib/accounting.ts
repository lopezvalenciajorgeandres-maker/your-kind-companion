/** Catálogo contable del negocio (gastos y caja). */
export const EXPENSE_CATEGORIES = [
  "Insumos y productos",
  "Nómina y comisiones",
  "Arriendo",
  "Servicios públicos",
  "Publicidad y marketing",
  "Equipos y mantenimiento",
  "Impuestos y tasas",
  "Software y suscripciones",
  "Transporte",
  "Otro",
] as const;

export const EXPENSE_METHODS = ["Efectivo", "Transferencia", "Tarjeta", "Otro"] as const;

export function monthRange(date = new Date()) {
  const from = new Date(date.getFullYear(), date.getMonth(), 1);
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { from: iso(from), to: iso(to) };
}

export function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}