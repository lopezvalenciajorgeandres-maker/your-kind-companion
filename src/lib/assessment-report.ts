import {
  MEASURE_FIELDS,
  type Assessment,
  type AssessmentCategory,
  type MeasureField,
} from "./assessments.functions";

export const MEASURE_LABELS: Record<MeasureField, string> = {
  neck_cm: "Cuello",
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

export type Row = {
  label: string;
  unit: string;
  before: number;
  after: number;
  diff: number;
  pct: number;
  /** true cuando bajar es el resultado deseado (medidas, grasa, peso). */
  lowerIsBetter: boolean;
};

export type ReportData = {
  category: AssessmentCategory;
  vitals: Row[];
  measures: Row[];
  totalCm: { before: number; after: number; diff: number; count: number } | null;
  /** Zonas con mayor y menor cambio, para orientar las próximas sesiones. */
  best: Row | null;
  worst: Row | null;
  daysBetween: number | null;
  photos: { label: string; before: string | null; after: string | null }[];
};

const n = (v: unknown): number | null => {
  const x = Number(v);
  return v == null || Number.isNaN(x) ? null : x;
};

function row(
  label: string,
  unit: string,
  before: unknown,
  after: unknown,
  lowerIsBetter: boolean,
): Row | null {
  const b = n(before);
  const a = n(after);
  if (b == null || a == null) return null;
  const diff = a - b;
  return { label, unit, before: b, after: a, diff, pct: b ? (diff / b) * 100 : 0, lowerIsBetter };
}

export function buildReport(inicial: Assessment, final: Assessment): ReportData {
  const vitals = [
    row("Peso", "kg", inicial.weight_kg, final.weight_kg, true),
    row("Grasa corporal", "%", inicial.body_fat_pct, final.body_fat_pct, true),
    row("Masa muscular", "%", inicial.muscle_mass_pct, final.muscle_mass_pct, false),
  ].filter(Boolean) as Row[];

  const imcRow = (() => {
    const bw = n(inicial.weight_kg);
    const bh = n(inicial.height_cm);
    const aw = n(final.weight_kg);
    const ah = n(final.height_cm) ?? bh;
    if (!bw || !bh || !aw || !ah) return null;
    return row("IMC", "", bw / (bh / 100) ** 2, aw / (ah / 100) ** 2, true);
  })();
  if (imcRow) vitals.splice(1, 0, imcRow);

  const measures = MEASURE_FIELDS.map((f) =>
    row(MEASURE_LABELS[f], "cm", inicial[f], final[f], true),
  ).filter(Boolean) as Row[];

  const totalCm = measures.length
    ? {
        before: measures.reduce((s, r) => s + r.before, 0),
        after: measures.reduce((s, r) => s + r.after, 0),
        diff: measures.reduce((s, r) => s + r.diff, 0),
        count: measures.length,
      }
    : null;

  const sorted = [...measures].sort((a, b) => a.pct - b.pct);
  const daysBetween = (() => {
    const b = new Date(inicial.recorded_at).getTime();
    const a = new Date(final.recorded_at).getTime();
    if (Number.isNaN(b) || Number.isNaN(a)) return null;
    return Math.max(0, Math.round((a - b) / 86_400_000));
  })();

  return {
    category: final.category,
    vitals,
    measures,
    totalCm,
    best: sorted[0] ?? null,
    worst: sorted[sorted.length - 1] ?? null,
    daysBetween,
    photos: [
      { label: "Frente", before: inicial.photo_front, after: final.photo_front },
      { label: "Perfil", before: inicial.photo_side, after: final.photo_side },
      { label: "Espalda", before: inicial.photo_back, after: final.photo_back },
    ].filter((p) => p.before || p.after),
  };
}

const fmt = (x: number, unit: string) =>
  `${x > 0 ? "+" : ""}${x.toFixed(1)}${unit ? (unit === "%" ? "%" : ` ${unit}`) : ""}`;

/** Texto para la clienta: resultados en lenguaje claro y hábitos para mantenerlos. */
export function clientRecommendations(r: ReportData, clientName: string): string {
  const lines: string[] = [];
  const first = clientName.split(" ")[0] || "";
  lines.push(`Hola ${first}, este es el resumen de tu proceso.`);
  lines.push("");

  lines.push("TUS RESULTADOS");
  if (r.totalCm) {
    lines.push(
      r.totalCm.diff < 0
        ? `· Reduciste ${Math.abs(r.totalCm.diff).toFixed(1)} cm en total entre todas las zonas medidas.`
        : r.totalCm.diff > 0
          ? `· Tus medidas aumentaron ${r.totalCm.diff.toFixed(1)} cm en total.`
          : "· Tus medidas se mantuvieron estables.",
    );
  }
  for (const v of r.vitals) {
    if (Math.abs(v.diff) < 0.05) continue;
    const bajo = v.diff < 0;
    if (v.label === "Peso") lines.push(`· Peso: ${bajo ? "bajaste" : "subiste"} ${Math.abs(v.diff).toFixed(1)} kg.`);
    if (v.label === "Grasa corporal")
      lines.push(`· Grasa corporal: ${bajo ? "bajó" : "subió"} ${Math.abs(v.diff).toFixed(1)} puntos.`);
    if (v.label === "Masa muscular")
      lines.push(`· Masa muscular: ${bajo ? "bajó" : "subió"} ${Math.abs(v.diff).toFixed(1)} puntos.`);
  }
  if (r.best && r.best.diff < 0) {
    lines.push(`· Tu mejor zona fue ${r.best.label.toLowerCase()}: ${fmt(r.best.diff, "cm")}.`);
  }
  lines.push("");

  lines.push("RECOMENDACIONES PARA MANTENER TUS RESULTADOS");
  const common = [
    "Toma entre 6 y 8 vasos de agua al día: ayuda a eliminar lo movilizado en las sesiones.",
    "Camina al menos 30 minutos diarios o realiza actividad física 3 veces por semana.",
    "Cuida tus horarios de comida y reduce ultraprocesados, azúcar y exceso de sal.",
    "Duerme entre 7 y 8 horas: el descanso influye directamente en tus resultados.",
  ];
  const byCategory: Record<AssessmentCategory, string[]> = {
    corporal: [
      "Evita permanecer muchas horas sentada sin moverte; levántate cada hora.",
      "Los masajes de mantenimiento cada 15 o 20 días ayudan a sostener lo logrado.",
      "Usa cremas reafirmantes con masaje ascendente después del baño.",
    ],
    laser: [
      "No te expongas al sol directo en las zonas tratadas durante las próximas 2 semanas.",
      "Usa protector solar FPS 50 a diario en las zonas descubiertas.",
      "No depiles con cera ni pinzas entre sesiones: solo rasura si lo necesitas.",
      "Hidrata la piel a diario y evita sauna, piscina y ejercicio intenso 48 horas después de cada sesión.",
    ],
    facial: [
      "Limpia tu rostro mañana y noche con un producto adecuado para tu tipo de piel.",
      "Usa protector solar FPS 50 todos los días, incluso en casa o con día nublado.",
      "No manipules lesiones ni comedones: puede dejar marcas.",
      "Mantén la hidratación y evita cambiar de productos sin asesoría.",
    ],
    postquirurgico: [
      "Usa tu faja o prenda de compresión según las indicaciones de tu cirujano.",
      "Evita esfuerzos y cargar peso hasta que tu médico lo autorice.",
      "Mantén una dieta rica en proteína para favorecer la cicatrización.",
      "Asiste puntualmente a tus controles médicos y a las sesiones de drenaje.",
    ],
  };
  for (const t of [...byCategory[r.category], ...common]) lines.push(`· ${t}`);
  lines.push("");
  lines.push("Gracias por confiar en nosotros. Cualquier duda, escríbenos.");
  return lines.join("\n");
}

/** Texto para la esteticista: lectura clínica y plan para las próximas sesiones. */
export function staffRecommendations(r: ReportData): string {
  const lines: string[] = [];

  lines.push("LECTURA DE RESULTADOS");
  if (r.daysBetween != null) lines.push(`· Duración del proceso: ${r.daysBetween} días entre valoración inicial y final.`);
  if (r.totalCm) {
    const pct = r.totalCm.before ? (r.totalCm.diff / r.totalCm.before) * 100 : 0;
    lines.push(
      `· Perímetro total: ${r.totalCm.before.toFixed(1)} → ${r.totalCm.after.toFixed(1)} cm (${fmt(r.totalCm.diff, "cm")}, ${pct.toFixed(1)}%) en ${r.totalCm.count} zonas.`,
    );
  }
  for (const v of r.vitals) {
    lines.push(`· ${v.label}: ${v.before.toFixed(1)} → ${v.after.toFixed(1)} (${fmt(v.diff, v.unit)}).`);
  }
  if (r.best) lines.push(`· Mejor respuesta: ${r.best.label} (${fmt(r.best.diff, "cm")}, ${r.best.pct.toFixed(1)}%).`);
  if (r.worst && r.worst.pct > -1)
    lines.push(`· Menor respuesta: ${r.worst.label} (${fmt(r.worst.diff, "cm")}, ${r.worst.pct.toFixed(1)}%).`);
  lines.push("");

  lines.push("VALORACIÓN");
  const totalPct = r.totalCm && r.totalCm.before ? (r.totalCm.diff / r.totalCm.before) * 100 : 0;
  const muscle = r.vitals.find((v) => v.label === "Masa muscular");
  const fat = r.vitals.find((v) => v.label === "Grasa corporal");
  if (totalPct <= -5) lines.push("· Respuesta muy favorable al protocolo aplicado.");
  else if (totalPct < -1.5) lines.push("· Respuesta favorable, dentro de lo esperado.");
  else if (totalPct < 0) lines.push("· Respuesta discreta: los cambios son leves.");
  else lines.push("· Sin reducción medible. Revisar adherencia, técnica y frecuencia.");

  if (fat && muscle && fat.diff < 0 && muscle.diff > 0)
    lines.push("· Recomposición corporal correcta: baja grasa y sube músculo.");
  else if (fat && fat.diff > 0.5)
    lines.push("· Aumento de grasa corporal: reforzar la pauta nutricional y de actividad física.");
  if (muscle && muscle.diff < -0.5)
    lines.push("· Pérdida de masa muscular: sugerir ingesta proteica y trabajo de fuerza.");
  lines.push("");

  lines.push("PLAN PARA LAS PRÓXIMAS SESIONES");
  const plan: Record<AssessmentCategory, string[]> = {
    corporal: [
      "Insistir en las zonas de menor respuesta aumentando el tiempo de trabajo.",
      "Alternar técnica manual con aparatología según disponibilidad y tolerancia.",
      "Mantener frecuencia de 2 sesiones por semana; espaciar a 1 en mantenimiento.",
      "Reforzar drenaje al cierre de cada sesión.",
    ],
    laser: [
      "Revisar los parámetros usados frente al fototipo y al porcentaje de reducción obtenido.",
      "Si la reducción es menor a la esperada, valorar subir energía de forma progresiva con prueba previa.",
      "Respetar el intervalo entre sesiones según la fase del vello en cada zona.",
      "Registrar siempre reacciones cutáneas y ajustar en la siguiente sesión.",
    ],
    facial: [
      "Ajustar activos según la evolución de manchas, textura e hidratación.",
      "Valorar sumar peeling o aparatología si la piel lo tolera.",
      "Reforzar rutina domiciliaria: la constancia en casa define el resultado.",
      "Programar mantenimiento mensual.",
    ],
    postquirurgico: [
      "Continuar drenaje linfático según evolución de inflamación y fibrosis.",
      "Insistir en las zonas fibrosadas con maniobras específicas y ultrasonido si está indicado.",
      "Verificar uso correcto de la prenda de compresión en cada control.",
      "Coordinar con el cirujano ante cualquier signo de alarma.",
    ],
  };
  for (const t of plan[r.category]) lines.push(`· ${t}`);
  lines.push("");
  lines.push("SEGUIMIENTO");
  lines.push("· Repetir medición en 30 días con el mismo método y puntos de referencia.");
  lines.push("· Tomar las fotos con la misma luz, distancia y postura para que la comparación sea válida.");
  return lines.join("\n");
}
