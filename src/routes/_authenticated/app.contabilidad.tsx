import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  cashDay,
  createExpense,
  deleteExpense,
  listExpenses,
  profitReport,
} from "@/lib/accounting.functions";
import { EXPENSE_CATEGORIES, EXPENSE_METHODS, iso, monthRange } from "@/lib/accounting";
import { useTenant } from "@/lib/use-tenant";
import { formatMoney } from "@/lib/plan";
import {
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Panel,
  StatCard,
  btnGhost,
  btnPrimary,
  inputClass,
} from "@/components/app/kit";
import { ArrowDownCircle, ArrowUpCircle, Plus, Trash2, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/contabilidad")({
  component: Accounting,
  head: () => ({
    meta: [
      { title: "Contabilidad | ELEVA System" },
      { name: "description", content: "Gastos, caja diaria e informe de utilidad de tu negocio." },
      { property: "og:title", content: "Contabilidad | ELEVA System" },
      { property: "og:description", content: "Controla gastos, caja diaria y utilidad real." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Tab = "gastos" | "caja" | "utilidad";

function Accounting() {
  const [tab, setTab] = useState<Tab>("gastos");
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "gastos", label: "Gastos" },
    { key: "caja", label: "Caja diaria" },
    { key: "utilidad", label: "Informe de utilidad" },
  ];

  return (
    <div className="p-5 md:p-10 max-w-5xl">
      <PageHeader title="Contabilidad" subtitle="Gastos, caja diaria y utilidad real del negocio." />

      <div className="mt-6 flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm transition ${
              tab === t.key ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground/70"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "gastos" && <ExpensesTab />}
        {tab === "caja" && <CashTab />}
        {tab === "utilidad" && <ProfitTab />}
      </div>
    </div>
  );
}

function ExpensesTab() {
  const qc = useQueryClient();
  const tenant = useTenant();
  const list = useServerFn(listExpenses);
  const create = useServerFn(createExpense);
  const del = useServerFn(deleteExpense);
  const initial = monthRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [modal, setModal] = useState(false);

  const expenses = useQuery({
    queryKey: ["expenses", from, to],
    queryFn: () => list({ data: { from, to } }),
  });

  const rows = expenses.data ?? [];
  const total = rows.reduce((a, e) => a + (e.amount_cents ?? 0), 0);

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["cash-day"] });
      qc.invalidateQueries({ queryKey: ["profit"] });
      toast.success("Gasto eliminado");
    },
  });

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Desde"><input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Hasta"><input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <button className={`${btnPrimary} ml-auto`} onClick={() => setModal(true)}>
          <Plus className="h-4 w-4" /> Registrar gasto
        </button>
      </div>

      <div className="mt-5 grid gap-4 grid-cols-2 lg:grid-cols-3">
        <StatCard label="Gasto del periodo" value={formatMoney(total, tenant.currency)} icon={ArrowDownCircle} />
        <StatCard label="Movimientos" value={rows.length} />
      </div>

      <Panel className="mt-5 divide-y divide-border">
        {expenses.isLoading && <div className="p-6 text-sm text-muted-foreground">Cargando...</div>}
        {!expenses.isLoading && rows.length === 0 && (
          <EmptyState title="Sin gastos" body="Registra los egresos del negocio para calcular la utilidad real." />
        )}
        {rows.map((e) => (
          <div key={e.id} className="p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{e.description}</div>
              <div className="text-xs text-muted-foreground truncate">
                {e.category} · {e.method} · {new Date(e.spent_at).toLocaleDateString("es-ES")}
                {e.supplier ? ` · ${e.supplier}` : ""}
              </div>
            </div>
            <div className="font-medium w-28 text-right text-destructive">
              -{formatMoney(e.amount_cents, tenant.currency)}
            </div>
            <button
              onClick={() => { if (confirm("¿Eliminar gasto?")) delMut.mutate(e.id); }}
              className="p-2 rounded-lg hover:bg-secondary text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </Panel>

      {modal && (
        <ExpenseModal
          onClose={() => setModal(false)}
          onSave={async (payload) => {
            try {
              await create({ data: payload });
              qc.invalidateQueries({ queryKey: ["expenses"] });
              qc.invalidateQueries({ queryKey: ["cash-day"] });
              qc.invalidateQueries({ queryKey: ["profit"] });
              toast.success("Gasto registrado");
              setModal(false);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Error");
            }
          }}
        />
      )}
    </div>
  );
}

type NewExpense = {
  category: string;
  description: string;
  amount_cents: number;
  method: string;
  supplier: string | null;
  spent_at: string;
  notes: string | null;
};

function ExpenseModal({ onClose, onSave }: { onClose: () => void; onSave: (e: NewExpense) => void }) {
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>(EXPENSE_METHODS[0]);
  const [supplier, setSupplier] = useState("");
  const [date, setDate] = useState(iso(new Date()));
  const [notes, setNotes] = useState("");

  return (
    <Modal title="Registrar gasto" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            category,
            description: description.trim(),
            amount_cents: Math.round((Number(amount) || 0) * 100),
            method,
            supplier: supplier.trim() || null,
            spent_at: new Date(`${date}T12:00:00`).toISOString(),
            notes: notes.trim() || null,
          });
        }}
      >
        <Field label="Concepto *">
          <input required className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Categoría">
            <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Valor *">
            <input required type="number" min={0} step="0.01" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Método de pago">
            <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value)}>
              {EXPENSE_METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Fecha">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Proveedor">
            <input className={inputClass} value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          </Field>
          <Field label="Notas">
            <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancelar</button>
          <button className={btnPrimary}>Guardar</button>
        </div>
      </form>
    </Modal>
  );
}

