import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useTenant } from "@/lib/use-tenant";
import { FEATURE_LABELS, type FeatureKey, formatMoney } from "@/lib/plan";
import { PageHeader, Panel, btnGhost, btnPrimary } from "@/components/app/kit";
import { Check, Crown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/planes")({ component: Plans });

const FREE_FEATURES: FeatureKey[] = [
  "agenda", "clientes", "servicios", "pagos", "historial", "reserva_online", "whatsapp_manual", "export_excel", "backups", "dashboard_basico",
];
const PRO_EXTRA: FeatureKey[] = [
  "recordatorios_automaticos", "whatsapp_automatico", "dashboard_financiero", "dashboard_avanzado", "reactivacion",
  "embudo", "profesionales", "paquetes", "reportes_avanzados", "rentabilidad", "automatizaciones",
];

function Plans() {
  const tenant = useTenant();
  const isPro = tenant.plan === "pro";

  return (
    <div className="p-5 md:p-10 max-w-5xl">
      <PageHeader title="Tu plan" subtitle={`Actualmente estás en el plan ${tenant.plan.toUpperCase()}.`} />

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Panel className={`p-6 ${!isPro ? "ring-2 ring-primary" : ""}`}>
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl">FREE</h2>
            {!isPro && <span className="text-xs rounded-full bg-primary text-primary-foreground px-3 py-1">Tu plan</span>}
          </div>
          <p className="mt-2 text-3xl font-serif">Gratis</p>
          <p className="text-sm text-muted-foreground mt-1">Todo lo esencial para gestionar tu día a día.</p>
          <ul className="mt-6 space-y-2 text-sm">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" /> {FEATURE_LABELS[f]}
              </li>
            ))}
          </ul>
          <div className="mt-6 text-xs text-muted-foreground">
            Hasta {tenant.limits.max_clients ?? "∞"} clientes · {tenant.limits.max_services ?? "∞"} servicios · 1 profesional
          </div>
        </Panel>

        <Panel className={`p-6 ${isPro ? "ring-2 ring-primary" : "bg-gradient-to-br from-primary/10 to-accent/10"}`}>
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl flex items-center gap-2"><Crown className="h-5 w-5 text-primary" /> PRO</h2>
            {isPro && <span className="text-xs rounded-full bg-primary text-primary-foreground px-3 py-1">Tu plan</span>}
          </div>
          <p className="mt-2 text-3xl font-serif">
            {formatMoney(2900, tenant.currency)} <span className="text-sm text-muted-foreground">/ mes</span>
          </p>
          <p className="text-sm text-muted-foreground mt-1">Automatiza, vende más y controla la rentabilidad.</p>
          <ul className="mt-6 space-y-2 text-sm">
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Todo lo del plan FREE, sin límites</li>
            {PRO_EXTRA.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" /> {FEATURE_LABELS[f]}
              </li>
            ))}
          </ul>
          {!isPro && (
            <button
              className={`${btnPrimary} mt-6 w-full`}
              onClick={() => toast.info("Te avisaremos en cuanto abramos los pagos del plan PRO 💜")}
            >
              Quiero el plan PRO
            </button>
          )}
        </Panel>
      </div>

      <Panel className="mt-6 p-6">
        <h2 className="font-serif text-lg">¿Necesitas ayuda?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Escríbenos y te acompañamos en la configuración de tu centro.
        </p>
        <a href="mailto:hola@elevasystem.agency" className={`${btnGhost} mt-4`}>Contactar soporte</a>
      </Panel>
    </div>
  );
}
