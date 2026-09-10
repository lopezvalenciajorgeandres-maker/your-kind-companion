import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listClients, createClient } from "@/lib/clients.functions";
import { listServices } from "@/lib/services.functions";
import { completeAppointmentSession, createAppointment, deleteAppointment, listAppointments, updateAppointment } from "@/lib/appointments.functions";
import { AlertTriangle, Check, CheckCircle2, ChevronLeft, ChevronRight, CircleCheckBig, Clock, Copy, Link2, Lock, LockOpen, MessageCircle, Pencil, Plus, Trash2, X } from "lucide-react";
import { createBlock, deleteBlock, listHours, openSlot, saveHours } from "@/lib/schedule.functions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ClientForm, type ClientPayload } from "@/components/app/client-form";
import { Modal } from "@/components/app/kit";
import { SignaturePad } from "@/components/app/signature-pad";
import { BackupButtons } from "@/components/app/backup-buttons";
import { closeTreatment, createTreatment, listTreatments, updateTreatment, type TreatmentSummary } from "@/lib/treatments.functions";
import { useTenant } from "@/lib/use-tenant";
import { formatMoney } from "@/lib/plan";
import { listReceivables } from "@/lib/payments.functions";


export const Route = createFileRoute("/_authenticated/app/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda de citas — Eleva System" },
      {
        name: "description",
        content: "Gestiona citas, clientes y recordatorios manuales de WhatsApp desde la agenda de Eleva System.",
      },
      { property: "og:title", content: "Agenda de citas — Eleva System" },
      {
        property: "og:description",
        content: "Agenda semanal para gestionar citas y enviar recordatorios manuales por WhatsApp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Agenda,
});

const DAY_NAMES = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const SLOT_MIN = 15; // franjas de 15 minutos
const SLOT_PX = 22; // px por franja de 15 min
const SLOT_HEIGHT = SLOT_PX * (60 / SLOT_MIN); // px por hora
const fmtSlot = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fmtMoveLabel = (s: Date, e: Date) =>
  `${s.toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" })} ${fmtSlot(s.getHours() * 60 + s.getMinutes())}–${fmtSlot(e.getHours() * 60 + e.getMinutes())}`;

function WhatsAppIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M12.04 2a9.84 9.84 0 0 0-8.48 14.8L2 22l5.34-1.5A9.99 9.99 0 1 0 12.04 2Zm0 17.98a8.05 8.05 0 0 1-4.1-1.12l-.3-.18-3.17.89.85-3.08-.2-.32a7.88 7.88 0 0 1-1.22-4.22 8.1 8.1 0 1 1 8.14 8.03Zm4.45-6.05c-.24-.12-1.44-.7-1.66-.79-.23-.08-.39-.12-.55.12-.16.25-.63.8-.77.96-.14.17-.28.19-.53.07-.24-.12-1.03-.38-1.96-1.2a7.4 7.4 0 0 1-1.35-1.67c-.14-.25-.01-.38.11-.5.11-.1.24-.28.36-.42.12-.14.16-.24.24-.4.08-.17.04-.31-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.43.06-.65.3-.22.25-.85.84-.85 2.04s.87 2.36 1 2.52c.12.17 1.72 2.63 4.16 3.69.58.25 1.03.4 1.39.51.58.19 1.11.16 1.53.1.47-.07 1.44-.6 1.64-1.17.2-.58.2-1.08.14-1.18-.06-.1-.22-.17-.46-.29Z" />
    </svg>
  );
}

type DayHours = {
  weekday: number;
  open_time: string;
  close_time: string;
  break_start: string | null;
  break_end: string | null;
  closed: boolean;
};

const DEFAULT_DAY: Omit<DayHours, "weekday"> = {
  open_time: "09:00",
  close_time: "18:00",
  break_start: null,
  break_end: null,
  closed: false,
};

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;


function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // Monday=0
  x.setDate(x.getDate() - day);
  return x;
}

