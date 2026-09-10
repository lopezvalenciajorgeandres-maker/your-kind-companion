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
  source: z.string().trim().max(60).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  service_id: z.string().uuid().optional().nullable(),
  service_price_cents: z.number().int().min(0).max(1_000_000_000).optional().nullable(),
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
    const [{ data: client }, { data: appointments }, { data: payments }, { data: notes }] = await Promise.all([
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
    ]);
    return {
      client,
      appointments: appointments ?? [],
      payments: payments ?? [],
      notes: notes ?? [],
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
