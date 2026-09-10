import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireBusinessId } from "./tenant";

export type TreatmentSummary = {
  id: string;
  client_id: string;
  client_name: string;
  service_id: string | null;
  service_name: string;
  name: string | null;
  status: string;
  total_cents: number;
  sessions_total: number;
  paid_cents: number;
  balance_cents: number;
  session_price_cents: number;
  sessions_paid: number;
  sessions_remaining: number;
  sessions_done: number;
  sessions_scheduled: number;
  settled: boolean;
  closed_at: string | null;
  created_at: string;
};

const createSchema = z.object({
  client_id: z.string().uuid(),
  service_id: z.string().uuid().nullable().optional(),
  name: z.string().trim().max(160).nullable().optional(),
  total_cents: z.number().int().min(0).max(1_000_000_000),
  sessions_total: z.number().int().min(1).max(500),
  notes: z.string().trim().max(1000).nullable().optional(),
});

/** Tratamientos del negocio con saldo y sesiones calculadas. */
export const listTreatments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TreatmentSummary[]> => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const [{ data: rows, error }, { data: pays }, { data: appts }] = await Promise.all([
      context.supabase
        .from("treatments")
        .select("*, client:clients(id, full_name, last_name), service:services(id, name)")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("payments")
        .select("treatment_id, amount_cents")
        .eq("business_id", businessId)
        .not("treatment_id", "is", null)
        .limit(5000),
      context.supabase
        .from("appointments")
        .select("treatment_id, status")
        .eq("business_id", businessId)
        .not("treatment_id", "is", null)
        .limit(5000),
    ]);
    if (error) throw new Error(error.message);

    const paidBy = new Map<string, number>();
    for (const p of pays ?? []) {
      if (!p.treatment_id) continue;
      paidBy.set(p.treatment_id, (paidBy.get(p.treatment_id) ?? 0) + (p.amount_cents ?? 0));
    }
    const doneBy = new Map<string, number>();
    const scheduledBy = new Map<string, number>();
    for (const a of appts ?? []) {
      if (!a.treatment_id || a.status === "cancelled") continue;
      scheduledBy.set(a.treatment_id, (scheduledBy.get(a.treatment_id) ?? 0) + 1);
      if (a.status === "completed") {
        doneBy.set(a.treatment_id, (doneBy.get(a.treatment_id) ?? 0) + 1);
      }
    }

    return ((rows ?? []) as any[]).map((t) => {
      const paid = paidBy.get(t.id) ?? 0;
      const total = t.total_cents ?? 0;
      const sessions = Math.max(1, t.sessions_total ?? 1);
      const sessionPrice = Math.round(total / sessions);
      const sessionsPaid = sessionPrice > 0 ? Math.min(sessions, Math.floor(paid / sessionPrice)) : 0;
      return {
        id: t.id,
        client_id: t.client_id,
        client_name: [t.client?.full_name, t.client?.last_name].filter(Boolean).join(" ") || "Cliente",
        service_id: t.service_id ?? null,
        service_name: t.service?.name ?? "Sin servicio",
        name: t.name ?? null,
        status: t.status,
        total_cents: total,
        sessions_total: sessions,
        paid_cents: paid,
        balance_cents: Math.max(0, total - paid),
        session_price_cents: sessionPrice,
        sessions_paid: sessionsPaid,
        sessions_remaining: Math.max(0, sessions - sessionsPaid),
        sessions_done: doneBy.get(t.id) ?? 0,
        sessions_scheduled: scheduledBy.get(t.id) ?? 0,
        settled: total - paid <= 0,
        closed_at: t.closed_at ?? null,
        created_at: t.created_at,
      };
    });
  });

export const createTreatment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => createSchema.parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("treatments")
      .insert({ ...data, business_id: businessId, created_by: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const closeTreatment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), reopen: z.boolean().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("treatments")
      .update(
        data.reopen
          ? { status: "open", closed_at: null }
          : { status: "closed", closed_at: new Date().toISOString() },
      )
      .eq("id", data.id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateTreatment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      total_cents: z.number().int().min(0).max(1_000_000_000).optional(),
      sessions_total: z.number().int().min(1).max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const patch: { total_cents?: number; sessions_total?: number } = {};
    if (data.total_cents !== undefined) patch.total_cents = data.total_cents;
    if (data.sessions_total !== undefined) patch.sessions_total = data.sessions_total;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("treatments")
      .update(patch)
      .eq("id", data.id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTreatment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("treatments")
      .delete()
      .eq("id", data.id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
