import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing-layout";
import { useState } from "react";
import { Mail, Phone, MapPin, Send } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/contacto")({
  head: () => ({
    meta: [
      { title: "Contacto — Eleva System" },
      { name: "description", content: "Hablemos de tu spa, clínica o salón de belleza. Agenda una consultoría gratuita con Eleva System." },
      { property: "og:title", content: "Contacto — Eleva System" },
      { property: "og:description", content: "Agenda una consultoría gratuita con nuestro equipo." },
    ],
  }),
  component: Contacto,
});

const schema = z.object({
  name: z.string().trim().min(2, "Ingresa tu nombre").max(100),
  email: z.string().trim().email("Email inválido").max(255),
  phone: z.string().trim().min(6, "Teléfono inválido").max(30),
  message: z.string().trim().min(10, "Cuéntanos un poco más").max(1000),
});

function Contacto() {
  const [loading, setLoading] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    setTimeout(() => {
      toast.success("¡Gracias! Te contactaremos en menos de 24 horas.");
      (e.target as HTMLFormElement).reset();
      setLoading(false);
    }, 600);
  }

  return (
    <MarketingLayout>
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-16 pb-24 grid md:grid-cols-2 gap-12">
        <div>
          <span className="text-sm text-primary font-medium tracking-wide uppercase">Contacto</span>
          <h1 className="mt-2 text-4xl md:text-5xl font-serif">Hablemos de tu negocio</h1>
          <p className="mt-4 text-foreground/70">
            Cuéntanos sobre tu spa, clínica o salón y agenda una consultoría gratuita con nuestro equipo.
          </p>
          <div className="mt-8 space-y-4 text-sm">
            <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-primary" /> hola@elevasystem.agency</div>
            <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-primary" /> +1 (555) 000-0000</div>
            <div className="flex items-center gap-3"><MapPin className="h-4 w-4 text-primary" /> Trabajamos remoto para toda LATAM</div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="rounded-2xl bg-card border border-border p-8 space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground/70">Nombre</label>
            <input name="name" required maxLength={100} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-foreground/70">Email</label>
              <input name="email" type="email" required maxLength={255} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground/70">Teléfono</label>
              <input name="phone" required maxLength={30} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground/70">Cuéntanos sobre tu negocio</label>
            <textarea name="message" required rows={5} maxLength={1000} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <button disabled={loading} className="w-full inline-flex justify-center items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition">
            {loading ? "Enviando..." : (<><Send className="h-4 w-4" /> Enviar mensaje</>)}
          </button>
        </form>
      </section>
    </MarketingLayout>
  );
}
