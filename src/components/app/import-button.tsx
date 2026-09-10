import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { importData } from "@/lib/import.functions";
import { parseSpreadsheet } from "@/lib/import-parse";

type Entity = "clients" | "services" | "professionals";

export function ImportButton({
  entity,
  label = "Importar",
  className,
}: {
  entity: Entity;
  label?: string;
  className?: string;
}) {
  const run = useServerFn(importData);
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    setBusy(true);
    try {
      const rows = await parseSpreadsheet(file);
      if (!rows.length) {
        toast.error("El archivo está vacío");
        return;
      }
      const res = await run({ data: { entity, rows } });
      toast.success(`${res.inserted} registros importados${res.skipped ? ` · ${res.skipped} omitidos` : ""}`);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo importar");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className={
          className ??
          "inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60"
        }
      >
        <Upload className="h-4 w-4" /> {busy ? "Importando..." : label}
      </button>
    </>
  );
}