function Agenda() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [presetDay, setPresetDay] = useState<Date | null>(null);
  const [modal, setModal] = useState(false);
  const [reminder, setReminder] = useState<WhatsAppReminder | null>(null);
  const [editAppt, setEditAppt] = useState<any | null>(null);
  const [signAppt, setSignAppt] = useState<any | null>(null);
  const [confirmUnlockDay, setConfirmUnlockDay] = useState<Date | null>(null);
  const [confirmUnlockSlot, setConfirmUnlockSlot] = useState<{ d: Date; m: number } | null>(null);
  const [confirmOffHours, setConfirmOffHours] = useState<{ d: Date; m: number } | null>(null);
  const [confirmUnlockRow, setConfirmUnlockRow] = useState<number | null>(null);
  const [confirmLockRow, setConfirmLockRow] = useState<number | null>(null);
  const [drag, setDrag] = useState<{
    id: string;
    grabDy: number;
    colWidth: number;
    dayIndex: number;
    minutes: number;
    moved: boolean;
  } | null>(null);
  const [pendingMove, setPendingMove] = useState<{
    id: string;
    clientName: string;
    fromLabel: string;
    toLabel: string;
    starts_at: string;
    ends_at: string;
  } | null>(null);
  const [resize, setResize] = useState<{
    id: string;
    edge: "top" | "bottom";
    startMin: number;
    endMin: number;
    moved: boolean;
  } | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const qc = useQueryClient();
  const getAppts = useServerFn(listAppointments);
  const getClients = useServerFn(listClients);
  const getServices = useServerFn(listServices);
  const create = useServerFn(createAppointment);
  const del = useServerFn(deleteAppointment);
  const update = useServerFn(updateAppointment);
  const createCli = useServerFn(createClient);
  const createTreat = useServerFn(createTreatment);
  const updateTreat = useServerFn(updateTreatment);
  const closeTreat = useServerFn(closeTreatment);
  const completeAppt = useServerFn(completeAppointmentSession);
  const getTreatments = useServerFn(listTreatments);
  const getReceivables = useServerFn(listReceivables);
  const tenant = useTenant();

  const from = new Date(weekStart);
  const to = new Date(weekStart);
  to.setDate(to.getDate() + 7);
  to.setMilliseconds(-1);

  const appts = useQuery({
    queryKey: ["appts", "week", weekStart.toISOString()],
    queryFn: () => getAppts({ data: { from: from.toISOString(), to: to.toISOString() } }),
  });
  const clients = useQuery({ queryKey: ["clients"], queryFn: () => getClients() });
  const services = useQuery({ queryKey: ["services"], queryFn: () => getServices() });
  const treatments = useQuery({
    queryKey: ["treatments"],
    queryFn: () => getTreatments(),
    
  });
  const receivables = useQuery({ queryKey: ["receivables"], queryFn: () => getReceivables() });
  const getSchedule = useServerFn(listHours);
  const addBlock = useServerFn(createBlock);
  const removeBlock = useServerFn(deleteBlock);
  const schedule = useQuery({ queryKey: ["schedule"], queryFn: () => getSchedule() });
  const blocks = (schedule.data?.blocks ?? []) as Array<{
    id: string;
    starts_at: string;
    ends_at: string;
    reason: string | null;
    kind: string;
  }>;

  // Horario del negocio (tabla de Ajustes / registro) → define la agenda
  const weekHours = useMemo<DayHours[]>(() => {
    const rows = (schedule.data?.hours ?? []) as DayHours[];
    return Array.from({ length: 7 }, (_, weekday) => {
      const found = rows.find((h) => h.weekday === weekday);
      return found ? { ...found, weekday } : { weekday, ...DEFAULT_DAY };
    });
  }, [schedule.data]);

  const hoursForWeekday = (weekday: number) => weekHours[weekday];

  const HOURS = useMemo(() => {
    const open = weekHours.filter((h) => !h.closed);
    const min = open.length ? Math.min(...open.map((h) => toMin(h.open_time))) : 9 * 60;
    const max = open.length ? Math.max(...open.map((h) => toMin(h.close_time))) : 18 * 60;
    const startHour = Math.max(0, Math.floor(min / 60));
    const endHour = Math.min(24, Math.ceil(max / 60));
    const length = Math.max(1, endHour - startHour);
    return Array.from({ length }, (_, i) => startHour + i);
  }, [weekHours]);

  const SLOTS = useMemo(
    () => Array.from({ length: HOURS.length * (60 / SLOT_MIN) }, (_, i) => HOURS[0] * 60 + i * SLOT_MIN),
    [HOURS],
  );

  const paidByAppt = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of receivables.data ?? []) {
      if (r.appointment_id) map.set(r.appointment_id, r.paid_cents ?? 0);
    }
    return map;
  }, [receivables.data]);

  // Número de sesión de cada cita dentro de su tratamiento (ordenadas por fecha).
  const sessionNumberByAppt = useMemo(() => {
    const map = new Map<string, number>();
    const byTr = new Map<string, { id: string; starts_at: string }[]>();
    for (const a of appts.data ?? []) {
      if (!a.treatment_id || a.status === "cancelled") continue;
      const arr = byTr.get(a.treatment_id) ?? [];
      arr.push({ id: a.id, starts_at: a.starts_at });
      byTr.set(a.treatment_id, arr);
    }
    for (const arr of byTr.values()) {
      arr.sort((x, y) => x.starts_at.localeCompare(y.starts_at));
      arr.forEach((a, i) => map.set(a.id, i + 1));
    }
    return map;
  }, [appts.data]);

  const persistHours = useServerFn(saveHours);
  const hoursMut = useMutation({
    mutationFn: (hours: DayHours[]) =>
      persistHours({
        data: {
          hours: hours.map((h) => ({
            weekday: h.weekday,
            open_time: h.open_time,
            close_time: h.close_time,
            break_start: h.break_start,
            break_end: h.break_end,
            closed: h.closed,
          })),
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule"] }),
    onError: (e: any) => toast.error(e?.message ?? "No se pudo actualizar el horario"),
  });

  // Si una cita queda fuera del horario del día, se amplía el horario guardado.
  function syncHoursWithAppointment(date: Date, startMin: number, endMin: number) {
    const weekday = date.getDay();
    const current = weekHours[weekday];
    const open = current.closed ? startMin : Math.min(toMin(current.open_time), startMin);
    const close = current.closed ? endMin : Math.max(toMin(current.close_time), endMin);
    if (!current.closed && open === toMin(current.open_time) && close === toMin(current.close_time)) return;
    const next = weekHours.map((h) =>
      h.weekday === weekday
        ? { ...h, closed: false, open_time: toTime(Math.max(0, open)), close_time: toTime(Math.min(24 * 60 - 1, close)) }
        : h,
    );
    hoursMut.mutate(next, {
      onSuccess: () =>
        toast.success(
          `Horario del ${date.toLocaleDateString("es", { weekday: "long" })} actualizado: ${toTime(open)} – ${toTime(close)}`,
        ),
    });
  }

  // Amplía el horario del día para incluir una franja fuera de horario.
  function confirmOffHoursOpen() {
    if (!confirmOffHours) return;
    const { d, m } = confirmOffHours;
    const weekday = d.getDay();
    const current = weekHours[weekday];
    const startMin = m;
    const endMin = m + SLOT_MIN;
    const open = current.closed ? startMin : Math.min(toMin(current.open_time), startMin);
    const close = current.closed ? endMin : Math.max(toMin(current.close_time), endMin);
    const inBreak =
      !!current.break_start &&
      !!current.break_end &&
      startMin >= toMin(current.break_start) &&
      startMin < toMin(current.break_end);
    const next = weekHours.map((h) =>
      h.weekday === weekday
        ? {
            ...h,
            closed: false,
            open_time: toTime(Math.max(0, open)),
            close_time: toTime(Math.min(24 * 60 - 1, close)),
            break_start: inBreak ? null : h.break_start,
            break_end: inBreak ? null : h.break_end,
          }
        : h,
    );
    hoursMut.mutate(next, {
      onSuccess: () => toast.success("Horario ampliado para esa franja"),
      onSettled: () => setConfirmOffHours(null),
    });
  }





  const blockMut = useMutation({
    mutationFn: (v: { starts_at: string; ends_at: string; reason?: string | null; kind?: string }) =>
      addBlock({ data: { kind: "bloqueo", ...v } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule"] });
      toast.success("Horario bloqueado — ya no aparece disponible en el enlace de reservas");
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo bloquear"),
  });

  const unblockMut = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => removeBlock({ data: { id } }))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule"] });
      toast.success("Bloqueo liberado");
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo liberar el bloqueo"),
  });

  const openSlotFn = useServerFn(openSlot);
  const openSlotMut = useMutation({
    mutationFn: (v: { starts_at: string; ends_at: string }) => openSlotFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule"] });
      toast.success("Hora abierta — solo esa franja quedó disponible");
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo abrir la hora"),
  });

  // Abre la misma franja en varios días sin destruir bloqueos de día completo.
  const openManySlotsMut = useMutation({
    mutationFn: async (rows: { starts_at: string; ends_at: string }[]) => {
      for (const v of rows) await openSlotFn({ data: v });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule"] });
      toast.success("Franja abierta en la semana — el resto de los bloqueos se mantiene");
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo abrir la franja"),
  });

  const blockManyMut = useMutation({
    mutationFn: (rows: { starts_at: string; ends_at: string; reason?: string | null; kind?: string }[]) =>
      Promise.all(rows.map((v) => addBlock({ data: { kind: "bloqueo", ...v } }))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule"] });
      toast.success("Franja horaria bloqueada en toda la semana");
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo bloquear la franja"),
  });


  const pendingOnline = useMemo(
    () =>
      [...(appts.data ?? [])]
        .filter((a: any) => a.status === "pending")
        .sort((a: any, b: any) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [appts.data],
  );

  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: "scheduled" | "cancelled" }) => update({ data: v }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["appts"] });
      toast.success(v.status === "scheduled" ? "Reserva confirmada" : "Reserva rechazada — horario liberado");
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo actualizar la reserva"),
  });


  const deleteMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appts"] });
      toast.success("Cita eliminada");
    },
  });

  const moveMut = useMutation({
    mutationFn: (v: { id: string; starts_at: string; ends_at: string; service_id?: string | null; price_cents?: number | null }) =>
      update({ data: v }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["appts"] });
      const d = new Date(v.starts_at);
      const e = new Date(v.ends_at);
      syncHoursWithAppointment(d, d.getHours() * 60 + d.getMinutes(), e.getHours() * 60 + e.getMinutes());
      toast.success(
        `Cita reagendada: ${d.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "short" })} ${d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}`,
      );
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo reagendar la cita"),
  });

  const updateTreatMut = useMutation({
    mutationFn: (v: { id: string; total_cents?: number; sessions_total?: number }) => updateTreat({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["treatments"] });
      toast.success("Tratamiento actualizado");
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo actualizar el tratamiento"),
  });

  const closeTreatMut = useMutation({
    mutationFn: (v: { id: string; reopen?: boolean }) => closeTreat({ data: v }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["treatments"] });
      qc.invalidateQueries({ queryKey: ["receivables"] });
      toast.success(v.reopen ? "Tratamiento reabierto" : "Tratamiento finalizado");
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo actualizar el tratamiento"),
  });

  const completeApptMut = useMutation({
    mutationFn: (v: {
      id: string;
      completed: boolean;
      signature_data_url?: string | null;
      signed_by_name?: string | null;
    }) => completeAppt({ data: v }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["appts"] });
      qc.invalidateQueries({ queryKey: ["treatments"] });
      toast.success(
        v.completed ? "Sesión confirmada con la firma del cliente" : "Sesión marcada como no realizada",
      );
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo actualizar la sesión"),
  });

  // Al chulear una sesión pedimos la firma del cliente; al deshacer, no.
  function toggleSession(a: any) {
    if (a.status === "completed") {
      completeApptMut.mutate({ id: a.id, completed: false });
      return;
    }
    setSignAppt(a);
  }

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [weekStart],
  );

  // Convierte la posición del puntero en día + minutos (franjas de 15 min),
  // usando el punto donde el usuario agarró la tarjeta.
  function pointToSlot(clientX: number, clientY: number, grabDy: number) {
    const grid = gridRef.current;
    if (!grid) return null;
    const rect = grid.getBoundingClientRect();
    const colWidth = (rect.width - 72) / 7;
    const dayIndex = Math.min(6, Math.max(0, Math.floor((clientX - rect.left - 72) / colWidth)));
    const topY = clientY - grabDy - rect.top;
    const rawMin = HOURS[0] * 60 + (topY / SLOT_HEIGHT) * 60;
    const snapped = Math.round(rawMin / SLOT_MIN) * SLOT_MIN;
    const minutes = Math.min(
      Math.max(snapped, HOURS[0] * 60),
      (HOURS[HOURS.length - 1] + 1) * 60 - SLOT_MIN,
    );
    return { dayIndex, minutes, colWidth };
  }

  function startDrag(e: React.PointerEvent, a: any) {
    if ((e.target as HTMLElement).closest("button")) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    const cardRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const grabDy = e.clientY - cardRect.top;
    const slot = pointToSlot(e.clientX, e.clientY, grabDy);
    if (!slot) return;
    setDrag({ id: a.id, grabDy, colWidth: slot.colWidth, dayIndex: slot.dayIndex, minutes: slot.minutes, moved: false });
  }

  function startResize(e: React.PointerEvent, a: any, edge: "top" | "bottom") {
    e.preventDefault();
    e.stopPropagation();
    const s = new Date(a.starts_at);
    const en = new Date(a.ends_at);
    setResize({
      id: a.id,
      edge,
      startMin: s.getHours() * 60 + s.getMinutes(),
      endMin: en.getHours() * 60 + en.getMinutes(),
      moved: false,
    });
  }

  useEffect(() => {
    if (!resize) return;
    const onMove = (e: PointerEvent) => {
      const slot = pointToSlot(e.clientX, e.clientY, 0);
      if (!slot) return;
      setResize((r) => {
        if (!r) return r;
        if (r.edge === "top") {
          const startMin = Math.min(slot.minutes, r.endMin - SLOT_MIN);
          return startMin === r.startMin ? r : { ...r, startMin, moved: true };
        }
        const endMin = Math.max(slot.minutes, r.startMin + SLOT_MIN);
        return endMin === r.endMin ? r : { ...r, endMin, moved: true };
      });
    };
    const onUp = () => {
      const cur = resize;
      setResize(null);
      if (!cur?.moved) return;
      const appt = (appts.data ?? []).find((x: any) => x.id === cur.id) as any;
      if (!appt) return;
      const base = new Date(appt.starts_at);
      const starts = new Date(base);
      starts.setHours(Math.floor(cur.startMin / 60), cur.startMin % 60, 0, 0);
      const ends = new Date(base);
      ends.setHours(Math.floor(cur.endMin / 60), cur.endMin % 60, 0, 0);
      if (starts.getTime() === base.getTime() && ends.getTime() === new Date(appt.ends_at).getTime()) return;
      setPendingMove({
        id: cur.id,
        clientName: appt.clients?.name ?? "la cita",
        fromLabel: fmtMoveLabel(new Date(appt.starts_at), new Date(appt.ends_at)),
        toLabel: fmtMoveLabel(starts, ends),
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  });

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const slot = pointToSlot(e.clientX, e.clientY, drag.grabDy);
      if (!slot) return;
      setDrag((d) =>
        d
          ? {
              ...d,
              colWidth: slot.colWidth,
              dayIndex: slot.dayIndex,
              minutes: slot.minutes,
              moved: d.moved || slot.dayIndex !== d.dayIndex || slot.minutes !== d.minutes,
            }
          : d,
      );
    };
    const onUp = () => {
      const cur = drag;
      setDrag(null);
      if (!cur?.moved) return;
      const appt = (appts.data ?? []).find((x: any) => x.id === cur.id) as any;
      if (!appt) return;
      const target = new Date(days[cur.dayIndex]);
      target.setHours(Math.floor(cur.minutes / 60), cur.minutes % 60, 0, 0);
      const oldStart = new Date(appt.starts_at);
      const duration = new Date(appt.ends_at).getTime() - oldStart.getTime();
      if (target.getTime() === oldStart.getTime()) return;
      const newEnd = new Date(target.getTime() + duration);
      setPendingMove({
        id: cur.id,
        clientName: appt.clients?.name ?? "la cita",
        fromLabel: fmtMoveLabel(oldStart, new Date(appt.ends_at)),
        toLabel: fmtMoveLabel(target, newEnd),
        starts_at: target.toISOString(),
        ends_at: newEnd.toISOString(),
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  });

  const rangeLabel = useMemo(() => {
    const end = days[6];
    const sameMonth = weekStart.getMonth() === end.getMonth();
    const a = weekStart.toLocaleDateString("es", { day: "numeric", month: sameMonth ? undefined : "short" });
    const b = end.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
    return `${a} — ${b}`;
  }, [days, weekStart]);

  function shiftWeek(delta: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(d);
  }

  function toWeekInput(d: Date) {
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayNum = (t.getDay() + 6) % 7;
    t.setDate(t.getDate() - dayNum + 3);
    const firstThursday = new Date(t.getFullYear(), 0, 4);
    const fDayNum = (firstThursday.getDay() + 6) % 7;
    firstThursday.setDate(firstThursday.getDate() - fDayNum + 3);
    const week = 1 + Math.round((t.getTime() - firstThursday.getTime()) / (7 * 86400000));
    return `${t.getFullYear()}-W${String(week).padStart(2, "0")}`;
  }

  function fromWeekInput(value: string) {
    const m = /^(\d{4})-W(\d{2})$/.exec(value);
    if (!m) return;
    const year = Number(m[1]);
    const week = Number(m[2]);
    const jan4 = new Date(year, 0, 4);
    const jan4Day = (jan4.getDay() + 6) % 7;
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - jan4Day + (week - 1) * 7);
    setWeekStart(startOfWeek(monday));
  }

  const today = new Date();
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  function openNewAt(d: Date, minutes?: number) {
    const day = new Date(d);
    if (minutes !== undefined) day.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    setPresetDay(day);
    setModal(true);
  }

  function slotRange(d: Date, minutes: number, length = SLOT_MIN) {
    const s = new Date(d);
    s.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    const e = new Date(s.getTime() + length * 60000);
    return { s, e };
  }

  function blocksOverlapping(startsAt: Date, endsAt: Date) {
    return blocks.filter(
      (b) => new Date(b.starts_at) < endsAt && new Date(b.ends_at) > startsAt,
    );
  }

  function isSlotBlocked(d: Date, minutes: number) {
    const { s, e } = slotRange(d, minutes);
    return blocksOverlapping(s, e).length > 0;
  }

  function dayBlocks(d: Date) {
    const s = new Date(d);
    s.setHours(0, 0, 0, 0);
    const e = new Date(s);
    e.setDate(e.getDate() + 1);
    return blocksOverlapping(s, e);
  }

  function isDayFullyBlocked(d: Date) {
    const s = new Date(d);
    s.setHours(0, 0, 0, 0);
    const e = new Date(s);
    e.setDate(e.getDate() + 1);
    return blocks.some((b) => new Date(b.starts_at) <= s && new Date(b.ends_at) >= e);
  }

  function toggleSlotBlock(d: Date, minutes: number) {
    const { s, e } = slotRange(d, minutes);
    const existing = blocksOverlapping(s, e);
    if (existing.length > 0) {
      unblockMut.mutate(existing.map((b) => b.id));
      return;
    }
    blockMut.mutate({ starts_at: s.toISOString(), ends_at: e.toISOString(), kind: "franja", reason: "Horario no disponible" });
  }

  // Abre solo una franja puntual (aunque el día o la fila completa estén bloqueados).
  function confirmSlotUnlock() {
    if (!confirmUnlockSlot) return;
    const { s, e } = slotRange(confirmUnlockSlot.d, confirmUnlockSlot.m);
    openSlotMut.mutate(
      { starts_at: s.toISOString(), ends_at: e.toISOString() },
      { onSettled: () => setConfirmUnlockSlot(null) },
    );
  }

  function confirmDayUnlock() {
    if (!confirmUnlockDay) return;
    const existing = dayBlocks(confirmUnlockDay);
    if (existing.length > 0) {
      unblockMut.mutate(existing.map((b) => b.id));
    }
    // Si el día está marcado como cerrado en el horario del negocio, se abre.
    const weekday = confirmUnlockDay.getDay();
    if (weekHours[weekday]?.closed) {
      hoursMut.mutate(
        weekHours.map((h) => (h.weekday === weekday ? { ...h, closed: false } : h)),
      );
    }
    setConfirmUnlockDay(null);
  }


  function toggleDayBlock(d: Date) {
    const existing = dayBlocks(d);
    if (existing.length > 0 || weekHours[d.getDay()]?.closed) {
      setConfirmUnlockDay(d);
      return;
    }
    const s = new Date(d);
    s.setHours(0, 0, 0, 0);
    const e = new Date(s);
    e.setDate(e.getDate() + 1);
    blockMut.mutate({ starts_at: s.toISOString(), ends_at: e.toISOString(), kind: "dia", reason: "Día no disponible" });
  }

  // Bloqueo horizontal: misma franja horaria en todos los días de la semana visible
  function isRowBlocked(minutes: number) {
    // Un día cerrado según el horario cuenta como bloqueado para la fila,
    // así el candado lateral refleja el estado real aunque haya días cerrados.
    return days.every((d) => isSlotBlocked(d, minutes) || !!weekHours[d.getDay()]?.closed);
  }

  function toggleRowBlock(minutes: number) {
    // Si la franja ya está bloqueada en todos los días (por bloqueo horizontal,
    // por día completo o mixto), pedimos confirmación y abrimos SOLO esa franja.
    if (isRowBlocked(minutes)) {
      setConfirmUnlockRow(minutes);
      return;
    }
    // Bloquear: pedimos confirmación antes de cerrar la franja en toda la semana.
    const pendientes = days.filter(
      (d) => !weekHours[d.getDay()]?.closed && !isSlotBlocked(d, minutes),
    );
    if (pendientes.length === 0) return;
    setConfirmLockRow(minutes);
  }

  function confirmRowLock() {
    if (confirmLockRow == null) return;
    const rows = days
      .filter((d) => !weekHours[d.getDay()]?.closed && !isSlotBlocked(d, confirmLockRow))
      .map((d) => {
        const { s, e } = slotRange(d, confirmLockRow);
        return {
          starts_at: s.toISOString(),
          ends_at: e.toISOString(),
          kind: "franja",
          reason: "Horario no disponible",
        };
      });
    if (rows.length === 0) {
      setConfirmLockRow(null);
      return;
    }
    blockManyMut.mutate(rows, { onSettled: () => setConfirmLockRow(null) });
  }

  function confirmRowUnlock() {
    if (confirmUnlockRow == null) return;
    const rows = days
      .filter((d) => isSlotBlocked(d, confirmUnlockRow))
      .map((d) => {
        const { s, e } = slotRange(d, confirmUnlockRow);
        return { starts_at: s.toISOString(), ends_at: e.toISOString() };
      });
    openManySlotsMut.mutate(rows, { onSettled: () => setConfirmUnlockRow(null) });
  }

  const bookingSlug = tenant.business?.slug ?? null;
  const bookingUrl =
    typeof window !== "undefined" && bookingSlug ? `${window.location.origin}/booking/${bookingSlug}` : "";



  return (
    <div className="p-4 md:p-8 max-w-[1400px]">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl">Agenda</h1>
          <div className="mt-1 flex items-center gap-3 flex-wrap">
            <p className="text-muted-foreground capitalize">{rangeLabel}</p>
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <span className="sr-only">Buscar semana</span>
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => shiftWeek(-1)}
                  className="p-1.5 rounded-lg border border-border hover:bg-secondary"
                  aria-label="Semana anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <input
                  type="week"
                  value={toWeekInput(weekStart)}
                  onChange={(e) => fromWeekInput(e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                  aria-label="Buscar semana"
                />
                <button
                  type="button"
                  onClick={() => shiftWeek(1)}
                  className="p-1.5 rounded-lg border border-border hover:bg-secondary"
                  aria-label="Semana siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </label>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => shiftWeek(-1)} className="p-2 rounded-lg border border-border hover:bg-secondary" aria-label="Semana anterior"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="px-3 py-2 text-sm rounded-lg border border-border hover:bg-secondary">Hoy</button>
          <button onClick={() => shiftWeek(1)} className="p-2 rounded-lg border border-border hover:bg-secondary" aria-label="Semana siguiente"><ChevronRight className="h-4 w-4" /></button>
          <BackupButtons />

          <button onClick={() => { setPresetDay(null); setModal(true); }} className="ml-2 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
            <Plus className="h-4 w-4" /> Nueva cita
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Consejo: arrastra una cita y suéltala en otro día u hora para reagendarla automáticamente. Usa el candado de cada
        franja (o “Bloquear día”) para reservar espacios: lo que bloquees desaparece al instante del enlace de reservas.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Enlace de reservas para clientes</span>
        {bookingUrl ? (
          <>
            <code className="truncate rounded bg-secondary px-2 py-1 text-xs">{bookingUrl}</code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(bookingUrl);
                toast.success("Enlace copiado");
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-secondary"
            >
              <Copy className="h-3.5 w-3.5" /> Copiar
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Hola! Puedes reservar tu cita aquí: ${bookingUrl}`)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Enviar por WhatsApp
            </a>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">Configura tu negocio en Ajustes para generar el enlace.</span>
        )}
      </div>

      {pendingOnline.length > 0 && (
        <div className="mt-4 rounded-2xl border border-sky-500/40 bg-sky-500/5 p-4">
          <h2 className="font-serif text-xl">Reservas online por confirmar ({pendingOnline.length})</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Estas citas llegaron desde tu enlace de reservas. Confírmalas o recházalas; el horario se libera al rechazar.
          </p>
          <div className="mt-3 space-y-2">
            {pendingOnline.map((a: any) => {
              const start = new Date(a.starts_at);
              const phone = (a.client?.whatsapp || a.client?.phone) as string | undefined;
              return (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{a.client?.full_name ?? "Cliente"}</div>
                    <div className="text-xs text-muted-foreground">
                      {start.toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" })} ·{" "}
                      {start.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                      {a.service?.name ? ` · ${a.service.name}` : ""}
                      {phone ? ` · ${phone}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => statusMut.mutate({ id: a.id, status: "scheduled" })}
                      disabled={statusMut.isPending}
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                    >
                      <Check className="h-3.5 w-3.5" /> Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => statusMut.mutate({ id: a.id, status: "cancelled" })}
                      disabled={statusMut.isPending}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-secondary"
                    >
                      <X className="h-3.5 w-3.5" /> Rechazar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}




      <div className="mt-6 rounded-2xl overflow-x-auto border border-[#2a2320] bg-[#1a1512] text-neutral-100 shadow-lg">
        <div className="min-w-[820px]">
        {/* Header row */}
        <div className="grid" style={{ gridTemplateColumns: `72px repeat(7, minmax(0,1fr))` }}>
          <div className="border-b border-r border-white/5" />
          {days.map((d, i) => {
            const active = isSameDay(d, today);
            const dayClosed = !!hoursForWeekday(d.getDay())?.closed;
            const dayBlocked = isDayFullyBlocked(d) || dayClosed;
            return (
              <div key={i} className="border-b border-white/5 py-3 text-center">
                <div className="text-[11px] uppercase tracking-wider text-neutral-400">{DAY_NAMES[i]}</div>
                <div className={`mt-1 mx-auto w-9 h-9 flex items-center justify-center rounded-full text-lg font-medium ${active ? "bg-primary text-primary-foreground" : dayBlocked ? "text-neutral-500" : "text-neutral-100"}`}>
                  {d.getDate()}
                </div>
                <button
                  type="button"
                  onClick={() => toggleDayBlock(d)}
                  className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
                    dayBlocked
                      ? "bg-lavender text-ink hover:bg-lavender/80"
                      : "border border-white/15 text-neutral-300 hover:bg-white/10"
                  }`}
                  title={
                    dayBlocked
                      ? "Día bloqueado — toca para confirmar apertura"
                      : "Bloquear día completo"
                  }
                >
                  {dayBlocked ? <LockOpen className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  {dayBlocked ? "Liberar día" : "Bloquear día"}
                </button>
              </div>
            );
          })}

        </div>

        {/* Body grid */}
        <div ref={gridRef} className="relative grid" style={{ gridTemplateColumns: `72px repeat(7, minmax(0,1fr))` }}>
          {/* Franjas de 15 minutos */}
          <div className="border-r border-white/5">
            {SLOTS.map((m) => {
              const rowBlocked = isRowBlocked(m);
              return (
                <div
                  key={m}
                  style={{ height: SLOT_PX }}
                  className={`group/row relative flex items-center justify-end gap-1 pr-2 border-b border-white/5 text-[10px] ${
                    rowBlocked ? "bg-lavender/15" : ""
                  } ${m % 60 === 0 ? "text-neutral-300 font-medium" : "text-neutral-500"}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleRowBlock(m)}
                    title={
                      rowBlocked
                        ? `Abrir ${fmtSlot(m)} en toda la semana (pide confirmación)`
                        : `Cerrar ${fmtSlot(m)} en todos los días de la semana (pide confirmación)`
                    }
                    aria-label={rowBlocked ? `Abrir franja ${fmtSlot(m)} de la semana` : `Cerrar franja ${fmtSlot(m)} de la semana`}
                    className={`shrink-0 rounded p-0.5 transition ${
                      rowBlocked
                        ? "text-lavender hover:text-lavender/80"
                        : "text-neutral-500 hover:text-lavender"
                    }`}
                  >
                    {rowBlocked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
                  </button>
                  <span className="tabular-nums">{fmtSlot(m)}</span>
                </div>
              );
            })}
          </div>


          {/* Day columns */}
          {days.map((d, di) => {
            const dayAppts = (appts.data ?? []).filter((a) => isSameDay(new Date(a.starts_at), d));
            const fullDayBlocked = isDayFullyBlocked(d);
            return (
              <div key={di} className="relative border-r border-white/5 last:border-r-0">
                {SLOTS.map((m) => {
                  const blocked = isSlotBlocked(d, m);
                  const dh = hoursForWeekday(d.getDay());
                  const inBreak =
                    !!dh.break_start && !!dh.break_end && m >= toMin(dh.break_start) && m < toMin(dh.break_end);
                  const offHours =
                    dh.closed || m < toMin(dh.open_time) || m >= toMin(dh.close_time) || inBreak;
                  const taken = dayAppts.some((a) => {
                    const s = new Date(a.starts_at);
                    const e = new Date(a.ends_at);
                    const sm = s.getHours() * 60 + s.getMinutes();
                    const em = e.getHours() * 60 + e.getMinutes();
                    return m < em && m + SLOT_MIN > sm;
                  });
                  const dayClosed = !!dh.closed;
                  return (
                    <div key={m} style={{ height: SLOT_PX }} className="relative group/slot">
                      <button
                         onClick={() => {
                            if (fullDayBlocked || blocked) return;
                            if (offHours) {
                              // Incluye días cerrados: permite abrir solo esta hora con confirmación.
                              setConfirmOffHours({ d, m });
                              return;
                            }
                            openNewAt(d, m);
                          }}
                        style={{ height: SLOT_PX }}
                        title={
                           dayClosed
                              ? "Día cerrado — toca aquí o en el candado para abrir solo esta hora"
                             : fullDayBlocked
                               ? "Día bloqueado — usa Liberar día para abrirlo"
                               : blocked
                                 ? "Franja bloqueada — usa el candado para liberarla"
                            : offHours
                              ? "Fuera del horario del negocio — usa el candado para abrir esta hora"
                              : undefined
                        }
                        aria-label={
                          dayClosed
                             ? `Día cerrado ${DAY_NAMES[di]}`
                             : fullDayBlocked
                               ? `Día bloqueado ${DAY_NAMES[di]}`
                            : blocked
                               ? `Franja bloqueada ${fmtSlot(m)}`
                              : offHours
                                ? `Fuera de horario ${fmtSlot(m)}`
                              : `Nueva cita ${fmtSlot(m)}`
                        }
                         className={`w-full block transition border-b ${m % 60 === 0 ? "border-white/10" : "border-white/[0.04]"} ${
                            blocked || dayClosed || offHours
                              ? "bg-lavender/20 hover:bg-lavender/30"
                              : "hover:bg-white/[0.06]"
                          }`}
                      />

                       {!taken && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                              if (blocked) {
                                setConfirmUnlockSlot({ d, m });
                                return;
                              }
                              if (offHours) {
                                setConfirmOffHours({ d, m });
                                return;
                              }
                              toggleSlotBlock(d, m);
                          }}
                          className={`absolute right-0.5 top-0.5 z-10 rounded p-0.5 transition ${
                            blocked || offHours
                               ? "bg-lavender text-ink opacity-100"
                               : "bg-white/15 text-neutral-100 opacity-0 group-hover/slot:opacity-100"
                          }`}
                           aria-label={blocked || offHours ? `Abrir solo la franja ${fmtSlot(m)}` : `Bloquear franja ${fmtSlot(m)}`}
                           title={blocked || offHours ? "Abrir solo esta hora (pide confirmación)" : "Bloquear esta franja"}
                        >
                          {blocked || offHours ? <LockOpen className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
                        </button>
                      )}
                    </div>
                  );
                })}

                {dayAppts.map((a) => {
                  const start = new Date(a.starts_at);
                  const end = new Date(a.ends_at);
                  const startMin = start.getHours() * 60 + start.getMinutes();
                  const endMin = end.getHours() * 60 + end.getMinutes();
                  const resizing = resize?.id === a.id ? resize : null;
                  const shownStart = resizing ? resizing.startMin : startMin;
                  const shownEnd = resizing ? resizing.endMin : endMin;
                  const top = ((shownStart - HOURS[0] * 60) / 60) * SLOT_HEIGHT;
                  const height = Math.max(28, ((shownEnd - shownStart) / 60) * SLOT_HEIGHT - 2);
                  const color = (a as any).service?.color ?? "#CDB4DB";
                  const phone = ((a as any).client?.whatsapp || (a as any).client?.phone) as string | undefined;
                  const waReminder = phone ? buildWhatsAppReminder(phone, a) : null;
                  const tr =
                    (a.treatment_id
                      ? (treatments.data ?? []).find((t) => t.id === a.treatment_id)
                      : (treatments.data ?? []).find(
                          (t) => t.client_id === (a as any).client_id && t.status === "open",
                        )) ?? null;
                  const trPendingSessions = tr ? Math.max(0, tr.sessions_total - tr.sessions_done) : 0;
                  const sessionsDone = !!tr && tr.status === "open" && trPendingSessions === 0;
                  const trReady = sessionsDone && tr!.balance_cents <= 0;
                  const treatmentPaidAndClosed = !!tr && tr.status === "closed" && tr.balance_cents <= 0;
                  const treatmentPaidWithPendingSessions =
                    !!tr &&
                    tr.balance_cents <= 0 &&
                    tr.total_cents > 0 &&
                    trPendingSessions > 0 &&
                    a.status !== "completed" &&
                    a.status !== "cancelled";
                  const payRatio = tr && tr.total_cents > 0 ? Math.min(1, tr.paid_cents / tr.total_cents) : 0;
                  const apptPaid = paidByAppt.get(a.id) ?? 0;
                  const trFullyPaid = !!tr && tr.total_cents > 0 && tr.paid_cents >= tr.total_cents;
                  const isCompleted = a.status === "completed";
                  // Sesión paga cuando su número dentro del tratamiento ya está cubierto por los abonos.
                  const sessionNumber = sessionNumberByAppt.get(a.id) ?? null;
                  const sessionPaid = !!tr && sessionNumber !== null && sessionNumber <= tr.sessions_paid;
                  const hasPendingBalance = !!tr && sessionNumber !== null && sessionNumber > tr.sessions_paid;

                  let baseColor: string;
                  if (treatmentPaidAndClosed) {
                    baseColor = "#689B20"; // verde oliva intenso del branding: tratamiento finalizado y pagado
                  } else if (sessionPaid) {
                    baseColor = "#34D399"; // verde: sesión con abono
                  } else if (isCompleted) {
                    baseColor = "#8FB996";
                  } else if (treatmentPaidWithPendingSessions) {
                    baseColor = "#BAE6FD";
                  } else {
                    baseColor = color;
                  }

                  const cardColor = hasPendingBalance
                    ? `linear-gradient(to bottom, ${baseColor} 50%, #F59E0B 50%)`
                    : baseColor;
                  const textColor = hasPendingBalance ? "#1a1512" : readableText(baseColor);

                  const dragging = drag?.id === a.id && drag.moved;
                  const previewTop = dragging ? ((drag!.minutes - HOURS[0] * 60) / 60) * SLOT_HEIGHT : top;

                  return (
                    <div
                      key={a.id}
                      data-appt-card={a.id}
                      onPointerDown={(e) => startDrag(e, a)}
                      className={`absolute left-1 right-1 rounded-md p-1.5 pr-9 text-[11px] leading-tight overflow-visible group cursor-grab active:cursor-grabbing touch-none select-none ${dragging ? "z-40 shadow-2xl ring-2 ring-white/70" : ""}`}
                      style={{
                        top,
                        height,
                        background: cardColor,
                        color: textColor,

                        transform: dragging
                          ? `translate(${(drag!.dayIndex - di) * drag!.colWidth}px, ${previewTop - top}px)`
                          : undefined,
                      }}
                      title={`${(a as any).client?.full_name} — ${(a as any).service?.name ?? ""}`}
                    >
                      {dragging && (
                        <div className="absolute -top-5 left-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground shadow">
                          {DAY_NAMES[drag!.dayIndex]} {fmtSlot(drag!.minutes)}
                        </div>
                      )}
                      {resizing && (
                        <div className="absolute -top-5 left-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground shadow">
                          {fmtSlot(shownStart)} – {fmtSlot(shownEnd)}
                        </div>
                      )}
                      <div
                        onPointerDown={(e) => startResize(e, a, "top")}
                        className="absolute left-0 right-0 -top-1 h-2.5 cursor-ns-resize touch-none"
                        title="Arrastra para cambiar la hora de inicio"
                      >
                        <div className="mx-auto mt-1 h-0.5 w-8 rounded-full bg-foreground/30 opacity-0 group-hover:opacity-100" />
                      </div>
                      <div
                        onPointerDown={(e) => startResize(e, a, "bottom")}
                        className="absolute left-0 right-0 -bottom-1 h-2.5 cursor-ns-resize touch-none z-30"
                        title="Arrastra para cambiar la hora final"
                      >
                        <div className="mx-auto mt-1 h-0.5 w-8 rounded-full bg-foreground/30 opacity-0 group-hover:opacity-100" />
                      </div>
                      <div className="font-semibold truncate flex items-center gap-1">
                        <span className="truncate">{(a as any).client?.full_name}</span>
                        {isCompleted && <CheckCircle2 className="h-3 w-3 shrink-0" />}
                      </div>
                      <div className="opacity-80 line-clamp-2">
                        {isCompleted ? "✓ Realizada — " : ""}{(a as any).service?.name ?? "Cita"}
                      </div>
                      {tr && (
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          <span className="rounded bg-foreground/10 px-1 py-[1px] text-[10px] font-medium">
                            {tr.sessions_done}/{tr.sessions_total} ses · {trPendingSessions} pend
                          </span>
                          <span
                            className={`rounded px-1 py-[1px] text-[10px] font-semibold ${tr.balance_cents > 0 ? "bg-amber-500 text-black" : "bg-emerald-500 text-white"}`}
                            title={tr.balance_cents > 0 ? "Saldo pendiente por pagar" : treatmentPaidWithPendingSessions ? "Tratamiento pagado · faltan sesiones" : "Tratamiento pagado"}
                          >
                            {tr.balance_cents > 0 ? formatMoney(tr.balance_cents, tenant.currency) : treatmentPaidWithPendingSessions ? `Pagado · ${trPendingSessions} pend` : "Pagado"}
                          </span>
                        </div>
                      )}
                      {sessionsDone && (
                        <div className="mt-1">
                          {tr!.balance_cents > 0 ? (
                            <div className="rounded bg-black/15 px-1.5 py-1 text-[10px] font-semibold">
                              Sesiones completas · falta pagar {formatMoney(tr!.balance_cents, tenant.currency)}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                closeTreatMut.mutate({ id: tr!.id });
                              }}
                              className="w-full rounded bg-black/20 px-1.5 py-1 text-[10px] font-bold hover:bg-black/30"
                            >
                              Finalizar tratamiento
                            </button>
                          )}
                        </div>
                      )}

                      <div className="absolute top-1 right-1 z-20 flex flex-col gap-1">
                        {tr && a.status !== "cancelled" && (
                          <Button
                            type="button"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSession(a);
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className={`h-7 w-7 rounded-full shadow-md ring-2 ring-background transition ${
                              a.status === "completed"
                                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                                : "bg-white/90 text-emerald-700 hover:bg-emerald-100"
                            }`}
                            aria-label={a.status === "completed" ? "Sesión realizada (deshacer)" : "Marcar sesión como realizada"}
                            title={a.status === "completed" ? "Sesión realizada (deshacer)" : "Marcar sesión como realizada"}
                          >
                            <CircleCheckBig className="h-[18px] w-[18px]" strokeWidth={2.4} />
                          </Button>
                        )}
                        {trReady && (
                          <Button
                            type="button"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              closeTreatMut.mutate({ id: tr!.id });
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="h-7 w-7 rounded-full bg-emerald-500 text-white shadow-md ring-2 ring-background hover:bg-emerald-600"
                            aria-label="Finalizar tratamiento"
                            title="Tratamiento pagado — finalizar"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}

                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          onClick={(e) => { e.stopPropagation(); setEditAppt(a); }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="h-7 w-7 rounded-full bg-secondary text-secondary-foreground shadow-md ring-2 ring-background hover:bg-primary hover:text-primary-foreground"
                          aria-label="Editar horario de la cita"
                          title="Editar hora de inicio y fin"
                        >
                          <Pencil className="h-4 w-4" strokeWidth={2.3} />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (waReminder) {
                              setReminder(waReminder);
                              return;
                            }
                            toast.error("Añade un teléfono al cliente para enviar el recordatorio");
                          }}
                          className="h-7 w-7 rounded-full bg-whatsapp text-whatsapp-foreground shadow-md ring-2 ring-background hover:bg-whatsapp/90"
                          aria-label={`Enviar recordatorio de ${(a as any).client?.full_name ?? "la cita"} por WhatsApp`}
                          title={waReminder ? "Enviar recordatorio por WhatsApp" : "El cliente no tiene teléfono registrado"}
                        >
                          <WhatsAppIcon className="h-[18px] w-[18px]" />
                        </Button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteMut.mutate(a.id); }}
                          className="self-end p-0.5 rounded bg-foreground/20 opacity-0 hover:bg-foreground/40 group-hover:opacity-100"
                          aria-label={`Eliminar cita de ${(a as any).client?.full_name ?? "cliente"}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        </div>
      </div>

      {/* Lista de citas de la semana con recordatorio WhatsApp */}
      <div className="mt-8">
        <h2 className="font-serif text-2xl">Recordatorios de WhatsApp</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Envía recordatorios de cita o mensajes sutiles sobre saldos pendientes.
        </p>

        {/* Citas pendientes */}
        <div className="mt-6 space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Citas pendientes</h3>
          {(appts.data ?? []).filter((a) => a.status !== "completed").length === 0 && (
            <p className="text-sm text-muted-foreground">No hay citas pendientes esta semana.</p>
          )}
          {[...(appts.data ?? [])]
            .filter((a) => a.status !== "completed")
            .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
            .map((a) => {
              const phone = ((a as any).client?.whatsapp || (a as any).client?.phone) as string | undefined;
              const rem = phone ? buildWhatsAppReminder(phone, a) : null;
              const start = new Date(a.starts_at);
              const tr =
                (a.treatment_id
                  ? (treatments.data ?? []).find((t) => t.id === a.treatment_id)
                  : (treatments.data ?? []).find(
                      (t) => t.client_id === (a as any).client_id && t.status === "open",
                    )) ?? null;
              const trPending = tr ? Math.max(0, tr.sessions_total - tr.sessions_done) : 0;
              const debtRem = phone && tr && tr.balance_cents > 0
                ? buildDebtReminder(phone, (a as any).client?.full_name ?? "", (a as any).service?.name ?? "", tr.balance_cents, tenant.currency)
                : null;
              return (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{(a as any).client?.full_name ?? "Cliente"}</div>
                    <div className="text-xs text-muted-foreground">
                      {start.toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" })} ·{" "}
                      {start.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                      {(a as any).service?.name ? ` · ${(a as any).service.name}` : ""}
                    </div>
                    {tr && (
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full bg-secondary px-2 py-0.5">
                          {tr.sessions_done}/{tr.sessions_total} sesiones · {trPending} pendientes
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 font-semibold ${tr.balance_cents > 0 ? "bg-amber-500/20 text-amber-600" : "bg-emerald-500/20 text-emerald-600"}`}
                        >
                          {tr.balance_cents > 0
                            ? `Saldo ${formatMoney(tr.balance_cents, tenant.currency)}`
                            : "Todo pagado"}
                        </span>
                      </div>
                    )}
                  </div>

                  {rem ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditAppt(a)}
                        className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-secondary"
                      >
                        <Clock className="h-4 w-4" /> Editar horario
                      </button>
                      {debtRem && (
                        <button
                          type="button"
                          onClick={() => setReminder(debtRem)}
                          className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                        >
                          <MessageCircle className="h-4 w-4" /> Recordar saldo
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setReminder(rem)}
                        className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                      >
                        <MessageCircle className="h-4 w-4" /> Recordar cita
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditAppt(a)}
                        className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-secondary"
                      >
                        <Clock className="h-4 w-4" /> Editar horario
                      </button>
                      <span className="text-xs text-muted-foreground">Sin teléfono registrado</span>
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* Saldos pendientes de tratamientos finalizados */}
        <div className="mt-6 space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Saldos pendientes de tratamientos finalizados</h3>
          {(() => {
            const pendingClientIds = new Set(
              (appts.data ?? [])
                .filter((a) => a.status !== "completed")
                .map((a) => (a as any).client_id),
            );
            const debtTreatments = (treatments.data ?? []).filter(
              (t) => t.status === "closed" && t.balance_cents > 0 && !pendingClientIds.has(t.client_id),
            );
            if (debtTreatments.length === 0) {
              return (
                <p className="text-sm text-muted-foreground">No hay saldos pendientes de tratamientos finalizados.</p>
              );
            }
            return debtTreatments.map((t) => {
              const client = (clients.data ?? []).find((c) => c.id === t.client_id);
              const phone = (client?.whatsapp || client?.phone) as string | undefined;
              const rem = phone
                ? buildDebtReminder(phone, t.client_name, t.service_name, t.balance_cents, tenant.currency)
                : null;
              return (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{t.client_name}</div>
                    <div className="text-xs text-muted-foreground">{t.service_name}</div>
                    <div className="mt-1 text-xs">
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 font-semibold text-amber-600">
                        Saldo {formatMoney(t.balance_cents, tenant.currency)}
                      </span>
                    </div>
                  </div>
                  {rem ? (
                    <button
                      type="button"
                      onClick={() => setReminder(rem)}
                      className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                    >
                      <MessageCircle className="h-4 w-4" /> Recordar saldo
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin teléfono registrado</span>
                  )}
                </div>
              );
            });
          })()}
        </div>
      </div>

      {modal && (
        <NewApptModal
          day={presetDay ?? days[0]}
          clients={clients.data ?? []}
          services={services.data ?? []}
          treatments={treatments.data ?? []}
          canTreatments
          currency={tenant.currency}
          onClose={() => setModal(false)}
          onCreate={async (payload, newClient, newTreatment) => {
            try {
              let clientId = payload.client_id;
              if (newClient) {
                const c = await createCli({ data: newClient });
                clientId = c.id;
                await qc.invalidateQueries({ queryKey: ["clients"] });
              }
              let treatmentId = payload.treatment_id ?? null;
              if (newTreatment) {
                const t = await createTreat({
                  data: {
                    client_id: clientId,
                    service_id: payload.service_id,
                    total_cents: newTreatment.total_cents,
                    sessions_total: newTreatment.sessions_total,
                  },
                });
                treatmentId = (t as any).id;
              }
              await create({ data: { ...payload, client_id: clientId, treatment_id: treatmentId } });
              const ns = new Date(payload.starts_at);
              const ne = new Date(payload.ends_at);
              syncHoursWithAppointment(ns, ns.getHours() * 60 + ns.getMinutes(), ne.getHours() * 60 + ne.getMinutes());
              qc.invalidateQueries({ queryKey: ["appts"] });
              qc.invalidateQueries({ queryKey: ["treatments"] });
              qc.invalidateQueries({ queryKey: ["receivables"] });
              toast.success("Cita creada");
              setModal(false);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Error");
            }
          }}
        />
      )}

      {reminder && (
        <WhatsAppReminderModal
          reminder={reminder}
          onClose={() => setReminder(null)}
        />
      )}

      {signAppt && (
        <SignaturePad
          clientName={
            [signAppt.client?.full_name, signAppt.client?.last_name].filter(Boolean).join(" ") || undefined
          }
          subtitle={`${signAppt.client?.full_name ?? "El cliente"} firma para confirmar que la cita del ${new Date(
            signAppt.starts_at,
          ).toLocaleString("es-ES", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })} se cumplió. Puede firmar con el dedo en celular o tablet, o con el touchpad en el computador.`}
          onCancel={() => setSignAppt(null)}
          onDone={(signature, signedBy) => {
            completeApptMut.mutate({
              id: signAppt.id,
              completed: true,
              signature_data_url: signature,
              signed_by_name: signedBy || null,
            });
            setSignAppt(null);
          }}
        />
      )}

      {editAppt && (
        <EditTimeModal
          appt={editAppt}
          services={services.data ?? []}
          treatments={treatments.data ?? []}
          currency={tenant.currency}
          onClose={() => setEditAppt(null)}
          onSave={(v) => {
            moveMut.mutate({ id: editAppt.id, ...v });
            setEditAppt(null);
          }}
          onUpdateTreatment={(v) => updateTreatMut.mutate(v)}
          onCloseTreatment={(v) => closeTreatMut.mutate(v)}
          closingTreatment={closeTreatMut.isPending}
        />
      )}

      {confirmOffHours && (
        <Modal title="Abrir esta hora" onClose={() => setConfirmOffHours(null)}>
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-lavender/25 text-lavender">
              <LockOpen className="h-7 w-7" />
            </div>
            <p className="text-base text-foreground">
              ¿Deseas abrir las <span className="font-semibold">{fmtSlot(confirmOffHours.m)}</span> del{" "}
              <span className="font-semibold">
                {confirmOffHours.d.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}
              </span>
              ?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {weekHours[confirmOffHours.d.getDay()]?.closed
                ? "Este día está marcado como cerrado. Al abrir esta hora se activa ese día en la tabla de horarios solo para esta franja, y quedará disponible para reservas."
                : "Esa hora está fuera del horario de tu negocio. Al abrirla se amplía el horario de ese día en la tabla de horarios y quedará disponible para reservas."}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
              <Button type="button" variant="outline" onClick={() => setConfirmOffHours(null)} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={confirmOffHoursOpen}
                disabled={hoursMut.isPending}
                className="w-full sm:w-auto bg-lavender text-ink hover:bg-lavender/90"
              >
                {hoursMut.isPending ? "Abriendo…" : "Sí, abrir esta hora"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {confirmUnlockSlot && (
        <Modal title="Abrir esta hora" onClose={() => setConfirmUnlockSlot(null)}>
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
              <LockOpen className="h-7 w-7" />
            </div>
            <p className="text-base text-foreground">
              ¿Deseas abrir solo las{" "}
              <span className="font-semibold">{fmtSlot(confirmUnlockSlot.m)}</span> del{" "}
              <span className="font-semibold">
                {confirmUnlockSlot.d.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}
              </span>
              ?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              El resto del bloqueo se mantiene. Solo esa franja quedará disponible en tu agenda y en el enlace de
              reservas.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmUnlockSlot(null)}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={confirmSlotUnlock}
                disabled={openSlotMut.isPending}
                className="w-full sm:w-auto"
              >
                {openSlotMut.isPending ? "Abriendo…" : "Sí, abrir esta hora"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {confirmLockRow != null && (
        <Modal title="Cerrar esta franja en la semana" onClose={() => setConfirmLockRow(null)}>
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Lock className="h-7 w-7" />
            </div>
            <p className="text-base text-foreground">
              ¿Deseas cerrar las <span className="font-semibold">{fmtSlot(confirmLockRow)}</span> en todos los días de
              esta semana?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ideal para separar el horario de desayuno, almuerzo u otras pausas. Los días cerrados o ya bloqueados se
              respetan.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
              <Button type="button" variant="outline" onClick={() => setConfirmLockRow(null)} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={confirmRowLock}
                disabled={blockManyMut.isPending}
                className="w-full sm:w-auto"
              >
                {blockManyMut.isPending ? "Cerrando…" : "Sí, cerrar la franja"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {confirmUnlockRow != null && (
        <Modal title="Abrir esta franja en la semana" onClose={() => setConfirmUnlockRow(null)}>
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
              <LockOpen className="h-7 w-7" />
            </div>
            <p className="text-base text-foreground">
              ¿Deseas abrir las <span className="font-semibold">{fmtSlot(confirmUnlockRow)}</span> en todos los días de
              esta semana?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Solo se libera esa franja. Los días bloqueados por completo siguen bloqueados en el resto de sus horas.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
              <Button type="button" variant="outline" onClick={() => setConfirmUnlockRow(null)} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={confirmRowUnlock}
                disabled={openManySlotsMut.isPending}
                className="w-full sm:w-auto"
              >
                {openManySlotsMut.isPending ? "Abriendo…" : "Sí, abrir la franja"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {confirmUnlockDay && (
        <Modal
          title={weekHours[confirmUnlockDay.getDay()]?.closed ? "Abrir día cerrado" : "Abrir día bloqueado"}
          onClose={() => setConfirmUnlockDay(null)}
        >
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
              <LockOpen className="h-7 w-7" />
            </div>
            <p className="text-base text-foreground">
              ¿Quieres abrir el{" "}
              <span className="font-semibold">
                {confirmUnlockDay.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}
              </span>
              ?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {weekHours[confirmUnlockDay.getDay()]?.closed
                ? "Este día está marcado como cerrado en tu horario. Al confirmar se activará ese día del horario y quedará disponible en la agenda y en el enlace de reservas."
                : "Al confirmar, el día volverá a estar disponible en tu agenda y en el enlace de reservas."}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmUnlockDay(null)}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={confirmDayUnlock}
                disabled={unblockMut.isPending}
                className="w-full sm:w-auto"
              >
                {unblockMut.isPending ? "Abriendo…" : "Sí, abrir día"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {pendingMove && (
        <Modal title="Cambiar horario de la cita" onClose={() => setPendingMove(null)}>
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <p className="text-base text-foreground">
              ¿Deseas cambiar el horario de la cita de{" "}
              <span className="font-semibold">{pendingMove.clientName}</span>?
            </p>
            <div className="mt-4 space-y-1 text-sm">
              <p className="text-muted-foreground">
                Antes: <span className="font-medium text-foreground">{pendingMove.fromLabel}</span>
              </p>
              <p className="text-muted-foreground">
                Ahora: <span className="font-semibold text-primary">{pendingMove.toLabel}</span>
              </p>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Esta alerta evita que la cita se mueva por error al deslizar las tarjetas.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPendingMove(null)}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => {
                  moveMut.mutate({ id: pendingMove.id, starts_at: pendingMove.starts_at, ends_at: pendingMove.ends_at });
                  setPendingMove(null);
                }}
                disabled={moveMut.isPending}
                className="w-full sm:w-auto"
              >
                {moveMut.isPending ? "Cambiando…" : "Sí, cambiar horario"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function toTimeInput(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function toDateInput(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function EditTimeModal({
  appt,
  services,
  treatments,
  currency,
  onClose,
  onSave,
  onUpdateTreatment,
  onCloseTreatment,
  closingTreatment,
}: {
  appt: any;
  services: any[];
  treatments: TreatmentSummary[];
  currency: string;
  onClose: () => void;
  onSave: (v: { starts_at: string; ends_at: string; service_id: string | null; price_cents: number | null }) => void;
  onUpdateTreatment: (v: { id: string; total_cents?: number; sessions_total?: number }) => void;
  onCloseTreatment: (v: { id: string; reopen?: boolean }) => void;
  closingTreatment?: boolean;
}) {
  const s = new Date(appt.starts_at);
  const e0 = new Date(appt.ends_at);
  const [date, setDate] = useState(toDateInput(s));
  const [start, setStart] = useState(toTimeInput(s));
  const [end, setEnd] = useState(toTimeInput(e0));
  const [serviceId, setServiceId] = useState<string>(appt.service_id ?? "");

  const linked = appt.treatment_id
    ? treatments.find((t) => t.id === appt.treatment_id) ?? null
    : null;
  const fallback =
    !linked && appt.client_id
      ? treatments.find((t) => t.client_id === appt.client_id && t.status === "open") ?? null
      : null;
  const treatment = linked ?? fallback;
  const [treatTotal, setTreatTotal] = useState(() =>
    linked ? String(linked.total_cents / 100) : "",
  );
  const [treatSessions, setTreatSessions] = useState(() =>
    linked ? String(linked.sessions_total) : "",
  );
  const sessionsPendingNow = treatment
    ? Math.max(
        0,
        (linked ? Number(treatSessions) || treatment.sessions_total : treatment.sessions_total) -
          treatment.sessions_done,
      )
    : 0;
  const state = !treatment
    ? { label: "", pill: "", panel: "border-border bg-card" }
    : treatment.status === "closed"
      ? {
          label: "Finalizado",
          pill: "bg-muted text-muted-foreground",
          panel: "border-border bg-muted/40 opacity-90",
        }
      : treatment.settled && sessionsPendingNow === 0
        ? {
            label: "Listo para finalizar",
            pill: "bg-emerald-500/15 text-emerald-600",
            panel: "border-emerald-500/40 bg-emerald-500/5",
          }
        : {
            label: "En curso",
            pill: "bg-amber-500/15 text-amber-600",
            panel: "border-amber-500/40 bg-amber-500/5",
          };

  const currentService = services.find((x) => x.id === serviceId) ?? null;
  const servicePriceCents = currentService?.price_cents ?? appt.price_cents ?? appt.service?.price_cents ?? null;


  function onServiceChange(id: string) {
    setServiceId(id);
    const svc = services.find((x) => x.id === id);
    if (svc?.duration_min && start) {
      const [h, m] = start.split(":").map(Number);
      const d = new Date();
      d.setHours(h ?? 0, (m ?? 0) + svc.duration_min, 0, 0);
      setEnd(toTimeInput(d));
    }
  }

  return (
    <Modal title="Editar horario de la cita" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(ev) => {
          ev.preventDefault();
          const starts = new Date(`${date}T${start}:00`);
          const ends = new Date(`${date}T${end}:00`);
          if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) return;
          if (ends.getTime() <= starts.getTime()) {
            toast.error("La hora final debe ser posterior a la de inicio");
            return;
          }
          const svc = services.find((x) => x.id === serviceId);
          if (linked) {
            const newTotalCents = Math.round((Number(treatTotal) || 0) * 100);
            const newSessions = Math.max(1, Math.round(Number(treatSessions) || 1));
            if (newTotalCents !== linked.total_cents || newSessions !== linked.sessions_total) {
              onUpdateTreatment({
                id: linked.id,
                total_cents: newTotalCents !== linked.total_cents ? newTotalCents : undefined,
                sessions_total: newSessions !== linked.sessions_total ? newSessions : undefined,
              });
            }
          }

          onSave({
            starts_at: starts.toISOString(),
            ends_at: ends.toISOString(),
            service_id: serviceId || null,
            price_cents: svc?.price_cents ?? null,
          });
        }}
      >
        <p className="text-sm text-muted-foreground">
          {appt.client?.full_name ?? "Cliente"}
          {appt.service?.name ? ` · ${appt.service.name}` : ""}
        </p>
        <div className="rounded-xl border border-border bg-secondary/50 p-3 text-sm flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Valor del servicio</span>
          <span className="font-medium">
            {servicePriceCents != null ? formatMoney(servicePriceCents, currency) : "—"}
          </span>
        </div>
        {treatment && (
          <div className={`rounded-xl border p-4 space-y-2 ${state.panel}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Tratamiento{treatment.service_name ? ` · ${treatment.service_name}` : ""}
              </h3>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${state.pill}`}>{state.label}</span>
            </div>
            {!linked && (
              <p className="text-[11px] text-muted-foreground">
                Tratamiento en curso de este cliente (esta cita no está vinculada a él).
              </p>
            )}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Valor total</label>
                {linked ? (
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={treatTotal}
                    onChange={(e) => setTreatTotal(e.target.value)}
                    className="mt-0.5 w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm font-medium"
                  />
                ) : (
                  <div className="font-medium">{formatMoney(treatment.total_cents, currency)}</div>
                )}
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Sesiones programadas</label>
                {linked ? (
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={treatSessions}
                    onChange={(e) => setTreatSessions(e.target.value)}
                    className="mt-0.5 w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm font-medium"
                  />
                ) : (
                  <div className="font-medium">{treatment.sessions_total}</div>
                )}
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Sesiones realizadas</div>
                <div className="font-medium">{treatment.sessions_done}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Sesiones pendientes</div>
                <div className="font-medium">{sessionsPendingNow}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Valor por sesión</div>
                <div className="font-medium">{formatMoney(treatment.session_price_cents, currency)}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Abonos</div>
                <div className="font-medium text-emerald-600">{formatMoney(treatment.paid_cents, currency)}</div>
              </div>
              <div className="col-span-2 border-t border-border pt-2 flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Saldo pendiente por pagar</div>
                <div className={`font-semibold ${treatment.balance_cents > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                  {formatMoney(treatment.balance_cents, currency)}
                </div>
              </div>
            </div>
            {treatment.status === "closed" ? (
              <button
                type="button"
                disabled={closingTreatment}
                onClick={() => onCloseTreatment({ id: treatment.id, reopen: true })}
                className="mt-1 w-full rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-secondary transition disabled:opacity-60"
              >
                Reabrir tratamiento
              </button>
            ) : (
              <button
                type="button"
                disabled={closingTreatment}
                onClick={() => {
                  if (treatment.balance_cents > 0 || sessionsPendingNow > 0) {
                    const msg = [
                      treatment.balance_cents > 0
                        ? `saldo pendiente de ${formatMoney(treatment.balance_cents, currency)}`
                        : null,
                      sessionsPendingNow > 0 ? `${sessionsPendingNow} sesión(es) sin agendar` : null,
                    ]
                      .filter(Boolean)
                      .join(" y ");
                    if (!window.confirm(`Este tratamiento tiene ${msg}. ¿Finalizarlo de todas formas?`)) return;
                  }
                  onCloseTreatment({ id: treatment.id });
                }}
                className={`mt-1 w-full rounded-full px-4 py-2 text-sm font-medium text-white transition disabled:opacity-60 ${
                  treatment.settled && sessionsPendingNow === 0
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {closingTreatment ? "Finalizando…" : "Finalizar tratamiento"}
              </button>
            )}
          </div>
        )}

        <div>
          <label className="text-xs text-muted-foreground">Fecha</label>
          <input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Hora de inicio</label>
            <input type="time" step={900} value={start} onChange={(ev) => setStart(ev.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Hora final</label>
            <input type="time" step={900} value={end} onChange={(ev) => setEnd(ev.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Servicio</label>
          <select
            value={serviceId}
            onChange={(ev) => onServiceChange(ev.target.value)}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Sin servicio</option>
            {services.map((sv) => (
              <option key={sv.id} value={sv.id}>
                {sv.name}
                {sv.price_cents ? ` · $${(sv.price_cents / 100).toLocaleString("es")}` : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-muted-foreground">Añádelo si olvidaste elegirlo al agendar.</p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border">Cancelar</button>
          <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground">Guardar horario</button>
        </div>
      </form>
    </Modal>
  );
}

/** Ámbar cálido (sin abono en la cita) → verde pastel claro (abono parcial en la cita) → verde cálido (tratamiento pagado). */
function payProgressColor(ratio: number, hasApptPayment: boolean, fullyPaid: boolean) {
  if (fullyPaid) return "#34D399";
  if (hasApptPayment) return "#D1FAE5";
  return "#E8A33D";
}

function readableText(hex: string) {

  const h = hex.replace("#", "");
  if (h.length !== 6) return "#1a1512";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? "#1a1512" : "#f7f2ee";
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  return digits.length >= 7 ? digits : null;
}

type WhatsAppReminder = {
  phone: string;
  clientName: string;
  message: string;
  webUrl: string;
  desktopUrl: string;
  kind: "appointment" | "debt";
  debtAmount?: number;
  currency?: string;
};

function buildWhatsAppReminder(phone: string, a: any): WhatsAppReminder | null {
  const num = normalizePhone(phone);
  if (!num) return null;
  const start = new Date(a.starts_at);
  const fecha = start.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
  const hora = start.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  const nombre = a.client?.full_name ?? "";
  const servicio = a.service?.name ? ` para tu ${a.service.name}` : "";
  const msg =
    `Hola ${nombre} 👋, te recordamos tu cita${servicio} el ${fecha} a las ${hora}. ` +
    `Por favor confírmanos tu asistencia. ¡Gracias!`;
  const encoded = encodeURIComponent(msg);
  return {
    phone: num,
    clientName: nombre || "Paciente",
    message: msg,
    webUrl: `https://web.whatsapp.com/send/?phone=${num}&text=${encoded}&app_absent=0`,
    desktopUrl: `whatsapp://send?phone=${num}&text=${encoded}`,
    kind: "appointment",
  };
}

function buildDebtReminder(
  phone: string,
  clientName: string,
  serviceName: string,
  balanceCents: number,
  currency: string,
): WhatsAppReminder | null {
  const num = normalizePhone(phone);
  if (!num) return null;
  const nombre = clientName ?? "";
  const servicio = serviceName ? `tu ${serviceName}` : "tu servicio";
  const monto = formatMoney(balanceCents, currency);
  const msg =
    `Hola ${nombre} 💜, esperamos que estés muy bien. ` +
    `Te escribimos con mucho cariño para recordarte que aún tienes un saldo pendiente de ${monto} correspondiente a ${servicio}. ` +
    `Si ya realizaste el pago, por favor ignora este mensaje. De lo contrario, quedamos atentos para ayudarte con cualquier duda. ¡Gracias por confiar en nosotros! ✨`;
  const encoded = encodeURIComponent(msg);
  return {
    phone: num,
    clientName: nombre || "Paciente",
    message: msg,
    webUrl: `https://web.whatsapp.com/send/?phone=${num}&text=${encoded}&app_absent=0`,
    desktopUrl: `whatsapp://send?phone=${num}&text=${encoded}`,
    kind: "debt",
    debtAmount: balanceCents,
    currency,
  };
}

type Client = { id: string; full_name: string };

const WA_WINDOW_NAME = "eleva_whatsapp_web";
let waWindow: Window | null = null;
type Service = { id: string; name: string; duration_min: number; color: string };

function WhatsAppReminderModal({ reminder, onClose }: { reminder: WhatsAppReminder; onClose: () => void }) {
  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(reminder.message);
      toast.success("Recordatorio copiado");
    } catch {
      toast.error("No se pudo copiar el mensaje");
    }
  }

  function openWhatsAppDesktop() {
    // Copy first so the user has the message even if the OS handler is slow.
    void copyMessage();

    // Strategy 1: hidden iframe — the browser hands the custom protocol to the
    // OS without navigating the current page. Works in most browsers even
    // inside an iframe preview (Chrome, Edge, Brave).
    const frame = document.createElement("iframe");
    frame.style.display = "none";
    frame.src = reminder.desktopUrl;
    document.body.appendChild(frame);
    setTimeout(() => frame.remove(), 2000);

    // Strategy 2: also trigger a top-level navigation via an anchor with
    // target="_top" as a fallback for browsers that ignore iframe src for
    // custom schemes (Safari/Firefox). Using _top escapes the preview iframe.
    try {
      const a = document.createElement("a");
      a.href = reminder.desktopUrl;
      a.target = "_top";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      /* ignore */
    }

    setTimeout(onClose, 600);
  }

  function openWhatsAppWeb() {
    // Reuse a single tab for every message: keep the handle around and only
    // change its location instead of opening a new window each time.
    let win = waWindow && !waWindow.closed ? waWindow : null;

    if (win) {
      try {
        win.location.href = reminder.webUrl;
        win.focus();
      } catch {
        win = null;
      }
    }

    if (!win) {
      // The window name keeps the same tab even after a full page reload.
      win = window.open(reminder.webUrl, WA_WINDOW_NAME);
      if (win) {
        waWindow = win;
        win.focus();
      } else {
        const a = document.createElement("a");
        a.href = reminder.webUrl;
        a.target = WA_WINDOW_NAME;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    }

    setTimeout(() => void copyMessage(), 150);
    setTimeout(onClose, 400);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-xl">
              {reminder.kind === "debt" ? "Recordatorio de saldo pendiente" : "Recordatorio de cita"}
            </h3>
            <p className="text-sm text-muted-foreground">{reminder.clientName} · +{reminder.phone}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1" aria-label="Cerrar recordatorio"><X className="h-4 w-4" /></button>
        </div>

        <textarea
          readOnly
          value={reminder.message}
          rows={5}
          className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm"
        />

        <div className="space-y-2">
          <button
            type="button"
            onClick={openWhatsAppWeb}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-3 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            <MessageCircle className="h-4 w-4" /> Abrir en WhatsApp Web
          </button>
          <button
            type="button"
            onClick={openWhatsAppDesktop}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary"
          >
            <MessageCircle className="h-4 w-4" /> Abrir en WhatsApp Desktop (app nativa)
          </button>
          <button
            type="button"
            onClick={copyMessage}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary"
          >
            <Copy className="h-4 w-4" /> Copiar mensaje
          </button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          "Web" reutiliza siempre la misma pestaña de WhatsApp Web. "Desktop" solo funciona si tienes instalada la app nativa de WhatsApp (Microsoft Store / Meta), no la versión web. El mensaje se copia automáticamente como respaldo.
        </p>
      </div>
    </div>
  );
}

function NewApptModal({
  day, clients, services, treatments, canTreatments, currency, onClose, onCreate,
}: {
  day: Date;
  clients: Client[];
  services: Service[];
  treatments: TreatmentSummary[];
  canTreatments: boolean;
  currency: string;
  onClose: () => void;
  onCreate: (
    payload: {
      client_id: string;
      service_id: string | null;
      treatment_id: string | null;
      starts_at: string;
      ends_at: string;
      notes: string | null;
    },
    newClient?: ClientPayload,
    newTreatment?: { total_cents: number; sessions_total: number },
  ) => void;
}) {
  const [clientId, setClientId] = useState("");
  const [newClient, setNewClient] = useState<ClientPayload | null>(null);
  const [clientForm, setClientForm] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [treatmentId, setTreatmentId] = useState("");
  const [total, setTotal] = useState("");
  const [sessions, setSessions] = useState("");
  const [time, setTime] = useState(() => {
    const h = day.getHours() || 10;
    return `${String(h).padStart(2, "0")}:${String(day.getMinutes()).padStart(2, "0")}`;
  });
  const [endTime, setEndTime] = useState(() => {
    const d = new Date(day);
    if (!d.getHours()) d.setHours(10, 0, 0, 0);
    d.setMinutes(d.getMinutes() + 60);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  const [notes, setNotes] = useState("");

  const openForClient = treatments.filter((t) => t.client_id === clientId && t.status === "open");
  const selected = openForClient.find((t) => t.id === treatmentId) ?? null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const [hh, mm] = time.split(":").map(Number);
    const starts = new Date(day); starts.setHours(hh, mm, 0, 0);
    const [eh, em] = endTime.split(":").map(Number);
    const ends = new Date(day); ends.setHours(eh, em, 0, 0);
    if (ends.getTime() <= starts.getTime()) ends.setTime(starts.getTime() + 60 * 60_000);
    const totalCents = Math.round((Number(total) || 0) * 100);
    const sessionsTotal = Math.max(0, Math.round(Number(sessions) || 0));
    const wantsNew = canTreatments && !treatmentId && totalCents > 0 && sessionsTotal > 0;
    onCreate(
      {
        client_id: clientId,
        service_id: serviceId || null,
        treatment_id: treatmentId || null,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        notes: notes || null,
      },
      newClient ?? undefined,
      wantsNew ? { total_cents: totalCents, sessions_total: sessionsTotal } : undefined,
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <form onSubmit={submit} className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-card p-6">
        <div className="flex items-center justify-between pb-4">
          <h3 className="font-serif text-xl">Nueva cita</h3>
          <button type="button" onClick={onClose} className="p-1"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid flex-1 gap-4 overflow-y-auto pr-1 md:grid-cols-2">


        <div>
          <label className="text-xs text-muted-foreground">Cliente existente</label>
          <select
            value={clientId}
            onChange={(e) => {
              const id = e.target.value;
              setClientId(id);
              setNewClient(null);
              const open = treatments.find((t) => t.client_id === id && t.status === "open");
              setTreatmentId(open ? open.id : "");
            }}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">— Ninguno —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">…o crear cliente nuevo</label>
          {newClient ? (
            <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm">
              <span className="truncate">
                {newClient.full_name}
                {newClient.whatsapp ? ` · ${newClient.whatsapp}` : ""}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" className="text-xs underline" onClick={() => setClientForm(true)}>Editar</button>
                <button type="button" className="text-xs underline text-destructive" onClick={() => setNewClient(null)}>Quitar</button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setClientForm(true)}
              className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-input px-3 py-2 text-sm hover:bg-secondary"
            >
              <Plus className="h-4 w-4" /> Nuevo cliente (formulario completo)
            </button>
          )}
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Servicio</label>
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <option value="">— Sin servicio —</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {canTreatments && (
          <div className="rounded-xl border border-border p-3 space-y-3 md:col-span-2">

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Tratamiento</span>
              <span className="rounded-full bg-primary/10 text-primary text-[10px] px-2 py-0.5 font-semibold">PRO</span>
            </div>

            {openForClient.length > 0 && (
              <div>
                <label className="text-xs text-muted-foreground">Tratamiento en curso del cliente</label>
                <select
                  value={treatmentId}
                  onChange={(e) => setTreatmentId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">— Crear uno nuevo —</option>
                  {openForClient.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.service_name} · saldo {formatMoney(t.balance_cents, currency)} · {t.sessions_remaining} sesiones
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selected ? (
              <div className="rounded-lg bg-secondary p-3 text-xs space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    Valor del servicio
                    <div className="font-medium text-foreground">{formatMoney(selected.total_cents, currency)}</div>
                  </div>
                  <div>
                    Valor por sesión
                    <div className="font-medium text-foreground">{formatMoney(selected.session_price_cents, currency)}</div>
                  </div>
                  <div>
                    Abonos
                    <div className="font-medium text-emerald-600">{formatMoney(selected.paid_cents, currency)}</div>
                  </div>
                  <div>
                    Sesiones agendadas
                    <div className="font-medium text-foreground">
                      {selected.sessions_scheduled} de {selected.sessions_total}
                    </div>
                  </div>
                  <div>
                    Sesiones pendientes
                    <div className="font-medium text-foreground">
                      {Math.max(0, selected.sessions_total - selected.sessions_scheduled)}
                      {" → "}
                      <span className="text-primary">
                        {Math.max(0, selected.sessions_total - selected.sessions_scheduled - 1)} tras esta cita
                      </span>
                    </div>
                  </div>
                  <div>
                    Estado
                    <div className="font-medium text-foreground">{selected.settled ? "A paz y salvo" : "Con saldo"}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span>Saldo pendiente por pagar</span>
                  <span className={`font-semibold ${selected.balance_cents > 0 ? "text-destructive" : "text-emerald-600"}`}>
                    {formatMoney(selected.balance_cents, currency)}
                  </span>
                </div>
              </div>
            ) : (

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Valor total del tratamiento</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={total}
                    onChange={(e) => setTotal(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Sesiones a pagar</label>
                  <input
                    type="number"
                    min={1}
                    step="1"
                    value={sessions}
                    onChange={(e) => setSessions(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <p className="col-span-2 text-[11px] text-muted-foreground">
                  Los abonos registrados en Pagos descuentan el saldo y las sesiones de este tratamiento.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:col-span-2">
          <div>
            <label className="text-xs text-muted-foreground">Hora de inicio</label>
            <input type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Hora final</label>
            <input type="time" step={900} value={endTime} onChange={(e) => setEndTime(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-muted-foreground">Notas</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        </div>
        </div>
        <div className="mt-4 flex gap-2 justify-end border-t border-border pt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border">Cancelar</button>
          <button
            type="submit"
            disabled={!clientId && !newClient}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground disabled:opacity-60"
          >
            Crear cita
          </button>
        </div>

      </form>

      {clientForm && (
        <Modal title="Nuevo cliente" onClose={() => setClientForm(false)} wide>
          <ClientForm
            client={newClient}
            submitLabel="Usar este cliente"
            onCancel={() => setClientForm(false)}
            onSave={(payload) => {
              setNewClient(payload);
              setClientId("");
              setClientForm(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
