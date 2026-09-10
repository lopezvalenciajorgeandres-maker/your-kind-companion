import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { addClientNote, getClientDetail } from "@/lib/clients.functions";
import { useTenant } from "@/lib/use-tenant";
import { formatMoney } from "@/lib/plan";
import { EmptyState, PageHeader, Panel, StatCard, StatusPill, btnPrimary, inputClass } from "@/components/app/kit";
import { WhatsAppMenu, reminderMessage } from "@/components/app/whatsapp-menu";
import { ArrowLeft, CalendarDays, Wallet, Star } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/clientes/$id")({ component: ClientDetail });

function ClientDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const tenant = useTenant();
  const fn = useServerFn(getClientDetail);
  const addNote = useServerFn(addClientNote);
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["client", id], queryFn: () => fn({ data: { id } }) });
  const client = data?.client;
  const spent = (data?.payments ?? []).reduce((a, p) => a + (p.amount_cents ?? 0), 0);
  const visits = (data?.appointments ?? []).filter((a) => a.status === "completed").length;

  if (isLoading) return <div className="p-10 text-sm text-muted-foreground">Cargando...</div>;
  if (!client) return <div className="p-10">Cliente no encontrado. <Link to="/app/clientes" className="text-primary">Volver</Link></div>;

  return (
    <div className="p-5 md:p-10 max-w-5xl">
      <Link to="/app/clientes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Clientes
      </Link>

      <div className="mt-4">
        <PageHeader
          title={`${client.full_name} ${client.last_name ?? ""}`}
          subtitle={[client.whatsapp || client.phone, client.email, client.source].filter(Boolean).join(" · ")}
          action={
            <WhatsAppMenu
              phone={client.whatsapp || client.phone}
              message={reminderMessage({
                clientName: client.full_name,
                businessName: tenant.business?.name ?? "nuestro centro",
                serviceName: (data?.appointments?.[0]?.service as unknown as { name: string } | null)?.name,
                startsAt: data?.appointments?.[0]?.starts_at,
              })}
            />
          }
        />
      </div>

      <div className="mt-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Visitas" value={visits} icon={CalendarDays} />
        <StatCard label="Total gastado" value={formatMoney(spent, tenant.currency)} icon={Wallet} />
        <StatCard label="Citas totales" value={data?.appointments.length ?? 0} icon={CalendarDays} />
        <StatCard
          label="Última visita"
          value={data?.appointments?.[0] ? new Date(data.appointments[0].starts_at).toLocaleDateString("es-ES") : "—"}
          icon={Star}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="font-serif text-lg p-5 pb-2">Historial de citas</h2>
          <div className="divide-y divide-border">
            {(data?.appointments ?? []).length === 0 && <EmptyState title="Sin citas registradas" />}
            {(data?.appointments ?? []).map((a) => {
              const svc = a.service as unknown as { name: string; color: string } | null;
              return (
                <div key={a.id} className="p-4 flex items-center gap-3">
                  <div className="w-1.5 h-9 rounded-full" style={{ background: svc?.color ?? "#CDB4DB" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{svc?.name ?? "Servicio"}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(a.starts_at).toLocaleString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <StatusPill status={a.status} />
                </div>
              );
            })}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel>
            <h2 className="font-serif text-lg p-5 pb-2">Pagos</h2>
            <div className="divide-y divide-border">
              {(data?.payments ?? []).length === 0 && <EmptyState title="Sin pagos registrados" />}
              {(data?.payments ?? []).map((p) => (
                <div key={p.id} className="p-4 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{formatMoney(p.amount_cents, tenant.currency)}</div>
                    <div className="text-xs text-muted-foreground">{p.method} · {p.status}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{new Date(p.paid_at).toLocaleDateString("es-ES")}</div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-5">
            <h2 className="font-serif text-lg">Notas internas</h2>
            <form
              className="mt-3 flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!note.trim()) return;
                try {
                  await addNote({ data: { client_id: id, body: note.trim(), private: true } });
                  setNote("");
                  qc.invalidateQueries({ queryKey: ["client", id] });
                  toast.success("Nota añadida");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Error");
                }
              }}
            >
              <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Alergias, preferencias, resultados..." />
              <button className={btnPrimary}>Añadir</button>
            </form>
            <div className="mt-4 space-y-3">
              {(data?.notes ?? []).map((n) => (
                <div key={n.id} className="rounded-xl bg-secondary/60 p-3">
                  <p className="text-sm">{n.body}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("es-ES")}</p>
                </div>
              ))}
              {client.notes && <div className="rounded-xl bg-secondary/60 p-3 text-sm">{client.notes}</div>}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
