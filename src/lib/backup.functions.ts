import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireBusinessId } from "./tenant";
import { SHEETS, type BackupSheets } from "./backup-shared";

type Row = Record<string, unknown>;

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

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

const iso = (v: string) => {
  if (!v) return null;
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2}))?$/);
  const d = m
    ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] ?? 0), Number(m[5] ?? 0))
    : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const nameKey = (a: string, b?: string | null) => norm([a, b ?? ""].join(" "));

export const exportFullBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const sb = context.supabase;
    const [clients, services, professionals, appointments, payments, expenses, notes, treatments] = await Promise.all([
      sb.from("clients").select("*").eq("business_id", businessId),
      sb.from("services").select("*").eq("business_id", businessId),
      sb.from("professionals").select("*").eq("business_id", businessId),
      sb.from("appointments").select("*").eq("business_id", businessId),
      sb.from("payments").select("*").eq("business_id", businessId),
      sb.from("expenses").select("*").eq("business_id", businessId),
      sb.from("client_notes").select("*").eq("business_id", businessId),
      sb.from("treatments").select("*").eq("business_id", businessId),
    ]);

    const cl = clients.data ?? [];
    const sv = services.data ?? [];
    const pr = professionals.data ?? [];
    const ap = appointments.data ?? [];
    const pa = payments.data ?? [];
    const tr = treatments.data ?? [];

    const clientName = new Map(cl.map((c) => [c.id, [c.full_name, c.last_name ?? ""].join(" ").trim()]));
    const serviceName = new Map(sv.map((s) => [s.id, s.name]));
    const serviceCents = new Map(sv.map((s) => [s.id, s.price_cents]));
    const proName = new Map(pr.map((p) => [p.id, p.full_name]));

    const charged = new Map<string, number>();
    const add = (clientId: string, cents: number) =>
      charged.set(clientId, (charged.get(clientId) ?? 0) + cents);

    // Tratamientos: el valor total pactado
    for (const t of tr) {
      if (!t.client_id || t.status === "cancelado") continue;
      add(t.client_id, t.total_cents ?? 0);
    }
    // Citas sueltas (sin tratamiento): precio de la cita o del servicio
    for (const a of ap) {
      if (!a.client_id || a.status === "cancelada" || a.treatment_id) continue;
      const cents = a.price_cents ?? (a.service_id ? (serviceCents.get(a.service_id) ?? 0) : 0);
      add(a.client_id, cents);
    }
    // Pagos sin cita ni tratamiento asociado: usar su total declarado
    for (const p of pa) {
      if (!p.client_id || p.treatment_id || p.appointment_id) continue;
      add(p.client_id, p.total_cents ?? p.amount_cents ?? 0);
    }

    const paid = new Map<string, number>();
    for (const p of pa) {
      if (!p.client_id) continue;
      paid.set(p.client_id, (paid.get(p.client_id) ?? 0) + (p.amount_cents ?? 0));
    }


    const hours = (await sb.from("business_hours").select("*").eq("business_id", businessId)).data ?? [];

    const sheets: BackupSheets = {
      [SHEETS.clients]: cl.map((c) => ({
        nombre: c.full_name,
        apellido: c.last_name ?? "",
        telefono: c.phone ?? "",
        whatsapp: c.whatsapp ?? "",
        email: c.email ?? "",
        nacimiento: c.birthdate ?? "",
        genero: c.gender ?? "",
        direccion: c.address ?? "",
        origen: c.source ?? "",
        notas: c.notes ?? "",
      })),
      [SHEETS.services]: sv.map((s) => ({
        nombre: s.name,
        categoria: s.category ?? "",
        descripcion: s.description ?? "",
        duracion_min: s.duration_min,
        precio: (s.price_cents ?? 0) / 100,
        activo: s.active ? "si" : "no",
      })),
      [SHEETS.professionals]: pr.map((p) => ({
        nombre: p.full_name,
        especialidad: p.specialty ?? "",
        telefono: p.phone ?? "",
        email: p.email ?? "",
        activo: p.active ? "si" : "no",
      })),
      [SHEETS.treatments]: tr.map((t) => ({
        id: t.id,
        cliente: t.client_id ? (clientName.get(t.client_id) ?? "") : "",
        nombre: t.name ?? "",
        servicio: t.service_id ? (serviceName.get(t.service_id) ?? "") : "",
        total: (t.total_cents ?? 0) / 100,
        sesiones: t.sessions_total ?? 1,
        estado: t.status,
        notas: t.notes ?? "",
        creado_iso: t.created_at,
        cerrado_iso: t.closed_at ?? "",
      })),
      [SHEETS.appointments]: ap.map((a) => ({
        id: a.id,
        inicio_iso: a.starts_at,
        fin_iso: a.ends_at,
        cliente: a.client_id ? (clientName.get(a.client_id) ?? "") : "",
        servicio: a.service_id ? (serviceName.get(a.service_id) ?? "") : "",
        profesional: a.professional_id ? (proName.get(a.professional_id) ?? "") : "",
        tratamiento_id: a.treatment_id ?? "",
        estado: a.status,
        origen: a.origin ?? "",
        valor: (a.price_cents ?? 0) / 100,
        notas: a.notes ?? "",
      })),
      [SHEETS.payments]: pa.map((p) => ({
        fecha_iso: p.paid_at,
        cliente: p.client_id ? (clientName.get(p.client_id) ?? "") : "",
        servicio: p.service_id ? (serviceName.get(p.service_id) ?? "") : "",
        tratamiento_id: p.treatment_id ?? "",
        cita_id: p.appointment_id ?? "",
        abono: (p.amount_cents ?? 0) / 100,
        total: (p.total_cents ?? 0) / 100,
        metodo: p.method,
        banco: p.bank ?? "",
        estado: p.status,
        notas: p.notes ?? "",
      })),
      [SHEETS.expenses]: (expenses.data ?? []).map((e) => ({
        fecha_iso: e.spent_at,
        categoria: e.category,
        descripcion: e.description,
        importe: (e.amount_cents ?? 0) / 100,
        metodo: e.method,
        proveedor: e.supplier ?? "",
        notas: e.notes ?? "",
      })),
      [SHEETS.notes]: (notes.data ?? []).map((n) => ({
        cliente: clientName.get(n.client_id) ?? "",
        fecha_iso: n.created_at,
        nota: n.body,
        privada: n.private ? "si" : "no",
      })),
      [SHEETS.hours]: hours.map((h) => ({
        dia: h.weekday,
        profesional: h.professional_id ? (proName.get(h.professional_id) ?? "") : "",
        abre: h.open_time,
        cierra: h.close_time,
        descanso_inicio: h.break_start ?? "",
        descanso_fin: h.break_end ?? "",
        cerrado: h.closed ? "si" : "no",
      })),
      [SHEETS.balances]: cl.map((c) => {
        const total = (charged.get(c.id) ?? 0) / 100;
        const abonado = (paid.get(c.id) ?? 0) / 100;
        return {
          cliente: [c.full_name, c.last_name ?? ""].join(" ").trim(),
          telefono: c.phone ?? "",
          total_servicios: total,
          abonado,
          saldo_pendiente: Math.max(total - abonado, 0),
        };
      }),
    };


    await sb.from("backups").insert({
      business_id: businessId,
      created_by: context.userId,
      size_bytes: JSON.stringify(sheets).length,
      destination: "download",
    });

    return sheets;
  });

