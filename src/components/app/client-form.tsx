import { useState } from "react";
import { useTenant } from "@/lib/use-tenant";
import { CLIENT_SOURCES } from "@/lib/plan";
import { Field, btnGhost, btnPrimary, inputClass } from "@/components/app/kit";
import { WhatsAppMenu, birthdayMessage } from "@/components/app/whatsapp-menu";
import { COUNTRY_CODES, joinPhone, splitPhone } from "@/lib/country-codes";
import { COLOMBIA_DEPARTMENTS } from "@/lib/colombia";

export type ClientPayload = {
  full_name: string;
  last_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  birthdate: string | null;
  gender: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  source: string | null;
  notes: string | null;
  // Ficha técnica — datos personales
  document_id: string | null;
  blood_type: string | null;
  marital_status: string | null;
  health_insurance: string | null;
  landline: string | null;
  companion_name: string | null;
  companion_relationship: string | null;
  // Ficha técnica — antecedentes clínicos
  family_history: string | null;
  allergies: string | null;
  diseases: string | null;
  cancer: string | null;
  antidepressants: string | null;
  arrhythmia: string | null;
  pacemaker: string | null;
  fatty_liver: string | null;
  surgeries: string | null;
  hernias: string | null;
  stomach_mesh: string | null;
  implants: string | null;
  last_period: string | null;
  alcohol: string | null;
  smoking: string | null;
  medications: string | null;
  // Piel
  skin_biotype: string | null;
  skin_phototype: string | null;
};

export const BLOOD_TYPES = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
export const MARITAL_STATUS = ["Soltero(a)", "Casado(a)", "Unión libre", "Separado(a)", "Divorciado(a)", "Viudo(a)"];
export const SKIN_BIOTYPES = ["Seca", "Grasa", "Normal", "Mixta"];
export const SKIN_PHOTOTYPES = ["I", "II", "III", "IV", "V", "VI"];
/** Antecedentes de Sí/No, en el orden de la ficha en papel. */
const YES_NO_FIELDS: { key: keyof ClientPayload; label: string }[] = [
  { key: "cancer", label: "Cáncer" },
  { key: "antidepressants", label: "Antidepresivos" },
  { key: "arrhythmia", label: "Arritmia cardiaca" },
  { key: "pacemaker", label: "Marcapasos" },
  { key: "fatty_liver", label: "Hígado graso" },
  { key: "hernias", label: "Hernias" },
  { key: "stomach_mesh", label: "Mallas estomacales" },
  { key: "alcohol", label: "Ingiere bebidas alcohólicas" },
  { key: "smoking", label: "Fuma" },
];

