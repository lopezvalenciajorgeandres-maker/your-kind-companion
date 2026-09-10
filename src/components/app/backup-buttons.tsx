import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { exportFullBackup, importFullBackup } from "@/lib/backup.functions";
import { downloadExcelSheets } from "@/lib/download";
import { parseWorkbook } from "@/lib/import-parse";

const base =
  "inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60";

export function BackupButtons() {
  const doExport = useServerFn(exportFullBackup);
  const doImport = useServerFn(importFullBackup);
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);

  async function onExport() {
    setBusy("export");
    try {
      const sheets = await doExport({});
      downloadExcelSheets(sheets, "respaldo-completo");
      toast.success("Respaldo completo descargado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo exportar");
    } finally {
      setBusy(null);
    }
  }

  async function onFile(file: File) {
    setBusy("import");
    try {
      const sheets = await parseWorkbook(file);
      const res = await doImport({ data: { sheets } });
      toast.success(
        `Importado: ${res.clientes} clientes · ${res.citas} citas · ${res.pagos} pagos · ${res.servicios} servicios`,
      );
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo importar");
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />
      <button type="button" disabled={busy !== null} onClick={onExport} className={base}>
        <Download className="h-4 w-4" /> {busy === "export" ? "Exportando..." : "Exportar todo"}
      </button>
      <button type="button" disabled={busy !== null} onClick={() => input.current?.click()} className={base}>
        <Upload className="h-4 w-4" /> {busy === "import" ? "Importando..." : "Importar todo"}
      </button>
    </>
  );
}
