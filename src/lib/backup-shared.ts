export const SHEETS = {
  control: "Control",
  business: "Negocio",
  clients: "Clientes",
  services: "Servicios",
  professionals: "Profesionales",
  professionalServices: "Profesional Servicios",
  packages: "Paquetes",
  treatments: "Tratamientos",
  appointments: "Citas",
  packageSessions: "Sesiones Paquete",
  payments: "Pagos",
  expenses: "Gastos",
  notes: "Notas",
  hours: "Horarios",
  blockedDates: "Fechas Bloqueadas",
  balances: "Saldos",
  treatmentBalances: "Saldos Tratamientos",
  reminders: "Recordatorios WhatsApp",
  notifications: "Notificaciones",
} as const;

export type BackupCell = string | number | null;
export type BackupSheets = Record<string, Array<Record<string, BackupCell>>>;