/** Bloque plegable para no alargar demasiado el formulario. */
function FormSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="rounded-xl border border-border open:bg-secondary/20" open>
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
        {title}
        {hint && <span className="ml-2 font-normal text-xs text-muted-foreground">{hint}</span>}
      </summary>
      <div className="space-y-4 px-4 pb-4">{children}</div>
    </details>
  );
}

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
    city: client?.city ?? "",
    state: client?.state ?? "",
    source: client?.source ?? "",
    notes: client?.notes ?? "",
    document_id: client?.document_id ?? "",
    blood_type: client?.blood_type ?? "",
    marital_status: client?.marital_status ?? "",
    health_insurance: client?.health_insurance ?? "",
    landline: client?.landline ?? "",
    companion_name: client?.companion_name ?? "",
    companion_relationship: client?.companion_relationship ?? "",
    family_history: client?.family_history ?? "",
    allergies: client?.allergies ?? "",
    diseases: client?.diseases ?? "",
    cancer: client?.cancer ?? "",
    antidepressants: client?.antidepressants ?? "",
    arrhythmia: client?.arrhythmia ?? "",
    pacemaker: client?.pacemaker ?? "",
    fatty_liver: client?.fatty_liver ?? "",
    surgeries: client?.surgeries ?? "",
    hernias: client?.hernias ?? "",
    stomach_mesh: client?.stomach_mesh ?? "",
    implants: client?.implants ?? "",
    last_period: client?.last_period ?? "",
    alcohol: client?.alcohol ?? "",
    smoking: client?.smoking ?? "",
    medications: client?.medications ?? "",
    skin_biotype: client?.skin_biotype ?? "",
    skin_phototype: client?.skin_phototype ?? "",
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
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Departamento">
          <select className={inputClass} value={form.state ?? ""} onChange={set("state")}>
            <option value="">Sin especificar</option>
            {COLOMBIA_DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Municipio de residencia">
          <input className={inputClass} value={form.city ?? ""} onChange={set("city")} placeholder="Ej. Cartago" />
        </Field>
      </div>
      <Field label="Dirección"><input className={inputClass} value={form.address ?? ""} onChange={set("address")} /></Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Cédula / documento">
          <input className={inputClass} value={form.document_id ?? ""} onChange={set("document_id")} />
        </Field>
        <Field label="RH / grupo sanguíneo">
          <select className={inputClass} value={form.blood_type ?? ""} onChange={set("blood_type")}>
            <option value="">Sin especificar</option>
            {BLOOD_TYPES.map((b) => <option key={b}>{b}</option>)}
          </select>
        </Field>
        <Field label="Estado civil">
          <select className={inputClass} value={form.marital_status ?? ""} onChange={set("marital_status")}>
            <option value="">Sin especificar</option>
            {MARITAL_STATUS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="EPS / seguro médico">
          <input className={inputClass} value={form.health_insurance ?? ""} onChange={set("health_insurance")} />
        </Field>
        <Field label="Teléfono fijo">
          <input className={inputClass} inputMode="tel" value={form.landline ?? ""} onChange={set("landline")} />
        </Field>
        <div />
        <Field label="Acompañante">
          <input className={inputClass} value={form.companion_name ?? ""} onChange={set("companion_name")} />
        </Field>
        <Field label="Parentesco del acompañante">
          <input className={inputClass} value={form.companion_relationship ?? ""} onChange={set("companion_relationship")} placeholder="Ej. madre, esposo" />
        </Field>
      </div>

      <FormSection title="Datos clínicos" hint="Antecedentes que pueden contraindicar un tratamiento.">
        <Field label="Antecedentes familiares">
          <textarea rows={2} className={inputClass} value={form.family_history ?? ""} onChange={set("family_history")} />
        </Field>
        <Field label="Alergias">
          <textarea rows={2} className={inputClass} value={form.allergies ?? ""} onChange={set("allergies")} />
        </Field>
        <Field label="Enfermedades, ¿cuál?">
          <textarea rows={2} className={inputClass} value={form.diseases ?? ""} onChange={set("diseases")} />
        </Field>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {YES_NO_FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              <select
                className={inputClass}
                value={(form[f.key] as string) ?? ""}
                onChange={set(f.key)}
              >
                <option value="">—</option>
                <option>No</option>
                <option>Sí</option>
              </select>
            </Field>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Cirugías importantes">
            <input className={inputClass} value={form.surgeries ?? ""} onChange={set("surgeries")} />
          </Field>
          <Field label="Implantes faciales y/o corporales">
            <input className={inputClass} value={form.implants ?? ""} onChange={set("implants")} />
          </Field>
          <Field label="Fecha de última menstruación">
            <input type="date" className={inputClass} value={form.last_period ?? ""} onChange={set("last_period")} />
          </Field>
          <div />
        </div>

        <Field label="Medicamentos, ¿cuáles?">
          <textarea rows={2} className={inputClass} value={form.medications ?? ""} onChange={set("medications")} />
        </Field>
      </FormSection>

      <FormSection title="Piel">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Biotipo de piel">
            <select className={inputClass} value={form.skin_biotype ?? ""} onChange={set("skin_biotype")}>
              <option value="">Sin especificar</option>
              {SKIN_BIOTYPES.map((b) => <option key={b}>{b}</option>)}
            </select>
          </Field>
          <Field label="Fototipo de piel (Fitzpatrick)">
            <select className={inputClass} value={form.skin_phototype ?? ""} onChange={set("skin_phototype")}>
              <option value="">Sin especificar</option>
              {SKIN_PHOTOTYPES.map((p) => <option key={p}>Fototipo {p}</option>)}
            </select>
          </Field>
        </div>
      </FormSection>

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
