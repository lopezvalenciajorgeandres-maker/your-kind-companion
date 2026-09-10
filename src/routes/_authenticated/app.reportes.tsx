import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getDashboard, getReactivationList } from "@/lib/stats.functions";
import { exportData } from "@/lib/export.functions";
import { useTenant } from "@/lib/use-tenant";
import { formatMoney } from "@/lib/plan";
import { downloadExcel } from "@/lib/download";
import { EmptyState, PageHeader, Panel, ProBadge, StatCard, btnGhost, btnPrimary, inputClass } from "@/components/app/kit";
import { WhatsAppMenu } from "@/components/app/whatsapp-menu";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/reportes")({ component: Reports });

const PIE_COLORS = ["#CDB4DB", "#A8C5A1", "#F5C6D6", "#BEB7B0", "#9AB7D3"];

function Reports() {
  const tenant = useTenant();
  const dash = useServerFn(getDashboard);
  const reactivation = useServerFn(getReactivationList);
  const doExport = useServerFn(exportData);

  const [entity, setEntity] = useState<"appointments" | "clients" | "services" | "payments" | "professionals">("appointments");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: () => dash() });
  const isPro = tenant.plan === "pro";
  const react = useQuery({ queryKey: ["reactivation"], queryFn: () => reactivation(), enabled: isPro });

  async function runExport() {
    setBusy(true);
    try {
      const rows = await doExport({
        data: {
          entity,
          from: from ? new Date(`${from}T00:00:00`).toISOString() : null,
          to: to ? new Date(`${to}T23:59:59`).toISOString() : null,
        },
      });
      if (!rows.length) return toast.error("No hay datos para exportar con esos filtros");
      downloadExcel(rows as Array<Record<string, unknown>>, `eleva-${entity}`);
      toast.success("Excel descargado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al exportar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-5 md:p-10 max-w-6xl">
      <PageHeader title="Reportes" subtitle="Rendimiento del negocio y exportación de datos." />

      <div className="mt-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Ingresos mes" value={formatMoney(data?.revenueMonth ?? 0, tenant.currency)} icon={TrendingUp} />
        <StatCard label="Ingresos año" value={formatMoney(data?.revenueYear ?? 0, tenant.currency)} />
        <StatCard label="Ticket medio" value={formatMoney(data?.averageTicket ?? 0, tenant.currency)} />
        <StatCard label="Citas completadas" value={data?.completedCount ?? 0} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel className="p-5">
          <h2 className="font-serif text-lg">Servicios más solicitados</h2>
          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.topServices ?? []}>
                <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis width={30} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#CDB4DB" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="p-5">
          <h2 className="font-serif text-lg">Ingresos por método de pago</h2>
          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data?.methods ?? []} dataKey="total" nameKey="name" innerRadius={50} outerRadius={90}>
                  {(data?.methods ?? []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel className="mt-6 p-5">
        <h2 className="font-serif text-lg">Exportar a Excel</h2>
        <div className="mt-4 grid sm:grid-cols-4 gap-3 items-end">
          <label className="block">
            <span className="text-xs text-muted-foreground">Datos</span>
            <select className={inputClass} value={entity} onChange={(e) => setEntity(e.target.value as typeof entity)}>
              <option value="appointments">Citas</option>
              <option value="clients">Clientes</option>
              <option value="services">Servicios</option>
              <option value="payments">Pagos</option>
              <option value="professionals">Profesionales</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Desde</span>
            <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Hasta</span>
            <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button className={btnPrimary} disabled={busy} onClick={runExport}>
            <Download className="h-4 w-4" /> {busy ? "Generando..." : "Descargar"}
          </button>
        </div>
      </Panel>

      <Panel className="mt-6">
        <div className="p-5 pb-0 flex items-center gap-2">
          <h2 className="font-serif text-lg">Clientes para reactivar</h2>
          {!isPro && <ProBadge />}
        </div>
        {!isPro ? (
          <EmptyState
            title="Disponible en PRO"
            body="Detecta automáticamente clientes que no vuelven hace más de 30 días y contáctalos por WhatsApp."
            action={<Link to="/app/planes" className={btnGhost}>Ver plan PRO</Link>}
          />
        ) : (
          <div className="mt-4 divide-y divide-border">
            {(react.data ?? []).length === 0 && <EmptyState title="Todos tus clientes están activos ✨" />}
            {(react.data ?? []).slice(0, 30).map((c) => (
              <div key={c.id} className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.days_since === null ? "Nunca ha venido" : `Hace ${c.days_since} días`}
                    {c.last_service ? ` · ${c.last_service}` : ""} · {formatMoney(c.lifetime_cents, tenant.currency)}
                  </div>
                </div>
                <WhatsAppMenu
                  compact
                  phone={c.whatsapp || c.phone}
                  message={`Hola ${c.full_name} 💜 Te echamos de menos en ${tenant.business?.name ?? "nuestro centro"}. Tenemos un hueco esta semana, ¿te reservamos?`}
                />
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
