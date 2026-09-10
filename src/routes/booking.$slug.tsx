import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { createPublicBooking, getAvailability, getPublicBusiness } from "@/lib/booking.functions";
import type { PublicBusinessPayload } from "@/lib/booking.functions";
import { formatMoney } from "@/lib/plan";
import { Check, Clock, MapPin, Instagram, Phone, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/booking/$slug")({
  loader: async ({ params }) => {
    const data = await getPublicBusiness({ data: { slug: params.slug } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Reservas no disponibles" }, { name: "robots", content: "noindex" }] };
    }
    const title = `Reserva tu cita en ${loaderData.business.name}`;
    const description =
      loaderData.business.description?.slice(0, 150) ??
      `Reserva online tu cita en ${loaderData.business.name}. Elige servicio, día y hora en menos de un minuto.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: () => <Centered title="No pudimos cargar las reservas" body="Inténtalo de nuevo en unos minutos." />,
  notFoundComponent: () => <Centered title="Página no encontrada" body="Este negocio no acepta reservas online." />,
  component: BookingPage,
});

function Centered({ title, body }: { title: string; body: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <h1 className="font-serif text-2xl">{title}</h1>
        <p className="text-sm text-muted-foreground mt-2">{body}</p>
      </div>
    </div>
  );
}

const inputClass = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30";

function BookingPage() {
  const data = Route.useLoaderData() as PublicBusinessPayload;
  const availability = useServerFn(getAvailability);
  const book = useServerFn(createPublicBooking);

  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState<string>("");
  const [professionalId, setProfessionalId] = useState<string>("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [slot, setSlot] = useState<string>("");
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", notes: "" });
  const [done, setDone] = useState<{ starts_at: string; service: string } | null>(null);

  const service = data.services.find((s) => s.id === serviceId);

  const slots = useQuery({
    queryKey: ["slots", serviceId, professionalId, date],
    enabled: step === 1 && !!serviceId,
    staleTime: 0,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: () =>
      availability({
        data: { business_id: data.business.id, service_id: serviceId, professional_id: professionalId || null, date },
      }),
  });


  const mutation = useMutation({
    mutationFn: () =>
      book({
        data: {
          business_id: data.business.id,
          service_id: serviceId,
          professional_id: professionalId || null,
          starts_at: slot,
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          whatsapp: form.phone.trim(),
          email: form.email.trim() || null,
          notes: form.notes.trim() || null,
        },
      }),
    onSuccess: (res) => setDone({ starts_at: res.starts_at, service: res.service }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "No pudimos crear la reserva"),
  });

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center rounded-3xl border border-border bg-card p-8">
          <div className="mx-auto h-14 w-14 rounded-full bg-primary/15 text-primary flex items-center justify-center">
            <Check className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-serif text-2xl">¡Reserva enviada!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {done.service} ·{" "}
            {new Date(done.starts_at).toLocaleString("es-ES", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="mt-4 text-sm">
            {data.business.name} confirmará tu cita en breve
            {data.business.phone ? ` al ${data.business.phone}` : ""}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-to-br from-primary/20 to-accent/15">
        <div className="max-w-3xl mx-auto px-5 py-10">
          {data.business.logo_url && (
            <img src={data.business.logo_url} alt={data.business.name} className="h-16 w-16 rounded-full object-cover" />
          )}
          <h1 className="mt-4 font-serif text-3xl md:text-4xl">{data.business.name}</h1>
          {data.business.description && <p className="mt-2 text-sm text-foreground/70 max-w-xl">{data.business.description}</p>}
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-foreground/70">
            {data.business.address && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {data.business.address}</span>}
            {data.business.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {data.business.phone}</span>}
            {data.business.instagram && <span className="inline-flex items-center gap-1"><Instagram className="h-3 w-3" /> {data.business.instagram}</span>}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {["Servicio", "Fecha y hora", "Tus datos"].map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1 rounded-full ${i <= step ? "bg-primary" : "bg-border"}`} />
              <div className="mt-1">{s}</div>
            </div>
          ))}
        </div>

        {step === 0 && (
          <section className="mt-6 space-y-3">
            <h2 className="font-serif text-xl">Elige tu servicio</h2>
            {data.services.length === 0 && <p className="text-sm text-muted-foreground">Este negocio aún no publicó servicios.</p>}
            {data.services.map((s) => (
              <button
                key={s.id}
                onClick={() => { setServiceId(s.id); setStep(1); }}
                className={`w-full text-left rounded-2xl border p-4 transition hover:border-primary ${serviceId === s.id ? "border-primary" : "border-border"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{s.name}</div>
                    {s.description && <div className="text-xs text-muted-foreground truncate">{s.description}</div>}
                    <div className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {s.duration_min} min
                    </div>
                  </div>
                  <div className="font-serif text-lg whitespace-nowrap">{formatMoney(s.price_cents, data.business.currency)}</div>
                </div>
              </button>
            ))}
          </section>
        )}

        {step === 1 && (
          <section className="mt-6">
            <button onClick={() => setStep(0)} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <ArrowLeft className="h-4 w-4" /> Cambiar servicio
            </button>
            <h2 className="mt-3 font-serif text-xl">¿Qué día te viene bien?</h2>
            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              <input type="date" className={inputClass} value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => { setDate(e.target.value); setSlot(""); }} />
              {data.professionals.length > 0 && (
                <select className={inputClass} value={professionalId} onChange={(e) => { setProfessionalId(e.target.value); setSlot(""); }}>
                  <option value="">Cualquier profesional</option>
                  {data.professionals.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              )}
            </div>

            <div className="mt-6">
              {slots.isLoading && <p className="text-sm text-muted-foreground">Buscando horarios...</p>}
              {!slots.isLoading && (slots.data ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No hay horas libres ese día. Prueba con otra fecha.</p>
              )}
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {(slots.data ?? []).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSlot(s)}
                    className={`rounded-xl border px-2 py-2 text-sm ${slot === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary"}`}
                  >
                    {new Date(s).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                  </button>
                ))}
              </div>
            </div>

            <button
              disabled={!slot}
              onClick={() => setStep(2)}
              className="mt-6 w-full rounded-full bg-primary text-primary-foreground py-3 text-sm font-medium disabled:opacity-50"
            >
              Continuar
            </button>
          </section>
        )}

        {step === 2 && (
          <section className="mt-6">
            <button onClick={() => setStep(1)} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <ArrowLeft className="h-4 w-4" /> Cambiar hora
            </button>
            <h2 className="mt-3 font-serif text-xl">Tus datos</h2>
            <p className="text-sm text-muted-foreground">
              {service?.name} ·{" "}
              {slot && new Date(slot).toLocaleString("es-ES", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}
            </p>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.full_name.trim() || !form.phone.trim()) return;
                mutation.mutate();
              }}
            >
              <input required className={inputClass} placeholder="Nombre y apellidos" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
              <input required className={inputClass} placeholder="Teléfono / WhatsApp" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              <input type="email" className={inputClass} placeholder="Email (opcional)" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              <textarea rows={3} className={inputClass} placeholder="¿Algo que debamos saber?" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              <button disabled={mutation.isPending} className="w-full rounded-full bg-primary text-primary-foreground py-3 text-sm font-medium disabled:opacity-50">
                {mutation.isPending ? "Reservando..." : "Confirmar reserva"}
              </button>
            </form>
          </section>
        )}
      </main>

      <footer className="py-8 text-center text-xs text-muted-foreground">
        Reservas gestionadas con <span className="font-serif">ELEVA SYSTEM</span>
      </footer>
    </div>
  );
}
