import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboard } from "@/lib/stats.functions";
import { useTenant } from "@/lib/use-tenant";
import { useAppMode } from "@/lib/mode";
import { formatMoney } from "@/lib/plan";
import { EmptyState, PageHeader, Panel, ProBadge, StatCard, StatusPill, btnPrimary } from "@/components/app/kit";
import { Calendar, Users, Wallet, TrendingUp, Plus, Clock } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/_authenticated/app/")({ component: Dashboard });

function Dashboard() {
  const tenant = useTenant();
  const { mode } = useAppMode();
  const isFreeMode = mode === "free";
  const fn = useServerFn(getDashboard);
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => fn() });
  const currency = tenant.currency;
  const isPro = !isFreeMode && tenant.plan === "pro";

  return (
    <div className="p-5 md:p-10 max-w-6xl">
      <PageHeader
        title={`Hola${tenant.business?.name ? `, ${tenant.business.name}` : ""} ✨`}
        subtitle="Resumen de tu negocio hoy."
        action={
          <Link to="/app/agenda" className={btnPrimary}>
            <Plus className="h-4 w-4" /> Nueva cita
          </Link>
        }
      />

      <div className={`mt-8 grid gap-4 grid-cols-2 ${isFreeMode ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
        <StatCard label="Citas hoy" value={data?.todayCount ?? "—"} icon={Calendar} hint={`${data?.pendingCount ?? 0} pendientes`} />
        <StatCard label="Próx. 7 días" value={data?.weekCount ?? "—"} icon={TrendingUp} />
        <StatCard label="Clientes" value={data?.clientsCount ?? "—"} icon={Users} />
        {!isFreeMode && (
          <StatCard
            label="Ingresos del mes"
            value={formatMoney(data?.revenueMonth ?? 0, currency)}
            icon={Wallet}
            hint={`Hoy ${formatMoney(data?.revenueToday ?? 0, currency)}`}
          />
        )}
      </div>

      {!isFreeMode && (
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel className="min-w-0 p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg">Ingresos últimos 30 días</h2>
            {!isPro && <ProBadge />}
          </div>
          <div className="h-56 mt-4">
            {isPro ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.daily ?? []}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" hide />
                  <YAxis width={40} tickLine={false} axisLine={false} fontSize={11} />
                  <Tooltip formatter={(v: number) => `${v}`} />
                  <Area type="monotone" dataKey="total" stroke="var(--color-primary)" fill="url(#rev)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <p className="text-sm text-muted-foreground max-w-xs">
                  El panel financiero con gráficas está incluido en el plan PRO.
                </p>
                <Link to="/app/planes" className="mt-3 text-sm text-primary hover:underline">
                  Conocer PRO
                </Link>
              </div>
            )}
          </div>
        </Panel>

        <Panel className="p-5">
          <h2 className="font-serif text-lg">Este mes</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Completadas" value={data?.completedCount ?? 0} />
            <Row label="Canceladas" value={data?.cancelledCount ?? 0} />
            <Row label="No asistieron" value={data?.noShowCount ?? 0} />
            <Row label="Ticket medio" value={formatMoney(data?.averageTicket ?? 0, currency)} />
            <Row label="Ingresos del año" value={formatMoney(data?.revenueYear ?? 0, currency)} />
          </dl>
        </Panel>
      </div>
      )}

      {isFreeMode && (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Panel className="p-5 lg:col-span-3">
            <h2 className="font-serif text-lg">Actividad del mes</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <Row label="Completadas" value={data?.completedCount ?? 0} />
              <Row label="Canceladas" value={data?.cancelledCount ?? 0} />
              <Row label="No asistieron" value={data?.noShowCount ?? 0} />
            </dl>
          </Panel>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel className="min-w-0 lg:col-span-2">
          <div className="p-5 pb-0 flex items-center justify-between">
            <h2 className="font-serif text-lg">Próximas citas</h2>
            <Link to="/app/agenda" className="text-sm text-primary hover:underline">Ver agenda</Link>
          </div>
          <div className="mt-4 divide-y divide-border">
            {isLoading && <div className="p-6 text-sm text-muted-foreground">Cargando...</div>}
            {!isLoading && (data?.upcoming ?? []).length === 0 && (
              <EmptyState title="Sin citas próximas" body="Cuando agendes citas aparecerán aquí." />
            )}
            {(data?.upcoming ?? []).map((a) => {
              const client = a.client as unknown as { full_name: string } | null;
              const service = a.service as unknown as { name: string; color: string } | null;
              return (
                <div key={a.id} className="p-4 flex flex-wrap items-center gap-3">
                  <div className="w-1.5 h-10 shrink-0 rounded-full" style={{ background: service?.color ?? "#CDB4DB" }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{client?.full_name ?? "Cliente"}</div>
                    <div className="text-xs text-muted-foreground truncate">{service?.name ?? "Servicio"}</div>
                  </div>
                  <StatusPill status={a.status} />
                  <div className="text-sm text-muted-foreground flex shrink-0 items-center gap-1 sm:w-28 justify-end">
                    <Clock className="h-3 w-3 shrink-0" />
                    {new Date(a.starts_at).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel className="min-w-0 p-5">
          <h2 className="font-serif text-lg">Servicios más solicitados</h2>
          <div className="mt-4 space-y-3">
            {(data?.topServices ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sin datos todavía.</p>}
            {(data?.topServices ?? []).map((s) => (
              <div key={s.name}>
                <div className="flex justify-between text-sm">
                  <span className="truncate">{s.name}</span>
                  <span className="text-muted-foreground">{s.count}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${(s.count / (data?.topServices?.[0]?.count || 1)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
