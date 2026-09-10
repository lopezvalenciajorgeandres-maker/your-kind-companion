import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing-layout";
import { Check } from "lucide-react";

export const Route = createFileRoute("/precios")({
  head: () => ({
    meta: [
      { title: "Planes — Eleva System" },
      { name: "description", content: "Planes de marketing digital para spas, clínicas estéticas y salones de belleza. Empieza gratis con nuestra plataforma de agenda." },
      { property: "og:title", content: "Planes y precios — Eleva System" },
      { property: "og:description", content: "Elige el plan que mejor se adapta a tu negocio de belleza." },
    ],
  }),
  component: Precios,
});

const plans = [
  {
    name: "Agenda FREE",
    price: "Gratis",
    tagline: "Lo esencial para tu día a día",
    features: [
      "Panel: citas de hoy, próximos 7 días y clientes",
      "Agenda con vista semanal y arrastrar para reprogramar",
      "Gestión de clientes",
      "Catálogo de servicios",
      "Recordatorios por WhatsApp manual",
    ],
    cta: "Empezar gratis",
    ctaTo: "/auth",
    highlight: false,
  },
  {
    name: "Agenda PRO",
    price: "A medida",
    tagline: "Todo el negocio bajo control",
    features: [
      "Todo lo de Agenda FREE, sin límites",
      "Pagos e ingresos del mes",
      "Gestión de profesionales",
      "Reportes y dashboard completo",
      "Plan y ajustes avanzados",
    ],
    cta: "Quiero el plan PRO",
    ctaTo: "/contacto",
    highlight: true,
  },
];

function Precios() {
  return (
    <MarketingLayout>
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-8 text-center">
        <span className="text-sm text-primary font-medium tracking-wide uppercase">Planes</span>
        <h1 className="mt-2 text-4xl md:text-6xl font-serif">Un plan para cada etapa</h1>
        <p className="mt-4 text-lg text-foreground/70 max-w-2xl mx-auto">
          Dos versiones de nuestro sistema de agendamiento: empieza gratis y pasa a PRO cuando lo necesites.
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pb-24 grid gap-6 md:grid-cols-2">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`rounded-2xl border p-7 flex flex-col ${
              p.highlight
                ? "border-primary bg-gradient-to-br from-lavender/40 to-white shadow-lg scale-[1.02]"
                : "border-border bg-card"
            }`}
          >
            {p.highlight && (
              <span className="self-start text-xs px-2 py-1 rounded-full bg-primary text-primary-foreground">
                Más popular
              </span>
            )}
            <h3 className="mt-3 font-serif text-2xl">{p.name}</h3>
            <p className="text-sm text-muted-foreground">{p.tagline}</p>
            <div className="mt-4 text-3xl font-serif">{p.price}</div>
            <ul className="mt-6 space-y-2.5 text-sm flex-1">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <span className="text-foreground/80">{f}</span>
                </li>
              ))}
            </ul>
            <Link
              to={p.ctaTo}
              className={`mt-8 inline-flex justify-center items-center rounded-full px-5 py-2.5 text-sm font-medium transition ${
                p.highlight
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "border border-border hover:bg-secondary"
              }`}
            >
              {p.cta}
            </Link>
          </div>
        ))}
      </section>
    </MarketingLayout>
  );
}
