import { useMemo, useState } from "react";
import { Modal, btnGhost, btnPrimary, inputClass } from "./kit";
import { Printer, TrendingDown, TrendingUp, Minus } from "lucide-react";
import {
  buildReport,
  clientRecommendations,
  staffRecommendations,
  type ReportData,
  type Row,
} from "@/lib/assessment-report";
import type { Assessment } from "@/lib/assessments.functions";

type Audience = "cliente" | "esteticista";

export function AssessmentReport({
  inicial,
  final,
  clientName,
  serviceName,
  businessName,
  saving,
  onSave,
  onClose,
}: {
  inicial: Assessment;
  final: Assessment;
  clientName: string;
  serviceName?: string | null;
  businessName?: string | null;
  saving?: boolean;
  onSave?: (v: { report_client: string; report_staff: string }) => void;
  onClose: () => void;
}) {
  const data = useMemo(() => buildReport(inicial, final), [inicial, final]);
  const [audience, setAudience] = useState<Audience>("cliente");
  const [textClient, setTextClient] = useState(
    () => final.report_client ?? clientRecommendations(data, clientName),
  );
  const [textStaff, setTextStaff] = useState(
    () => final.report_staff ?? staffRecommendations(data),
  );

  const text = audience === "cliente" ? textClient : textStaff;
  const setText = audience === "cliente" ? setTextClient : setTextStaff;

  return (
    <Modal title="Informe de cierre del tratamiento" onClose={onClose} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-full border border-border p-1">
            {(["cliente", "esteticista"] as Audience[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAudience(a)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                  audience === a ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                }`}
              >
                {a === "cliente" ? "Para la clienta" : "Para la esteticista"}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={btnGhost}
            onClick={() =>
              printReport({
                data,
                audience,
                text,
                clientName,
                serviceName,
                businessName,
                inicial,
                final,
              })
            }
          >
            <Printer className="h-4 w-4" /> Imprimir / Guardar PDF
          </button>
        </div>

        <ComparisonTables data={data} audience={audience} />

        <section>
          <h3 className="mb-2 font-serif text-lg">
            {audience === "cliente" ? "Resumen y recomendaciones para la clienta" : "Lectura clínica y plan de trabajo"}
          </h3>
          <p className="mb-2 text-[11px] text-muted-foreground">
            Generado automáticamente con los datos de la ficha. Puedes editarlo antes de guardar o imprimir.
          </p>
          <textarea
            rows={14}
            className={`${inputClass} font-mono text-[12px] leading-relaxed`}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </section>

        {data.photos.length > 0 && (
          <section>
            <h3 className="mb-2 font-serif text-lg">Antes y después</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {data.photos.map((p) => (
                <div key={p.label} className="rounded-xl border border-border p-2">
                  <div className="text-xs font-medium">{p.label}</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Figure src={p.before} caption="Antes" />
                    <Figure src={p.after} caption="Después" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end border-t border-border pt-4">
          <button type="button" className={btnGhost} onClick={onClose}>
            Cerrar
          </button>
          {onSave && (
            <button
              type="button"
              className={btnPrimary}
              disabled={saving}
              onClick={() => onSave({ report_client: textClient, report_staff: textStaff })}
            >
              {saving ? "Guardando…" : "Guardar informe"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Figure({ src, caption }: { src: string | null; caption: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{caption}</div>
      {src ? (
        <img src={src} alt={caption} className="mt-1 w-full rounded-lg object-cover" />
      ) : (
        <div className="mt-1 flex h-20 items-center justify-center rounded-lg border border-dashed border-input text-[10px] text-muted-foreground">
          Sin foto
        </div>
      )}
    </div>
  );
}

function ComparisonTables({ data, audience }: { data: ReportData; audience: Audience }) {
  return (
    <div className="space-y-4">
      {data.totalCm && (
        <div
          className={`rounded-xl px-4 py-3 ${
            data.totalCm.diff <= 0 ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"
          }`}
        >
          <div className="font-serif text-xl">
            {data.totalCm.diff <= 0 ? "Reducción total" : "Aumento total"}:{" "}
            {Math.abs(data.totalCm.diff).toFixed(1)} cm
          </div>
          <div className="text-xs opacity-80">
            {data.totalCm.before.toFixed(1)} → {data.totalCm.after.toFixed(1)} cm en {data.totalCm.count} zonas
            {data.daysBetween != null ? ` · ${data.daysBetween} días de proceso` : ""}
          </div>
        </div>
      )}

      {data.vitals.length > 0 && <Table title="Datos generales" rows={data.vitals} />}
      {data.measures.length > 0 && <Table title="Medidas corporales" rows={data.measures} />}

      {audience === "esteticista" && (data.best || data.worst) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.best && (
            <div className="rounded-xl border border-border p-3">
              <div className="text-xs text-muted-foreground">Mejor respuesta</div>
              <div className="font-medium">{data.best.label}</div>
              <div className="text-sm text-emerald-600">
                {data.best.diff.toFixed(1)} cm ({data.best.pct.toFixed(1)}%)
              </div>
            </div>
          )}
          {data.worst && (
            <div className="rounded-xl border border-border p-3">
              <div className="text-xs text-muted-foreground">Menor respuesta</div>
              <div className="font-medium">{data.worst.label}</div>
              <div className="text-sm text-amber-600">
                {data.worst.diff > 0 ? "+" : ""}
                {data.worst.diff.toFixed(1)} cm ({data.worst.pct.toFixed(1)}%)
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Table({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div>
      <h3 className="mb-2 font-serif text-lg">{title}</h3>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Concepto</th>
              <th className="px-3 py-2 text-right font-medium">Inicial</th>
              <th className="px-3 py-2 text-right font-medium">Final</th>
              <th className="px-3 py-2 text-right font-medium">Diferencia</th>
              <th className="px-3 py-2 text-right font-medium">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const good = r.lowerIsBetter ? r.diff < 0 : r.diff > 0;
              const flat = Math.abs(r.diff) < 0.05;
              return (
                <tr key={r.label}>
                  <td className="px-3 py-2">{r.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.before.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{r.after.toFixed(1)}</td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums font-semibold ${
                      flat ? "text-muted-foreground" : good ? "text-emerald-600" : "text-amber-600"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {flat ? (
                        <Minus className="h-3 w-3" />
                      ) : r.diff < 0 ? (
                        <TrendingDown className="h-3 w-3" />
                      ) : (
                        <TrendingUp className="h-3 w-3" />
                      )}
                      {r.diff > 0 ? "+" : ""}
                      {r.diff.toFixed(1)} {r.unit}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {r.pct > 0 ? "+" : ""}
                    {r.pct.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Abre una ventana con el informe listo para imprimir o guardar como PDF. */
export function printReport({
  data,
  audience,
  text,
  clientName,
  serviceName,
  businessName,
  inicial,
  final,
}: {
  data: ReportData;
  audience: Audience;
  text: string;
  clientName: string;
  serviceName?: string | null;
  businessName?: string | null;
  inicial: Assessment;
  final: Assessment;
}) {
  const fecha = (d: string) =>
    new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  const tableHtml = (title: string, rows: Row[]) =>
    rows.length
      ? `<h2>${title}</h2>
      <table>
        <thead><tr><th>Concepto</th><th>Inicial</th><th>Final</th><th>Diferencia</th><th>%</th></tr></thead>
        <tbody>${rows
          .map((r) => {
            const good = r.lowerIsBetter ? r.diff < 0 : r.diff > 0;
            const flat = Math.abs(r.diff) < 0.05;
            const cls = flat ? "flat" : good ? "good" : "warn";
            return `<tr><td>${r.label}</td><td class="num">${r.before.toFixed(1)}</td><td class="num b">${r.after.toFixed(1)}</td><td class="num ${cls}">${r.diff > 0 ? "+" : ""}${r.diff.toFixed(1)} ${r.unit}</td><td class="num muted">${r.pct > 0 ? "+" : ""}${r.pct.toFixed(1)}%</td></tr>`;
          })
          .join("")}</tbody>
      </table>`
      : "";

  const photosHtml = data.photos.length
    ? `<h2>Registro fotográfico</h2><div class="photos">${data.photos
        .map(
          (p) => `<div class="pair">
            <div class="plabel">${p.label}</div>
            <div class="imgs">
              <figure>${p.before ? `<img src="${p.before}">` : `<div class="noimg">Sin foto</div>`}<figcaption>Antes</figcaption></figure>
              <figure>${p.after ? `<img src="${p.after}">` : `<div class="noimg">Sin foto</div>`}<figcaption>Después</figcaption></figure>
            </div>
          </div>`,
        )
        .join("")}</div>`
    : "";

  const resumen = data.totalCm
    ? `<div class="hero ${data.totalCm.diff <= 0 ? "ok" : "up"}">
         <div class="big">${data.totalCm.diff <= 0 ? "Reducción total" : "Aumento total"}: ${Math.abs(data.totalCm.diff).toFixed(1)} cm</div>
         <div class="sub">${data.totalCm.before.toFixed(1)} → ${data.totalCm.after.toFixed(1)} cm en ${data.totalCm.count} zonas${
           data.daysBetween != null ? ` · ${data.daysBetween} días de proceso` : ""
         }</div>
       </div>`
    : "";

  const titulo = audience === "cliente" ? "Informe de resultados" : "Informe clínico del tratamiento";

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${esc(titulo)} — ${esc(clientName)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", system-ui, -apple-system, sans-serif; color: #1f1a17; margin: 0; font-size: 12px; line-height: 1.5; }
  header { border-bottom: 2px solid #CDB4DB; padding-bottom: 10px; margin-bottom: 16px; }
  .brand { font-size: 18px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  h1 { font-size: 20px; margin: 6px 0 2px; }
  .meta { color: #6b625c; font-size: 11px; }
  h2 { font-size: 13px; margin: 18px 0 6px; padding-bottom: 3px; border-bottom: 1px solid #e7e1dc; text-transform: uppercase; letter-spacing: .06em; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #f6f2ef; text-align: left; padding: 5px 7px; font-weight: 600; color: #6b625c; }
  td { padding: 5px 7px; border-top: 1px solid #efeae6; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .b { font-weight: 600; }
  .good { color: #12805c; font-weight: 700; }
  .warn { color: #a66b00; font-weight: 700; }
  .flat, .muted { color: #8b817a; }
  .hero { padding: 10px 14px; border-radius: 10px; margin-bottom: 14px; }
  .hero.ok { background: #e8f6f0; color: #12805c; }
  .hero.up { background: #fdf3e2; color: #a66b00; }
  .big { font-size: 17px; font-weight: 700; }
  .sub { font-size: 11px; opacity: .85; }
  pre { white-space: pre-wrap; font-family: inherit; font-size: 11.5px; margin: 0; }
  .photos { display: flex; gap: 10px; flex-wrap: wrap; }
  .pair { border: 1px solid #efeae6; border-radius: 8px; padding: 6px; width: calc(33.333% - 7px); }
  .plabel { font-size: 10px; font-weight: 600; margin-bottom: 4px; }
  .imgs { display: flex; gap: 6px; }
  figure { margin: 0; flex: 1; }
  figure img { width: 100%; border-radius: 5px; display: block; }
  .noimg { height: 60px; display: flex; align-items: center; justify-content: center; border: 1px dashed #d9d2cc; border-radius: 5px; font-size: 9px; color: #8b817a; }
  figcaption { font-size: 9px; color: #8b817a; text-align: center; margin-top: 2px; }
  footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #e7e1dc; font-size: 9.5px; color: #8b817a; }
  section { break-inside: avoid; }
</style></head><body>
<header>
  <div class="brand">${esc(businessName || "Eleva System")}</div>
  <h1>${esc(titulo)}</h1>
  <div class="meta">
    ${esc(clientName)}${serviceName ? ` · ${esc(serviceName)}` : ""}<br>
    Valoración inicial: ${fecha(inicial.recorded_at)} · Valoración final: ${fecha(final.recorded_at)}
  </div>
</header>
${resumen}
<section>${tableHtml("Datos generales", data.vitals)}</section>
<section>${tableHtml("Medidas corporales (cm)", data.measures)}</section>
<section><h2>${audience === "cliente" ? "Recomendaciones" : "Lectura clínica y plan de trabajo"}</h2><pre>${esc(text)}</pre></section>
<section>${photosHtml}</section>
<footer>
  Documento generado el ${new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })} por ${esc(businessName || "Eleva System")}.
  Las estimaciones de grasa y masa muscular se obtienen por medidas antropométricas y son orientativas para seguimiento estético; no sustituyen un diagnóstico médico.
</footer>
<script>window.onload = function () { window.focus(); window.print(); };</script>
</body></html>`;

  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) {
    alert("Permite las ventanas emergentes para poder imprimir el informe.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
