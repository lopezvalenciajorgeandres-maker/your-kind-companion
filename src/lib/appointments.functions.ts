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

// birthdate y gender alimentan el cálculo automático de la ficha de valoración.
const SELECT =
  "*, client:clients(id, full_name, last_name, phone, whatsapp, birthdate, gender), service:services(id, name, color, duration_min, price_cents), professional:professionals(id, full_name, color)";

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

    // Se guarda el tratamiento para poder limpiarlo si la cita era la única que lo sostenía.
    const { data: appt } = await context.supabase
      .from("appointments")
      .select("treatment_id")
      .eq("id", data.id)
      .eq("business_id", businessId)
      .maybeSingle();

    const { error } = await context.supabase
      .from("appointments")
      .delete()
      .eq("id", data.id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);

    // La agenda manda: al borrar la última cita de un tratamiento, este desaparece
    // junto con su saldo de los recordatorios de WhatsApp y de Pagos.
    // Única excepción: si ya tiene abonos cobrados, borrarlo destruiría el registro
    // contable de ese dinero, así que se conserva y se avisa al usuario.
    let deletedTreatment = false;
    let keptForPayments = 0;
    if (appt?.treatment_id) {
      const [{ count: apptCount }, { count: payCount }] = await Promise.all([
        context.supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId)
          .eq("treatment_id", appt.treatment_id),
        context.supabase
          .from("payments")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId)
          .eq("treatment_id", appt.treatment_id),
      ]);
      if ((apptCount ?? 0) === 0) {
        if ((payCount ?? 0) === 0) {
          await context.supabase
            .from("treatments")
            .delete()
            .eq("id", appt.treatment_id)
            .eq("business_id", businessId);
          deletedTreatment = true;
        } else {
          keptForPayments = payCount ?? 0;
        }
      }
    }

    return { ok: true, deletedTreatment, keptForPayments };
  });

export const completeAppointmentSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        completed: z.boolean(),
        signature_data_url: z
          .string()
          .startsWith("data:image/")
          .max(2_000_000)
          .nullable()
          .optional(),
        signed_by_name: z.string().trim().max(120).nullable().optional(),
        data_consent: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const patch: {
      status: string;
      signature_data_url?: string | null;
      signed_at?: string | null;
      signed_by_name?: string | null;
      data_consent?: boolean | null;
      data_consent_at?: string | null;
    } = { status: data.completed ? "completed" : "scheduled" };
    if (data.completed) {
      if (data.signature_data_url) {
        patch.signature_data_url = data.signature_data_url;
        patch.signed_at = new Date().toISOString();
        patch.signed_by_name = data.signed_by_name ?? null;
      }
      if (data.data_consent !== undefined) {
        patch.data_consent = data.data_consent;
        patch.data_consent_at = data.data_consent ? new Date().toISOString() : null;
      }
    } else {
      patch.signature_data_url = null;
      patch.signed_at = null;
      patch.signed_by_name = null;
      patch.data_consent = null;
      patch.data_consent_at = null;
    }
    const { error } = await context.supabase
      .from("appointments")
      .update(patch)
      .eq("id", data.id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
