import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing-layout";
import { Instagram, Search, Megaphone, Camera, Mail, LineChart, Palette, Globe } from "lucide-react";

export const Route = createFileRoute("/servicios")({
  head: () => ({
    meta: [
      { title: "Servicios — Marketing digital para spas y clínicas | Eleva System" },
      { name: "description", content: "Estrategia digital, redes sociales, SEO local, campañas de anuncios, branding y contenido para spas, clínicas estéticas y salones de belleza." },
      { property: "og:title", content: "Servicios de marketing para negocios de belleza" },
      { property: "og:description", content: "Todo lo que necesitas para llenar tu agenda: redes, SEO local, anuncios y branding." },
    ],
  }),
  component: Servicios,
});

const items = [
  { icon: Instagram, title: "Gestión de redes sociales", desc: "Contenido pensado para el mundo de la belleza. Instagram, TikTok y Facebook con constancia y estrategia." },
  { icon: Megaphone, title: "Campañas de anuncios", desc: "Meta Ads y Google Ads optimizados para llenar tu agenda de clientes calificados." },
  { icon: Search, title: "SEO local", desc: "Aparece primero cuando busquen 'spa cerca de mí' o 'clínica estética en tu ciudad'." },
  { icon: Camera, title: "Producción de contenido", desc: "Fotografía y video profesional que refleja el alma y la calidad de tu marca." },
  { icon: Palette, title: "Branding e identidad", desc: "Logo, paleta y guías de marca coherentes con tu propuesta y tu público." },
  { icon: Globe, title: "Sitios web y landing pages", desc: "Diseño profesional que convierte visitas en citas agendadas." },
  { icon: Mail, title: "Email y WhatsApp marketing", desc: "Recordatorios, promociones y automatizaciones para que tus clientas vuelvan." },
  { icon: LineChart, title: "Reportes y analítica", desc: "Métricas claras cada mes para saber exactamente qué está funcionando." },
];

function Servicios() {
  return (
    <MarketingLayout>
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-10">
        <span className="text-sm text-primary font-medium tracking-wide uppercase">Servicios</span>
        <h1 className="mt-2 text-4xl md:text-6xl font-serif max-w-3xl">Marketing hecho para el mundo de la belleza</h1>
        <p className="mt-4 text-lg text-foreground/70 max-w-2xl">
          Combinamos estrategia, estética y datos para hacer crecer clínicas estéticas, spas, salones de belleza y consultorios de cirugía plástica.
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((i) => (
          <div key={i.title} className="rounded-2xl border border-border bg-card p-7 hover:shadow-lg transition-shadow">
            <div className="h-11 w-11 rounded-xl bg-lavender/40 flex items-center justify-center text-primary">
              <i.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-5 font-medium">{i.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{i.desc}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-24 text-center">
        <h2 className="text-3xl md:text-4xl font-serif">¿Quieres ver cómo lo aplicaríamos a tu negocio?</h2>
        <Link to="/contacto" className="mt-6 inline-flex rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm font-medium hover:opacity-90 transition">
          Agenda una consultoría
        </Link>
      </section>
    </MarketingLayout>
  );
}
