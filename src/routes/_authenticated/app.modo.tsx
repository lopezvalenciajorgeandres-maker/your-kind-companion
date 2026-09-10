import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Calendar, Users, Sparkles, Wallet, UserCog, BarChart3, Crown, Check, LayoutDashboard } from "lucide-react";
import { setMode } from "@/lib/mode";

export const Route = createFileRoute("/_authenticated/app/modo")({
  head: () => ({
    meta: [
      { title: "Elige tu versión — Eleva System" },
      { name: "description", content: "Elige entre la versión FREE y la versión PRO de Eleva System para gestionar tu centro de estética." },
      { property: "og:title", content: "Elige tu versión — Eleva System" },
      { property: "og:description", content: "Accede a la versión FREE o a la versión PRO de Eleva System." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModeChooser,
});

function ModeChooser() {
  const navigate = useNavigate();

  function choose(mode: "free" | "pro") {
    setMode(mode);
    navigate({ to: "/app", replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="font-serif text-3xl md:text-4xl text-center">¿Con qué versión quieres entrar?</h1>
      <p className="text-muted-foreground mt-2 text-center text-sm">Puedes cambiar de versión cuando quieras.</p>

      <div className="mt-10 grid gap-6 md:grid-cols-2 w-full max-w-3xl">
        <button
          onClick={() => choose("free")}
          className="text-left rounded-2xl border border-border bg-card p-6 hover:border-primary hover:shadow-lg transition"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="font-serif text-2xl">Versión FREE</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-2">Lo esencial para tu día a día.</p>
          <ul className="mt-5 space-y-2 text-sm">
            <Item icon={LayoutDashboard} text="Panel: citas de hoy, próx. 7 días y clientes" />
            <Item icon={Calendar} text="Agenda" />
            <Item icon={Users} text="Clientes" />
            <Item icon={Sparkles} text="Servicios" />
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">Sin ingresos del mes ni panel financiero.</p>
          <span className="mt-6 inline-flex w-full items-center justify-center rounded-full border border-border px-4 py-2.5 text-sm font-medium">
            Entrar en FREE
          </span>
        </button>

        <button
          onClick={() => choose("pro")}
          className="text-left rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-accent/10 p-6 hover:border-primary hover:shadow-lg transition"
        >
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            <h2 className="font-serif text-2xl">Versión PRO</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-2">Todo el negocio bajo control.</p>
          <ul className="mt-5 space-y-2 text-sm">
            <Item icon={Check} text="Todo lo de la versión FREE" />
            <Item icon={Wallet} text="Pagos e ingresos" />
            <Item icon={UserCog} text="Profesionales" />
            <Item icon={BarChart3} text="Reportes y dashboard completo" />
            <Item icon={Crown} text="Plan y ajustes" />
          </ul>
          <span className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium">
            Entrar en PRO
          </span>
        </button>
      </div>
    </div>
  );
}

function Item({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <li className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <span>{text}</span>
    </li>
  );
}
