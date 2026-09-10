export const SHEETS = {
  clients: "Clientes",
  services: "Servicios",
  professionals: "Profesionales",
  treatments: "Tratamientos",
  appointments: "Citas",
  payments: "Pagos",
  expenses: "Gastos",
  notes: "Notas",
  hours: "Horarios",
  balances: "Saldos",
} as const;

export type BackupCell = string | number | null;
export type BackupSheets = Record<string, Array<Record<string, BackupCell>>>;
