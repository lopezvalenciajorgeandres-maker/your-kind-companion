import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { createPayment, deletePayment, listPayments, listReceivables, type Receivable } from "@/lib/payments.functions";
import { listClients } from "@/lib/clients.functions";
import { listServices } from "@/lib/services.functions";
import { useTenant } from "@/lib/use-tenant";
import { PAYMENT_METHODS, PAYMENT_STATUS, formatMoney } from "@/lib/plan";
import { COLOMBIA_BANKS } from "@/lib/banks";
import { EmptyState, Field, Modal, PageHeader, Panel, ProBadge, StatCard, btnGhost, btnPrimary, inputClass } from "@/components/app/kit";
import { Plus, Trash2, Wallet } from "lucide-react";
import { closeTreatment, listTreatments, type TreatmentSummary } from "@/lib/treatments.functions";

export const Route = createFileRoute("/_authenticated/app/pagos")({ component: Payments });

type NewPayment = {
  client_id: string | null;
  service_id: string | null;
  treatment_id: string | null;
  appointment_id: string | null;
  amount_cents: number;
  total_cents: number | null;
  method: string;
  status: string;
  bank: string | null;
  paid_at: string;
  notes: string | null;
};

function Payments() {
  const qc = useQueryClient();
  const tenant = useTenant();
  const list = useServerFn(listPayments);
  const create = useServerFn(createPayment);
  const del = useServerFn(deletePayment);
  const getClients = useServerFn(listClients);
  const getServices = useServerFn(listServices);
  const getReceivables = useServerFn(listReceivables);

  const getTreatments = useServerFn(listTreatments);
  const closeTreat = useServerFn(closeTreatment);

  const [modal, setModal] = useState(false);
  const [preselected, setPreselected] = useState<Receivable | null>(null);
  const [preselectedTreatment, setPreselectedTreatment] = useState<TreatmentSummary | null>(null);
  const [method, setMethod] = useState("");

  const payments = useQuery({ queryKey: ["payments"], queryFn: () => list() });
  const clients = useQuery({ queryKey: ["clients"], queryFn: () => getClients() });
  const services = useQuery({ queryKey: ["services"], queryFn: () => getServices() });
  const receivables = useQuery({ queryKey: ["receivables"], queryFn: () => getReceivables() });
  const isPro = true;
  const treatments = useQuery({ queryKey: ["treatments"], queryFn: () => getTreatments() });

  const closeMut = useMutation({
    mutationFn: (v: { id: string; reopen?: boolean }) => closeTreat({ data: v }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["treatments"] });
      toast.success(v.reopen ? "Tratamiento reabierto" : "Tratamiento cerrado");
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo actualizar el tratamiento"),
  });

  const rows = (payments.data ?? []).filter((p) => !method || p.method === method);
  const pending = useMemo(
    () => (receivables.data ?? []).filter((r) => r.balance_cents > 0),
    [receivables.data],
  );
  const totals = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const all = payments.data ?? [];
    return {
      month: all.filter((p) => p.paid_at >= monthStart).reduce((a, p) => a + (p.amount_cents ?? 0), 0),
      cartera: pending.reduce((a, r) => a + r.balance_cents, 0),
      count: all.length,
    };
  }, [payments.data, pending]);

  const byClient = useMemo(() => {
    const map = new Map<string, { name: string; balance: number; items: Receivable[] }>();
    for (const r of pending) {
      const key = r.client_id ?? "sin-cliente";
      const entry = map.get(key) ?? { name: r.client_name, balance: 0, items: [] };
      entry.balance += r.balance_cents;
      entry.items.push(r);
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.balance - a.balance);
  }, [pending]);

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["receivables"] });
      qc.invalidateQueries({ queryKey: ["treatments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Pago eliminado");
    },
  });

  const openModal = (r?: Receivable) => { setPreselected(r ?? null); setPreselectedTreatment(null); setModal(true); };
  const openTreatmentModal = (t: TreatmentSummary) => { setPreselected(null); setPreselectedTreatment(t); setModal(true); };

  return (
    <div className="p-5 md:p-10 max-w-5xl">
      <PageHeader
        title="Pagos"
        subtitle="Cobra directamente sobre las citas de la agenda y controla la cartera."
        action={<button className={btnPrimary} onClick={() => openModal()}><Plus className="h-4 w-4" /> Registrar pago</button>}
      />

      <div className="mt-6 grid gap-4 grid-cols-2 lg:grid-cols-3">
        <StatCard label="Cobrado este mes" value={formatMoney(totals.month, tenant.currency)} icon={Wallet} />
        <StatCard label="Cartera pendiente" value={formatMoney(totals.cartera, tenant.currency)} />
        <StatCard label="Movimientos" value={totals.count} />
      </div>

      {tenant.can("dashboard_financiero") && (
        <Panel className="mt-6">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <h2 className="font-medium">Cartera por cliente</h2>
            <ProBadge />
          </div>
          {receivables.isLoading && <div className="p-6 text-sm text-muted-foreground">Cargando cartera...</div>}
          {!receivables.isLoading && byClient.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">Sin saldos pendientes. Todo cobrado.</div>
          )}
          <div className="divide-y divide-border">
            {byClient.map((c) => (
              <div key={c.name + c.balance} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 font-medium truncate">{c.name}</div>
                  <div className="text-sm text-destructive font-medium">{formatMoney(c.balance, tenant.currency)}</div>
                </div>
                <div className="mt-2 space-y-1">
                  {c.items.map((r) => (
                    <div key={r.appointment_id} className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex-1 truncate">
                        {new Date(r.starts_at).toLocaleDateString("es-ES")} · {r.service_name} ·
                        {" "}Total {formatMoney(r.total_cents, tenant.currency)} · Abonado {formatMoney(r.paid_cents, tenant.currency)}
                      </span>
                      <span className="text-destructive">{formatMoney(r.balance_cents, tenant.currency)}</span>
                      <button className="text-primary hover:underline" onClick={() => openModal(r)}>Abonar</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {isPro && (
        <Panel className="mt-6">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <h2 className="font-medium">Tratamientos por sesiones</h2>
            <ProBadge />
          </div>
          {treatments.isLoading && <div className="p-6 text-sm text-muted-foreground">Cargando tratamientos...</div>}
          {!treatments.isLoading && (treatments.data ?? []).length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">
              Aún no hay tratamientos. Crea uno al agendar una cita (valor total y número de sesiones).
            </div>
          )}
          <div className="divide-y divide-border">
            {(treatments.data ?? []).map((t) => (
              <div key={t.id} className="p-4 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">
                    {t.client_name} · {t.service_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Total {formatMoney(t.total_cents, tenant.currency)} · Abonado{" "}
                    {formatMoney(t.paid_cents, tenant.currency)} · Sesiones pagadas {t.sessions_paid}/{t.sessions_total}
                    {" · "}Sesiones realizadas {t.sessions_done}
                  </div>
                </div>
                <span
                  className={`text-[11px] rounded-full px-2 py-0.5 ${
                    t.status === "closed"
                      ? "bg-secondary text-muted-foreground"
                      : t.settled
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {t.status === "closed"
                    ? "Cerrado"
                    : t.settled
                      ? "A paz y salvo"
                      : `Debe ${formatMoney(t.balance_cents, tenant.currency)}`}
                </span>
                {t.status === "open" && (
                  <>
                    {t.balance_cents > 0 && (
                      <button className="text-sm text-primary hover:underline" onClick={() => openTreatmentModal(t)}>
                        Abonar
                      </button>
                    )}
                    <button
                      className={btnGhost}
                      onClick={() => {
                        if (
                          !t.settled &&
                          !confirm("El tratamiento aún tiene saldo pendiente. ¿Cerrarlo de todas formas?")
                        )
                          return;
                        closeMut.mutate({ id: t.id });
                      }}
                    >
                      Cerrar tratamiento
                    </button>
                  </>
                )}
                {t.status === "closed" && (
                  <button className={btnGhost} onClick={() => closeMut.mutate({ id: t.id, reopen: true })}>
                    Reabrir
                  </button>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      <div className="mt-6 flex gap-3">
        <select className={`${inputClass} sm:w-52`} value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="">Todos los métodos</option>
          {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>

      <Panel className="mt-4 divide-y divide-border">
        {payments.isLoading && <div className="p-6 text-sm text-muted-foreground">Cargando...</div>}
        {!payments.isLoading && rows.length === 0 && <EmptyState title="Sin pagos" body="Registra tu primer cobro." />}
        {rows.map((p) => {
          const client = p.client as unknown as { full_name: string } | null;
          const service = p.service as unknown as { name: string } | null;
          return (
            <div key={p.id} className="p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{client?.full_name ?? "Sin cliente"}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {service?.name ?? "Sin servicio"} · {p.method} · {new Date(p.paid_at).toLocaleDateString("es-ES")}
                  {p.bank ? ` · ${p.bank}` : ""}
                  {p.status === "Parcial" && p.total_cents
                    ? ` · Debe ${formatMoney((p.total_cents ?? 0) - (p.amount_cents ?? 0), tenant.currency)}`
                    : ""}
                </div>
              </div>
              <span className={`text-[11px] rounded-full px-2 py-0.5 ${p.status === "Pagado" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{p.status}</span>
              <div className="font-medium w-24 text-right">{formatMoney(p.amount_cents, tenant.currency)}</div>
              <button onClick={() => { if (confirm("¿Eliminar pago?")) delMut.mutate(p.id); }} className="p-2 rounded-lg hover:bg-secondary text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          );
        })}
      </Panel>

      {modal && (
        <PaymentModal
          clients={(clients.data ?? []) as Array<{ id: string; full_name: string }>}
          services={(services.data ?? []) as Array<{ id: string; name: string; price_cents: number }>}
          receivables={receivables.data ?? []}
          treatments={treatments.data ?? []}
          preselected={preselected}
          preselectedTreatment={preselectedTreatment}
          currency={tenant.currency}
          onClose={() => { setModal(false); setPreselected(null); setPreselectedTreatment(null); }}
          onSave={async (payload) => {
            try {
              await create({ data: payload });
              qc.invalidateQueries({ queryKey: ["payments"] });
              qc.invalidateQueries({ queryKey: ["receivables"] });
              qc.invalidateQueries({ queryKey: ["treatments"] });
              qc.invalidateQueries({ queryKey: ["dashboard"] });
              toast.success("Pago registrado");
              setModal(false);
              setPreselected(null);
              setPreselectedTreatment(null);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Error");
            }
          }}
        />
      )}
    </div>
  );
}

function PaymentModal({ clients, services, receivables, treatments, preselected, preselectedTreatment, currency, onClose, onSave }: {
  clients: Array<{ id: string; full_name: string }>;
  services: Array<{ id: string; name: string; price_cents: number }>;
  receivables: Receivable[];
  treatments: TreatmentSummary[];
  preselected: Receivable | null;
  preselectedTreatment: TreatmentSummary | null;
  currency: string;
  onClose: () => void;
  onSave: (p: NewPayment) => void;
}) {
  const [appointmentId, setAppointmentId] = useState(preselected?.appointment_id ?? "");
  const [treatmentId, setTreatmentId] = useState(preselectedTreatment?.id ?? "");
  const [clientId, setClientId] = useState(preselected?.client_id ?? preselectedTreatment?.client_id ?? "");
  const [serviceId, setServiceId] = useState(preselected?.service_id ?? "");
  const [amount, setAmount] = useState(
    preselected
      ? (preselected.balance_cents / 100).toString()
      : preselectedTreatment
        ? (preselectedTreatment.balance_cents / 100).toString()
        : "",
  );

  const [total, setTotal] = useState(preselected ? (preselected.total_cents / 100).toString() : "");
  const [method, setMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [status, setStatus] = useState<string>(PAYMENT_STATUS[0]);
  const [bank, setBank] = useState<string>(COLOMBIA_BANKS[0]);
  const [date, setDate] = useState(() => {
    const n = new Date();
    const p = (v: number) => String(v).padStart(2, "0");
    return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
  });
  const [notes, setNotes] = useState("");

  const appt = receivables.find((r) => r.appointment_id === appointmentId) ?? null;
  const treat = treatments.find((t) => t.id === treatmentId) ?? null;
  const isPartial = status === "Parcial";
  const isTransfer = method === "Transferencia";
  const abonoCents = Math.round((Number(amount) || 0) * 100);

  // El tratamiento manda: trae el valor total, lo abonado y el saldo real.
  const summary = treat
    ? { total: treat.total_cents, paid: treat.paid_cents, balance: treat.balance_cents }
    : appt
      ? { total: appt.total_cents, paid: appt.paid_cents, balance: appt.balance_cents }
      : null;

  const alreadyPaid = summary?.paid ?? 0;
  // Saldo real pendiente ANTES de registrar este abono.
  const due = summary
    ? summary.balance
    : Math.max(0, Math.round((Number(total) || 0) * 100) - alreadyPaid);
  const pendingAfter = Math.max(0, due - abonoCents);


  const options = useMemo(() => {
    const pendingFirst = [...receivables].sort((a, b) => Number(a.paid_cents > 0) - Number(b.paid_cents > 0));
    return pendingFirst.slice(0, 200);
  }, [receivables]);

  function selectAppointment(id: string) {
    setAppointmentId(id);
    const r = receivables.find((x) => x.appointment_id === id);
    if (!r) return;
    setClientId(r.client_id ?? "");
    setServiceId(r.service_id ?? "");
    // Si el cliente tiene un tratamiento abierto, el total sale del tratamiento.
    const t = treatments.find((x) => x.status === "open" && x.client_id === r.client_id) ?? null;
    if (t) {
      setTreatmentId(t.id);
      setTotal((t.total_cents / 100).toString());
      setAmount((t.balance_cents / 100).toString());
      setStatus("Parcial");
      return;
    }

    setTotal((r.total_cents / 100).toString());
    setAmount((r.balance_cents / 100).toString());
    if (r.paid_cents > 0 && r.balance_cents > 0) setStatus("Parcial");
  }

  return (
    <Modal title="Registrar pago" onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        onSave({
          client_id: clientId || null,
          service_id: serviceId || null,
          treatment_id: treatmentId || null,
          appointment_id: appointmentId || null,
          amount_cents: Math.round((Number(amount) || 0) * 100),
          total_cents: isPartial ? Math.round((Number(total) || 0) * 100) : null,
          method, status,
          bank: isTransfer ? bank : null,
          paid_at: new Date(`${date}T12:00:00`).toISOString(),
          notes: notes.trim() || null,
        });
      }}>
        {treatments.length > 0 && (
          <Field label="Tratamiento (PRO)" hint="El abono descuenta el saldo y las sesiones del tratamiento.">
            <select
              className={inputClass}
              value={treatmentId}
              onChange={(e) => {
                setTreatmentId(e.target.value);
                const t = treatments.find((x) => x.id === e.target.value);
                if (!t) return;
                setClientId(t.client_id);
                setServiceId(t.service_id ?? "");
                setTotal((t.total_cents / 100).toString());
                setAmount((t.balance_cents / 100).toString());

              }}
            >
              <option value="">Sin tratamiento</option>
              {treatments
                .filter((t) => t.status === "open")
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.client_name} · {t.service_name} · saldo {formatMoney(t.balance_cents, currency)} ·{" "}
                    {t.sessions_remaining} sesiones
                  </option>
                ))}
            </select>
          </Field>
        )}

        <Field label="Cita de la agenda" hint="Selecciona el servicio que se está ejecutando para descontar del saldo.">
          <select className={inputClass} value={appointmentId} onChange={(e) => selectAppointment(e.target.value)}>
            <option value="">Sin cita (cobro suelto)</option>
            {options.map((r) => (
              <option key={r.appointment_id} value={r.appointment_id}>
                {new Date(r.starts_at).toLocaleDateString("es-ES")} · {r.client_name} · {r.service_name} ·{" "}
                {r.paid_cents > 0 ? "pagada" : "pendiente"}
              </option>
            ))}
          </select>
        </Field>

        {summary && (
          <div className="rounded-lg bg-secondary p-3 text-xs text-muted-foreground grid grid-cols-3 gap-2">
            <div>{treat ? "Total tratamiento" : "Total"}<div className="text-foreground font-medium">{formatMoney(summary.total, currency)}</div></div>
            <div>Abonado<div className="text-foreground font-medium">{formatMoney(summary.paid, currency)}</div></div>
            <div>Saldo<div className="text-foreground font-medium">{formatMoney(summary.balance, currency)}</div></div>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Cliente">
            <select className={inputClass} value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Sin cliente</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </Field>
          <Field label="Servicio">
            <select className={inputClass} value={serviceId} onChange={(e) => {
              setServiceId(e.target.value);
              const s = services.find((x) => x.id === e.target.value);
              if (s && !amount) setAmount((s.price_cents / 100).toString());
              if (s && !total) setTotal((s.price_cents / 100).toString());
            }}>
              <option value="">Sin servicio</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label={isPartial ? "Valor total del servicio *" : "Abono *"}>
            <input
              required
              type="number"
              min={0}
              step="0.01"
              className={inputClass}
              value={isPartial ? total : amount}
              onChange={(e) => (isPartial ? setTotal(e.target.value) : setAmount(e.target.value))}
            />
          </Field>
          <Field label="Fecha"><input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Método">
            <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Estado">
            <select
              className={inputClass}
              value={status}
              onChange={(e) => {
                const next = e.target.value;
                if (next === "Parcial" && !total) setTotal(amount);
                setStatus(next);
              }}
            >
              <option value="Parcial">Parcial</option>
              <option value="Pagado">Pago total</option>
            </select>
          </Field>
          {isPartial && (
            <Field label="Abono *">
              <input required type="number" min={0} step="0.01" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
          )}
          {(isPartial || summary) && (
            <Field
              label="Saldo pendiente por pagar"
              hint={[
                `Saldo actual: ${formatMoney(due, currency)}`,
                alreadyPaid > 0 ? `Ya abonado antes: ${formatMoney(alreadyPaid, currency)}` : null,
              ].filter(Boolean).join(" · ") || undefined}
            >
              <input readOnly className={`${inputClass} bg-secondary`} value={formatMoney(pendingAfter, currency)} />
            </Field>
          )}

          {isTransfer && (
            <Field label="Banco / entidad *">
              <select className={inputClass} value={bank} onChange={(e) => setBank(e.target.value)}>
                {COLOMBIA_BANKS.map((b) => <option key={b}>{b}</option>)}
              </select>
            </Field>
          )}
        </div>
        <Field label="Notas"><input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancelar</button>
          <button className={btnPrimary}>Guardar</button>
        </div>
      </form>
    </Modal>
  );
}
