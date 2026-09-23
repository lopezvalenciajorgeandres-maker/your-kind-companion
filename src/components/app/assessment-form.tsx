import { useMemo, useRef, useState } from "react";
import { Modal, btnGhost, btnPrimary, inputClass } from "./kit";
import { Camera, Ruler, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import {
  MEASURE_FIELDS,
  type Assessment,
  type AssessmentCategory,
  type AssessmentStage,
  type MeasureField,
} from "@/lib/assessments.functions";

const MEASURE_LABELS: Record<MeasureField, string> = {
  bust_cm: "Busto",
  chest_cm: "Pecho",
  waist_cm: "Cintura",
  upper_abdomen_cm: "Abdomen alto",
  lower_abdomen_cm: "Abdomen bajo",
  hip_cm: "Cadera",
  gluteus_cm: "Glúteo",
  thigh_left_cm: "Muslo izq.",
  thigh_right_cm: "Muslo der.",
  calf_left_cm: "Pantorrilla izq.",
  calf_right_cm: "Pantorrilla der.",
  arm_left_cm: "Brazo izq.",
  arm_right_cm: "Brazo der.",
  back_cm: "Espalda",
};

type DetailField = {
  key: string;
  label: string;
  type?: "text" | "number" | "select" | "textarea" | "date";
  options?: string[];
  hint?: string;
};

/** Campos clínicos propios de cada especialidad. */
const DETAIL_FIELDS: Record<AssessmentCategory, DetailField[]> = {
  corporal: [
    { key: "zonas", label: "Zonas a tratar", hint: "Ej.: abdomen, flancos, muslos" },
    { key: "adiposidad", label: "Adiposidad localizada", type: "select", options: ["Leve", "Moderada", "Severa"] },
    { key: "celulitis", label: "Grado de celulitis", type: "select", options: ["0 — ninguna", "I", "II", "III", "IV"] },
    { key: "flacidez", label: "Flacidez", type: "select", options: ["Leve", "Moderada", "Severa"] },
    { key: "retencion", label: "Retención de líquidos", type: "select", options: ["No", "Leve", "Moderada", "Alta"] },
    { key: "habitos", label: "Hábitos (dieta / ejercicio)", type: "textarea" },
  ],
  laser: [
    { key: "zonas", label: "Zonas a tratar", hint: "Ej.: axilas, piernas, bozo" },
    {
      key: "fototipo",
      label: "Fototipo (Fitzpatrick)",
      type: "select",
      options: ["I", "II", "III", "IV", "V", "VI"],
    },
    { key: "color_vello", label: "Color del vello", type: "select", options: ["Negro", "Castaño", "Rubio", "Pelirrojo", "Canoso"] },
    { key: "grosor_vello", label: "Grosor del vello", type: "select", options: ["Fino", "Medio", "Grueso"] },
    { key: "densidad", label: "Densidad", type: "select", options: ["Baja", "Media", "Alta"] },
    { key: "potencia", label: "Potencia (J/cm²)", type: "number" },
    { key: "frecuencia", label: "Frecuencia (Hz)", type: "number" },
    { key: "ancho_pulso", label: "Ancho de pulso (ms)", type: "number" },
    { key: "reduccion_pct", label: "Reducción estimada (%)", type: "number" },
    { key: "reacciones", label: "Reacciones observadas", type: "textarea" },
  ],
  facial: [
    { key: "tipo_piel", label: "Tipo de piel", type: "select", options: ["Normal", "Seca", "Mixta", "Grasa", "Sensible"] },
    { key: "hidratacion", label: "Hidratación", type: "select", options: ["Baja", "Media", "Alta"] },
    { key: "seborrea", label: "Seborrea", type: "select", options: ["Leve", "Moderada", "Severa"] },
    { key: "manchas", label: "Manchas / hiperpigmentación", type: "select", options: ["No", "Leve", "Moderada", "Severa"] },
    { key: "arrugas", label: "Arrugas / líneas", type: "select", options: ["No", "Finas", "Moderadas", "Profundas"] },
    { key: "poros", label: "Poros dilatados", type: "select", options: ["No", "Leve", "Moderado", "Severo"] },
    { key: "acne", label: "Acné / lesiones", type: "select", options: ["No", "Comedones", "Pápulas", "Pústulas", "Quístico"] },
    { key: "firmeza", label: "Firmeza", type: "select", options: ["Buena", "Regular", "Baja"] },
    { key: "rosacea", label: "Rosácea / enrojecimiento", type: "select", options: ["No", "Leve", "Moderado", "Severo"] },
  ],
  postquirurgico: [
    { key: "tipo_cirugia", label: "Tipo de cirugía", hint: "Ej.: lipoescultura, abdominoplastia" },
    { key: "fecha_cirugia", label: "Fecha de la cirugía", type: "date" },
    { key: "inflamacion", label: "Inflamación (0–5)", type: "select", options: ["0", "1", "2", "3", "4", "5"] },
    { key: "fibrosis", label: "Fibrosis (0–5)", type: "select", options: ["0", "1", "2", "3", "4", "5"] },
    { key: "seroma", label: "Seroma", type: "select", options: ["No", "Sí"] },
    { key: "dolor", label: "Dolor (0–10)", type: "number" },
    { key: "movilidad", label: "Movilidad", type: "select", options: ["Normal", "Limitada", "Muy limitada"] },
    { key: "cicatrizacion", label: "Cicatrización", type: "select", options: ["Buena", "Regular", "Con complicaciones"] },
    { key: "prendas", label: "Uso de faja / prendas de compresión", type: "select", options: ["Sí", "No", "Parcial"] },
  ],
};

const CATEGORY_LABELS: Record<AssessmentCategory, string> = {
  corporal: "Corporal / reductor",
  laser: "Depilación láser",
  facial: "Facial",
  postquirurgico: "Postquirúrgico",
};

/** Deduce la especialidad a partir del nombre del servicio. */
export function guessCategory(serviceName?: string | null): AssessmentCategory {
  const n = (serviceName ?? "").toLowerCase();
  if (/l[áa]ser|laser|depilaci/.test(n)) return "laser";
  if (/facial|limpieza|peeling|hidrataci/.test(n)) return "facial";
  if (/postquir|post-?quir|post\s?op|drenaje|cicatr/.test(n)) return "postquirurgico";
  return "corporal";
}

export type AssessmentValues = {
  weight_kg: string;
  height_cm: string;
  body_fat_pct: string;
  muscle_mass_pct: string;
  blood_pressure: string;
  measures: Record<MeasureField, string>;
  details: Record<string, string>;
  notes: string;
  photo_front: string | null;
  photo_side: string | null;
  photo_back: string | null;
};

const emptyMeasures = () =>
  Object.fromEntries(MEASURE_FIELDS.map((f) => [f, ""])) as Record<MeasureField, string>;

function toValues(a?: Assessment | null): AssessmentValues {
  const measures = emptyMeasures();
  if (a) for (const f of MEASURE_FIELDS) measures[f] = a[f] != null ? String(a[f]) : "";
  return {
    weight_kg: a?.weight_kg != null ? String(a.weight_kg) : "",
    height_cm: a?.height_cm != null ? String(a.height_cm) : "",
    body_fat_pct: a?.body_fat_pct != null ? String(a.body_fat_pct) : "",
    muscle_mass_pct: a?.muscle_mass_pct != null ? String(a.muscle_mass_pct) : "",
    blood_pressure: a?.blood_pressure ?? "",
    measures,
    details: a?.details ?? {},
    notes: a?.notes ?? "",
    photo_front: a?.photo_front ?? null,
    photo_side: a?.photo_side ?? null,
    photo_back: a?.photo_back ?? null,
  };
}

const num = (v: string): number | null => {
  const n = Number(String(v).replace(",", "."));
  return v.trim() === "" || Number.isNaN(n) ? null : n;
};

/** Reduce la foto antes de guardarla para no enviar megas al servidor. */
async function compressImage(file: File, maxSide = 1280, quality = 0.72): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", quality);
}

