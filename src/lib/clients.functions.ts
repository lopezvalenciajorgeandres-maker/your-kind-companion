import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireBusinessId } from "./tenant";

const clientSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  last_name: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  whatsapp: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().max(200).optional().nullable(),
  birthdate: z.string().trim().min(4).max(10).optional().nullable(),
  gender: z.string().trim().max(30).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  state: z.string().trim().max(120).optional().nullable(),
  source: z.string().trim().max(60).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  service_id: z.string().uuid().optional().nullable(),
  service_price_cents: z.number().int().min(0).max(1_000_000_000).optional().nullable(),
  // Ficha técnica: datos personales
  document_id: z.string().trim().max(40).optional().nullable(),
  blood_type: z.string().trim().max(10).optional().nullable(),
  marital_status: z.string().trim().max(40).optional().nullable(),
  health_insurance: z.string().trim().max(120).optional().nullable(),
  landline: z.string().trim().max(40).optional().nullable(),
  companion_name: z.string().trim().max(120).optional().nullable(),
  companion_relationship: z.string().trim().max(60).optional().nullable(),
  // Ficha técnica: antecedentes clínicos
  family_history: z.string().trim().max(600).optional().nullable(),
  allergies: z.string().trim().max(600).optional().nullable(),
  diseases: z.string().trim().max(600).optional().nullable(),
  cancer: z.string().trim().max(200).optional().nullable(),
  antidepressants: z.string().trim().max(200).optional().nullable(),
  arrhythmia: z.string().trim().max(200).optional().nullable(),
  pacemaker: z.string().trim().max(200).optional().nullable(),
  fatty_liver: z.string().trim().max(200).optional().nullable(),
  surgeries: z.string().trim().max(600).optional().nullable(),
  hernias: z.string().trim().max(200).optional().nullable(),
  stomach_mesh: z.string().trim().max(200).optional().nullable(),
  implants: z.string().trim().max(400).optional().nullable(),
  last_period: z.string().trim().max(10).optional().nullable(),
  alcohol: z.string().trim().max(60).optional().nullable(),
  smoking: z.string().trim().max(60).optional().nullable(),
  medications: z.string().trim().max(600).optional().nullable(),
  skin_biotype: z.string().trim().max(40).optional().nullable(),
  skin_phototype: z.string().trim().max(20).optional().nullable(),
});

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("clients")
      .select("*")
      .eq("business_id", businessId)
      .order("full_name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getClientDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const [{ data: client }, { data: appointments }, { data: payments }, { data: notes }, { data: treatments }] =
      await Promise.all([
      context.supabase.from("clients").select("*").eq("business_id", businessId).eq("id", data.id).maybeSingle(),
      context.supabase
        .from("appointments")
        .select("*, service:services(name, color)")
        .eq("business_id", businessId)
        .eq("client_id", data.id)
        .order("starts_at", { ascending: false }),
      context.supabase
        .from("payments")
        .select("*")
        .eq("business_id", businessId)
        .eq("client_id", data.id)
        .order("paid_at", { ascending: false }),
      context.supabase
        .from("client_notes")
        .select("*")
        .eq("business_id", businessId)
        .eq("client_id", data.id)
        .order("created_at", { ascending: false }),
      // Historial de tratamientos para la historia clínica del cliente.
      context.supabase
        .from("treatments")
        .select("*, service:services(name)")
        .eq("business_id", businessId)
        .eq("client_id", data.id)
        .order("created_at", { ascending: false }),
    ]);

    // Abonos y sesiones realizadas por tratamiento.
    const paidByTreatment = new Map<string, number>();
    for (const p of payments ?? []) {
      if (!p.treatment_id) continue;
      paidByTreatment.set(p.treatment_id, (paidByTreatment.get(p.treatment_id) ?? 0) + (p.amount_cents ?? 0));
    }
    const doneByTreatment = new Map<string, number>();
    for (const a of appointments ?? []) {
      if (!a.treatment_id || a.status !== "completed") continue;
      doneByTreatment.set(a.treatment_id, (doneByTreatment.get(a.treatment_id) ?? 0) + 1);
    }

    return {
      client,
      appointments: appointments ?? [],
      payments: payments ?? [],
      notes: notes ?? [],
      treatments: ((treatments ?? []) as any[]).map((t) => {
        const paid = paidByTreatment.get(t.id) ?? 0;
        return {
          id: t.id as string,
          name: (t.name ?? null) as string | null,
          service_name: (t.service?.name ?? "Sin servicio") as string,
          status: t.status as string,
          total_cents: (t.total_cents ?? 0) as number,
          paid_cents: paid,
          balance_cents: Math.max(0, (t.total_cents ?? 0) - paid),
          sessions_total: (t.sessions_total ?? 1) as number,
          sessions_done: doneByTreatment.get(t.id) ?? 0,
          created_at: t.created_at as string,
          closed_at: (t.closed_at ?? null) as string | null,
        };
      }),
    };
  });

export const createClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => clientSchema.parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("clients")
      .insert({ ...data, business_id: businessId, owner_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => clientSchema.partial().extend({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { id, ...rest } = data;
    const { error } = await context.supabase
      .from("clients")
      .update(rest)
      .eq("id", id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("clients")
      .delete()
      .eq("id", data.id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addClientNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ client_id: z.string().uuid(), body: z.string().trim().min(1).max(2000), private: z.boolean().default(false) })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("client_notes")
      .insert({ ...data, business_id: businessId, author_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
