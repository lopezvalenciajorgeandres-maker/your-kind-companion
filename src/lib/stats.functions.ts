import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findBusinessId } from "./tenant";

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const businessId = await findBusinessId(context.supabase, context.userId);
    // Usuario todavía en onboarding: sin negocio no hay panel que mostrar.
    if (!businessId) return null;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();

    const [today, week, clientsCount, payments, upcoming, monthAppointments, allServices] = await Promise.all([
      context.supabase
        .from("appointments")
        .select("id, status")
        .eq("business_id", businessId)
        .gte("starts_at", startOfDay)
        .lt("starts_at", endOfDay),
      context.supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .gte("starts_at", startOfDay)
        .lt("starts_at", endOfWeek),
      context.supabase.from("clients").select("id", { count: "exact", head: true }).eq("business_id", businessId),
      context.supabase
        .from("payments")
        .select("amount_cents, paid_at, method")
        .eq("business_id", businessId)
        .gte("paid_at", startOfYear),
      context.supabase
        .from("appointments")
        .select("*, client:clients(full_name, phone, whatsapp), service:services(name, color), professional:professionals(full_name)")
        .eq("business_id", businessId)
        .gte("starts_at", startOfDay)
        .order("starts_at", { ascending: true })
        .limit(8),
      context.supabase
        .from("appointments")
        .select("id, status, starts_at, service_id, price_cents")
        .eq("business_id", businessId)
        .gte("starts_at", startOfMonth),
      context.supabase.from("services").select("id, name").eq("business_id", businessId),
    ]);

    const rows = payments.data ?? [];
    const sum = (from: string) =>
      rows.filter((p) => p.paid_at >= from).reduce((acc, p) => acc + (p.amount_cents ?? 0), 0);

    const month = monthAppointments.data ?? [];
    const serviceNames = new Map((allServices.data ?? []).map((s) => [s.id, s.name]));
    const byService = new Map<string, number>();
    for (const a of month) {
      if (!a.service_id) continue;
      const name = serviceNames.get(a.service_id) ?? "Sin servicio";
      byService.set(name, (byService.get(name) ?? 0) + 1);
    }

    // ingresos por día de los últimos 30 días
    const daily: Array<{ date: string; total: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i + 1);
      const total = rows
        .filter((p) => p.paid_at >= d.toISOString() && p.paid_at < next.toISOString())
        .reduce((acc, p) => acc + (p.amount_cents ?? 0), 0);
      daily.push({ date: d.toISOString().slice(0, 10), total: total / 100 });
    }

    const todayRows = today.data ?? [];
    return {
      todayCount: todayRows.length,
      weekCount: week.count ?? 0,
      clientsCount: clientsCount.count ?? 0,
      pendingCount: todayRows.filter((a) => a.status === "pending").length,
      cancelledCount: month.filter((a) => a.status === "cancelled").length,
      noShowCount: month.filter((a) => a.status === "no_show").length,
      completedCount: month.filter((a) => a.status === "completed").length,
      revenueToday: sum(startOfDay),
      revenueMonth: sum(startOfMonth),
      revenueYear: sum(startOfYear),
      averageTicket: rows.length ? Math.round(rows.reduce((a, p) => a + (p.amount_cents ?? 0), 0) / rows.length) : 0,
      upcoming: upcoming.data ?? [],
      topServices: [...byService.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6),
      daily,
      methods: Object.entries(
        rows.reduce<Record<string, number>>((acc, p) => {
          acc[p.method ?? "Otro"] = (acc[p.method ?? "Otro"] ?? 0) + (p.amount_cents ?? 0);
          return acc;
        }, {}),
      ).map(([name, total]) => ({ name, total: total / 100 })),
    };
  });

export const getReactivationList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const businessId = await findBusinessId(context.supabase, context.userId);
    if (!businessId) return [];
    const [{ data: clients }, { data: appointments }, { data: payments }] = await Promise.all([
      context.supabase.from("clients").select("id, full_name, phone, whatsapp").eq("business_id", businessId),
      context.supabase
        .from("appointments")
        .select("client_id, starts_at, service:services(name)")
        .eq("business_id", businessId)
        .order("starts_at", { ascending: false }),
      context.supabase.from("payments").select("client_id, amount_cents").eq("business_id", businessId),
    ]);

    const last = new Map<string, { date: string; service: string | null }>();
    for (const a of appointments ?? []) {
      if (!a.client_id || last.has(a.client_id)) continue;
      const svc = a.service as unknown as { name: string } | null;
      last.set(a.client_id, { date: a.starts_at, service: svc?.name ?? null });
    }
    const spent = new Map<string, number>();
    for (const p of payments ?? []) {
      if (!p.client_id) continue;
      spent.set(p.client_id, (spent.get(p.client_id) ?? 0) + (p.amount_cents ?? 0));
    }

    const today = Date.now();
    return (clients ?? [])
      .map((c) => {
        const l = last.get(c.id);
        const days = l ? Math.floor((today - new Date(l.date).getTime()) / 86400000) : null;
        return {
          ...c,
          last_visit: l?.date ?? null,
          last_service: l?.service ?? null,
          days_since: days,
          lifetime_cents: spent.get(c.id) ?? 0,
        };
      })
      .filter((c) => c.days_since === null || c.days_since >= 30)
      .sort((a, b) => (b.days_since ?? 9999) - (a.days_since ?? 9999));
  });