export function AssessmentForm({
  stage,
  category: initialCategory,
  clientName,
  serviceName,
  existing,
  baseline,
  saving,
  onSave,
  onClose,
}: {
  stage: AssessmentStage;
  category: AssessmentCategory;
  clientName: string;
  serviceName?: string | null;
  /** Ficha ya guardada de esta etapa, para poder editarla. */
  existing?: Assessment | null;
  /** Ficha inicial: en la etapa final se muestra la comparación contra ella. */
  baseline?: Assessment | null;
  saving?: boolean;
  onSave: (payload: {
    category: AssessmentCategory;
    values: ReturnType<typeof buildPayload>;
  }) => void;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<AssessmentCategory>(existing?.category ?? initialCategory);
  const [v, setV] = useState<AssessmentValues>(() => toValues(existing));
  const isFinal = stage === "final";

  const set = <K extends keyof AssessmentValues>(k: K, value: AssessmentValues[K]) =>
    setV((prev) => ({ ...prev, [k]: value }));
  const setMeasure = (f: MeasureField, value: string) =>
    setV((prev) => ({ ...prev, measures: { ...prev.measures, [f]: value } }));
  const setDetail = (k: string, value: string) =>
    setV((prev) => ({ ...prev, details: { ...prev.details, [k]: value } }));

  const bmi = useMemo(() => {
    const w = num(v.weight_kg);
    const h = num(v.height_cm);
    if (!w || !h) return null;
    return w / (h / 100) ** 2;
  }, [v.weight_kg, v.height_cm]);

  const totalDiff = useMemo(() => {
    if (!isFinal || !baseline) return null;
    let before = 0;
    let after = 0;
    let counted = 0;
    for (const f of MEASURE_FIELDS) {
      const b = baseline[f];
      const a = num(v.measures[f]);
      if (b == null || a == null) continue;
      before += Number(b);
      after += a;
      counted++;
    }
    return counted ? { before, after, diff: after - before, counted } : null;
  }, [isFinal, baseline, v.measures]);

  const detailFields = DETAIL_FIELDS[category];

  return (
    <Modal
      title={isFinal ? "Valoración final — resultados" : "Valoración inicial — cómo inicia"}
      onClose={onClose}
      wide
    >
      <div className="space-y-6">
        <div className="rounded-xl bg-secondary/60 px-4 py-3 text-sm">
          <div className="font-medium">{clientName}</div>
          <div className="text-xs text-muted-foreground">
            {serviceName ? `${serviceName} · ` : ""}
            {isFinal
              ? "Última sesión. Registra las medidas finales y la foto del después."
              : "Primera sesión. Registra el punto de partida y la foto del antes."}
          </div>
        </div>

        <section>
          <label className="text-xs font-medium text-foreground/80">Tipo de valoración</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_LABELS) as AssessmentCategory[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium border transition ${
                  category === c
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-secondary"
                }`}
              >
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle icon={Ruler}>Datos generales</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Num label="Peso (kg)" value={v.weight_kg} onChange={(x) => set("weight_kg", x)} before={baseline?.weight_kg} isFinal={isFinal} lowerIsBetter />
            <Num label="Estatura (cm)" value={v.height_cm} onChange={(x) => set("height_cm", x)} />
            <div>
              <span className="text-xs font-medium text-foreground/80">IMC</span>
              <div className={`${inputClass} mt-1 bg-secondary/50 flex items-center justify-between`}>
                <span>{bmi ? bmi.toFixed(1) : "—"}</span>
                {bmi && <span className="text-[10px] text-muted-foreground">{bmiLabel(bmi)}</span>}
              </div>
            </div>
            <Num label="% grasa" value={v.body_fat_pct} onChange={(x) => set("body_fat_pct", x)} before={baseline?.body_fat_pct} isFinal={isFinal} lowerIsBetter />
            <Num label="% masa muscular" value={v.muscle_mass_pct} onChange={(x) => set("muscle_mass_pct", x)} before={baseline?.muscle_mass_pct} isFinal={isFinal} />
          </div>
          <div className="mt-3 max-w-[12rem]">
            <span className="text-xs font-medium text-foreground/80">Presión arterial</span>
            <input
              className={`${inputClass} mt-1`}
              placeholder="120/80"
              value={v.blood_pressure}
              onChange={(e) => set("blood_pressure", e.target.value)}
            />
          </div>
        </section>

        <section>
          <SectionTitle icon={Ruler}>Medidas corporales (cm)</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {MEASURE_FIELDS.map((f) => (
              <Num
                key={f}
                label={MEASURE_LABELS[f]}
                value={v.measures[f]}
                onChange={(x) => setMeasure(f, x)}
                before={baseline?.[f]}
                isFinal={isFinal}
                lowerIsBetter
              />
            ))}
          </div>
          {totalDiff && (
            <div
              className={`mt-3 rounded-xl px-4 py-3 text-sm ${
                totalDiff.diff <= 0 ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"
              }`}
            >
              <span className="font-semibold">
                {totalDiff.diff <= 0 ? "Reducción total" : "Aumento total"}: {Math.abs(totalDiff.diff).toFixed(1)} cm
              </span>{" "}
              <span className="text-xs opacity-80">
                ({totalDiff.counted} medidas comparadas · {totalDiff.before.toFixed(1)} → {totalDiff.after.toFixed(1)} cm)
              </span>
            </div>
          )}
        </section>

        <section>
          <SectionTitle>Valoración de {CATEGORY_LABELS[category].toLowerCase()}</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {detailFields.map((f) => (
              <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2 lg:col-span-3" : ""}>
                <span className="text-xs font-medium text-foreground/80">{f.label}</span>
                {f.type === "select" ? (
                  <select
                    className={`${inputClass} mt-1`}
                    value={v.details[f.key] ?? ""}
                    onChange={(e) => setDetail(f.key, e.target.value)}
                  >
                    <option value="">—</option>
                    {f.options?.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    rows={2}
                    className={`${inputClass} mt-1`}
                    value={v.details[f.key] ?? ""}
                    onChange={(e) => setDetail(f.key, e.target.value)}
                  />
                ) : (
                  <input
                    type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                    step={f.type === "number" ? "0.1" : undefined}
                    className={`${inputClass} mt-1`}
                    placeholder={f.hint}
                    value={v.details[f.key] ?? ""}
                    onChange={(e) => setDetail(f.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle icon={Camera}>
            Registro fotográfico — {isFinal ? "DESPUÉS" : "ANTES"}
          </SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <PhotoSlot
              label="Frente"
              value={v.photo_front}
              compare={isFinal ? baseline?.photo_front : null}
              onChange={(x) => set("photo_front", x)}
            />
            <PhotoSlot
              label="Perfil"
              value={v.photo_side}
              compare={isFinal ? baseline?.photo_side : null}
              onChange={(x) => set("photo_side", x)}
            />
            <PhotoSlot
              label="Espalda"
              value={v.photo_back}
              compare={isFinal ? baseline?.photo_back : null}
              onChange={(x) => set("photo_back", x)}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            En celular o tablet se abre la cámara directamente. Las fotos se comprimen automáticamente.
          </p>
        </section>

        <section>
          <SectionTitle>Observaciones</SectionTitle>
          <textarea
            rows={3}
            className={inputClass}
            placeholder="Antecedentes, contraindicaciones, recomendaciones…"
            value={v.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </section>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end border-t border-border pt-4">
          <button type="button" className={btnGhost} onClick={onClose}>
            Ahora no
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={saving}
            onClick={() => onSave({ category, values: buildPayload(v) })}
          >
            {saving ? "Guardando…" : "Guardar ficha"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Convierte el formulario (texto) a los tipos que espera el servidor. */
export function buildPayload(v: AssessmentValues) {
  const measures = Object.fromEntries(MEASURE_FIELDS.map((f) => [f, num(v.measures[f])])) as Record<
    MeasureField,
    number | null
  >;
  const details = Object.fromEntries(
    Object.entries(v.details).filter(([, val]) => String(val).trim() !== ""),
  ) as Record<string, string>;
  return {
    weight_kg: num(v.weight_kg),
    height_cm: num(v.height_cm),
    body_fat_pct: num(v.body_fat_pct),
    muscle_mass_pct: num(v.muscle_mass_pct),
    blood_pressure: v.blood_pressure.trim() || null,
    ...measures,
    details,
    notes: v.notes.trim() || null,
    photo_front: v.photo_front,
    photo_side: v.photo_side,
    photo_back: v.photo_back,
  };
}

function bmiLabel(bmi: number) {
  if (bmi < 18.5) return "Bajo";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Sobrepeso";
  return "Obesidad";
}

function SectionTitle({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <h3 className="mb-3 flex items-center gap-2 font-serif text-lg">
      {Icon && <Icon className="h-4 w-4 text-primary" />}
      {children}
    </h3>
  );
}

/** Campo numérico que, en la ficha final, muestra la diferencia contra la inicial. */
function Num({
  label,
  value,
  onChange,
  before,
  isFinal,
  lowerIsBetter,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  before?: number | null;
  isFinal?: boolean;
  lowerIsBetter?: boolean;
}) {
  const after = num(value);
  const showDiff = isFinal && before != null && after != null;
  const diff = showDiff ? after - Number(before) : 0;
  const good = lowerIsBetter ? diff < 0 : diff > 0;
  return (
    <div>
      <span className="text-xs font-medium text-foreground/80">{label}</span>
      <input
        type="number"
        step="0.1"
        min="0"
        inputMode="decimal"
        className={`${inputClass} mt-1`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {isFinal && before != null && (
        <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
          <span>Inicial: {Number(before)}</span>
          {showDiff && diff !== 0 && (
            <span className={`inline-flex items-center gap-0.5 font-semibold ${good ? "text-emerald-600" : "text-amber-600"}`}>
              {diff < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
              {diff > 0 ? "+" : ""}
              {diff.toFixed(1)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function PhotoSlot({
  label,
  value,
  compare,
  onChange,
}: {
  label: string;
  value: string | null;
  compare?: string | null;
  onChange: (v: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await compressImage(file));
    } catch {
      onChange(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground/80">{label}</span>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Quitar foto ${label}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {compare && (
        <div className="mt-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Antes</div>
          <img src={compare} alt={`${label} antes`} className="mt-1 w-full rounded-lg object-cover" />
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="mt-2 block w-full overflow-hidden rounded-lg border border-dashed border-input hover:bg-secondary/50 disabled:opacity-60"
      >
        {value ? (
          <img src={value} alt={label} className="w-full object-cover" />
        ) : (
          <span className="flex h-28 flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
            <Camera className="h-5 w-5" />
            {busy ? "Procesando…" : "Tomar o subir foto"}
          </span>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
