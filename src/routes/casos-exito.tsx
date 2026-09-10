import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing-layout";
import { TrendingUp } from "lucide-react";

export const Route = createFileRoute("/casos-exito")({
  head: () => ({
    meta: [
      { title: "Casos de éxito — Resultados reales | Eleva System" },
      { name: "description", content: "Marcas de belleza que crecieron con Eleva System: más reservas, mejor posicionamiento y agenda llena." },
      { property: "og:title", content: "Casos de éxito — Eleva System" },
      { property: "og:description", content: "Historias reales de clínicas y spas que transformaron su negocio." },
    ],
  }),
  component: Casos,
});

const cases = [
  { name: "Spa Aurora", metric: "+220%", label: "en reservas mensuales", desc: "Rediseñamos su estrategia de contenidos y activamos campañas locales que triplicaron las citas.", tag: "Spa" },
  { name: "Clínica Estética Bella", metric: "+340%", label: "en pacientes nuevos", desc: "SEO local y branding que la posicionaron como referente en su ciudad.", tag: "Clínica" },
  { name: "Belle Salón", metric: "+150%", label: "en ventas cruzadas", desc: "Automatizaciones de WhatsApp y agenda organizada para maximizar cada cliente.", tag: "Salón" },
  { name: "Dr. Silva Cirugía Plástica", metric: "+180%", label: "en consultas agendadas", desc: "Contenido educativo y campañas segmentadas construyeron una autoridad clara.", tag: "Cirugía" },
];

function Casos() {
  return (
    <MarketingLayout>
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-10">
        <span className="text-sm text-primary font-medium tracking-wide uppercase">Casos de éxito</span>
        <h1 className="mt-2 text-4xl md:text-6xl font-serif max-w-3xl">Resultados que hablan por sí solos</h1>
        <p className="mt-4 text-lg text-foreground/70 max-w-2xl">
          Estas son algunas de las marcas de belleza que han crecido junto a nosotras.
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-24 grid gap-6 md:grid-cols-2">
        {cases.map((c) => (
          <div key={c.name} className="rounded-2xl border border-border bg-card p-8">
            <span className="text-xs px-2 py-1 rounded-full bg-sage/30 text-foreground/70">{c.tag}</span>
            <h3 className="mt-4 font-serif text-2xl">{c.name}</h3>
            <div className="mt-6 flex items-baseline gap-3">
              <div className="text-5xl font-serif text-primary">{c.metric}</div>
              <div className="text-sm text-muted-foreground">{c.label}</div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
            <div className="mt-6 flex items-center gap-2 text-xs text-accent-foreground/70">
              <TrendingUp className="h-4 w-4 text-accent" /> Crecimiento sostenido durante 6 meses
            </div>
          </div>
        ))}
      </section>
    </MarketingLayout>
  );
}
