import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireBusinessId } from "./tenant";

const expenseSchema = z.object({
  category: z.string().trim().max(60).default("Otro"),
  description: z.string().trim().min(1).max(200),
  amount_cents: z.number().int().min(0).max(1_000_000_000),
  method: z.string().trim().max(40).default("Efectivo"),
  supplier: z.string().trim().max(120).optional().nullable(),
  spent_at: z.string().min(10),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const rangeSchema = z.object({ from: z.string().min(10), to: z.string().min(10) });
const daySchema = z.object({ date: z.string().min(10) });

export const listExpenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => rangeSchema.parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("expenses")
      .select("*")
      .eq("business_id", businessId)
      .gte("spent_at", new Date(`${data.from}T00:00:00`).toISOString())
      .lte("spent_at", new Date(`${data.to}T23:59:59`).toISOString())
      .order("spent_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => expenseSchema.parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("expenses")
      .insert({ ...data, business_id: businessId, created_by: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("expenses")
      .delete()
      .eq("id", data.id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type CashMovement = {
  id: string;
  kind: "ingreso" | "egreso";
  concept: string;
  detail: string;
  method: string;
  amount_cents: number;
  at: string;
};

export type CashDay = {
  date: string;
  income_cents: number;
  expense_cents: number;
  balance_cents: number;
  by_method: Array<{ method: string; income_cents: number; expense_cents: number }>;
  movements: CashMovement[];
};

/** Caja diaria: ingresos (pagos) y egresos (gastos) de un día concreto. */
export const cashDay = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => daySchema.parse(i))
  .handler(async ({ data, context }): Promise<CashDay> => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const start = new Date(`${data.date}T00:00:00`).toISOString();
    const end = new Date(`${data.date}T23:59:59`).toISOString();

    const [{ data: pays, error: payErr }, { data: exps, error: expErr }] = await Promise.all([
      context.supabase
        .from("payments")
        .select("id, amount_cents, method, paid_at, notes, client:clients(full_name), service:services(name)")
        .eq("business_id", businessId)
        .gte("paid_at", start)
        .lte("paid_at", end)
        .limit(1000),
      context.supabase
        .from("expenses")
        .select("id, amount_cents, method, spent_at, category, description")
        .eq("business_id", businessId)
        .gte("spent_at", start)
        .lte("spent_at", end)
        .limit(1000),
    ]);
    if (payErr) throw new Error(payErr.message);
    if (expErr) throw new Error(expErr.message);

    const movements: CashMovement[] = [];
    const methods = new Map<string, { method: string; income_cents: number; expense_cents: number }>();
    let income = 0;
    let expense = 0;

    for (const p of (pays ?? []) as unknown as Array<{
      id: string; amount_cents: number; method: string; paid_at: string;
      client: { full_name: string } | null; service: { name: string } | null;
    }>) {
      income += p.amount_cents ?? 0;
      const m = methods.get(p.method) ?? { method: p.method, income_cents: 0, expense_cents: 0 };
      m.income_cents += p.amount_cents ?? 0;
      methods.set(p.method, m);
      movements.push({
        id: p.id,
        kind: "ingreso",
        concept: p.client?.full_name ?? "Cobro",
        detail: p.service?.name ?? "Sin servicio",
        method: p.method,
        amount_cents: p.amount_cents ?? 0,
        at: p.paid_at,
      });
    }

    for (const e of exps ?? []) {
      expense += e.amount_cents ?? 0;
      const m = methods.get(e.method) ?? { method: e.method, income_cents: 0, expense_cents: 0 };
      m.expense_cents += e.amount_cents ?? 0;
      methods.set(e.method, m);
      movements.push({
        id: e.id,
        kind: "egreso",
        concept: e.description,
        detail: e.category,
        method: e.method,
        amount_cents: e.amount_cents ?? 0,
        at: e.spent_at,
      });
    }

    movements.sort((a, b) => b.at.localeCompare(a.at));

    return {
      date: data.date,
      income_cents: income,
      expense_cents: expense,
      balance_cents: income - expense,
      by_method: [...methods.values()].sort((a, b) => b.income_cents - a.income_cents),
      movements,
    };
  });

export type ProfitReport = {
  from: string;
  to: string;
  income_cents: number;
  expense_cents: number;
  profit_cents: number;
  margin: number;
  receivable_cents: number;
  by_category: Array<{ category: string; amount_cents: number }>;
  by_service: Array<{ service: string; amount_cents: number }>;
  by_method: Array<{ method: string; amount_cents: number }>;
  by_day: Array<{ date: string; income_cents: number; expense_cents: number }>;
};

/** Informe de utilidad: ingresos cobrados vs gastos del periodo. */
export const profitReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => rangeSchema.parse(i))
  .handler(async ({ data, context }): Promise<ProfitReport> => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const start = new Date(`${data.from}T00:00:00`).toISOString();
    const end = new Date(`${data.to}T23:59:59`).toISOString();

    const [payRes, expRes, apptRes, allPayRes] = await Promise.all([
      context.supabase
        .from("payments")
        .select("amount_cents, method, paid_at, service:services(name)")
        .eq("business_id", businessId)
        .gte("paid_at", start)
        .lte("paid_at", end)
        .limit(2000),
      context.supabase
        .from("expenses")
        .select("amount_cents, category, spent_at")
        .eq("business_id", businessId)
        .gte("spent_at", start)
        .lte("spent_at", end)
        .limit(2000),
      context.supabase
        .from("appointments")
        .select("id, price_cents, service:services(price_cents)")
        .eq("business_id", businessId)
        .neq("status", "cancelled")
        .limit(2000),
      context.supabase
        .from("payments")
        .select("appointment_id, amount_cents")
        .eq("business_id", businessId)
        .not("appointment_id", "is", null)
        .limit(5000),
    ]);
    if (payRes.error) throw new Error(payRes.error.message);
    if (expRes.error) throw new Error(expRes.error.message);
    if (apptRes.error) throw new Error(apptRes.error.message);
    if (allPayRes.error) throw new Error(allPayRes.error.message);

    const byService = new Map<string, number>();
    const byMethod = new Map<string, number>();
    const byDay = new Map<string, { date: string; income_cents: number; expense_cents: number }>();
    let income = 0;

    for (const p of (payRes.data ?? []) as unknown as Array<{
      amount_cents: number; method: string; paid_at: string; service: { name: string } | null;
    }>) {
      const cents = p.amount_cents ?? 0;
      income += cents;
      const s = p.service?.name ?? "Sin servicio";
      byService.set(s, (byService.get(s) ?? 0) + cents);
      byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + cents);
      const day = p.paid_at.slice(0, 10);
      const d = byDay.get(day) ?? { date: day, income_cents: 0, expense_cents: 0 };
      d.income_cents += cents;
      byDay.set(day, d);
    }

    const byCategory = new Map<string, number>();
    let expense = 0;
    for (const e of expRes.data ?? []) {
      const cents = e.amount_cents ?? 0;
      expense += cents;
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + cents);
      const day = e.spent_at.slice(0, 10);
      const d = byDay.get(day) ?? { date: day, income_cents: 0, expense_cents: 0 };
      d.expense_cents += cents;
      byDay.set(day, d);
    }

    const paidBy = new Map<string, number>();
    for (const p of allPayRes.data ?? []) {
      if (!p.appointment_id) continue;
      paidBy.set(p.appointment_id, (paidBy.get(p.appointment_id) ?? 0) + (p.amount_cents ?? 0));
    }
    let receivable = 0;
    for (const a of (apptRes.data ?? []) as unknown as Array<{
      id: string; price_cents: number | null; service: { price_cents: number } | null;
    }>) {
      const total = a.price_cents ?? a.service?.price_cents ?? 0;
      receivable += Math.max(0, total - (paidBy.get(a.id) ?? 0));
    }

    return {
      from: data.from,
      to: data.to,
      income_cents: income,
      expense_cents: expense,
      profit_cents: income - expense,
      margin: income > 0 ? (income - expense) / income : 0,
      receivable_cents: receivable,
      by_category: [...byCategory.entries()]
        .map(([category, amount_cents]) => ({ category, amount_cents }))
        .sort((a, b) => b.amount_cents - a.amount_cents),
      by_service: [...byService.entries()]
        .map(([service, amount_cents]) => ({ service, amount_cents }))
        .sort((a, b) => b.amount_cents - a.amount_cents)
        .slice(0, 10),
      by_method: [...byMethod.entries()]
        .map(([method, amount_cents]) => ({ method, amount_cents }))
        .sort((a, b) => b.amount_cents - a.amount_cents),
      by_day: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
    };
  });