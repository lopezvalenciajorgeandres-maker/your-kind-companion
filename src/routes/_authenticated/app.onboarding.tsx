import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { createMyBusiness, setOnboardingStep, updateMyBusiness, upsertMyProfile } from "@/lib/business.functions";
import { createService } from "@/lib/services.functions";
import { saveHours } from "@/lib/schedule.functions";
import { useTenant } from "@/lib/use-tenant";
import { BUSINESS_TYPES } from "@/lib/plan";
import { Field, Panel, btnGhost, btnPrimary, inputClass } from "@/components/app/kit";
import { Check } from "lucide-react";
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE, joinPhone } from "@/lib/country-codes";

export const Route = createFileRoute("/_authenticated/app/onboarding")({ component: Onboarding });

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const STEPS = ["Tu negocio", "Contacto", "Servicios", "Horario", "Listo"];

type Hour = { weekday: number; open_time: string; close_time: string; closed: boolean; break_start: null; break_end: null };

const DEFAULT_HOURS: Hour[] = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
  weekday: d,
  open_time: d === 0 ? "10:00" : "09:00",
  close_time: d === 6 ? "14:00" : "19:00",
  closed: d === 0,
  break_start: null,
  break_end: null,
}));

function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const tenant = useTenant();

  const create = useServerFn(createMyBusiness);
  const update = useServerFn(updateMyBusiness);
  const step = useServerFn(setOnboardingStep);
  const saveProfile = useServerFn(upsertMyProfile);
  const addService = useServerFn(createService);
  const persistHours = useServerFn(saveHours);

  const [current, setCurrent] = useState(0);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState<string>(BUSINESS_TYPES[0]);
  const [description, setDescription] = useState("");
  const [ownerName, setOwnerName] = useState("");

  const [phone, setPhone] = useState("");
  const [waDial, setWaDial] = useState(DEFAULT_COUNTRY_CODE);
  const [waLocal, setWaLocal] = useState("");
  const whatsapp = joinPhone(waDial, waLocal);
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [instagram, setInstagram] = useState("");
  const [website, setWebsite] = useState("");
  const [currency, setCurrency] = useState("COP");

  const [services, setServices] = useState([{ name: "", sessions: 1 }]);
  const [hours, setHours] = useState<Hour[]>(DEFAULT_HOURS);

  async function next() {
    setSaving(true);
    try {
      if (current === 0) {
        if (!name.trim()) throw new Error("Escribe el nombre de tu negocio");
        await create({ data: { name: name.trim(), business_type: type, description: description || null, currency } });
        if (ownerName.trim()) {
          const [first, ...rest] = ownerName.trim().split(" ");
          await saveProfile({ data: { first_name: first, last_name: rest.join(" ") || null } });
        }
        await step({ data: { step: 1 } });
        qc.invalidateQueries({ queryKey: ["tenant"] });
      }
      if (current === 1) {
        await update({
          data: {
            phone: phone || null,
            whatsapp: whatsapp || null,
            city: city || null,
            address: address || null,
            instagram: instagram || null,
            website: website || null,
            currency,
          },
        });
        await step({ data: { step: 2 } });
      }
      if (current === 2) {
        for (const s of services) {
          if (!s.name.trim()) continue;
          await addService({
            data: {
              name: s.name.trim(),
              duration_min: 60,
              price_cents: 0,
              color: "#CDB4DB",
              description: null,
              active: true,
            },
          });
        }
        await step({ data: { step: 3 } });
      }
      if (current === 3) {
        await persistHours({ data: { hours } });
        await step({ data: { step: 4 } });
      }
      if (current === 4) {
        await step({ data: { step: 5, onboarded: true } });
        await qc.invalidateQueries();
        toast.success("¡Todo listo! Bienvenida a ELEVA SYSTEM");
        navigate({ to: "/app", replace: true });
        return;
      }
      setCurrent((c) => c + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen p-6 md:p-12 flex justify-center">
      <div className="w-full max-w-2xl">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Configuración inicial</p>
          <h1 className="font-serif text-3xl md:text-4xl mt-2">Pongamos en marcha tu negocio</h1>
          <p className="text-muted-foreground text-sm mt-2">Sólo toma un par de minutos. Podrás cambiarlo todo después.</p>
        </div>

        <div className="mt-8 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= current ? "bg-primary" : "bg-border"}`} />
              <div className={`mt-2 text-[10px] ${i === current ? "text-foreground" : "text-muted-foreground"}`}>{s}</div>
            </div>
          ))}
        </div>

        <Panel className="mt-6 p-6 space-y-4">
          {current === 0 && (
            <>
              <Field label="Nombre del negocio">
                <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Bella Spa" />
              </Field>
              <Field label="Tipo de negocio">
                <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Tu nombre">
                <input className={inputClass} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="María López" />
              </Field>
              <Field label="Descripción breve">
                <textarea className={inputClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tratamientos faciales y corporales personalizados." />
              </Field>
            </>
          )}

          {current === 1 && (
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Teléfono"><input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
              <Field label="Celular / WhatsApp">
                <div className="grid grid-cols-[9rem_1fr] gap-2">
                  <select className={inputClass} value={waDial} onChange={(e) => setWaDial(e.target.value)}>
                    {COUNTRY_CODES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    maxLength={15}
                    value={waLocal}
                    onChange={(e) => setWaLocal(e.target.value.replace(/\D/g, ""))}
                    placeholder="3001234567"
                  />
                </div>
              </Field>
              <Field label="Ciudad"><input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} /></Field>
              <Field label="Moneda">
                <select className={inputClass} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {["EUR", "USD", "MXN", "COP", "ARS", "CLP", "PEN"].map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Dirección"><input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
              </div>
              <Field label="Instagram"><input className={inputClass} value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@tunegocio" /></Field>
              <Field label="Sitio web"><input className={inputClass} value={website} onChange={(e) => setWebsite(e.target.value)} /></Field>
            </div>
          )}

          {current === 2 && (
            <>
              <p className="text-sm text-muted-foreground">Añade tus servicios principales. Podrás crear más después.</p>
              {services.map((s, i) => (
                <input key={i} className={inputClass} value={s.name} onChange={(e) => setServices((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Limpieza facial" />
              ))}
              <button type="button" className={btnGhost} onClick={() => setServices((p) => [...p, { name: "", sessions: 1 }])}>
                Añadir otro servicio
              </button>
            </>
          )}

          {current === 3 && (
            <div className="space-y-2">
              {hours.map((h, i) => (
                <div key={h.weekday} className="flex items-center gap-2 text-sm">
                  <span className="w-24 text-muted-foreground">{DAYS[h.weekday]}</span>
                  <input type="checkbox" checked={!h.closed} onChange={(e) => setHours((p) => p.map((x, j) => (j === i ? { ...x, closed: !e.target.checked } : x)))} />
                  <input type="time" disabled={h.closed} className={`${inputClass} w-28`} value={h.open_time} onChange={(e) => setHours((p) => p.map((x, j) => (j === i ? { ...x, open_time: e.target.value } : x)))} />
                  <span className="text-muted-foreground">a</span>
                  <input type="time" disabled={h.closed} className={`${inputClass} w-28`} value={h.close_time} onChange={(e) => setHours((p) => p.map((x, j) => (j === i ? { ...x, close_time: e.target.value } : x)))} />
                </div>
              ))}
            </div>
          )}

          {current === 4 && (
            <div className="text-center py-6">
              <div className="mx-auto h-14 w-14 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                <Check className="h-6 w-6" />
              </div>
              <h2 className="mt-4 font-serif text-2xl">Todo listo, {name || "bienvenida"}</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Tu página pública de reservas estará en{" "}
                <span className="text-primary">/booking/{tenant.business?.slug ?? "tu-negocio"}</span>
              </p>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between">
            <button type="button" className={btnGhost} disabled={current === 0 || saving} onClick={() => setCurrent((c) => c - 1)}>
              Atrás
            </button>
            <button type="button" className={btnPrimary} disabled={saving} onClick={next}>
              {saving ? "Guardando..." : current === 4 ? "Entrar al panel" : "Continuar"}
            </button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