function CashTab() {
  const tenant = useTenant();
  const getDay = useServerFn(cashDay);
  const [date, setDate] = useState(iso(new Date()));
  const day = useQuery({ queryKey: ["cash-day", date], queryFn: () => getDay({ data: { date } }) });
  const d = day.data;

  return (
    <div>
      <Field label="Día de caja">
        <input type="date" className={`${inputClass} sm:w-52`} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>

      <div className="mt-5 grid gap-4 grid-cols-2 lg:grid-cols-3">
        <StatCard label="Ingresos" value={formatMoney(d?.income_cents ?? 0, tenant.currency)} icon={ArrowUpCircle} />
        <StatCard label="Egresos" value={formatMoney(d?.expense_cents ?? 0, tenant.currency)} icon={ArrowDownCircle} />
        <StatCard label="Saldo de caja" value={formatMoney(d?.balance_cents ?? 0, tenant.currency)} icon={TrendingUp} />
      </div>

      <Panel className="mt-5">
        <div className="p-4 border-b border-border font-medium">Desglose por método</div>
        {(d?.by_method ?? []).length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">Sin movimientos este día.</div>
        )}
        <div className="divide-y divide-border">
          {(d?.by_method ?? []).map((m) => (
            <div key={m.method} className="p-4 flex items-center gap-3 text-sm">
              <div className="flex-1">{m.method}</div>
              <div className="text-emerald-600">+{formatMoney(m.income_cents, tenant.currency)}</div>
              <div className="text-destructive w-28 text-right">-{formatMoney(m.expense_cents, tenant.currency)}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="mt-5 divide-y divide-border">
        <div className="p-4 border-b border-border font-medium">Movimientos del día</div>
        {day.isLoading && <div className="p-6 text-sm text-muted-foreground">Cargando...</div>}
        {!day.isLoading && (d?.movements ?? []).length === 0 && (
          <EmptyState title="Caja vacía" body="Aún no hay ingresos ni gastos registrados en esta fecha." />
        )}
        {(d?.movements ?? []).map((m) => (
          <div key={m.kind + m.id} className="p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{m.concept}</div>
              <div className="text-xs text-muted-foreground truncate">
                {m.detail} · {m.method} · {new Date(m.at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
            <div className={`font-medium w-28 text-right ${m.kind === "ingreso" ? "text-emerald-600" : "text-destructive"}`}>
              {m.kind === "ingreso" ? "+" : "-"}{formatMoney(m.amount_cents, tenant.currency)}
            </div>
          </div>
        ))}
      </Panel>
    </div>
  );
}

function ProfitTab() {
  const tenant = useTenant();
  const getReport = useServerFn(profitReport);
  const initial = monthRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const report = useQuery({ queryKey: ["profit", from, to], queryFn: () => getReport({ data: { from, to } }) });
  const r = report.data;

  const marginLabel = useMemo(() => `${Math.round((r?.margin ?? 0) * 100)}%`, [r?.margin]);

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Desde"><input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Hasta"><input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>

      <div className="mt-5 grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Ingresos" value={formatMoney(r?.income_cents ?? 0, tenant.currency)} />
        <StatCard label="Gastos" value={formatMoney(r?.expense_cents ?? 0, tenant.currency)} />
        <StatCard label="Utilidad" value={formatMoney(r?.profit_cents ?? 0, tenant.currency)} hint={`Margen ${marginLabel}`} />
        <StatCard label="Cartera pendiente" value={formatMoney(r?.receivable_cents ?? 0, tenant.currency)} />
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Breakdown
          title="Gastos por categoría"
          rows={(r?.by_category ?? []).map((c) => ({ label: c.category, value: c.amount_cents }))}
          currency={tenant.currency}
          negative
        />
        <Breakdown
          title="Ingresos por servicio"
          rows={(r?.by_service ?? []).map((s) => ({ label: s.service, value: s.amount_cents }))}
          currency={tenant.currency}
        />
        <Breakdown
          title="Ingresos por método de pago"
          rows={(r?.by_method ?? []).map((m) => ({ label: m.method, value: m.amount_cents }))}
          currency={tenant.currency}
        />
        <Breakdown
          title="Utilidad por día"
          rows={(r?.by_day ?? []).map((d) => ({
            label: new Date(`${d.date}T12:00:00`).toLocaleDateString("es-ES"),
            value: d.income_cents - d.expense_cents,
          }))}
          currency={tenant.currency}
        />
      </div>
    </div>
  );
}

function Breakdown({ title, rows, currency, negative }: {
  title: string;
  rows: Array<{ label: string; value: number }>;
  currency: string;
  negative?: boolean;
}) {
  return (
    <Panel>
      <div className="p-4 border-b border-border font-medium">{title}</div>
      {rows.length === 0 && <div className="p-6 text-sm text-muted-foreground">Sin datos en el periodo.</div>}
      <div className="divide-y divide-border">
        {rows.map((row) => (
          <div key={row.label} className="p-3 px-4 flex items-center gap-3 text-sm">
            <div className="flex-1 truncate">{row.label}</div>
            <div className={negative || row.value < 0 ? "text-destructive" : "text-foreground"}>
              {formatMoney(row.value, currency)}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}