import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findBusinessId, requireBusinessId } from "./tenant";
import { slugify } from "./plan";

const businessSchema = z.object({
  name: z.string().trim().min(1).max(120),
  business_type: z.string().trim().max(60).default("Otro"),
  description: z.string().trim().max(600).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  country: z.string().trim().max(80).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  whatsapp: z.string().trim().max(40).optional().nullable(),
  instagram: z.string().trim().max(100).optional().nullable(),
  website: z.string().trim().max(200).optional().nullable(),
  logo_url: z.string().trim().max(500).optional().nullable(),
  currency: z.string().trim().min(3).max(3).default("EUR"),
  booking_enabled: z.boolean().optional(),
});

export const getMyContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const businessId = await findBusinessId(context.supabase, context.userId);
    const [{ data: profile }, { data: limits }] = await Promise.all([
      context.supabase.from("profiles").select("*").eq("user_id", context.userId).maybeSingle(),
      context.supabase.from("plan_limits").select("*"),
    ]);

    if (!businessId) {
      return { business: null, profile, limits: limits ?? [], counts: null, member: null };
    }

    const [{ data: business }, { data: member }, clients, services, professionals] = await Promise.all([
      context.supabase.from("businesses").select("*").eq("id", businessId).maybeSingle(),
      context.supabase
        .from("business_members")
        .select("role")
        .eq("business_id", businessId)
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase.from("clients").select("id", { count: "exact", head: true }).eq("business_id", businessId),
      context.supabase.from("services").select("id", { count: "exact", head: true }).eq("business_id", businessId),
      context.supabase.from("professionals").select("id", { count: "exact", head: true }).eq("business_id", businessId),
    ]);

    return {
      business,
      profile,
      member,
      limits: limits ?? [],
      counts: {
        clients: clients.count ?? 0,
        services: services.count ?? 0,
        professionals: professionals.count ?? 0,
      },
    };
  });

export const createMyBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => businessSchema.parse(i))
  .handler(async ({ data, context }) => {
    const existing = await findBusinessId(context.supabase, context.userId);
    if (existing) return { id: existing, created: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const base = slugify(data.name) || "negocio";
    let slug = base;
    for (let i = 0; i < 8; i++) {
      const { data: taken } = await supabaseAdmin.from("businesses").select("id").eq("slug", slug).maybeSingle();
      if (!taken) break;
      slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const { data: business, error } = await supabaseAdmin
      .from("businesses")
      .insert({ ...data, slug, onboarding_step: 1 })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: memberError } = await supabaseAdmin
      .from("business_members")
      .insert({ business_id: business.id, user_id: context.userId, role: "owner" });
    if (memberError) throw new Error(memberError.message);

    await supabaseAdmin.from("subscriptions").insert({ business_id: business.id });

    // Horario por defecto: L-V 09:00-19:00, sábado 10:00-14:00, domingo cerrado
    await supabaseAdmin.from("business_hours").insert(
      [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
        business_id: business.id,
        weekday,
        open_time: weekday === 6 ? "10:00" : "09:00",
        close_time: weekday === 6 ? "14:00" : "19:00",
        closed: weekday === 0,
      })),
    );

    return { id: business.id, created: true };
  });

export const updateMyBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => businessSchema.partial().parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { error } = await context.supabase.from("businesses").update(data).eq("id", businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setOnboardingStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ step: z.number().int().min(0).max(5), onboarded: z.boolean().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("businesses")
      .update({ onboarding_step: data.step, ...(data.onboarded ? { onboarded: true } : {}) })
      .eq("id", businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        first_name: z.string().trim().max(80).optional().nullable(),
        last_name: z.string().trim().max(80).optional().nullable(),
        phone: z.string().trim().max(40).optional().nullable(),
        email: z.string().trim().max(200).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .upsert({ ...data, user_id: context.userId }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
