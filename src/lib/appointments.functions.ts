import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireBusinessId } from "./tenant";

const apptSchema = z.object({
  client_id: z.string().uuid(),
  service_id: z.string().uuid().nullable().optional(),
  professional_id: z.string().uuid().nullable().optional(),
  treatment_id: z.string().uuid().nullable().optional(),
  starts_at: z.string().min(10),
  ends_at: z.string().min(10),
  price_cents: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  status: z.enum(["pending", "scheduled", "completed", "cancelled", "no_show"]).default("scheduled"),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const SELECT =
  "*, client:clients(id, full_name, phone, whatsapp), service:services(id, name, color, duration_min, price_cents), professional:professionals(id, full_name, color)";

export const listAppointments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ from: z.string(), to: z.string() }).parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("appointments")
      .select(SELECT)
      .eq("business_id", businessId)
      .gte("starts_at", data.from)
      .lte("starts_at", data.to)
      .order("starts_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

async function assertNoOverlap(
  supabase: Awaited<ReturnType<typeof requireBusinessId>> extends never ? never : any,
  businessId: string,
  professionalId: string | null | undefined,
  startsAt: string,
  endsAt: string,
  ignoreId?: string,
) {
  if (!professionalId) return;
  let query = supabase
    .from("appointments")
    .select("id")
    .eq("business_id", businessId)
    .eq("professional_id", professionalId)
    .neq("status", "cancelled")
    .lt("starts_at", endsAt)
    .gt("ends_at", startsAt);
  if (ignoreId) query = query.neq("id", ignoreId);
  const { data } = await query.limit(1);
  if (data && data.length > 0) {
    throw new Error("Ese profesional ya tiene una cita en ese horario.");
  }
}

export const createAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => apptSchema.parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    await assertNoOverlap(context.supabase, businessId, data.professional_id, data.starts_at, data.ends_at);
    const { data: row, error } = await context.supabase
      .from("appointments")
      .insert({ ...data, business_id: businessId, owner_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => apptSchema.partial().extend({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { id, ...rest } = data;
    if (rest.starts_at && rest.ends_at && rest.professional_id !== undefined) {
      await assertNoOverlap(context.supabase, businessId, rest.professional_id, rest.starts_at, rest.ends_at, id);
    }
    const { error } = await context.supabase
      .from("appointments")
      .update(rest)
      .eq("id", id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("appointments")
      .delete()
      .eq("id", data.id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const completeAppointmentSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), completed: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("appointments")
      .update({ status: data.completed ? "completed" : "scheduled" })
      .eq("id", data.id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
