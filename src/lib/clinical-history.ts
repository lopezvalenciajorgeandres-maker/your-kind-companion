import type { Assessment, ClientAssessmentGroup } from "./assessments.functions";
import { MEASURE_LABELS } from "./assessment-report";
import { MEASURE_FIELDS } from "./assessments.functions";

export type HistoryTreatment = {
  id: string;
  name: string | null;
  service_name: string;
  status: string;
  total_cents: number;
  paid_cents: number;
  balance_cents: number;
  sessions_total: number;
  sessions_done: number;
  created_at: string;
  closed_at: string | null;
};

export type HistoryAppointment = {
  id: string;
  starts_at: string;
  status: string;
  service?: { name?: string } | null;
  signed_by_name?: string | null;
  signed_at?: string | null;
};

/** Edad cumplida; se calcula aquí para no arrastrar componentes a esta librería. */
function calcAge(birthdate?: string | null): number | null {
  if (!birthdate) return null;
  const d = new Date(birthdate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const date = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const money = (cents: number, currency: string) => {
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(
      cents / 100,
    );
  } catch {
    return `${(cents / 100).toLocaleString("es-CO")} ${currency}`;
  }
};

const STATUS_LABEL: Record<string, string> = {
  completed: "Realizada",
  scheduled: "Programada",
  pending: "Pendiente",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

/** Fila "etiqueta: valor" que se omite si el dato está vacío. */
function row(label: string, value: unknown): string {
  const v = String(value ?? "").trim();
  if (!v) return "";
  return `<div class="f"><span class="l">${esc(label)}</span><span class="v">${esc(v)}</span></div>`;
}

function block(title: string, rows: string): string {
  const inner = rows.trim();
  if (!inner) return "";
  return `<section><h2>${esc(title)}</h2><div class="grid">${inner}</div></section>`;
}

/**
 * Historia clínica completa del cliente lista para imprimir o guardar en PDF:
 * ficha técnica, antecedentes, tratamientos, citas y valoraciones.
 */
export function printClinicalHistory({
  client,
  treatments,
  appointments,
  groups,
  businessName,
  currency,
}: {
  client: Record<string, any>;
  treatments: HistoryTreatment[];
  appointments: HistoryAppointment[];
  groups: ClientAssessmentGroup[];
  businessName?: string | null;
  currency: string;
}) {
  const nombre = [client.full_name, client.last_name].filter(Boolean).join(" ");
  const edad = calcAge(client.birthdate);

  const personales = block(
    "Datos personales",
    [
      row("Cédula / documento", client.document_id),
      row("Fecha de nacimiento", client.birthdate ? date(client.birthdate) : ""),
      row("Edad", edad != null ? `${edad} años` : ""),
      row("Género", client.gender),
      row("RH / grupo sanguíneo", client.blood_type),
      row("Estado civil", client.marital_status),
      row("EPS / seguro médico", client.health_insurance),
      row("Celular / WhatsApp", client.whatsapp || client.phone),
      row("Teléfono fijo", client.landline),
      row("Email", client.email),
      row("Dirección", client.address),
      row("Municipio", client.city),
      row("Departamento", client.state),
      row("Acompañante", client.companion_name),
      row("Parentesco", client.companion_relationship),
      row("Cómo nos conoció", client.source),
    ].join(""),
  );

  const clinicos = block(
    "Datos clínicos",
    [
      row("Antecedentes familiares", client.family_history),
      row("Alergias", client.allergies),
      row("Enfermedades", client.diseases),
      row("Cáncer", client.cancer),
      row("Antidepresivos", client.antidepressants),
      row("Arritmia cardiaca", client.arrhythmia),
      row("Marcapasos", client.pacemaker),
      row("Hígado graso", client.fatty_liver),
      row("Cirugías importantes", client.surgeries),
      row("Hernias", client.hernias),
      row("Mallas estomacales", client.stomach_mesh),
      row("Implantes faciales y/o corporales", client.implants),
      row("Última menstruación", client.last_period ? date(client.last_period) : ""),
      row("Ingiere bebidas alcohólicas", client.alcohol),
      row("Fuma", client.smoking),
      row("Medicamentos", client.medications),
    ].join(""),
  );

  const piel = block(
    "Piel",
    [row("Biotipo", client.skin_biotype), row("Fototipo", client.skin_phototype)].join(""),
  );

  const notas = String(client.notes ?? "").trim()
    ? `<section><h2>Observaciones</h2><p class="txt">${esc(client.notes)}</p></section>`
    : "";

  const tratamientosHtml = treatments.length
    ? `<section><h2>Historial de tratamientos</h2>
       <table>
         <thead><tr><th>Tratamiento</th><th>Inicio</th><th>Sesiones</th><th class="num">Valor</th><th class="num">Abonado</th><th class="num">Saldo</th><th>Estado</th></tr></thead>
         <tbody>${treatments
           .map(
             (t) => `<tr>
               <td>${esc(t.service_name)}${t.name ? ` — ${esc(t.name)}` : ""}</td>
               <td>${date(t.created_at)}</td>
               <td>${t.sessions_done}/${t.sessions_total}</td>
               <td class="num">${esc(money(t.total_cents, currency))}</td>
               <td class="num">${esc(money(t.paid_cents, currency))}</td>
               <td class="num ${t.balance_cents > 0 ? "warn" : "good"}">${esc(money(t.balance_cents, currency))}</td>
               <td>${t.status === "closed" ? "Finalizado" : "En curso"}</td>
             </tr>`,
           )
           .join("")}</tbody>
       </table></section>`
    : "";

  const citasHtml = appointments.length
    ? `<section><h2>Procedimientos realizados</h2>
       <table>
         <thead><tr><th>Fecha</th><th>Servicio</th><th>Estado</th><th>Firma del cliente</th></tr></thead>
         <tbody>${appointments
           .map(
             (a) => `<tr>
               <td>${new Date(a.starts_at).toLocaleString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
               <td>${esc(a.service?.name ?? "—")}</td>
               <td>${esc(STATUS_LABEL[a.status] ?? a.status)}</td>
               <td>${a.signed_at ? `Firmado${a.signed_by_name ? ` por ${esc(a.signed_by_name)}` : ""} el ${date(a.signed_at)}` : "—"}</td>
             </tr>`,
           )
           .join("")}</tbody>
       </table></section>`
    : "";

  const valoracionesHtml = groups.length
    ? groups
        .map((g) => {
          const ini = g.inicial;
          const fin = g.final;
          if (!ini && !fin) return "";
          const medidas = MEASURE_FIELDS.map((f) => {
            const b = ini?.[f] != null ? Number(ini[f]) : null;
            const a = fin?.[f] != null ? Number(fin[f]) : null;
            if (b == null && a == null) return "";
            const diff = b != null && a != null ? a - b : null;
            return `<tr><td>${esc(MEASURE_LABELS[f])}</td><td class="num">${b ?? "—"}</td><td class="num">${a ?? "—"}</td><td class="num ${
              diff == null ? "" : diff <= 0 ? "good" : "warn"
            }">${diff == null ? "—" : `${diff > 0 ? "+" : ""}${diff.toFixed(1)} cm`}</td></tr>`;
          }).join("");

          const vitals = [
            ["Peso (kg)", ini?.weight_kg, fin?.weight_kg],
            ["% grasa corporal", ini?.body_fat_pct, fin?.body_fat_pct],
            ["% masa muscular", ini?.muscle_mass_pct, fin?.muscle_mass_pct],
          ]
            .filter(([, b, a]) => b != null || a != null)
            .map(([label, b, a]) => {
              const nb = b != null ? Number(b) : null;
              const na = a != null ? Number(a) : null;
              const diff = nb != null && na != null ? na - nb : null;
              return `<tr><td>${esc(label)}</td><td class="num">${nb ?? "—"}</td><td class="num">${na ?? "—"}</td><td class="num ${
                diff == null ? "" : diff <= 0 ? "good" : "warn"
              }">${diff == null ? "—" : `${diff > 0 ? "+" : ""}${diff.toFixed(1)}`}</td></tr>`;
            })
            .join("");

          const tabla =
            vitals || medidas
              ? `<table><thead><tr><th>Concepto</th><th>Inicial</th><th>Final</th><th>Diferencia</th></tr></thead><tbody>${vitals}${medidas}</tbody></table>`
              : "";

          const fotos = photosRow(ini, fin);
          const detalles = detailRows(ini, fin);

          return `<section>
            <h2>Valoración · ${esc(g.service_name)}</h2>
            <div class="meta">Inicial: ${ini ? date(ini.recorded_at) : "pendiente"} · Final: ${fin ? date(fin.recorded_at) : "pendiente"}</div>
            ${tabla}${detalles}${fotos}
          </section>`;
        })
        .join("")
    : "";

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Historia clínica — ${esc(nombre)}</title>
<style>
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", system-ui, -apple-system, sans-serif; color: #1f1a17; margin: 0; font-size: 11.5px; line-height: 1.45; }
  header { border-bottom: 2px solid #CDB4DB; padding-bottom: 10px; margin-bottom: 14px; }
  .brand { font-size: 17px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  h1 { font-size: 19px; margin: 6px 0 2px; }
  .meta { color: #6b625c; font-size: 10.5px; }
  h2 { font-size: 12px; margin: 16px 0 6px; padding-bottom: 3px; border-bottom: 1px solid #e7e1dc; text-transform: uppercase; letter-spacing: .06em; }
  section { break-inside: avoid; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; }
  .f { display: flex; gap: 6px; padding: 2px 0; border-bottom: 1px dotted #efeae6; }
  .l { color: #6b625c; min-width: 42%; }
  .v { font-weight: 600; }
  .txt { white-space: pre-wrap; margin: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-top: 4px; }
  th { background: #f6f2ef; text-align: left; padding: 4px 6px; font-weight: 600; color: #6b625c; }
  td { padding: 4px 6px; border-top: 1px solid #efeae6; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .good { color: #12805c; font-weight: 700; }
  .warn { color: #a66b00; font-weight: 700; }
  .photos { display: flex; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
  .pair { border: 1px solid #efeae6; border-radius: 7px; padding: 5px; width: calc(33.333% - 6px); }
  .plabel { font-size: 9.5px; font-weight: 600; margin-bottom: 3px; }
  .imgs { display: flex; gap: 5px; }
  figure { margin: 0; flex: 1; }
  figure img { width: 100%; border-radius: 4px; display: block; }
  .noimg { height: 52px; display: flex; align-items: center; justify-content: center; border: 1px dashed #d9d2cc; border-radius: 4px; font-size: 8.5px; color: #8b817a; }
  figcaption { font-size: 8.5px; color: #8b817a; text-align: center; margin-top: 2px; }
  footer { margin-top: 18px; padding-top: 8px; border-top: 1px solid #e7e1dc; font-size: 9px; color: #8b817a; }
</style></head><body>
<header>
  <div class="brand">${esc(businessName || "Eleva System")}</div>
  <h1>Historia clínica</h1>
  <div class="meta">${esc(nombre)}${edad != null ? ` · ${edad} años` : ""}${client.document_id ? ` · CC ${esc(client.document_id)}` : ""}</div>
</header>
${personales}${clinicos}${piel}${notas}${tratamientosHtml}${citasHtml}${valoracionesHtml}
<footer>
  Documento generado el ${new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })} por ${esc(businessName || "Eleva System")}.
  Información confidencial sujeta a la Ley 1581 de 2012 de protección de datos personales.
  Las estimaciones de composición corporal son orientativas para seguimiento estético y no sustituyen un diagnóstico médico.
</footer>
<script>window.onload = function () { window.focus(); window.print(); };</script>
</body></html>`;

  openPrintWindow(html);
}

function detailRows(ini: Assessment | null, fin: Assessment | null): string {
  const keys = new Set([...Object.keys(ini?.details ?? {}), ...Object.keys(fin?.details ?? {})]);
  if (keys.size === 0) return "";
  const rows = [...keys]
    .map(
      (k) =>
        `<tr><td>${esc(k.replace(/_/g, " "))}</td><td>${esc(ini?.details?.[k] ?? "—")}</td><td>${esc(fin?.details?.[k] ?? "—")}</td></tr>`,
    )
    .join("");
  return `<table><thead><tr><th>Valoración</th><th>Inicial</th><th>Final</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function photosRow(ini: Assessment | null, fin: Assessment | null): string {
  const pairs = [
    ["Frente", ini?.photo_front, fin?.photo_front],
    ["Perfil", ini?.photo_side, fin?.photo_side],
    ["Espalda", ini?.photo_back, fin?.photo_back],
  ].filter(([, b, a]) => b || a) as [string, string | null, string | null][];
  if (!pairs.length) return "";
  return `<div class="photos">${pairs
    .map(
      ([label, b, a]) => `<div class="pair">
        <div class="plabel">${esc(label)}</div>
        <div class="imgs">
          <figure>${b ? `<img src="${b}">` : `<div class="noimg">Sin foto</div>`}<figcaption>Antes</figcaption></figure>
          <figure>${a ? `<img src="${a}">` : `<div class="noimg">Sin foto</div>`}<figcaption>Después</figcaption></figure>
        </div>
      </div>`,
    )
    .join("")}</div>`;
}

export function openPrintWindow(html: string) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) {
    alert("Permite las ventanas emergentes para poder imprimir el documento.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
