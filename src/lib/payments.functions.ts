import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireBusinessId } from "./tenant";

const schema = z.object({
  client_id: z.string().uuid().optional().nullable(),
  appointment_id: z.string().uuid().optional().nullable(),
  service_id: z.string().uuid().optional().nullable(),
  treatment_id: z.string().uuid().optional().nullable(),
  amount_cents: z.number().int().min(0).max(1_000_000_000),
  total_cents: z.number().int().min(0).max(1_000_000_000).optional().nullable(),
  method: z.string().trim().max(40).default("Efectivo"),
  status: z.string().trim().max(20).default("Pagado"),
  bank: z.string().trim().max(60).optional().nullable(),
  paid_at: z.string().min(10).optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const listPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("payments")
      .select("*, client:clients(full_name), service:services(name)")
      .eq("business_id", businessId)
      .order("paid_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => schema.parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("payments")
      .insert({ ...data, business_id: businessId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

type ApptRow = {
  id: string;
  starts_at: string;
  status: string;
  price_cents: number | null;
  client: { id: string; full_name: string; last_name: string | null } | null;
  service: { id: string; name: string; price_cents: number } | null;
};

export type Receivable = {
  appointment_id: string;
  starts_at: string;
  status: string;
  client_id: string | null;
  client_name: string;
  service_id: string | null;
  service_name: string;
  total_cents: number;
  paid_cents: number;
  balance_cents: number;
};

/** Citas de la agenda con su estado de cobro (total, abonado y saldo pendiente). */
export const listReceivables = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Receivable[]> => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const [{ data: appts, error: apptErr }, { data: pays, error: payErr }] = await Promise.all([
      context.supabase
        .from("appointments")
        .select(
          "id, starts_at, status, price_cents, client:clients(id, full_name, last_name), service:services(id, name, price_cents)",
        )
        .eq("business_id", businessId)
        .neq("status", "cancelled")
        .order("starts_at", { ascending: false })
        .limit(500),
      context.supabase
        .from("payments")
        .select("appointment_id, amount_cents")
        .eq("business_id", businessId)
        .not("appointment_id", "is", null)
        .limit(2000),
    ]);
    if (apptErr) throw new Error(apptErr.message);
    if (payErr) throw new Error(payErr.message);

    const paidBy = new Map<string, number>();
    for (const p of pays ?? []) {
      if (!p.appointment_id) continue;
      paidBy.set(p.appointment_id, (paidBy.get(p.appointment_id) ?? 0) + (p.amount_cents ?? 0));
    }

    return ((appts ?? []) as unknown as ApptRow[]).map((a) => {
      const total = a.price_cents ?? a.service?.price_cents ?? 0;
      const paid = paidBy.get(a.id) ?? 0;
      return {
        appointment_id: a.id,
        starts_at: a.starts_at,
        status: a.status,
        client_id: a.client?.id ?? null,
        client_name: [a.client?.full_name, a.client?.last_name].filter(Boolean).join(" ") || "Sin cliente",
        service_id: a.service?.id ?? null,
        service_name: a.service?.name ?? "Sin servicio",
        total_cents: total,
        paid_cents: paid,
        balance_cents: Math.max(0, total - paid),
      };
    });
  });

export const updatePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => schema.partial().extend({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { id, ...rest } = data;
    const { error } = await context.supabase
      .from("payments")
      .update(rest)
      .eq("id", id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("payments")
      .delete()
      .eq("id", data.id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
