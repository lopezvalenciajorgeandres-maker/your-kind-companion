/**
 * Gestión centralizada de planes, permisos y límites.
 * Los valores reales viven en la tabla `plan_limits` (configurables desde backend);
 * aquí sólo se define el catálogo de funciones y los textos para la interfaz.
 */

export type PlanTier = "free" | "pro";

export type FeatureKey =
  | "agenda"
  | "clientes"
  | "servicios"
  | "pagos"
  | "historial"
  | "reserva_online"
  | "whatsapp_manual"
  | "export_excel"
  | "backups"
  | "dashboard_basico"
  | "recordatorios_automaticos"
  | "whatsapp_automatico"
  | "dashboard_financiero"
  | "dashboard_avanzado"
  | "reactivacion"
  | "embudo"
  | "profesionales"
  | "paquetes"
  | "reportes_avanzados"
  | "rentabilidad"
  | "automatizaciones"
  | "eleva_ai";

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  agenda: "Agenda",
  clientes: "Clientes",
  servicios: "Servicios",
  pagos: "Registro de pagos",
  historial: "Historial de clientes",
  reserva_online: "Reserva online",
  whatsapp_manual: "WhatsApp manual",
  export_excel: "Exportación a Excel",
  backups: "Copias de seguridad",
  dashboard_basico: "Panel básico",
  recordatorios_automaticos: "Recordatorios automáticos",
  whatsapp_automatico: "WhatsApp automatizado",
  dashboard_financiero: "Panel financiero",
  dashboard_avanzado: "Panel avanzado",
  reactivacion: "Reactivación de clientes",
  embudo: "Embudo de ventas",
  profesionales: "Gestión de profesionales",
  paquetes: "Paquetes y bonos",
  reportes_avanzados: "Reportes avanzados",
  rentabilidad: "Rentabilidad por servicio",
  automatizaciones: "Automatizaciones",
  eleva_ai: "ELEVA AI",
};

export type PlanLimits = {
  plan: PlanTier;
  max_clients: number | null;
  max_services: number | null;
  max_professionals: number | null;
  max_appointments_per_month: number | null;
  price_cents: number;
  features: Partial<Record<FeatureKey, boolean>>;
};

export const FALLBACK_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    plan: "free",
    max_clients: 200,
    max_services: 20,
    max_professionals: 1,
    max_appointments_per_month: 300,
    price_cents: 0,
    features: {
      agenda: true,
      clientes: true,
      servicios: true,
      pagos: true,
      historial: true,
      reserva_online: true,
      whatsapp_manual: true,
      export_excel: true,
      backups: true,
      dashboard_basico: true,
    },
  },
  pro: {
    plan: "pro",
    max_clients: null,
    max_services: null,
    max_professionals: null,
    max_appointments_per_month: null,
    price_cents: 2900,
    features: Object.fromEntries(
      (Object.keys(FEATURE_LABELS) as FeatureKey[]).map((k) => [k, true]),
    ) as Partial<Record<FeatureKey, boolean>>,
  },
};

export function hasFeature(limits: PlanLimits | null | undefined, key: FeatureKey): boolean {
  if (!limits) return FALLBACK_LIMITS.free.features[key] === true;
  return limits.features?.[key] === true;
}

export function limitReached(
  limits: PlanLimits | null | undefined,
  key: "max_clients" | "max_services" | "max_professionals" | "max_appointments_per_month",
  current: number,
): boolean {
  const max = (limits ?? FALLBACK_LIMITS.free)[key];
  if (max == null) return false;
  return current >= max;
}

export const BUSINESS_TYPES = [
  "Clínica estética",
  "Spa",
  "Centro de estética",
  "Cabina estética",
  "Salón de belleza",
  "Cosmetología",
  "Masajes",
  "Otro",
] as const;

export const CLIENT_SOURCES = [
  "Instagram",
  "Facebook",
  "Google",
  "Referido",
  "WhatsApp",
  "Página web",
  "Facebook Ads",
  "Instagram Ads",
  "Google Ads",
  "TikTok Ads",
  "Otro",
] as const;

export const APPOINTMENT_STATUS = {
  pending: "Pendiente",
  scheduled: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistió",
} as const;

export type AppointmentStatus = keyof typeof APPOINTMENT_STATUS;

export const PAYMENT_METHODS = ["Efectivo", "Transferencia", "Tarjeta", "Otro"] as const;
export const PAYMENT_STATUS = ["Pagado", "Pendiente", "Parcial"] as const;

export function formatMoney(cents: number | null | undefined, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format((cents ?? 0) / 100);
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
