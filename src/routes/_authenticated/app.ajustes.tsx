import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { updateMyBusiness } from "@/lib/business.functions";
import { createBlock, deleteBlock, listHours, saveHours } from "@/lib/schedule.functions";
import { createBackup, listBackups } from "@/lib/export.functions";
import { useTenant } from "@/lib/use-tenant";
import { BUSINESS_TYPES } from "@/lib/plan";
import { downloadJson } from "@/lib/download";
import { Field, PageHeader, Panel, btnGhost, btnPrimary, inputClass } from "@/components/app/kit";
import { Copy, Database, Trash2 } from "lucide-react";
import { ImportButton } from "@/components/app/import-button";
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE, joinPhone, splitPhone } from "@/lib/country-codes";

export const Route = createFileRoute("/_authenticated/app/ajustes")({ component: Settings });

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const TABS = ["Negocio", "Horarios", "Reservas", "Datos"] as const;

type Hour = { weekday: number; open_time: string; close_time: string; break_start: string | null; break_end: string | null; closed: boolean };

function Settings() {
  const qc = useQueryClient();
  const tenant = useTenant();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Negocio");

  return (
    <div className="p-5 md:p-10 max-w-4xl">
      <PageHeader title="Ajustes" subtitle="Configura tu negocio, horarios y datos." />

      <div className="mt-6 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm whitespace-nowrap ${tab === t ? "bg-primary text-primary-foreground" : "hover:bg-secondary border border-border"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-6">
        {tab === "Negocio" && <BusinessTab key={tenant.business?.id ?? "none"} qc={qc} />}
        {tab === "Horarios" && <HoursTab />}
        {tab === "Reservas" && <BookingTab />}
        {tab === "Datos" && <DataTab />}
      </div>
    </div>
  );
}

function BusinessTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const tenant = useTenant();
  const update = useServerFn(updateMyBusiness);
  const b = tenant.business;
  const [form, setForm] = useState({
    name: "", business_type: BUSINESS_TYPES[0] as string, description: "", phone: "", whatsapp: "",
    address: "", city: "", country: "", instagram: "", website: "", currency: "COP", logo_url: "",
  });
  const [waDial, setWaDial] = useState(DEFAULT_COUNTRY_CODE);
  const [waLocal, setWaLocal] = useState("");

  useEffect(() => {
    if (!b) return;
    setForm({
      name: b.name ?? "", business_type: b.business_type ?? "Otro", description: b.description ?? "",
      phone: b.phone ?? "", whatsapp: b.whatsapp ?? "", address: b.address ?? "", city: b.city ?? "",
      country: b.country ?? "", instagram: b.instagram ?? "", website: b.website ?? "",
      currency: b.currency ?? "COP", logo_url: b.logo_url ?? "",
    });
    const parts = splitPhone(b.whatsapp ?? b.phone);
    setWaDial(parts.code);
    setWaLocal(parts.number);
  }, [b]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Panel className="p-6">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const wa = joinPhone(waDial, waLocal);
            await update({ data: { ...form, whatsapp: wa ?? "", description: form.description || null } });
            qc.invalidateQueries({ queryKey: ["tenant"] });
            toast.success("Datos guardados");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error");
          }
        }}
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Nombre del negocio"><input className={inputClass} value={form.name} onChange={set("name")} /></Field>
          <Field label="Tipo">
            <select className={inputClass} value={form.business_type} onChange={set("business_type")}>
              {BUSINESS_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Teléfono"><input className={inputClass} value={form.phone} onChange={set("phone")} /></Field>
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
          <Field label="Ciudad"><input className={inputClass} value={form.city} onChange={set("city")} /></Field>
          <Field label="País"><input className={inputClass} value={form.country} onChange={set("country")} /></Field>
          <Field label="Instagram"><input className={inputClass} value={form.instagram} onChange={set("instagram")} /></Field>
          <Field label="Sitio web"><input className={inputClass} value={form.website} onChange={set("website")} /></Field>
          <Field label="Moneda">
            <select className={inputClass} value={form.currency} onChange={set("currency")}>
              {["EUR", "USD", "MXN", "COP", "ARS", "CLP", "PEN"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="URL del logo"><input className={inputClass} value={form.logo_url} onChange={set("logo_url")} /></Field>
        </div>
        <Field label="Dirección"><input className={inputClass} value={form.address} onChange={set("address")} /></Field>
        <Field label="Descripción"><textarea rows={3} className={inputClass} value={form.description} onChange={set("description")} /></Field>
        <div className="flex justify-end"><button className={btnPrimary}>Guardar cambios</button></div>
      </form>
    </Panel>
  );
}

function HoursTab() {
  const qc = useQueryClient();
  const list = useServerFn(listHours);
  const save = useServerFn(saveHours);
  const addBlock = useServerFn(createBlock);
  const removeBlock = useServerFn(deleteBlock);

  const { data } = useQuery({ queryKey: ["hours"], queryFn: () => list() });
  const [hours, setHours] = useState<Hour[]>([]);
  const [blockFrom, setBlockFrom] = useState("");
  const [blockTo, setBlockTo] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!data) return;
    const byDay = new Map(data.hours.map((h) => [h.weekday, h]));
    setHours(
      [0, 1, 2, 3, 4, 5, 6].map((d) => {
        const h = byDay.get(d);
        return {
          weekday: d,
          open_time: (h?.open_time ?? "09:00").slice(0, 5),
          close_time: (h?.close_time ?? "19:00").slice(0, 5),
          break_start: h?.break_start ? h.break_start.slice(0, 5) : null,
          break_end: h?.break_end ? h.break_end.slice(0, 5) : null,
          closed: h?.closed ?? d === 0,
        };
      }),
    );
  }, [data]);

  return (
    <>
      <Panel className="p-6">
        <h2 className="font-serif text-lg">Horario de atención</h2>
        <div className="mt-4 space-y-2">
          {hours.map((h, i) => (
            <div key={h.weekday} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-24 text-muted-foreground">{DAYS[h.weekday]}</span>
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={!h.closed} onChange={(e) => setHours((p) => p.map((x, j) => (j === i ? { ...x, closed: !e.target.checked } : x)))} /> Abierto
              </label>
              <input type="time" disabled={h.closed} className={`${inputClass} w-28`} value={h.open_time} onChange={(e) => setHours((p) => p.map((x, j) => (j === i ? { ...x, open_time: e.target.value } : x)))} />
              <span className="text-muted-foreground">a</span>
              <input type="time" disabled={h.closed} className={`${inputClass} w-28`} value={h.close_time} onChange={(e) => setHours((p) => p.map((x, j) => (j === i ? { ...x, close_time: e.target.value } : x)))} />
              <span className="text-xs text-muted-foreground ml-2">Descanso</span>
              <input type="time" disabled={h.closed} className={`${inputClass} w-28`} value={h.break_start ?? ""} onChange={(e) => setHours((p) => p.map((x, j) => (j === i ? { ...x, break_start: e.target.value || null } : x)))} />
              <input type="time" disabled={h.closed} className={`${inputClass} w-28`} value={h.break_end ?? ""} onChange={(e) => setHours((p) => p.map((x, j) => (j === i ? { ...x, break_end: e.target.value || null } : x)))} />
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            className={btnPrimary}
            onClick={async () => {
              try {
                await save({ data: { hours } });
                qc.invalidateQueries({ queryKey: ["hours"] });
                toast.success("Horario guardado");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Error");
              }
            }}
          >
            Guardar horario
          </button>
        </div>
      </Panel>

      <Panel className="p-6">
        <h2 className="font-serif text-lg">Días bloqueados y vacaciones</h2>
        <div className="mt-4 grid sm:grid-cols-4 gap-3 items-end">
          <Field label="Desde"><input type="date" className={inputClass} value={blockFrom} onChange={(e) => setBlockFrom(e.target.value)} /></Field>
          <Field label="Hasta"><input type="date" className={inputClass} value={blockTo} onChange={(e) => setBlockTo(e.target.value)} /></Field>
          <Field label="Motivo"><input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Vacaciones" /></Field>
          <button
            className={btnGhost}
            onClick={async () => {
              if (!blockFrom || !blockTo) return toast.error("Elige las fechas");
              try {
                await addBlock({
                  data: {
                    starts_at: new Date(`${blockFrom}T00:00:00`).toISOString(),
                    ends_at: new Date(`${blockTo}T23:59:59`).toISOString(),
                    reason: reason || null,
                    kind: "bloqueo",
                  },
                });
                setBlockFrom(""); setBlockTo(""); setReason("");
                qc.invalidateQueries({ queryKey: ["hours"] });
                toast.success("Bloqueo creado");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Error");
              }
            }}
          >
            Bloquear
          </button>
        </div>
        <div className="mt-4 divide-y divide-border">
          {(data?.blocks ?? []).map((b) => (
            <div key={b.id} className="py-3 flex items-center justify-between text-sm">
              <div>
                <div className="font-medium">{b.reason ?? "Bloqueo"}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(b.starts_at).toLocaleDateString("es-ES")} — {new Date(b.ends_at).toLocaleDateString("es-ES")}
                </div>
              </div>
              <button
                className="p-2 rounded-lg hover:bg-secondary text-destructive"
                onClick={async () => {
                  await removeBlock({ data: { id: b.id } });
                  qc.invalidateQueries({ queryKey: ["hours"] });
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

function BookingTab() {
  const qc = useQueryClient();
  const tenant = useTenant();
  const update = useServerFn(updateMyBusiness);
  const slug = tenant.business?.slug;
  const url = typeof window !== "undefined" && slug ? `${window.location.origin}/booking/${slug}` : "";

  return (
    <Panel className="p-6 space-y-4">
      <h2 className="font-serif text-lg">Página pública de reservas</h2>
      <p className="text-sm text-muted-foreground">
        Comparte este enlace en Instagram, WhatsApp o tu web para que tus clientas reserven solas, 24/7.
      </p>
      <div className="flex gap-2">
        <input readOnly className={inputClass} value={url} />
        <button
          className={btnGhost}
          onClick={() => { navigator.clipboard.writeText(url); toast.success("Enlace copiado"); }}
        >
          <Copy className="h-4 w-4" /> Copiar
        </button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={tenant.business?.booking_enabled ?? true}
          onChange={async (e) => {
            try {
              await update({ data: { booking_enabled: e.target.checked } });
              qc.invalidateQueries({ queryKey: ["tenant"] });
              toast.success(e.target.checked ? "Reservas activadas" : "Reservas desactivadas");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Error");
            }
          }}
        />
        Aceptar reservas online
      </label>
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className={btnPrimary}>
          Ver mi página de reservas
        </a>
      )}
    </Panel>
  );
}

function DataTab() {
  const backup = useServerFn(createBackup);
  const list = useServerFn(listBackups);
  const { data, refetch } = useQuery({ queryKey: ["backups"], queryFn: () => list() });
  const [busy, setBusy] = useState(false);

  return (
    <Panel className="p-6">
      <h2 className="font-serif text-lg">Copias de seguridad</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Descarga una copia completa de tus clientes, citas, servicios y pagos. Guárdala donde prefieras (por ejemplo, tu Google Drive).
      </p>
      <button
        className={`${btnPrimary} mt-4`}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const res = await backup();
            downloadJson(res.payload, "eleva-backup");
            refetch();
            toast.success("Copia de seguridad descargada");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Database className="h-4 w-4" /> {busy ? "Generando..." : "Crear copia ahora"}
      </button>

      <div className="mt-6 divide-y divide-border">
        {(data ?? []).map((b) => (
          <div key={b.id} className="py-3 flex items-center justify-between text-sm">
            <span>{new Date(b.created_at).toLocaleString("es-ES")}</span>
            <span className="text-muted-foreground">{Math.round((b.size_bytes ?? 0) / 1024)} KB</span>
          </div>
        ))}
      </div>

      <div className="mt-8 border-t border-border pt-6">
        <h2 className="font-serif text-lg">Importar datos (CSV o Excel)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Sube un archivo .csv o .xlsx para restaurar o cargar tus datos. La primera fila debe tener los títulos de las
          columnas (por ejemplo: nombre, telefono, whatsapp, email para clientes).
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ImportButton entity="clients" label="Importar clientes" />
          <ImportButton entity="services" label="Importar servicios" />
          <ImportButton entity="professionals" label="Importar profesionales" />
        </div>
      </div>
    </Panel>
  );
}

