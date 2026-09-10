import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireBusinessId } from "./tenant";

export const listHours = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const [{ data: hours }, { data: blocks }] = await Promise.all([
      context.supabase
        .from("business_hours")
        .select("*")
        .eq("business_id", businessId)
        .is("professional_id", null)
        .order("weekday"),
      context.supabase
        .from("blocked_dates")
        .select("*")
        .eq("business_id", businessId)
        .order("starts_at", { ascending: false }),
    ]);
    return { hours: hours ?? [], blocks: blocks ?? [] };
  });

const hourSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  open_time: z.string().min(4).max(8),
  close_time: z.string().min(4).max(8),
  break_start: z.string().min(4).max(8).optional().nullable(),
  break_end: z.string().min(4).max(8).optional().nullable(),
  closed: z.boolean(),
});

export const saveHours = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ hours: z.array(hourSchema).max(7) }).parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    await context.supabase.from("business_hours").delete().eq("business_id", businessId).is("professional_id", null);
    const { error } = await context.supabase
      .from("business_hours")
      .insert(data.hours.map((h) => ({ ...h, business_id: businessId })));
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        starts_at: z.string().min(10),
        ends_at: z.string().min(10),
        reason: z.string().trim().max(200).optional().nullable(),
        kind: z.string().trim().max(40).default("bloqueo"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { error } = await context.supabase.from("blocked_dates").insert({ ...data, business_id: businessId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Abre una franja puntual dentro de bloqueos más grandes (p. ej. una hora dentro de un día bloqueado).
// Elimina los bloqueos que se solapan y recrea los tramos que quedan fuera de la franja.
export const openSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ starts_at: z.string().min(10), ends_at: z.string().min(10) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { data: overlapping, error: readErr } = await context.supabase
      .from("blocked_dates")
      .select("id, starts_at, ends_at, kind, reason")
      .eq("business_id", businessId)
      .lt("starts_at", data.ends_at)
      .gt("ends_at", data.starts_at);
    if (readErr) throw new Error(readErr.message);
    const inserts: Array<{
      business_id: string;
      starts_at: string;
      ends_at: string;
      kind: string;
      reason: string | null;
    }> = [];
    for (const b of overlapping ?? []) {
      if (b.starts_at < data.starts_at)
        inserts.push({ business_id: businessId, starts_at: b.starts_at, ends_at: data.starts_at, kind: b.kind, reason: b.reason });
      if (b.ends_at > data.ends_at)
        inserts.push({ business_id: businessId, starts_at: data.ends_at, ends_at: b.ends_at, kind: b.kind, reason: b.reason });
      const { error: delErr } = await context.supabase.from("blocked_dates").delete().eq("id", b.id);
      if (delErr) throw new Error(delErr.message);
    }
    if (inserts.length > 0) {
      const { error: insErr } = await context.supabase.from("blocked_dates").insert(inserts);
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true };
  });

export const deleteBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("blocked_dates")
      .delete()
      .eq("id", data.id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
