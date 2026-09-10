import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireBusinessId } from "./tenant";
import { SHEETS, type BackupSheets } from "./backup-shared";

type Row = Record<string, unknown>;
type Count = { added: number; updated: number; skipped: number };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
const pick = (row: Row, keys: string[]): string => {
  const entries = Object.entries(row).map(([k, v]) => [norm(k), v] as const);
  for (const key of keys) {
    const hit = entries.find(([k]) => k === norm(key));
    if (hit && String(hit[1] ?? "").trim() !== "") return String(hit[1]).trim();
  }
  return "";
};
const num = (v: string) => {
  if (!v) return 0;
  const n = Number(v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const cents = (r: Row, centKeys: string[], moneyKeys: string[]) => {
  const raw = pick(r, centKeys);
  return raw ? Math.round(num(raw)) : Math.round(num(pick(r, moneyKeys)) * 100);
};
const yes = (v: string, fallback = false) => v ? ["si", "yes", "true", "1"].includes(norm(v)) : fallback;
const iso = (v: string) => {
  if (!v) return null;
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2}))?$/);
  const d = m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] ?? 0), Number(m[5] ?? 0)) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const nameKey = (a: string, b?: string | null) => norm([a, b ?? ""].join(" "));
const result = (): Count => ({ added: 0, updated: 0, skipped: 0 });
const signatureColumns = (value?: string | null) => Object.fromEntries(
  Array.from({ length: Math.ceil((value?.length ?? 0) / 30000) }, (_, index) => [
    `firma_datos_${index + 1}`,
    value?.slice(index * 30000, (index + 1) * 30000) ?? "",
  ]),
);
const readSignature = (row: Row) => {
  const chunks = Object.entries(row)
    .filter(([key]) => /^firma_datos_\d+$/i.test(key))
    .sort(([a], [b]) => Number(a.split("_").at(-1)) - Number(b.split("_").at(-1)))
    .map(([, value]) => String(value ?? ""));
  return chunks.length ? chunks.join("") : pick(row, ["firma_datos", "signature_data_url"]);
};
const clientMatch = (row: Row, existing: any[]) => {
  const email = norm(pick(row, ["email", "correo"]));
  const phone = norm(pick(row, ["whatsapp", "telefono", "phone"]));
  const birthdate = iso(pick(row, ["nacimiento", "birthdate"]))?.slice(0, 10) ?? "";
  const byContact = existing.find((x) =>
    (email && norm(x.email ?? "") === email) ||
    (phone && [x.whatsapp, x.phone].some((value) => norm(value ?? "") === phone)),
  );
  if (byContact) return byContact;
  const sameName = existing.filter((x) => nameKey(x.full_name, x.last_name) === nameKey(pick(row, ["nombre", "full_name"]), pick(row, ["apellido", "last_name"])));
  if (birthdate) return sameName.find((x) => x.birthdate === birthdate);
  return sameName.length === 1 ? sameName[0] : undefined;
};

