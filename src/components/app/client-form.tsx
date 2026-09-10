import { useState } from "react";
import { useTenant } from "@/lib/use-tenant";
import { CLIENT_SOURCES } from "@/lib/plan";
import { Field, btnGhost, btnPrimary, inputClass } from "@/components/app/kit";
import { WhatsAppMenu, birthdayMessage } from "@/components/app/whatsapp-menu";
import { COUNTRY_CODES, joinPhone, splitPhone } from "@/lib/country-codes";

export type ClientPayload = {
  full_name: string;
  last_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  birthdate: string | null;
  gender: string | null;
  address: string | null;
  source: string | null;
  notes: string | null;
};

export function calcAge(birthdate?: string | null) {
  if (!birthdate) return null;
  const d = new Date(birthdate);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

export function daysToBirthday(birthdate?: string | null) {
  if (!birthdate) return null;
  const d = new Date(birthdate);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (next < today) next.setFullYear(next.getFullYear() + 1);
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

export function ClientForm({
  client,
  onCancel,
  onSave,
  submitLabel = "Guardar",
}: {
  client?: Partial<ClientPayload> | null;
  onCancel: () => void;
  onSave: (payload: ClientPayload) => void;
  submitLabel?: string;
}) {
  const tenant = useTenant();
  const initial = splitPhone(client?.whatsapp || client?.phone);
  const [dial, setDial] = useState(initial.code);
  const [local, setLocal] = useState(initial.number);
  const [form, setForm] = useState<ClientPayload>({
    full_name: client?.full_name ?? "",
    last_name: client?.last_name ?? "",
    phone: client?.phone ?? "",
    whatsapp: client?.whatsapp ?? "",
    email: client?.email ?? "",
    birthdate: client?.birthdate ?? "",
    gender: client?.gender ?? "",
    address: client?.address ?? "",
    source: client?.source ?? "",
    notes: client?.notes ?? "",
  });
  const set =
    (k: keyof ClientPayload) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const age = calcAge(form.birthdate);
  const days = daysToBirthday(form.birthdate);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.full_name.trim()) return;
        const wa = joinPhone(dial, local);
        const clean = Object.fromEntries(
          Object.entries(form).map(([k, v]) => [k, typeof v === "string" && v.trim() === "" ? null : v]),
        ) as ClientPayload;
        onSave({ ...clean, full_name: form.full_name.trim(), whatsapp: wa, phone: wa });
      }}
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Nombre *"><input required className={inputClass} value={form.full_name} onChange={set("full_name")} /></Field>
        <Field label="Apellidos"><input className={inputClass} value={form.last_name ?? ""} onChange={set("last_name")} /></Field>
        <div className="sm:col-span-2"><Field label="Celular / WhatsApp">
          <div className="grid grid-cols-[9rem_1fr] gap-2">
            <select className={inputClass} value={dial} onChange={(e) => setDial(e.target.value)}>
              {COUNTRY_CODES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
            <input
              className={`${inputClass} w-full`}
              inputMode="numeric"
              maxLength={15}
              value={local}
              onChange={(e) => setLocal(e.target.value.replace(/\D/g, ""))}
              placeholder="3001234567"
            />
          </div>
        </Field></div>
        <Field label="Email"><input type="email" className={inputClass} value={form.email ?? ""} onChange={set("email")} /></Field>
        <Field label="Fecha de nacimiento"><input type="date" className={inputClass} value={form.birthdate ?? ""} onChange={set("birthdate")} /></Field>
        <Field label="Edad (automática)">
          <div className="flex items-center gap-2">
            <input readOnly className={`${inputClass} bg-secondary/60`} value={age === null ? "—" : `${age} años`} />
            <WhatsAppMenu
              compact
              phone={joinPhone(dial, local)}
              message={birthdayMessage({
                clientName: form.full_name || client?.full_name || "",
                businessName: tenant.business?.name ?? "nuestro centro",
              })}
            />
          </div>
          {days !== null && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {days === 0 ? "🎂 ¡Hoy es su cumpleaños!" : `Cumple en ${days} día${days === 1 ? "" : "s"}`}
            </p>
          )}
        </Field>
        <Field label="Género">
          <select className={inputClass} value={form.gender ?? ""} onChange={set("gender")}>
            <option value="">Sin especificar</option>
            <option>Femenino</option>
            <option>Masculino</option>
            <option>Otro</option>
          </select>
        </Field>
        <Field label="Cómo nos conoció">
          <select className={inputClass} value={form.source ?? ""} onChange={set("source")}>
            <option value="">Sin especificar</option>
            {CLIENT_SOURCES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Dirección"><input className={inputClass} value={form.address ?? ""} onChange={set("address")} /></Field>
      <Field label="Notas / observaciones">
        <textarea rows={3} className={inputClass} value={form.notes ?? ""} onChange={set("notes")} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={btnGhost} onClick={onCancel}>Cancelar</button>
        <button type="submit" className={btnPrimary}>{submitLabel}</button>
      </div>
    </form>
  );
}