const sheetsSchema = z.record(z.string(), z.array(z.record(z.string(), z.unknown())));

export const importFullBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ sheets: sheetsSchema }).parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const sb = context.supabase;

    const get = (name: string): Row[] => {
      const hit = Object.entries(data.sheets).find(([k]) => norm(k) === norm(name));
      return (hit?.[1] as Row[]) ?? [];
    };

    const summary = { clientes: 0, servicios: 0, profesionales: 0, citas: 0, pagos: 0, gastos: 0, notas: 0 };

    // Clientes
    const existingClients = (await sb.from("clients").select("id, full_name, last_name").eq("business_id", businessId)).data ?? [];
    const clientMap = new Map(existingClients.map((c) => [nameKey(c.full_name, c.last_name), c.id]));
    const newClients = get(SHEETS.clients)
      .map((r) => {
        const full_name = pick(r, ["nombre", "full_name", "cliente", "name"]);
        if (!full_name) return null;
        const last_name = pick(r, ["apellido", "last_name", "apellidos"]) || null;
        if (clientMap.has(nameKey(full_name, last_name))) return null;
        return {
          business_id: businessId,
          owner_id: context.userId,
          full_name,
          last_name,
          phone: pick(r, ["telefono", "phone", "celular"]) || null,
          whatsapp: pick(r, ["whatsapp", "wpp"]) || null,
          email: pick(r, ["email", "correo"]) || null,
          birthdate: iso(pick(r, ["nacimiento", "birthdate", "cumpleanos"]))?.slice(0, 10) ?? null,
          gender: pick(r, ["genero", "gender"]) || null,
          address: pick(r, ["direccion", "address"]) || null,
          source: pick(r, ["origen", "source"]) || null,
          notes: pick(r, ["notas", "notes"]) || null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (newClients.length) {
      const { data: ins, error } = await sb.from("clients").insert(newClients).select("id, full_name, last_name");
      if (error) throw new Error(error.message);
      for (const c of ins ?? []) clientMap.set(nameKey(c.full_name, c.last_name), c.id);
      summary.clientes = newClients.length;
    }

    // Servicios
    const existingServices = (await sb.from("services").select("id, name").eq("business_id", businessId)).data ?? [];
    const serviceMap = new Map(existingServices.map((s) => [norm(s.name), s.id]));
    const newServices = get(SHEETS.services)
      .map((r) => {
        const name = pick(r, ["nombre", "name", "servicio"]);
        if (!name || serviceMap.has(norm(name))) return null;
        const dur = num(pick(r, ["duracion_min", "duracion", "minutos"]));
        return {
          business_id: businessId,
          owner_id: context.userId,
          name,
          category: pick(r, ["categoria", "category"]) || null,
          description: pick(r, ["descripcion", "description"]) || null,
          duration_min: dur > 0 ? Math.round(dur) : 60,
          price_cents: Math.round(num(pick(r, ["precio", "price", "valor"])) * 100),
          active: pick(r, ["activo", "active"]).toLowerCase() !== "no",
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (newServices.length) {
      const { data: ins, error } = await sb.from("services").insert(newServices).select("id, name");
      if (error) throw new Error(error.message);
      for (const s of ins ?? []) serviceMap.set(norm(s.name), s.id);
      summary.servicios = newServices.length;
    }

    // Profesionales
    const existingPros = (await sb.from("professionals").select("id, full_name").eq("business_id", businessId)).data ?? [];
    const proMap = new Map(existingPros.map((p) => [norm(p.full_name), p.id]));
    const newPros = get(SHEETS.professionals)
      .map((r) => {
        const full_name = pick(r, ["nombre", "full_name", "profesional"]);
        if (!full_name || proMap.has(norm(full_name))) return null;
        return {
          business_id: businessId,
          full_name,
          specialty: pick(r, ["especialidad", "specialty"]) || null,
          phone: pick(r, ["telefono", "phone"]) || null,
          email: pick(r, ["email", "correo"]) || null,
          active: pick(r, ["activo", "active"]).toLowerCase() !== "no",
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (newPros.length) {
      const { data: ins, error } = await sb.from("professionals").insert(newPros).select("id, full_name");
      if (error) throw new Error(error.message);
      for (const p of ins ?? []) proMap.set(norm(p.full_name), p.id);
      summary.profesionales = newPros.length;
    }

    // Tratamientos
    const treatmentMap = new Map<string, string>();
    const trRows = get(SHEETS.treatments)
      .map((r) => {
        const clientId = clientMap.get(nameKey(pick(r, ["cliente", "client"])));
        if (!clientId) return null;
        return {
          oldId: pick(r, ["id", "id_tratamiento"]),
          row: {
            business_id: businessId,
            created_by: context.userId,
            client_id: clientId,
            service_id: serviceMap.get(norm(pick(r, ["servicio", "service"]))) ?? null,
            name: pick(r, ["nombre", "name"]) || null,
            total_cents: Math.round(num(pick(r, ["total", "valor"])) * 100),
            sessions_total: Math.max(Math.round(num(pick(r, ["sesiones", "sessions"]))) || 1, 1),
            status: pick(r, ["estado", "status"]) || "open",
            notes: pick(r, ["notas", "notes"]) || null,
            closed_at: iso(pick(r, ["cerrado_iso", "cerrado"])),
          },
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (trRows.length) {
      const { data: ins, error } = await sb
        .from("treatments")
        .insert(trRows.map((t) => t.row))
        .select("id");
      if (error) throw new Error(error.message);
      (ins ?? []).forEach((t, i) => {
        const old = trRows[i]?.oldId;
        if (old) treatmentMap.set(old, t.id);
      });
      summary.tratamientos = trRows.length;
    }

    // Citas
    const existingAppts = (await sb.from("appointments").select("client_id, starts_at").eq("business_id", businessId)).data ?? [];
    const apptKeys = new Set(existingAppts.map((a) => `${a.client_id}|${a.starts_at}`));
    const apptRows = get(SHEETS.appointments)
      .map((r) => {
        const starts = iso(pick(r, ["inicio_iso", "inicio", "fecha", "starts_at"]));
        const clientId = clientMap.get(nameKey(pick(r, ["cliente", "client", "nombre"])));
        if (!starts || !clientId) return null;
        if (apptKeys.has(`${clientId}|${starts}`)) return null;
        apptKeys.add(`${clientId}|${starts}`);
        const ends = iso(pick(r, ["fin_iso", "fin", "ends_at"])) ?? new Date(new Date(starts).getTime() + 3600000).toISOString();
        return {
          oldId: pick(r, ["id", "id_cita"]),
          row: {
            business_id: businessId,
            owner_id: context.userId,
            client_id: clientId,
            service_id: serviceMap.get(norm(pick(r, ["servicio", "service"]))) ?? null,
            professional_id: proMap.get(norm(pick(r, ["profesional", "professional"]))) ?? null,
            treatment_id: treatmentMap.get(pick(r, ["tratamiento_id", "tratamiento"])) ?? null,
            starts_at: starts,
            ends_at: ends,
            status: pick(r, ["estado", "status"]) || "confirmada",
            origin: pick(r, ["origen", "origin"]) || "manual",
            price_cents: Math.round(num(pick(r, ["valor", "precio", "price"])) * 100),
            notes: pick(r, ["notas", "notes"]) || null,
          },
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const apptMap = new Map<string, string>();
    if (apptRows.length) {
      const { data: ins, error } = await sb
        .from("appointments")
        .insert(apptRows.map((a) => a.row))
        .select("id");
      if (error) throw new Error(error.message);
      (ins ?? []).forEach((a, i) => {
        const old = apptRows[i]?.oldId;
        if (old) apptMap.set(old, a.id);
      });
      summary.citas = apptRows.length;
    }

    // Pagos / abonos
    const existingPayments =
      (await sb.from("payments").select("client_id, paid_at, amount_cents").eq("business_id", businessId)).data ?? [];
    const payKeys = new Set(existingPayments.map((p) => `${p.client_id}|${p.paid_at}|${p.amount_cents}`));
    const newPayments = get(SHEETS.payments)
      .map((r) => {
        const paid_at = iso(pick(r, ["fecha_iso", "fecha", "paid_at"]));
        if (!paid_at) return null;
        const amount = num(pick(r, ["abono", "importe", "monto", "amount"]));
        const clientId = clientMap.get(nameKey(pick(r, ["cliente", "client"]))) ?? null;
        const cents = Math.round(amount * 100);
        const key = `${clientId}|${paid_at}|${cents}`;
        if (payKeys.has(key)) return null;
        payKeys.add(key);
        return {
          business_id: businessId,
          client_id: clientId,
          service_id: serviceMap.get(norm(pick(r, ["servicio", "service"]))) ?? null,
          treatment_id: treatmentMap.get(pick(r, ["tratamiento_id", "tratamiento"])) ?? null,
          appointment_id: apptMap.get(pick(r, ["cita_id", "cita"])) ?? null,
          amount_cents: cents,
          total_cents: Math.round(num(pick(r, ["total"])) * 100) || null,
          method: pick(r, ["metodo", "method"]) || "efectivo",
          bank: pick(r, ["banco", "bank"]) || null,
          status: pick(r, ["estado", "status"]) || "pagado",
          paid_at,
          notes: pick(r, ["notas", "notes"]) || null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (newPayments.length) {
      const { error } = await sb.from("payments").insert(newPayments);
      if (error) throw new Error(error.message);
      summary.pagos = newPayments.length;
    }

    // Gastos
    const existingExpenses =
      (await sb.from("expenses").select("spent_at, description, amount_cents").eq("business_id", businessId)).data ?? [];
    const expKeys = new Set(existingExpenses.map((e) => `${e.spent_at}|${norm(e.description)}|${e.amount_cents}`));
    const newExpenses = get(SHEETS.expenses)
      .map((r) => {
        const spent_at = iso(pick(r, ["fecha_iso", "fecha", "spent_at"]));
        const description = pick(r, ["descripcion", "description"]);
        if (!spent_at || !description) return null;
        const cents = Math.round(num(pick(r, ["importe", "monto", "valor"])) * 100);
        const key = `${spent_at}|${norm(description)}|${cents}`;
        if (expKeys.has(key)) return null;
        expKeys.add(key);
        return {
          business_id: businessId,
          created_by: context.userId,
          category: pick(r, ["categoria", "category"]) || "otros",
          description,
          amount_cents: cents,
          method: pick(r, ["metodo", "method"]) || "efectivo",
          supplier: pick(r, ["proveedor", "supplier"]) || null,
          spent_at,
          notes: pick(r, ["notas", "notes"]) || null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (newExpenses.length) {
      const { error } = await sb.from("expenses").insert(newExpenses);
      if (error) throw new Error(error.message);
      summary.gastos = newExpenses.length;
    }

    // Notas de clientes
    const existingNotes = (await sb.from("client_notes").select("client_id, body").eq("business_id", businessId)).data ?? [];
    const noteKeys = new Set(existingNotes.map((n) => `${n.client_id}|${norm(n.body)}`));
    const newNotes = get(SHEETS.notes)
      .map((r) => {
        const clientId = clientMap.get(nameKey(pick(r, ["cliente", "client"])));
        const body = pick(r, ["nota", "notas", "body"]);
        if (!clientId || !body) return null;
        const key = `${clientId}|${norm(body)}`;
        if (noteKeys.has(key)) return null;
        noteKeys.add(key);
        return {
          business_id: businessId,
          client_id: clientId,
          author_id: context.userId,
          body,
          private: pick(r, ["privada", "private"]).toLowerCase() === "si",
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (newNotes.length) {
      const { error } = await sb.from("client_notes").insert(newNotes);
      if (error) throw new Error(error.message);
      summary.notas = newNotes.length;
    }

    // Horarios de atención
    const hourRows = get(SHEETS.hours)
      .map((r) => {
        const weekday = Math.round(num(pick(r, ["dia", "weekday"])));
        const open_time = pick(r, ["abre", "open_time", "apertura"]);
        const close_time = pick(r, ["cierra", "close_time", "cierre"]);
        if (!open_time || !close_time || weekday < 0 || weekday > 6) return null;
        return {
          business_id: businessId,
          professional_id: proMap.get(norm(pick(r, ["profesional", "professional"]))) ?? null,
          weekday,
          open_time,
          close_time,
          break_start: pick(r, ["descanso_inicio", "break_start"]) || null,
          break_end: pick(r, ["descanso_fin", "break_end"]) || null,
          closed: pick(r, ["cerrado", "closed"]).toLowerCase() === "si",
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (hourRows.length) {
      const globals = hourRows.filter((h) => !h.professional_id).map((h) => h.weekday);
      if (globals.length) {
        await sb.from("business_hours").delete().eq("business_id", businessId).is("professional_id", null).in("weekday", globals);
      }
      const { error } = await sb.from("business_hours").insert(hourRows);
      if (error) throw new Error(error.message);
      summary.horarios = hourRows.length;
    }


    return summary;
  });
