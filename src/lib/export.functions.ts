import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireBusinessId } from "./tenant";

const filters = z.object({
  entity: z.enum(["clients", "appointments", "services", "payments", "professionals"]),
  from: z.string().optional().nullable(),
  to: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  service_id: z.string().uuid().optional().nullable(),
});

export const exportData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => filters.parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);

    if (data.entity === "clients") {
      const { data: rows } = await context.supabase
        .from("clients")
        .select("full_name, last_name, phone, whatsapp, email, birthdate, gender, address, source, notes, created_at")
        .eq("business_id", businessId)
        .order("full_name");
      return rows ?? [];
    }

    if (data.entity === "services") {
      const { data: rows } = await context.supabase
        .from("services")
        .select("name, category, description, duration_min, price_cents, active, created_at")
        .eq("business_id", businessId)
        .order("name");
      return rows ?? [];
    }

    if (data.entity === "professionals") {
      const { data: rows } = await context.supabase
        .from("professionals")
        .select("full_name, specialty, phone, email, active, created_at")
        .eq("business_id", businessId)
        .order("full_name");
      return rows ?? [];
    }

    if (data.entity === "payments") {
      let q = context.supabase
        .from("payments")
        .select("paid_at, amount_cents, method, status, notes, client:clients(full_name), service:services(name)")
        .eq("business_id", businessId);
      if (data.from) q = q.gte("paid_at", data.from);
      if (data.to) q = q.lte("paid_at", data.to);
      if (data.client_id) q = q.eq("client_id", data.client_id);
      const { data: rows } = await q.order("paid_at", { ascending: false });
      return (rows ?? []).map((r) => ({
        fecha: r.paid_at,
        cliente: (r.client as unknown as { full_name: string } | null)?.full_name ?? "",
        servicio: (r.service as unknown as { name: string } | null)?.name ?? "",
        importe: (r.amount_cents ?? 0) / 100,
        metodo: r.method,
        estado: r.status,
        notas: r.notes ?? "",
      }));
    }

    let q = context.supabase
      .from("appointments")
      .select(
        "id, starts_at, ends_at, status, origin, notes, price_cents, client:clients(full_name, last_name, phone, whatsapp, email), service:services(name, duration_min, price_cents), professional:professionals(full_name)",
      )
      .eq("business_id", businessId);
    if (data.from) q = q.gte("starts_at", data.from);
    if (data.to) q = q.lte("starts_at", data.to);
    if (data.status) q = q.eq("status", data.status);
    if (data.client_id) q = q.eq("client_id", data.client_id);
    if (data.service_id) q = q.eq("service_id", data.service_id);
    const { data: rows } = await q.order("starts_at", { ascending: true });
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmtDate = (iso: string) => {
      const d = new Date(iso);
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    };
    const fmtTime = (iso: string) => {
      const d = new Date(iso);
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    return (rows ?? []).map((r) => {
      const client = r.client as unknown as {
        full_name: string;
        last_name: string | null;
        phone: string | null;
        whatsapp: string | null;
        email: string | null;
      } | null;
      const service = r.service as unknown as { name: string; duration_min: number; price_cents: number } | null;
      const cents = r.price_cents ?? service?.price_cents ?? 0;
      return {
        id: r.id,
        fecha: fmtDate(r.starts_at),
        hora_inicio: fmtTime(r.starts_at),
        hora_fin: fmtTime(r.ends_at),
        cliente: [client?.full_name ?? "", client?.last_name ?? ""].join(" ").trim(),
        telefono: client?.phone ?? "",
        whatsapp: client?.whatsapp ?? "",
        email: client?.email ?? "",
        servicio: service?.name ?? "",
        duracion_min: service?.duration_min ?? "",
        valor: cents / 100,
        profesional: (r.professional as unknown as { full_name: string } | null)?.full_name ?? "",
        estado: r.status,
        origen: r.origin ?? "",
        notas: r.notes ?? "",
        inicio_iso: r.starts_at,
        fin_iso: r.ends_at,
      };
    });
  });

export const createBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const [business, clients, services, professionals, appointments, payments, hours, notes] = await Promise.all([
      context.supabase.from("businesses").select("*").eq("id", businessId).maybeSingle(),
      context.supabase.from("clients").select("*").eq("business_id", businessId),
      context.supabase.from("services").select("*").eq("business_id", businessId),
      context.supabase.from("professionals").select("*").eq("business_id", businessId),
      context.supabase.from("appointments").select("*").eq("business_id", businessId),
      context.supabase.from("payments").select("*").eq("business_id", businessId),
      context.supabase.from("business_hours").select("*").eq("business_id", businessId),
      context.supabase.from("client_notes").select("*").eq("business_id", businessId),
    ]);

    const payload = {
      generated_at: new Date().toISOString(),
      business: business.data,
      clients: clients.data ?? [],
      services: services.data ?? [],
      professionals: professionals.data ?? [],
      appointments: appointments.data ?? [],
      payments: payments.data ?? [],
      business_hours: hours.data ?? [],
      client_notes: notes.data ?? [],
    };
    const size = JSON.stringify(payload).length;

    await context.supabase
      .from("backups")
      .insert({ business_id: businessId, created_by: context.userId, size_bytes: size, destination: "download" });

    return { payload, size };
  });

export const listBackups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("backups")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(20);
    return data ?? [];
  });

export const listIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { data } = await context.supabase.from("integrations").select("*").eq("business_id", businessId);
    return data ?? [];
  });