export const exportFullBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const sb = context.supabase as any;
    const names = ["businesses", "clients", "services", "professionals", "professional_services", "packages", "treatments", "appointments", "package_sessions", "payments", "expenses", "client_notes", "business_hours", "blocked_dates", "notifications"] as const;
    const responses = await Promise.all(names.map((table) => sb.from(table).select("*").eq(table === "businesses" ? "id" : "business_id", businessId)));
    for (const response of responses) if (response.error) throw new Error(response.error.message);
    const data = Object.fromEntries(names.map((name, i) => [name, responses[i]?.data ?? []])) as Record<string, any[]>;
    const business = data.businesses[0];
    const clients = data.clients;
    const services = data.services;
    const professionals = data.professionals;
    const appointments = data.appointments;
    const payments = data.payments;
    const treatments = data.treatments;
    const clientName = new Map(clients.map((r) => [r.id, [r.full_name, r.last_name ?? ""].join(" ").trim()]));
    const serviceName = new Map(services.map((r) => [r.id, r.name]));
    const professionalName = new Map(professionals.map((r) => [r.id, r.full_name]));
    const charged = new Map<string, number>();
    const paid = new Map<string, number>();
    const add = (map: Map<string, number>, id: string, value: number) => map.set(id, (map.get(id) ?? 0) + value);
    for (const t of treatments) if (t.client_id && t.status !== "cancelled" && t.status !== "cancelado") add(charged, t.client_id, t.total_cents ?? 0);
    for (const a of appointments) if (a.client_id && a.status !== "cancelled" && a.status !== "cancelada" && !a.treatment_id) add(charged, a.client_id, a.price_cents ?? (a.service_id ? serviceName.has(a.service_id) ? services.find((s) => s.id === a.service_id)?.price_cents ?? 0 : 0 : 0));
    for (const p of payments) {
      if (p.client_id) add(paid, p.client_id, p.amount_cents ?? 0);
      if (p.client_id && !p.treatment_id && !p.appointment_id) add(charged, p.client_id, p.total_cents ?? p.amount_cents ?? 0);
    }
    const paidByTreatment = new Map<string, number>();
    for (const p of payments) if (p.treatment_id) add(paidByTreatment, p.treatment_id, p.amount_cents ?? 0);
    const clientById = new Map(clients.map((c) => [c.id, c]));
    const contactOf = (id: string | null) => { const c = id ? clientById.get(id) : null; return c ? (c.whatsapp || c.phone || "") : ""; };
    const treatmentBalance = (t: any) => Math.max((t.total_cents ?? 0) - (paidByTreatment.get(t.id) ?? 0), 0);
    const pendingAppointments = appointments.filter((a) => a.status !== "completed" && a.status !== "cancelled");
    const apptTreatmentClients = new Set(pendingAppointments.filter((a) => a.treatment_id).map((a) => a.client_id));
    const sheets: BackupSheets = {
      [SHEETS.control]: [{ version_respaldo: 2, generado_iso: new Date().toISOString(), negocio_id: businessId, descripcion: "Respaldo integral ELEVA" }, ...names.filter((n) => n !== "businesses").map((n) => ({ seccion: n, registros: data[n]?.length ?? 0 }))],
      [SHEETS.business]: business ? [{ id: business.id, nombre: business.name, tipo: business.business_type, descripcion: business.description ?? "", ciudad: business.city ?? "", pais: business.country ?? "", direccion: business.address ?? "", telefono: business.phone ?? "", whatsapp: business.whatsapp ?? "", instagram: business.instagram ?? "", sitio_web: business.website ?? "", logo_url: business.logo_url ?? "", zona_horaria: business.timezone, moneda: business.currency, reservas_activas: business.booking_enabled ? "si" : "no" }] : [],
      [SHEETS.clients]: clients.map((c) => ({ id: c.id, nombre: c.full_name, apellido: c.last_name ?? "", telefono: c.phone ?? "", whatsapp: c.whatsapp ?? "", email: c.email ?? "", nacimiento: c.birthdate ?? "", genero: c.gender ?? "", direccion: c.address ?? "", municipio: c.city ?? "", departamento: c.state ?? "", origen: c.source ?? "", notas: c.notes ?? "", servicio_id: c.service_id ?? "", precio_servicio_centavos: c.service_price_cents ?? "", creado_iso: c.created_at })),
      [SHEETS.services]: services.map((s) => ({ id: s.id, nombre: s.name, categoria: s.category ?? "", descripcion: s.description ?? "", duracion_min: s.duration_min, precio_centavos: s.price_cents, precio: s.price_cents / 100, color: s.color, activo: s.active ? "si" : "no", profesional_id: s.professional_id ?? "", creado_iso: s.created_at })),
      [SHEETS.professionals]: professionals.map((p) => ({ id: p.id, nombre: p.full_name, especialidad: p.specialty ?? "", telefono: p.phone ?? "", email: p.email ?? "", foto_url: p.photo_url ?? "", color: p.color, activo: p.active ? "si" : "no", creado_iso: p.created_at })),
      [SHEETS.professionalServices]: data.professional_services.map((r) => ({ id: r.id, profesional_id: r.professional_id, profesional: professionalName.get(r.professional_id) ?? "", servicio_id: r.service_id, servicio: serviceName.get(r.service_id) ?? "", creado_iso: r.created_at })),
      [SHEETS.packages]: data.packages.map((r) => ({ id: r.id, nombre: r.name, servicio_id: r.service_id ?? "", servicio: serviceName.get(r.service_id) ?? "", sesiones: r.sessions_total, precio_centavos: r.price_cents, precio: r.price_cents / 100, activo: r.active ? "si" : "no", creado_iso: r.created_at })),
      [SHEETS.treatments]: treatments.map((t) => ({ id: t.id, cliente_id: t.client_id, cliente: clientName.get(t.client_id) ?? "", nombre: t.name ?? "", servicio_id: t.service_id ?? "", servicio: serviceName.get(t.service_id) ?? "", total_centavos: t.total_cents, total: t.total_cents / 100, sesiones: t.sessions_total, estado: t.status, notas: t.notes ?? "", creado_iso: t.created_at, cerrado_iso: t.closed_at ?? "" })),
      [SHEETS.appointments]: appointments.map((a) => ({ id: a.id, inicio_iso: a.starts_at, fin_iso: a.ends_at, cliente_id: a.client_id, cliente: clientName.get(a.client_id) ?? "", servicio_id: a.service_id ?? "", servicio: serviceName.get(a.service_id) ?? "", profesional_id: a.professional_id ?? "", profesional: professionalName.get(a.professional_id) ?? "", tratamiento_id: a.treatment_id ?? "", estado: a.status, origen: a.origin, valor_centavos: a.price_cents ?? "", valor: (a.price_cents ?? 0) / 100, notas: a.notes ?? "", ...signatureColumns(a.signature_data_url), firmado_iso: a.signed_at ?? "", firmado_por: a.signed_by_name ?? "", creado_iso: a.created_at })),
      [SHEETS.packageSessions]: data.package_sessions.map((r) => ({ id: r.id, paquete_id: r.package_id, cliente_id: r.client_id, cita_id: r.appointment_id ?? "", usado_iso: r.used_at ?? "", vence_iso: r.expires_at ?? "", creado_iso: r.created_at })),
      [SHEETS.payments]: payments.map((p) => ({ id: p.id, fecha_iso: p.paid_at, cliente_id: p.client_id ?? "", cliente: clientName.get(p.client_id) ?? "", servicio_id: p.service_id ?? "", servicio: serviceName.get(p.service_id) ?? "", tratamiento_id: p.treatment_id ?? "", cita_id: p.appointment_id ?? "", abono_centavos: p.amount_cents, abono: p.amount_cents / 100, total_centavos: p.total_cents ?? "", total: (p.total_cents ?? 0) / 100, metodo: p.method, banco: p.bank ?? "", estado: p.status, notas: p.notes ?? "", creado_iso: p.created_at })),
      [SHEETS.expenses]: data.expenses.map((e) => ({ id: e.id, fecha_iso: e.spent_at, categoria: e.category, descripcion: e.description, importe_centavos: e.amount_cents, importe: e.amount_cents / 100, metodo: e.method, proveedor: e.supplier ?? "", notas: e.notes ?? "", creado_iso: e.created_at })),
      [SHEETS.notes]: data.client_notes.map((n) => ({ id: n.id, cliente_id: n.client_id, cliente: clientName.get(n.client_id) ?? "", fecha_iso: n.created_at, nota: n.body, privada: n.private ? "si" : "no" })),
      [SHEETS.hours]: data.business_hours.map((h) => ({ id: h.id, dia: h.weekday, profesional_id: h.professional_id ?? "", profesional: professionalName.get(h.professional_id) ?? "", abre: h.open_time, cierra: h.close_time, descanso_inicio: h.break_start ?? "", descanso_fin: h.break_end ?? "", cerrado: h.closed ? "si" : "no" })),
      [SHEETS.blockedDates]: data.blocked_dates.map((b) => ({ id: b.id, inicio_iso: b.starts_at, fin_iso: b.ends_at, profesional_id: b.professional_id ?? "", profesional: professionalName.get(b.professional_id) ?? "", motivo: b.reason ?? "", tipo: b.kind, creado_iso: b.created_at })),
      [SHEETS.balances]: clients.map((c) => ({ cliente_id: c.id, cliente: clientName.get(c.id) ?? "", telefono: c.phone ?? "", total_servicios: (charged.get(c.id) ?? 0) / 100, abonado: (paid.get(c.id) ?? 0) / 100, saldo_pendiente: Math.max((charged.get(c.id) ?? 0) - (paid.get(c.id) ?? 0), 0) / 100 })),
    };
    const { error } = await sb.from("backups").insert({ business_id: businessId, created_by: context.userId, size_bytes: JSON.stringify(sheets).length, destination: "download" });
    if (error) throw new Error(error.message);
    return sheets;
  });

