import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { exportData } from "@/lib/export.functions";
import { downloadCsv, downloadExcel } from "@/lib/download";

type Entity = "clients" | "appointments" | "services" | "payments" | "professionals";

export function ExportButton({
  entity,
  filename,
  from,
  to,
  label = "Exportar",
  className,
  rangePicker = false,
}: {
  entity: Entity;
  filename: string;
  from?: string | null;
  to?: string | null;
  label?: string;
  className?: string;
  rangePicker?: boolean;
}) {
  const run = useServerFn(exportData);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const toInput = (v?: string | null) => (v ? new Date(v).toISOString().slice(0, 10) : "");
  const [rFrom, setRFrom] = useState(toInput(from));
  const [rTo, setRTo] = useState(toInput(to));

  useEffect(() => {
    if (!open) {
      setRFrom(toInput(from));
      setRTo(toInput(to));
    }
  }, [from, to, open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function handle(format: "xlsx" | "csv") {
    setOpen(false);
    setBusy(true);
    try {
      const rangeFrom = rangePicker && rFrom ? new Date(`${rFrom}T00:00:00`).toISOString() : (from ?? null);
      const rangeTo = rangePicker && rTo ? new Date(`${rTo}T23:59:59`).toISOString() : (to ?? null);
      const rows = (await run({ data: { entity, from: rangeFrom, to: rangeTo } })) as Array<Record<string, unknown>>;
      if (!rows.length) {
        toast.error("No hay datos para exportar");
        return;
      }
      if (format === "xlsx") downloadExcel(rows, filename);
      else downloadCsv(rows, filename);
      toast.success(`Exportado (${rows.length} registros)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo exportar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
        className={
          className ??
          "inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60"
        }
      >
        <Download className="h-4 w-4" /> {busy ? "Exportando..." : label}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-background shadow-lg">
          {rangePicker && (
            <div className="grid grid-cols-2 gap-2 border-b border-border p-3">
              <label className="block text-xs text-muted-foreground">
                Desde
                <input
                  type="date"
                  value={rFrom}
                  onChange={(e) => setRFrom(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                Hasta
                <input
                  type="date"
                  value={rTo}
                  onChange={(e) => setRTo(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </label>
            </div>
          )}
          <button
            type="button"
            onClick={() => handle("xlsx")}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-secondary"
          >
            <FileSpreadsheet className="h-4 w-4" /> Excel (.xlsx)
          </button>
          <button
            type="button"
            onClick={() => handle("csv")}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-secondary"
          >
            <FileText className="h-4 w-4" /> CSV (.csv)
          </button>
        </div>
      )}
    </div>
  );
}