import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type PublicBusiness = Pick<
  Tables["businesses"]["Row"],
  | "id" | "slug" | "name" | "description" | "logo_url" | "address" | "city"
  | "country" | "phone" | "whatsapp" | "instagram" | "website" | "currency" | "booking_enabled"
>;
export type PublicService = Pick<
  Tables["services"]["Row"],
  "id" | "name" | "description" | "category" | "duration_min" | "price_cents" | "color"
>;
export type PublicProfessional = Pick<
  Tables["professionals"]["Row"],
  "id" | "full_name" | "specialty" | "photo_url"
>;
export type PublicBusinessPayload = {
  business: PublicBusiness;
  services: PublicService[];
  professionals: PublicProfessional[];
  hours: Tables["business_hours"]["Row"][];
};

function publicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const getPublicBusiness = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ slug: z.string().trim().min(1).max(60) }).parse(i))
  .handler(async ({ data }): Promise<PublicBusinessPayload | null> => {
    const supabase = publicClient();
    const { data: business } = await supabase
      .from("businesses")
      .select("id, slug, name, description, logo_url, address, city, country, phone, whatsapp, instagram, website, currency, booking_enabled")
      .eq("slug", data.slug)
      .eq("booking_enabled", true)
      .maybeSingle();
    if (!business) return null;

    const [services, professionals, hours] = await Promise.all([
      supabase
        .from("services")
        .select("id, name, description, category, duration_min, price_cents, color")
        .eq("business_id", business.id)
        .eq("active", true)
        .order("name"),
      supabase
        .from("professionals")
        .select("id, full_name, specialty, photo_url")
        .eq("business_id", business.id)
        .eq("active", true)
        .order("full_name"),
      supabase.from("business_hours").select("*").eq("business_id", business.id).is("professional_id", null).order("weekday"),
    ]);

    return {
      business: business as PublicBusiness,
      services: (services.data ?? []) as PublicService[],
      professionals: (professionals.data ?? []) as PublicProfessional[],
      hours: (hours.data ?? []) as Tables["business_hours"]["Row"][],
    };
  });

export const getAvailability = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        business_id: z.string().uuid(),
        professional_id: z.string().uuid().nullable().optional(),
        service_id: z.string().uuid(),
        date: z.string().min(10).max(10),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: service }, { data: hours }, { data: appts }, { data: blocks }] = await Promise.all([
      supabaseAdmin.from("services").select("duration_min").eq("id", data.service_id).eq("business_id", data.business_id).maybeSingle(),
      supabaseAdmin.from("business_hours").select("*").eq("business_id", data.business_id).is("professional_id", null),
      supabaseAdmin
        .from("appointments")
        .select("starts_at, ends_at, professional_id, status")
        .eq("business_id", data.business_id)
        .gte("starts_at", `${data.date}T00:00:00.000Z`)
        .lte("starts_at", `${data.date}T23:59:59.999Z`),
      supabaseAdmin
        .from("blocked_dates")
        .select("starts_at, ends_at, professional_id")
        .eq("business_id", data.business_id),
    ]);
    if (!service) return [];

    const day = new Date(`${data.date}T00:00:00`);
    const weekday = day.getDay();
    const h = (hours ?? []).find((x) => x.weekday === weekday);
    if (!h || h.closed) return [];

    const toMinutes = (t: string) => {
      const [hh, mm] = t.split(":").map(Number);
      return hh * 60 + mm;
    };
    const open = toMinutes(h.open_time);
    const close = toMinutes(h.close_time);
    const bStart = h.break_start ? toMinutes(h.break_start) : null;
    const bEnd = h.break_end ? toMinutes(h.break_end) : null;
    const duration = service.duration_min ?? 60;

    const busy = (appts ?? [])
      .filter((a) => a.status !== "cancelled")
      .filter((a) => !data.professional_id || a.professional_id === data.professional_id || a.professional_id === null)
      .map((a) => [new Date(a.starts_at).getTime(), new Date(a.ends_at).getTime()] as const)
      .concat(
        (blocks ?? [])
          .filter((b) => !data.professional_id || !b.professional_id || b.professional_id === data.professional_id)
          .map((b) => [new Date(b.starts_at).getTime(), new Date(b.ends_at).getTime()] as const),
      );

    const slots: string[] = [];
    for (let m = open; m + duration <= close; m += 15) {
      if (bStart !== null && bEnd !== null && m < bEnd && m + duration > bStart) continue;
      const start = new Date(day);
      start.setMinutes(m);
      const end = new Date(start.getTime() + duration * 60000);
      if (start.getTime() < Date.now()) continue;
      const overlaps = busy.some(([s, e]) => start.getTime() < e && end.getTime() > s);
      if (!overlaps) slots.push(start.toISOString());
    }
    return slots;
  });

export const createPublicBooking = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        business_id: z.string().uuid(),
        service_id: z.string().uuid(),
        professional_id: z.string().uuid().nullable().optional(),
        starts_at: z.string().min(10),
        full_name: z.string().trim().min(1).max(120),
        phone: z.string().trim().min(4).max(40),
        whatsapp: z.string().trim().max(40).optional().nullable(),
        email: z.string().trim().email().max(200).optional().or(z.literal("")).nullable(),
        notes: z.string().trim().max(500).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("id, name, address, booking_enabled")
      .eq("id", data.business_id)
      .maybeSingle();
    if (!business || !business.booking_enabled) throw new Error("Este negocio no acepta reservas online.");

    const { data: service } = await supabaseAdmin
      .from("services")
      .select("id, name, duration_min, price_cents")
      .eq("id", data.service_id)
      .eq("business_id", data.business_id)
      .eq("active", true)
      .maybeSingle();
    if (!service) throw new Error("Servicio no disponible.");

    const startsAt = new Date(data.starts_at);
    const endsAt = new Date(startsAt.getTime() + (service.duration_min ?? 60) * 60000);

    const { data: clash } = await supabaseAdmin
      .from("appointments")
      .select("id")
      .eq("business_id", data.business_id)
      .neq("status", "cancelled")
      .lt("starts_at", endsAt.toISOString())
      .gt("ends_at", startsAt.toISOString())
      .eq("professional_id", data.professional_id ?? "")
      .limit(1);
    if (data.professional_id && clash && clash.length > 0) {
      throw new Error("Ese horario acaba de ocuparse. Elige otro, por favor.");
    }

    let clientId: string;
    const { data: existing } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("business_id", data.business_id)
      .eq("phone", data.phone)
      .maybeSingle();
    if (existing) {
      clientId = existing.id;
    } else {
      const { data: created, error } = await supabaseAdmin
        .from("clients")
        .insert({
          business_id: data.business_id,
          full_name: data.full_name,
          phone: data.phone,
          whatsapp: data.whatsapp,
          email: data.email || null,
          source: "Página web",
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      clientId = created.id;
    }

    const { error: apptError } = await supabaseAdmin.from("appointments").insert({
      business_id: data.business_id,
      client_id: clientId,
      service_id: service.id,
      professional_id: data.professional_id ?? null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      price_cents: service.price_cents,
      status: "pending",
      origin: "reserva_online",
      notes: data.notes ?? null,
    });
    if (apptError) throw new Error(apptError.message);

    await supabaseAdmin.from("notifications").insert({
      business_id: data.business_id,
      kind: "nueva_reserva",
      title: "Nueva reserva online",
      body: `${data.full_name} reservó ${service.name}`,
    });

    return {
      ok: true,
      business: { name: business.name, address: business.address },
      service: service.name,
      starts_at: startsAt.toISOString(),
    };
  });