const sheetsSchema = z.record(z.string(), z.array(z.record(z.string(), z.unknown())).max(20000));

export const importFullBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sheets: sheetsSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const sb = context.supabase as any;
    const get = (name: string): Row[] => (Object.entries(data.sheets).find(([key]) => norm(key) === norm(name))?.[1] as Row[] | undefined) ?? [];
    if (!get(SHEETS.clients).length && !get(SHEETS.services).length && !get(SHEETS.appointments).length) throw new Error("El archivo no parece ser una copia válida de ELEVA");
    const sections: Record<string, Count> = Object.fromEntries(["negocio", "clientes", "servicios", "profesionales", "servicios_profesionales", "paquetes", "tratamientos", "citas", "sesiones_paquete", "pagos", "gastos", "notas", "horarios", "bloqueos"].map((k) => [k, result()]));
    const warnings: string[] = [];

    const merge = async (table: string, rows: Row[], key: string, build: (r: Row) => Row | null, natural: (r: Row, existing: any[]) => any | undefined, map?: Map<string, string>) => {
      const { data: current, error: readError } = await sb.from(table).select("*").eq("business_id", businessId);
      if (readError) throw new Error(readError.message);
      const existing = current ?? [];
      for (const source of rows) {
        const payload = build(source);
        if (!payload) { sections[key].skipped++; continue; }
        const oldId = pick(source, ["id"]);
        const found = (oldId ? existing.find((x: any) => x.id === oldId) : undefined) ?? natural(source, existing);
        if (found) {
          const { error } = await sb.from(table).update(payload).eq("id", found.id).eq("business_id", businessId);
          if (error) throw new Error(error.message);
          sections[key].updated++;
          if (oldId && map) map.set(oldId, found.id);
          Object.assign(found, payload);
        } else {
          const { data: inserted, error } = await sb.from(table).insert({ ...payload, business_id: businessId }).select("id").single();
          if (error) throw new Error(error.message);
          sections[key].added++;
          if (oldId && map) map.set(oldId, inserted.id);
          existing.push({ ...payload, id: inserted.id });
        }
      }
    };
    const clientMap = new Map<string, string>();
    const serviceMap = new Map<string, string>();
    const proMap = new Map<string, string>();
    const packageMap = new Map<string, string>();
    const treatmentMap = new Map<string, string>();
    const apptMap = new Map<string, string>();
    const resolve = (r: Row, idKeys: string[], nameKeys: string[], ids: Map<string, string>, existing: any[], getName: (x: any) => string) => {
      const old = pick(r, idKeys);
      if (old && ids.has(old)) return ids.get(old) ?? null;
      if (old && existing.some((x) => x.id === old)) return old;
      const name = norm(pick(r, nameKeys));
      return name ? existing.find((x) => norm(getName(x)) === name)?.id ?? null : null;
    };

    const businessRow = get(SHEETS.business)[0];
    if (businessRow) {
      const patch = { name: pick(businessRow, ["nombre", "name"]) || undefined, business_type: pick(businessRow, ["tipo", "business_type"]) || undefined, description: pick(businessRow, ["descripcion"]) || null, city: pick(businessRow, ["ciudad"]) || null, country: pick(businessRow, ["pais"]) || null, address: pick(businessRow, ["direccion"]) || null, phone: pick(businessRow, ["telefono"]) || null, whatsapp: pick(businessRow, ["whatsapp"]) || null, instagram: pick(businessRow, ["instagram"]) || null, website: pick(businessRow, ["sitio_web", "website"]) || null, logo_url: pick(businessRow, ["logo_url"]) || null, timezone: pick(businessRow, ["zona_horaria", "timezone"]) || undefined, currency: pick(businessRow, ["moneda", "currency"]) || undefined, booking_enabled: yes(pick(businessRow, ["reservas_activas", "booking_enabled"]), true) };
      const { error } = await sb.from("businesses").update(patch).eq("id", businessId);
      if (error) throw new Error(error.message);
      sections.negocio.updated++;
    }

    await merge("clients", get(SHEETS.clients), "clientes", (r) => {
      const full_name = pick(r, ["nombre", "full_name", "cliente"]); if (!full_name) return null;
      return { owner_id: context.userId, full_name, last_name: pick(r, ["apellido", "last_name"]) || null, phone: pick(r, ["telefono", "phone"]) || null, whatsapp: pick(r, ["whatsapp"]) || null, email: pick(r, ["email", "correo"]) || null, birthdate: iso(pick(r, ["nacimiento", "birthdate"]))?.slice(0, 10) ?? null, gender: pick(r, ["genero", "gender"]) || null, address: pick(r, ["direccion", "address"]) || null, city: pick(r, ["municipio", "city"]) || null, state: pick(r, ["departamento", "state"]) || null, source: pick(r, ["origen", "source"]) || null, notes: pick(r, ["notas", "notes"]) || null, service_price_cents: pick(r, ["precio_servicio_centavos"]) ? Math.round(num(pick(r, ["precio_servicio_centavos"]))) : null, created_at: iso(pick(r, ["creado_iso"])) ?? undefined };
    }, clientMatch, clientMap);
    await merge("services", get(SHEETS.services), "servicios", (r) => { const name = pick(r, ["nombre", "name", "servicio"]); if (!name) return null; return { owner_id: context.userId, name, category: pick(r, ["categoria", "category"]) || null, description: pick(r, ["descripcion", "description"]) || null, duration_min: Math.max(1, Math.round(num(pick(r, ["duracion_min", "duracion"]))) || 60), price_cents: cents(r, ["precio_centavos", "price_cents"], ["precio", "price", "valor"]), color: pick(r, ["color"]) || undefined, active: yes(pick(r, ["activo", "active"]), true) }; }, (r, xs) => xs.find((x) => norm(x.name) === norm(pick(r, ["nombre", "name", "servicio"]))), serviceMap);
    await merge("professionals", get(SHEETS.professionals), "profesionales", (r) => { const full_name = pick(r, ["nombre", "full_name", "profesional"]); if (!full_name) return null; return { full_name, specialty: pick(r, ["especialidad", "specialty"]) || null, phone: pick(r, ["telefono", "phone"]) || null, email: pick(r, ["email", "correo"]) || null, photo_url: pick(r, ["foto_url", "photo_url"]) || null, color: pick(r, ["color"]) || undefined, active: yes(pick(r, ["activo", "active"]), true) }; }, (r, xs) => xs.find((x) => norm(x.full_name) === norm(pick(r, ["nombre", "full_name", "profesional"]))), proMap);
    const clientsNow = (await sb.from("clients").select("*").eq("business_id", businessId)).data ?? [];
    const servicesNow = (await sb.from("services").select("*").eq("business_id", businessId)).data ?? [];
    const prosNow = (await sb.from("professionals").select("*").eq("business_id", businessId)).data ?? [];
    for (const r of get(SHEETS.clients)) {
      const client = clientMatch(r, clientsNow);
      const service_id = resolve(r, ["servicio_id"], [], serviceMap, servicesNow, (x) => x.name);
      if (client && service_id) await sb.from("clients").update({ service_id }).eq("id", client.id).eq("business_id", businessId);
    }
    for (const r of get(SHEETS.services)) {
      const service = servicesNow.find((x: any) => x.id === (serviceMap.get(pick(r, ["id"])) ?? pick(r, ["id"]))) ?? servicesNow.find((x: any) => norm(x.name) === norm(pick(r, ["nombre", "name"])));
      const professional_id = resolve(r, ["profesional_id"], [], proMap, prosNow, (x) => x.full_name);
      if (service && professional_id) await sb.from("services").update({ professional_id }).eq("id", service.id).eq("business_id", businessId);
    }

    await merge("professional_services", get(SHEETS.professionalServices), "servicios_profesionales", (r) => { const professional_id = resolve(r, ["profesional_id"], ["profesional"], proMap, prosNow, (x) => x.full_name); const service_id = resolve(r, ["servicio_id"], ["servicio"], serviceMap, servicesNow, (x) => x.name); return professional_id && service_id ? { professional_id, service_id } : null; }, (r, xs) => { const pId = resolve(r, ["profesional_id"], ["profesional"], proMap, prosNow, (x) => x.full_name); const sId = resolve(r, ["servicio_id"], ["servicio"], serviceMap, servicesNow, (x) => x.name); return xs.find((x) => x.professional_id === pId && x.service_id === sId); });
    await merge("packages", get(SHEETS.packages), "paquetes", (r) => { const name = pick(r, ["nombre", "name"]); if (!name) return null; return { name, service_id: resolve(r, ["servicio_id"], ["servicio"], serviceMap, servicesNow, (x) => x.name), sessions_total: Math.max(1, Math.round(num(pick(r, ["sesiones", "sessions_total"]))) || 1), price_cents: cents(r, ["precio_centavos", "price_cents"], ["precio"]), active: yes(pick(r, ["activo", "active"]), true) }; }, (r, xs) => xs.find((x) => norm(x.name) === norm(pick(r, ["nombre", "name"]))), packageMap);
    await merge("treatments", get(SHEETS.treatments), "tratamientos", (r) => { const client_id = resolve(r, ["cliente_id"], ["cliente"], clientMap, clientsNow, (x) => [x.full_name, x.last_name ?? ""].join(" ").trim()); if (!client_id) { warnings.push("Tratamiento omitido: cliente no encontrado"); return null; } return { created_by: context.userId, client_id, service_id: resolve(r, ["servicio_id"], ["servicio"], serviceMap, servicesNow, (x) => x.name), name: pick(r, ["nombre", "name"]) || null, total_cents: cents(r, ["total_centavos"], ["total", "valor"]), sessions_total: Math.max(1, Math.round(num(pick(r, ["sesiones", "sessions_total"]))) || 1), status: pick(r, ["estado", "status"]) || "open", notes: pick(r, ["notas", "notes"]) || null, closed_at: iso(pick(r, ["cerrado_iso", "cerrado"])), created_at: iso(pick(r, ["creado_iso"])) ?? undefined }; }, (r, xs) => { const cid = resolve(r, ["cliente_id"], ["cliente"], clientMap, clientsNow, (x) => [x.full_name, x.last_name ?? ""].join(" ").trim()); return xs.find((x: any) => x.client_id === cid && norm(x.name ?? "") === norm(pick(r, ["nombre", "name"])) && x.created_at === pick(r, ["creado_iso"])); }, treatmentMap);
    const treatmentsNow = (await sb.from("treatments").select("*").eq("business_id", businessId)).data ?? [];
    await merge("appointments", get(SHEETS.appointments), "citas", (r) => { const starts_at = iso(pick(r, ["inicio_iso", "inicio", "fecha", "starts_at"])); const client_id = resolve(r, ["cliente_id"], ["cliente"], clientMap, clientsNow, (x) => [x.full_name, x.last_name ?? ""].join(" ").trim()); if (!starts_at || !client_id) { warnings.push("Cita omitida: fecha o cliente no encontrado"); return null; } const treatmentOld = pick(r, ["tratamiento_id"]); const treatment_id = treatmentOld ? (treatmentMap.get(treatmentOld) ?? treatmentsNow.find((x: any) => x.id === treatmentOld)?.id ?? null) : null; if (treatmentOld && !treatment_id) { warnings.push("Cita omitida: tratamiento no encontrado"); return null; } return { owner_id: context.userId, client_id, service_id: resolve(r, ["servicio_id"], ["servicio"], serviceMap, servicesNow, (x) => x.name), professional_id: resolve(r, ["profesional_id"], ["profesional"], proMap, prosNow, (x) => x.full_name), treatment_id, starts_at, ends_at: iso(pick(r, ["fin_iso", "fin", "ends_at"])) ?? new Date(new Date(starts_at).getTime() + 3600000).toISOString(), status: pick(r, ["estado", "status"]) || "confirmada", origin: pick(r, ["origen", "origin"]) || "manual", price_cents: cents(r, ["valor_centavos", "price_cents"], ["valor", "precio"]), notes: pick(r, ["notas", "notes"]) || null, signature_data_url: readSignature(r) || null, signed_at: iso(pick(r, ["firmado_iso", "signed_at"])), signed_by_name: pick(r, ["firmado_por", "signed_by_name"]) || null, created_at: iso(pick(r, ["creado_iso"])) ?? undefined }; }, (r, xs) => { const cid = resolve(r, ["cliente_id"], ["cliente"], clientMap, clientsNow, (x) => [x.full_name, x.last_name ?? ""].join(" ").trim()); return xs.find((x) => x.client_id === cid && x.starts_at === iso(pick(r, ["inicio_iso", "inicio", "fecha", "starts_at"]))); }, apptMap);
    const apptsNow = (await sb.from("appointments").select("*").eq("business_id", businessId)).data ?? [];
    const packagesNow = (await sb.from("packages").select("*").eq("business_id", businessId)).data ?? [];
    await merge("package_sessions", get(SHEETS.packageSessions), "sesiones_paquete", (r) => { const package_id = resolve(r, ["paquete_id"], [], packageMap, packagesNow, (x) => x.name); const client_id = resolve(r, ["cliente_id"], ["cliente"], clientMap, clientsNow, (x) => [x.full_name, x.last_name ?? ""].join(" ").trim()); const oldAppt = pick(r, ["cita_id"]); const appointment_id = oldAppt ? apptMap.get(oldAppt) ?? apptsNow.find((x: any) => x.id === oldAppt)?.id ?? null : null; return package_id && client_id ? { package_id, client_id, appointment_id, used_at: iso(pick(r, ["usado_iso", "used_at"])), expires_at: iso(pick(r, ["vence_iso", "expires_at"])), created_at: iso(pick(r, ["creado_iso"])) ?? undefined } : null; }, (r, xs) => { const pid = resolve(r, ["paquete_id"], [], packageMap, packagesNow, (x) => x.name); const cid = resolve(r, ["cliente_id"], [], clientMap, clientsNow, (x) => x.full_name); return xs.find((x: any) => x.package_id === pid && x.client_id === cid && String(x.used_at ?? "") === String(iso(pick(r, ["usado_iso", "used_at"])) ?? "")); });

    await merge("payments", get(SHEETS.payments), "pagos", (r) => { const paid_at = iso(pick(r, ["fecha_iso", "fecha", "paid_at"])); if (!paid_at) return null; const oldTreatment = pick(r, ["tratamiento_id"]); const oldAppt = pick(r, ["cita_id"]); const treatment_id = oldTreatment ? treatmentMap.get(oldTreatment) ?? treatmentsNow.find((x: any) => x.id === oldTreatment)?.id ?? null : null; const appointment_id = oldAppt ? apptMap.get(oldAppt) ?? apptsNow.find((x: any) => x.id === oldAppt)?.id ?? null : null; if ((oldTreatment && !treatment_id) || (oldAppt && !appointment_id)) { warnings.push("Pago omitido: no se pudo relacionar con su cita o tratamiento"); return null; } return { client_id: resolve(r, ["cliente_id"], ["cliente"], clientMap, clientsNow, (x) => [x.full_name, x.last_name ?? ""].join(" ").trim()), service_id: resolve(r, ["servicio_id"], ["servicio"], serviceMap, servicesNow, (x) => x.name), treatment_id, appointment_id, amount_cents: cents(r, ["abono_centavos", "amount_cents"], ["abono", "importe", "monto", "amount"]), total_cents: pick(r, ["total_centavos"]) ? Math.round(num(pick(r, ["total_centavos"]))) : (pick(r, ["total"]) ? Math.round(num(pick(r, ["total"])) * 100) : null), method: pick(r, ["metodo", "method"]) || "efectivo", bank: pick(r, ["banco", "bank"]) || null, status: pick(r, ["estado", "status"]) || "pagado", paid_at, notes: pick(r, ["notas", "notes"]) || null, created_at: iso(pick(r, ["creado_iso"])) ?? undefined }; }, (r, xs) => xs.find((x) => x.client_id === resolve(r, ["cliente_id"], ["cliente"], clientMap, clientsNow, (y) => [y.full_name, y.last_name ?? ""].join(" ").trim()) && x.paid_at === iso(pick(r, ["fecha_iso", "fecha", "paid_at"])) && x.amount_cents === cents(r, ["abono_centavos", "amount_cents"], ["abono", "importe", "monto", "amount"])));
    await merge("expenses", get(SHEETS.expenses), "gastos", (r) => { const spent_at = iso(pick(r, ["fecha_iso", "fecha", "spent_at"])); const description = pick(r, ["descripcion", "description"]); if (!spent_at || !description) return null; return { created_by: context.userId, category: pick(r, ["categoria", "category"]) || "otros", description, amount_cents: cents(r, ["importe_centavos", "amount_cents"], ["importe", "monto", "valor"]), method: pick(r, ["metodo", "method"]) || "efectivo", supplier: pick(r, ["proveedor", "supplier"]) || null, spent_at, notes: pick(r, ["notas", "notes"]) || null }; }, (r, xs) => xs.find((x) => x.spent_at === iso(pick(r, ["fecha_iso", "fecha", "spent_at"])) && norm(x.description) === norm(pick(r, ["descripcion", "description"])) && x.amount_cents === cents(r, ["importe_centavos", "amount_cents"], ["importe", "monto", "valor"])));
    await merge("client_notes", get(SHEETS.notes), "notas", (r) => { const client_id = resolve(r, ["cliente_id"], ["cliente"], clientMap, clientsNow, (x) => [x.full_name, x.last_name ?? ""].join(" ").trim()); const body = pick(r, ["nota", "notas", "body"]); return client_id && body ? { client_id, author_id: context.userId, body, private: yes(pick(r, ["privada", "private"])) } : null; }, (r, xs) => xs.find((x) => x.client_id === resolve(r, ["cliente_id"], ["cliente"], clientMap, clientsNow, (y) => [y.full_name, y.last_name ?? ""].join(" ").trim()) && norm(x.body) === norm(pick(r, ["nota", "notas", "body"]))));
    await merge("business_hours", get(SHEETS.hours), "horarios", (r) => { const weekday = Math.round(num(pick(r, ["dia", "weekday"]))); const open_time = pick(r, ["abre", "open_time"]); const close_time = pick(r, ["cierra", "close_time"]); return weekday >= 0 && weekday <= 6 && open_time && close_time ? { professional_id: resolve(r, ["profesional_id"], ["profesional"], proMap, prosNow, (x) => x.full_name), weekday, open_time, close_time, break_start: pick(r, ["descanso_inicio", "break_start"]) || null, break_end: pick(r, ["descanso_fin", "break_end"]) || null, closed: yes(pick(r, ["cerrado", "closed"])) } : null; }, (r, xs) => xs.find((x) => x.weekday === Math.round(num(pick(r, ["dia", "weekday"]))) && (x.professional_id ?? null) === resolve(r, ["profesional_id"], ["profesional"], proMap, prosNow, (y) => y.full_name)));
    await merge("blocked_dates", get(SHEETS.blockedDates), "bloqueos", (r) => { const starts_at = iso(pick(r, ["inicio_iso", "starts_at"])); const ends_at = iso(pick(r, ["fin_iso", "ends_at"])); return starts_at && ends_at ? { professional_id: resolve(r, ["profesional_id"], ["profesional"], proMap, prosNow, (x) => x.full_name), starts_at, ends_at, reason: pick(r, ["motivo", "reason"]) || null, kind: pick(r, ["tipo", "kind"]) || "bloqueo" } : null; }, (r, xs) => xs.find((x) => x.starts_at === iso(pick(r, ["inicio_iso", "starts_at"])) && x.ends_at === iso(pick(r, ["fin_iso", "ends_at"]))));

    return { sections, warnings: [...new Set(warnings)].slice(0, 20) };
  });
