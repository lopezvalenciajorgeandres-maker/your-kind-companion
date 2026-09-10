import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { exportFullBackup, importFullBackup } from "@/lib/backup.functions";
import { downloadExcelSheets } from "@/lib/download";
import { parseWorkbook } from "@/lib/import-parse";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const base =
  "inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60";

export function BackupButtons() {
  const doExport = useServerFn(exportFullBackup);
  const doImport = useServerFn(importFullBackup);
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

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
      const totals = Object.values(res.sections as Record<string, { added: number; updated: number; skipped: number }>).reduce(
        (sum, section) => ({
          added: sum.added + section.added,
          updated: sum.updated + section.updated,
          skipped: sum.skipped + section.skipped,
        }),
        { added: 0, updated: 0, skipped: 0 },
      );
      toast.success(
        `Restauración lista: ${totals.added} agregados · ${totals.updated} actualizados · ${totals.skipped} omitidos`,
      );
      if (res.warnings.length) toast.warning(`${res.warnings.length} aviso(s): revisa registros sin relación`);
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
          if (f) setPendingFile(f);
        }}
      />
      <button type="button" disabled={busy !== null} onClick={onExport} className={base}>
        <Download className="h-4 w-4" /> {busy === "export" ? "Exportando..." : "Exportar todo"}
      </button>
      <button type="button" disabled={busy !== null} onClick={() => input.current?.click()} className={base}>
        <Upload className="h-4 w-4" /> {busy === "import" ? "Importando..." : "Importar todo"}
      </button>
      <AlertDialog open={pendingFile !== null} onOpenChange={(open) => { if (!open) setPendingFile(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Combinar esta copia con tus datos?</AlertDialogTitle>
            <AlertDialogDescription>
              Se actualizarán las coincidencias y se agregarán los registros faltantes. No se duplicarán los datos existentes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const file = pendingFile;
                setPendingFile(null);
                if (file) void onFile(file);
              }}
            >
              Sí, combinar datos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
