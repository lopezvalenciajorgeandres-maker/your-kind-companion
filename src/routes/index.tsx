import { createFileRoute, Link } from "@tanstack/react-router";
import { Target, TrendingUp, Users, DollarSign, Sparkles, ArrowRight, Heart, Check } from "lucide-react";
import { MarketingLayout } from "@/components/marketing-layout";
import logoUrl from "@/assets/eleva-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Eleva System — Elevamos tu marca, impulsamos tus resultados" },
      {
        name: "description",
        content:
          "Agencia de marketing digital especializada en spas, clínicas estéticas y salones de belleza. Más clientes, más reservas, más ventas — con una agenda gratuita incluida.",
      },
      { property: "og:title", content: "Eleva System — Elevamos tu marca, impulsamos tus resultados" },
      {
        property: "og:description",
        content: "Agencia de marketing digital especializada en spas, clínicas estéticas y salones de belleza. Más clientes, más reservas, más ventas — con una agenda gratuita incluida.",
      },
    ],
  }),
  component: Home,
});

const services = [
  { icon: Target, title: "Estrategia que impacta", desc: "Diseñamos el plan de marketing que tu negocio necesita para crecer con dirección." },
  { icon: TrendingUp, title: "Posicionamiento que destaca", desc: "Tu marca visible en Google, redes sociales y en la mente de tus clientes ideales." },
  { icon: Users, title: "Más clientes calificados", desc: "Atraemos a las personas correctas — las que sí reservan y regresan." },
  { icon: DollarSign, title: "Más reservas, más ventas", desc: "Convertimos interés en agenda llena y facturación real cada mes." },
];

function Home() {
  return (
    <MarketingLayout>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-lavender/30 via-cream to-cream" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-24 md:pt-24 md:pb-32 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur border border-border px-3 py-1 text-xs text-foreground/70">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Consultora de crecimiento para negocios de belleza
            </span>
            <h1 className="mt-6 text-4xl md:text-6xl font-serif leading-[1.05]">
              Elevamos tu marca,<br />
              impulsamos tus ventas <span className="text-primary italic">en 30 dias.</span>
            </h1>
            <p className="mt-6 text-lg text-foreground/70 max-w-lg">
              Marketing digital diseñado para clínicas estéticas, spas, salones de belleza y cirugía plástica.
              Estrategia, posicionamiento y una agenda gratuita para gestionar tus citas.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm font-medium hover:opacity-90 transition"
              >
                Prueba la agenda gratis <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/servicios"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-6 py-3 text-sm font-medium hover:bg-background transition"
              >
                Ver servicios
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-accent" /> Sin tarjeta</span>
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-accent" /> Registro con Google</span>
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-accent" /> 100% gratis</span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-lavender/40 to-sage/30 blur-3xl -z-10" />
            <div className="rounded-[2rem] bg-white shadow-xl border border-border/60 p-8 md:p-12 flex items-center justify-center">
              <img src={logoUrl} alt="Logo Eleva System" className="w-full max-w-sm" />
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-sm text-primary font-medium tracking-wide uppercase">Lo que hacemos</span>
          <h2 className="mt-2 text-3xl md:text-5xl font-serif">Todo lo que tu negocio necesita para crecer</h2>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((s) => (
            <div key={s.title} className="group rounded-2xl border border-border bg-card p-8 hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <div className="h-12 w-12 rounded-xl bg-lavender/40 flex items-center justify-center text-primary">
                <s.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-lg font-medium">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* METRICS */}
      <section className="bg-gradient-to-r from-lavender/30 via-cream to-sage/30 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 grid gap-8 sm:grid-cols-3 text-center">
          {[
            ["+180%", "Crecimiento promedio en reservas"],
            ["+50", "Marcas de belleza impulsadas"],
            ["4.9/5", "Satisfacción de nuestras clientas"],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="text-4xl md:text-5xl font-serif text-primary">{k}</div>
              <div className="mt-2 text-sm text-foreground/70">{v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-sm text-primary font-medium tracking-wide uppercase">Lo que dicen de nosotras</span>
          <h2 className="mt-2 text-3xl md:text-5xl font-serif">Historias que transforman</h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            { q: "En 3 meses duplicamos las reservas y por fin tenemos una agenda organizada.", a: "Lucía R.", r: "Spa Aurora" },
            { q: "Nos ayudaron a posicionar la clínica en Google y ahora llegan pacientes cada día.", a: "Dra. Marina S.", r: "Clínica Estética Bella" },
            { q: "La estrategia y la plataforma de agenda cambiaron nuestro salón por completo.", a: "Camila O.", r: "Belle Salón" },
          ].map((t) => (
            <blockquote key={t.a} className="rounded-2xl border border-border bg-card p-8">
              <Heart className="h-5 w-5 text-primary mb-3" />
              <p className="text-foreground/80 leading-relaxed">"{t.q}"</p>
              <footer className="mt-6 text-sm">
                <div className="font-medium">{t.a}</div>
                <div className="text-muted-foreground">{t.r}</div>
              </footer>
            </blockquote>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="rounded-[2rem] bg-gradient-to-br from-primary to-lavender text-primary-foreground p-10 md:p-16 text-center">
          <h2 className="text-3xl md:text-5xl font-serif">Comienza a agendar tus citas hoy</h2>
          <p className="mt-4 text-primary-foreground/90 max-w-xl mx-auto">
            Regístrate gratis con tu cuenta de Google y accede a nuestro sistema de agendamiento diseñado para spas y clínicas estéticas.
          </p>
          <Link
            to="/auth"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-white text-primary px-8 py-3 text-sm font-medium hover:bg-white/90 transition"
          >
            Crear cuenta gratis <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </MarketingLayout>
  );
}
