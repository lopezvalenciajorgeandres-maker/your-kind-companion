import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { addClientNote, getClientDetail } from "@/lib/clients.functions";
import { useTenant } from "@/lib/use-tenant";
import { formatMoney } from "@/lib/plan";
import { EmptyState, PageHeader, Panel, StatCard, StatusPill, btnPrimary, inputClass } from "@/components/app/kit";
import { WhatsAppMenu, reminderMessage } from "@/components/app/whatsapp-menu";
import { AssessmentReport } from "@/components/app/assessment-report";
import {
  listClientAssessments,
  saveAssessmentReport,
  type Assessment,
  type ClientAssessmentGroup,
} from "@/lib/assessments.functions";
import { ArrowLeft, CalendarDays, FileText, Wallet, Star } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/clientes/$id")({ component: ClientDetail });

function ClientDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const tenant = useTenant();
  const fn = useServerFn(getClientDetail);
  const addNote = useServerFn(addClientNote);
  const [note, setNote] = useState("");
  const [report, setReport] = useState<ClientAssessmentGroup | null>(null);
  const getGroups = useServerFn(listClientAssessments);
  const saveReport = useServerFn(saveAssessmentReport);

  const { data, isLoading } = useQuery({ queryKey: ["client", id], queryFn: () => fn({ data: { id } }) });
  const groups = useQuery({
    queryKey: ["client-assessments", id],
    queryFn: () => getGroups({ data: { client_id: id } }),
  });
  const saveReportMut = useMutation({
    mutationFn: (v: { id: string; report_client: string; report_staff: string }) => saveReport({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-assessments", id] });
      setReport(null);
      toast.success("Informe guardado");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo guardar el informe"),
  });
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
          subtitle={[client.whatsapp || client.phone, client.email, client.source].filter(Boolean).join(" Â· ")}
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
          label="Ãšltima visita"
          value={data?.appointments?.[0] ? new Date(data.appointments[0].starts_at).toLocaleDateString("es-ES") : "â€”"}
          icon={Star}
        />
      </div>

      <Panel className="mt-6">
        <div className="flex items-center justify-between p-5 pb-2">
          <h2 className="font-serif text-lg">Valoraciones e informes</h2>
          <span className="text-xs text-muted-foreground">Medidas, fotos y resultados por tratamiento</span>
        </div>
        <div className="divide-y divide-border">
          {(groups.data ?? []).length === 0 && (
            <EmptyState
              title="Sin valoraciones registradas"
              body="Se crean solas al marcar como realizada la primera y la Ãºltima sesiÃ³n de un tratamiento."
            />
          )}
          {(groups.data ?? []).map((g) => {
            const completo = !!g.inicial && !!g.final;
            return (
              <div key={g.treatment_id ?? g.service_name} className="p-4 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{g.service_name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <Stage label="Inicial" a={g.inicial} />
                    <Stage label="Final" a={g.final} />
                    {g.final?.report_at && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">Informe guardado</span>
                    )}
                  </div>
                </div>
                {completo ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-secondary"
                    onClick={() => setReport(g)}
                  >
                    <FileText className="h-4 w-4" /> Ver informe
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {g.inicial ? "Falta la valoraciÃ³n final" : "Falta la valoraciÃ³n inicial"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      {report?.inicial && report?.final && (
        <AssessmentReport
          inicial={report.inicial}
          final={report.final}
          clientName={`${client.full_name} ${client.last_name ?? ""}`.trim()}
          serviceName={report.service_name}
          businessName={tenant.business?.name}
          saving={saveReportMut.isPending}
          onClose={() => setReport(null)}
          onSave={(v) => saveReportMut.mutate({ id: report.final!.id, ...v })}
        />
      )}

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
                    <div className="text-xs text-muted-foreground">{p.method} Â· {p.status}</div>
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
                  toast.success("Nota aÃ±adida");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Error");
                }
              }}
            >
              <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Alergias, preferencias, resultados..." />
              <button className={btnPrimary}>AÃ±adir</button>
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

/** Estado de una etapa de valoracion: fecha si existe, guion si falta. */
function Stage({ label, a }: { label: string; a: Assessment | null }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 ${
        a ? "bg-emerald-500/15 text-emerald-700" : "bg-muted text-muted-foreground"
      }`}
    >
      {label}: {a ? new Date(a.recorded_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" }) : "pendiente"}
    </span>
  );
}
